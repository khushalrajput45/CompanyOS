"use client";

import { useState, useMemo, useCallback } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/utils/logAudit";
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
import { CustomerCombobox, type CustomerOption } from "@/components/ui/customer-combobox";
import { ProductCombobox, type ProductOption } from "@/components/ui/product-combobox";
import { AddressCard } from "@/components/ui/address-card";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { cn, preventDecimalInput } from "@/lib/utils";
import type { Quotation } from "@/lib/types";

// ── Schema ────────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  product_id:  z.string().optional(),
  description: z.string().min(1, "Description required"),
  quantity:    z.coerce.number().int("Quantity must be a whole number").min(1, "Must be ≥ 1"),
  unit_price:  z.coerce.number().min(0, "Must be ≥ 0"),
  tax_rate:    z.coerce.number().min(0).max(100),
});

const quotationSchema = z.object({
  customer_id:     z.string().min(1, "Customer required"),
  quotation_date:  z.string().min(1, "Date required"),
  valid_until:     z.string().optional(),
  status:          z.enum(["draft", "sent", "accepted", "rejected", "expired"]),
  notes:           z.string().optional(),
  billing_address:  z.any().optional(),
  shipping_address: z.any().optional(),
  items: z.array(itemSchema).min(1, "Add at least one line item"),
});

type QuotationFormData = z.infer<typeof quotationSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", sent: "Sent", accepted: "Accepted",
  rejected: "Rejected", expired: "Expired",
};

const COMMON_TAX_RATES = [0, 5, 12, 18, 28];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  quotation?: Quotation | null;
  onSuccess: (id: string) => void;
  onCancel?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QuotationForm({ quotation, onSuccess, onCancel }: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const defaultValidUntil = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<QuotationFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(quotationSchema) as any,
    defaultValues: {
      customer_id:     quotation?.customer_id    ?? "",
      quotation_date:  quotation?.quotation_date ?? today,
      valid_until:     quotation?.valid_until    ?? defaultValidUntil,
      status:          quotation?.status         ?? "draft",
      notes:           quotation?.notes          ?? "",
      billing_address:  quotation?.billing_address  ?? null,
      shipping_address: quotation?.shipping_address ?? null,
      items: quotation?.items?.map(it => ({
        product_id:  it.product_id  ?? "",
        description: it.description,
        quantity:    it.quantity,
        unit_price:  it.unit_price,
        tax_rate:    it.tax_rate,
      })) ?? [{ product_id: "", description: "", quantity: 1, unit_price: 0, tax_rate: 18 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // ── Data queries ─────────────────────────────────────────────────────────
  const { data: customers = [] } = useQuery<CustomerOption[]>({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("customers")
        .select("id, name, company_name, phone, email, gst_number, address, city, state, pincode, shipping_address")
        .eq("is_active", true)
        .order("name");
      return (data ?? []) as CustomerOption[];
    },
  });

  const { data: rawProducts = [] } = useQuery({
    queryKey: ["products-for-movement"],
    queryFn: async () => {
      const supabase = createClient();
      const [{ data: prods }, { data: stocks }] = await Promise.all([
        supabase
          .from("products")
          .select("id, sku, name, selling_price, cost_price, tax_rate, reorder_point, brand:brands(id,name), category:categories(id,name)")
          .is("deleted_at", null)
          .eq("is_active", true)
          .order("name"),
        supabase.from("stock_levels").select("product_id, quantity"),
      ]);
      const stockMap = new Map<string, number>();
      for (const s of stocks ?? []) {
        stockMap.set(s.product_id, (stockMap.get(s.product_id) ?? 0) + s.quantity);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (prods ?? []).map((p: any) => ({
        id: p.id, sku: p.sku, name: p.name,
        brand: p.brand?.name ?? undefined,
        category: p.category?.name ?? undefined,
        cost_price: p.cost_price ?? null,
        selling_price: p.selling_price ?? null,
        currentStock: stockMap.get(p.id) ?? 0,
        reorderPoint: p.reorder_point ?? undefined,
        tax_rate: p.tax_rate ?? 18,
      }));
    },
  });

  // Keep a quick look-up for tax_rate per product (not in ProductOption interface)
  const taxRateByProduct = useMemo(() => {
    const m = new Map<string, number>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of rawProducts as any[]) m.set(p.id, p.tax_rate ?? 18);
    return m;
  }, [rawProducts]);

  const products: ProductOption[] = rawProducts;

  // ── Totals ───────────────────────────────────────────────────────────────
  // useWatch (not watch) returns a new reference on every field change, so
  // useMemo recalculates whenever quantity, unit_price, or tax_rate changes.
  const watchedItems = useWatch({ control, name: "items" }) ?? [];
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;
    for (const item of watchedItems) {
      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
      subtotal  += lineTotal;
      taxAmount += lineTotal * (Number(item.tax_rate) || 0) / 100;
    }
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  }, [watchedItems]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const customerId = watch("customer_id");

  function onCustomerChange(id: string, customer: CustomerOption | null) {
    setValue("customer_id", id, { shouldValidate: true });
    if (customer) {
      // Build billing address from flat customer fields
      const billing = (customer.address || customer.city || customer.state)
        ? { line1: customer.address ?? "", line2: null, city: customer.city ?? "", state: customer.state ?? "", pincode: customer.pincode ?? "" }
        : null;
      setValue("billing_address", billing);
      setValue("shipping_address", customer.shipping_address ?? null);
    }
  }

  const onProductSelect = useCallback((index: number, productId: string, product: ProductOption | null) => {
    setValue(`items.${index}.product_id`, productId);
    if (product) {
      if (!watch(`items.${index}.description`) || watch(`items.${index}.description`) === "") {
        setValue(`items.${index}.description`, product.name);
      }
      setValue(`items.${index}.unit_price`, product.selling_price ?? 0);
      setValue(`items.${index}.tax_rate`,   taxRateByProduct.get(productId) ?? 18);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setValue, taxRateByProduct]);

  async function onSubmit(values: QuotationFormData) {
    setSubmitError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const subtotal   = totals.subtotal;
    const taxAmount  = totals.taxAmount;
    const totalAmount = totals.total;

    if (quotation) {
      // Update header
      const { error: qErr } = await supabase
        .from("quotations")
        .update({
          customer_id:      values.customer_id,
          quotation_date:   values.quotation_date,
          valid_until:      values.valid_until || null,
          status:           values.status,
          notes:            values.notes || null,
          billing_address:  values.billing_address  ?? null,
          shipping_address: values.shipping_address ?? null,
          subtotal, tax_amount: taxAmount, total_amount: totalAmount,
        })
        .eq("id", quotation.id);
      if (qErr) { setSubmitError(qErr.message); return; }

      // Replace items
      const { error: delErr } = await supabase
        .from("quotation_items")
        .delete()
        .eq("quotation_id", quotation.id);
      if (delErr) { setSubmitError(delErr.message); return; }

      const { error: insErr } = await supabase.from("quotation_items").insert(
        values.items.map((it, i) => ({
          quotation_id: quotation.id,
          product_id:   it.product_id || null,
          description:  it.description,
          quantity:     it.quantity,
          unit_price:   it.unit_price,
          tax_rate:     it.tax_rate,
          line_total:   it.quantity * it.unit_price,
          sort_order:   i,
        }))
      );
      if (insErr) {
        // Items were deleted above; attempt to restore originals to avoid data loss.
        if (quotation.items?.length) {
          await supabase.from("quotation_items").insert(
            quotation.items.map(it => ({
              quotation_id: quotation.id,
              product_id:   it.product_id || null,
              description:  it.description,
              quantity:     it.quantity,
              unit_price:   it.unit_price,
              tax_rate:     it.tax_rate,
              line_total:   it.line_total,
              sort_order:   it.sort_order,
            }))
          );
        }
        setSubmitError(insErr.message);
        return;
      }
      logAudit({ action: "updated", module: "quotations", record_id: quotation.id, record_name: quotation.quotation_number });
      onSuccess(quotation.id);
    } else {
      // Create quotation header
      const { data: qData, error: qErr } = await supabase
        .from("quotations")
        .insert({
          customer_id:      values.customer_id,
          quotation_date:   values.quotation_date,
          valid_until:      values.valid_until || null,
          status:           values.status,
          notes:            values.notes || null,
          billing_address:  values.billing_address  ?? null,
          shipping_address: values.shipping_address ?? null,
          subtotal, tax_amount: taxAmount, total_amount: totalAmount,
          created_by: user?.id ?? null,
          quotation_number: "",
        })
        .select("id")
        .single();
      if (qErr) { setSubmitError(qErr.message); return; }

      const { error: insErr } = await supabase.from("quotation_items").insert(
        values.items.map((it, i) => ({
          quotation_id: qData.id,
          product_id:   it.product_id || null,
          description:  it.description,
          quantity:     it.quantity,
          unit_price:   it.unit_price,
          tax_rate:     it.tax_rate,
          line_total:   it.quantity * it.unit_price,
          sort_order:   i,
        }))
      );
      if (insErr) {
        // Roll back quotation header if items failed
        await supabase.from("quotations").delete().eq("id", qData.id);
        setSubmitError(insErr.message);
        return;
      }
      logAudit({ action: "created", module: "quotations", record_id: qData.id });
      onSuccess(qData.id);
    }
  }

  const currentStatus    = watch("status");
  const billingAddress   = watch("billing_address");
  const shippingAddress  = watch("shipping_address");
  const selectedCustomer = customers.find(c => c.id === customerId) ?? null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* ── Customer + Dates ──────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Quotation Details</h3>

        <div className="space-y-1">
          <Label>Customer *</Label>
          <CustomerCombobox
            customers={customers}
            value={customerId ?? ""}
            onChange={onCustomerChange}
            error={errors.customer_id?.message}
            disabled={isSubmitting}
          />
          {errors.customer_id && (
            <p className="text-xs text-destructive">{errors.customer_id.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Quotation Date *</Label>
            <Input type="date" {...register("quotation_date")} />
            {errors.quotation_date && (
              <p className="text-xs text-destructive">{errors.quotation_date.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Valid Until</Label>
            <Input type="date" {...register("valid_until")} />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={currentStatus}
              onValueChange={v => setValue("status", v as QuotationFormData["status"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Billing / Shipping Addresses ─────────────────────── */}
      {selectedCustomer && (
        <div className="rounded-lg border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold">Billing &amp; Shipping</h3>
          <AddressCard
            customerName={selectedCustomer.name}
            companyName={selectedCustomer.company_name}
            gstNumber={selectedCustomer.gst_number}
            phone={selectedCustomer.phone}
            billingAddress={billingAddress ?? null}
            shippingAddress={shippingAddress ?? null}
            onBillingChange={addr => setValue("billing_address", addr)}
            onShippingChange={addr => setValue("shipping_address", addr)}
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* ── Line Items ────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Line Items</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ product_id: "", description: "", quantity: 1, unit_price: 0, tax_rate: 18 })}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Line
          </Button>
        </div>

        {errors.items?.root && (
          <p className="text-xs text-destructive">{errors.items.root.message}</p>
        )}
        {typeof errors.items?.message === "string" && (
          <p className="text-xs text-destructive">{errors.items.message}</p>
        )}

        {/* Header row */}
        <div className="hidden sm:grid grid-cols-[24px_1fr_1fr_100px_110px_90px_90px_32px] gap-2 px-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          <span />
          <span>Product</span>
          <span>Description</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Unit Price</span>
          <span className="text-right">Tax %</span>
          <span className="text-right">Total</span>
          <span />
        </div>

        <div className="space-y-3">
          {fields.map((field, i) => {
            const qty      = Number(watch(`items.${i}.quantity`)) || 0;
            const price    = Number(watch(`items.${i}.unit_price`)) || 0;
            const lineTotal = qty * price;
            const prodId   = watch(`items.${i}.product_id`);

            return (
              <div
                key={field.id}
                className="grid grid-cols-1 sm:grid-cols-[24px_1fr_1fr_100px_110px_90px_90px_32px] gap-2 items-start p-3 sm:p-1 rounded-md border sm:border-0 bg-muted/20 sm:bg-transparent"
              >
                {/* Drag handle (visual only) */}
                <div className="hidden sm:flex items-center justify-center pt-2 text-muted-foreground/40">
                  <GripVertical className="h-4 w-4" />
                </div>

                {/* Product selector */}
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

                {/* Description */}
                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">Description *</Label>
                  <Input
                    {...register(`items.${i}.description`)}
                    placeholder="Item description"
                  />
                  {errors.items?.[i]?.description && (
                    <p className="text-xs text-destructive">{errors.items[i]?.description?.message}</p>
                  )}
                </div>

                {/* Quantity */}
                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    onKeyDown={preventDecimalInput}
                    {...register(`items.${i}.quantity`)}
                    className="text-right"
                  />
                  {errors.items?.[i]?.quantity && (
                    <p className="text-xs text-destructive">{errors.items[i]?.quantity?.message}</p>
                  )}
                </div>

                {/* Unit Price */}
                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">Unit Price (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    {...register(`items.${i}.unit_price`)}
                    className="text-right"
                  />
                </div>

                {/* Tax Rate */}
                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">Tax %</Label>
                  <Select
                    value={String(watch(`items.${i}.tax_rate`) ?? 18)}
                    onValueChange={v => setValue(`items.${i}.tax_rate`, Number(v))}
                  >
                    <SelectTrigger className="text-right">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_TAX_RATES.map(r => (
                        <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Line Total */}
                <div className="flex items-center justify-end pt-2 text-sm font-medium tabular-nums">
                  {fmtINR(lineTotal)}
                </div>

                {/* Remove */}
                <div className="flex items-center justify-end pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn("h-7 w-7 p-0", fields.length === 1 && "opacity-30 cursor-not-allowed")}
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

      {/* ── Notes ─────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-5 space-y-2">
        <h3 className="text-sm font-semibold">Notes</h3>
        <textarea
          {...register("notes")}
          placeholder="Terms, conditions, delivery info, or any notes for the customer…"
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                     placeholder:text-muted-foreground focus:outline-none focus:ring-2
                     focus:ring-ring focus:ring-offset-2 resize-none"
        />
      </div>

      {submitError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
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
          {isSubmitting
            ? "Saving…"
            : quotation
            ? "Update Quotation"
            : "Create Quotation"}
        </Button>
      </div>
    </form>
  );
}
