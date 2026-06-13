"use client";

import { useState, useMemo, useCallback } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductCombobox, type ProductOption } from "@/components/ui/product-combobox";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { preventDecimalInput } from "@/lib/utils";
import type { PurchaseOrder } from "@/lib/types";

// ── Schema ────────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  product_id:  z.string().optional(),
  description: z.string().min(1, "Description required"),
  quantity:    z.coerce.number().int("Quantity must be a whole number").min(1, "Must be ≥ 1"),
  unit_cost:   z.coerce.number().min(0, "Must be ≥ 0"),
  tax_rate:    z.coerce.number().min(0).max(100),
});

const poSchema = z.object({
  vendor_id:     z.string().min(1, "Vendor required"),
  po_date:       z.string().min(1, "Date required"),
  expected_date: z.string().optional(),
  // partial / received are receive-driven — not settable via form
  status:        z.enum(["draft", "sent"]),
  notes:         z.string().optional(),
  items:         z.array(itemSchema).min(1, "Add at least one line item"),
});

type POFormData = z.infer<typeof poSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_LABELS = { draft: "Draft", sent: "Sent" };
const COMMON_TAX_RATES = [0, 5, 12, 18, 28];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  po?:       PurchaseOrder | null;
  onSuccess: (id: string) => void;
  onCancel?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function POForm({ po, onSuccess, onCancel }: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];

  const initialStatus = (): "draft" | "sent" => {
    const s = po?.status;
    if (s === "sent") return "sent";
    return "draft";
  };

  const defaultItems =
    po?.items?.map(it => ({
      product_id:  it.product_id ?? "",
      description: it.description,
      quantity:    it.quantity,
      unit_cost:   it.unit_cost,
      tax_rate:    it.tax_rate,
    })) ??
    [{ product_id: "", description: "", quantity: 1, unit_cost: 0, tax_rate: 18 }];

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<POFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(poSchema) as any,
    defaultValues: {
      vendor_id:     po?.vendor_id     ?? "",
      po_date:       po?.po_date       ?? today,
      expected_date: po?.expected_date ?? "",
      status:        initialStatus(),
      notes:         po?.notes         ?? "",
      items:         defaultItems,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-active"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("vendors")
        .select("id, name, company_name")
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
    staleTime: 60000,
  });

  const { data: rawProducts = [] } = useQuery({
    queryKey: ["products-for-po"],
    queryFn: async () => {
      const supabase = createClient();
      const [{ data: prods }, { data: stocks }] = await Promise.all([
        supabase
          .from("products")
          .select("id, sku, name, cost_price, selling_price, tax_rate, reorder_point, brand:brands(id,name), category:categories(id,name)")
          .is("deleted_at", null)
          .eq("is_active", true)
          .order("name"),
        supabase.from("stock_levels").select("product_id, quantity"),
      ]);
      // Aggregate stock across all locations for each product
      const stockMap = new Map<string, number>();
      for (const s of stocks ?? []) {
        stockMap.set(s.product_id, (stockMap.get(s.product_id) ?? 0) + s.quantity);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (prods ?? []).map((p: any) => ({
        id: p.id, sku: p.sku, name: p.name,
        brand:         p.brand?.name    ?? undefined,
        category:      p.category?.name ?? undefined,
        cost_price:    p.cost_price     ?? null,
        selling_price: p.selling_price  ?? null,
        currentStock:  stockMap.get(p.id) ?? 0,
        reorderPoint:  p.reorder_point  ?? undefined,
        tax_rate:      p.tax_rate       ?? 18,
      }));
    },
    staleTime: 60000,
  });

  const products: ProductOption[] = rawProducts;

  const taxRateByProduct = useMemo(() => {
    const m = new Map<string, number>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of rawProducts as any[]) m.set(p.id, p.tax_rate ?? 18);
    return m;
  }, [rawProducts]);

  // ── Reactive totals ───────────────────────────────────────────────────────

  const watchedItems = useWatch({ control, name: "items" }) ?? [];
  const totals = useMemo(() => {
    let subtotal  = 0;
    let taxAmount = 0;
    for (const item of watchedItems) {
      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0);
      subtotal  += lineTotal;
      taxAmount += lineTotal * (Number(item.tax_rate) || 0) / 100;
    }
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  }, [watchedItems]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const currentStatus = watch("status");
  const vendorId      = watch("vendor_id");

  const onProductSelect = useCallback(
    (index: number, productId: string, product: ProductOption | null) => {
      setValue(`items.${index}.product_id`, productId);
      if (product) {
        if (!watch(`items.${index}.description`)) {
          setValue(`items.${index}.description`, product.name);
        }
        // Use cost price for PO (what we pay the vendor)
        setValue(`items.${index}.unit_cost`,  product.cost_price ?? 0);
        setValue(`items.${index}.tax_rate`,   taxRateByProduct.get(productId) ?? 18);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setValue, taxRateByProduct],
  );

  // ── Submit ────────────────────────────────────────────────────────────────

  async function onSubmit(values: POFormData) {
    setSubmitError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { subtotal, taxAmount: tax_amount, total: total_amount } = totals;

    if (po) {
      // ── Edit mode ──────────────────────────────────────────────────────────

      // Safety: block edit if goods were received since page load (race condition guard)
      const { data: currentItems } = await supabase
        .from("purchase_order_items")
        .select("id, received_qty")
        .eq("purchase_order_id", po.id)
        .gt("received_qty", 0)
        .limit(1);
      if (currentItems && currentItems.length > 0) {
        setSubmitError("Cannot edit: goods have already been received against this PO. View the PO to check its current status.");
        return;
      }

      const { error: poErr } = await supabase
        .from("purchase_orders")
        .update({
          vendor_id:     values.vendor_id,
          po_date:       values.po_date,
          expected_date: values.expected_date || null,
          status:        values.status,
          notes:         values.notes || null,
          subtotal, tax_amount, total_amount,
        })
        .eq("id", po.id);
      if (poErr) { setSubmitError(poErr.message); return; }

      // Replace items
      const { error: delErr } = await supabase
        .from("purchase_order_items")
        .delete()
        .eq("purchase_order_id", po.id);
      if (delErr) { setSubmitError(delErr.message); return; }

      const { error: insErr } = await supabase
        .from("purchase_order_items")
        .insert(
          values.items.map((it, i) => ({
            purchase_order_id: po.id,
            product_id:        it.product_id || null,
            description:       it.description,
            quantity:          it.quantity,
            received_qty:      0,
            unit_cost:         it.unit_cost,
            tax_rate:          it.tax_rate,
            line_total:        it.quantity * it.unit_cost,
            sort_order:        i,
          }))
        );
      if (insErr) { setSubmitError(insErr.message); return; }

      onSuccess(po.id);

    } else {
      // ── Create mode ────────────────────────────────────────────────────────
      const { data: poData, error: poErr } = await supabase
        .from("purchase_orders")
        .insert({
          vendor_id:     values.vendor_id,
          po_date:       values.po_date,
          expected_date: values.expected_date || null,
          status:        values.status,
          notes:         values.notes || null,
          subtotal, tax_amount, total_amount,
          po_number:     "",   // trigger overwrites this
          created_by:    user?.id ?? null,
        })
        .select("id, po_number")
        .single();
      if (poErr) { setSubmitError(poErr.message); return; }

      const { error: insErr } = await supabase
        .from("purchase_order_items")
        .insert(
          values.items.map((it, i) => ({
            purchase_order_id: poData.id,
            product_id:        it.product_id || null,
            description:       it.description,
            quantity:          it.quantity,
            received_qty:      0,
            unit_cost:         it.unit_cost,
            tax_rate:          it.tax_rate,
            line_total:        it.quantity * it.unit_cost,
            sort_order:        i,
          }))
        );
      if (insErr) {
        // Roll back the PO header if items fail
        await supabase.from("purchase_orders").delete().eq("id", poData.id);
        setSubmitError(insErr.message);
        return;
      }

      onSuccess(poData.id);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* ── PO Details ──────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Purchase Order Details</h3>

        <div className="space-y-1">
          <Label>Vendor *</Label>
          <Select
            value={vendorId}
            onValueChange={v => setValue("vendor_id", v, { shouldValidate: true })}
          >
            <SelectTrigger className={errors.vendor_id ? "border-destructive" : ""}>
              <SelectValue placeholder="Select vendor…" />
            </SelectTrigger>
            <SelectContent>
              {vendors.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                  {v.company_name && (
                    <span className="text-muted-foreground ml-1 text-xs">— {v.company_name}</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.vendor_id && (
            <p className="text-xs text-destructive">{errors.vendor_id.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>PO Date *</Label>
            <Input type="date" {...register("po_date")} />
            {errors.po_date && (
              <p className="text-xs text-destructive">{errors.po_date.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Expected Delivery</Label>
            <Input type="date" {...register("expected_date")} />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={currentStatus}
              onValueChange={v => setValue("status", v as POFormData["status"])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Partial / Received update when goods are received.
            </p>
          </div>
        </div>
      </div>

      {/* ── Line Items ──────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Line Items</h3>
          <Button
            type="button" size="sm" variant="outline"
            onClick={() => append({ product_id: "", description: "", quantity: 1, unit_cost: 0, tax_rate: 18 })}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />Add Line
          </Button>
        </div>

        {typeof errors.items?.message === "string" && (
          <p className="text-xs text-destructive">{errors.items.message}</p>
        )}

        {/* Header row */}
        <div className="hidden sm:grid grid-cols-[24px_1fr_1fr_110px_110px_90px_90px_32px] gap-2 px-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          <span /><span>Product</span><span>Description</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Unit Cost</span>
          <span className="text-right">Tax %</span>
          <span className="text-right">Total</span>
          <span />
        </div>

        <div className="space-y-3">
          {fields.map((field, i) => {
            const qty       = Number(watch(`items.${i}.quantity`))  || 0;
            const cost      = Number(watch(`items.${i}.unit_cost`)) || 0;
            const lineTotal = qty * cost;
            const prodId    = watch(`items.${i}.product_id`);

            return (
              <div
                key={field.id}
                className="grid grid-cols-1 sm:grid-cols-[24px_1fr_1fr_110px_110px_90px_90px_32px] gap-2 items-start p-3 sm:p-1 rounded-md border sm:border-0 bg-muted/20 sm:bg-transparent"
              >
                <div className="hidden sm:flex items-center justify-center pt-2 text-muted-foreground/40">
                  <GripVertical className="h-4 w-4" />
                </div>

                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">Product</Label>
                  <ProductCombobox
                    products={products}
                    value={prodId ?? ""}
                    onChange={(id, product) => onProductSelect(i, id, product)}
                    placeholder="Select product…"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">Description *</Label>
                  <Input {...register(`items.${i}.description`)} placeholder="Item description" />
                  {errors.items?.[i]?.description && (
                    <p className="text-xs text-destructive">{errors.items[i]?.description?.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">Qty</Label>
                  <Input
                    type="number" min={1} step={1}
                    onKeyDown={preventDecimalInput}
                    {...register(`items.${i}.quantity`)}
                    className="text-right"
                  />
                  {errors.items?.[i]?.quantity && (
                    <p className="text-xs text-destructive">{errors.items[i]?.quantity?.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">Unit Cost (₹)</Label>
                  <Input
                    type="number" min={0} step={0.01}
                    {...register(`items.${i}.unit_cost`)}
                    className="text-right"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">Tax %</Label>
                  <Select
                    value={String(watch(`items.${i}.tax_rate`) ?? 18)}
                    onValueChange={v => setValue(`items.${i}.tax_rate`, Number(v))}
                  >
                    <SelectTrigger className="text-right"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMMON_TAX_RATES.map(r => (
                        <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-end pt-2 text-sm font-medium tabular-nums">
                  {fmtINR(lineTotal)}
                </div>

                <div className="flex items-center justify-end pt-1">
                  <Button
                    type="button" size="sm" variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => { if (fields.length > 1) remove(i); }}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="border-t pt-4 flex justify-end">
          <div className="w-full sm:w-72 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium tabular-nums">{fmtINR(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST / Tax</span>
              <span className="font-medium tabular-nums">{fmtINR(totals.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-2">
              <span>Total</span>
              <span className="tabular-nums">{fmtINR(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Notes ───────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-5 space-y-2">
        <h3 className="text-sm font-semibold">Notes</h3>
        <textarea
          {...register("notes")}
          placeholder="Delivery instructions, payment terms, or any notes for the vendor…"
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                     placeholder:text-muted-foreground focus:outline-none focus:ring-2
                     focus:ring-ring focus:ring-offset-2 resize-none"
        />
      </div>

      {submitError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive whitespace-pre-wrap">
          {submitError}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : po ? "Update Purchase Order" : "Create Purchase Order"}
        </Button>
      </div>
    </form>
  );
}
