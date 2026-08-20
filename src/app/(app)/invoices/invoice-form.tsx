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
import { Plus, Trash2, GripVertical, AlertTriangle } from "lucide-react";
import { cn, preventDecimalInput } from "@/lib/utils";
import type { Invoice, StockMovement } from "@/lib/types";

// ── Schema ────────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  product_id:  z.string().optional(),
  description: z.string().min(1, "Description required"),
  quantity:    z.coerce.number().int("Quantity must be a whole number").min(1, "Must be ≥ 1"),
  unit_price:  z.coerce.number().min(0, "Must be ≥ 0"),
  tax_rate:    z.coerce.number().min(0).max(100),
});

const invoiceSchema = z.object({
  customer_id:  z.string().min(1, "Customer required"),
  invoice_date: z.string().min(1, "Date required"),
  due_date:     z.string().optional(),
  // draft / sent / overdue only — partial & paid are payment-driven
  status:       z.enum(["draft", "sent", "overdue"]),
  notes:        z.string().optional(),
  billing_address:  z.any().optional(),
  shipping_address: z.any().optional(),
  items: z.array(itemSchema).min(1, "Add at least one line item"),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_LABELS: Record<string, string> = {
  draft:   "Draft",
  sent:    "Sent",
  overdue: "Overdue",
};

const COMMON_TAX_RATES = [0, 5, 12, 18, 28];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InvoiceInitialData {
  quotation_id:     string | null;
  customer_id:      string;
  notes:            string | null;
  billing_address?: { line1: string; line2?: string | null; city: string; state: string; pincode: string } | null;
  shipping_address?: { line1: string; line2?: string | null; city: string; state: string; pincode: string } | null;
  items: Array<{
    product_id:  string | null;
    description: string;
    quantity:    number;
    unit_price:  number;
    tax_rate:    number;
  }>;
}

interface Props {
  invoice?:     Invoice | null;
  initialData?: InvoiceInitialData | null;
  onSuccess:    (id: string) => void;
  onCancel?:    () => void;
}

// ── Stock helpers ─────────────────────────────────────────────────────────────

async function getDefaultLocationId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data } = await supabase
    .from("locations")
    .select("id")
    .eq("is_active", true)
    .order("name")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InvoiceForm({ invoice, initialData, onSuccess, onCancel }: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const today          = new Date().toISOString().split("T")[0];
  const defaultDueDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  // For edit: coerce status to the allowed subset (paid/partial become draft)
  const initialStatus = (): "draft" | "sent" | "overdue" => {
    const s = invoice?.status;
    if (s === "sent" || s === "overdue") return s;
    return "draft";
  };

  const mappedInvoiceItems = invoice?.items?.map(it => ({
    product_id:  it.product_id  ?? "",
    description: it.description,
    quantity:    it.quantity,
    unit_price:  it.unit_price,
    tax_rate:    it.tax_rate,
  }));
  const mappedInitialItems = initialData?.items?.length
    ? initialData.items.map(it => ({
        product_id:  it.product_id ?? "",
        description: it.description,
        quantity:    it.quantity,
        unit_price:  it.unit_price,
        tax_rate:    it.tax_rate,
      }))
    : null;
  const defaultItems =
    mappedInvoiceItems ??
    mappedInitialItems ??
    [{ product_id: "", description: "", quantity: 1, unit_price: 0, tax_rate: 18 }];

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: {
      customer_id:      invoice?.customer_id  ?? initialData?.customer_id ?? "",
      invoice_date:     invoice?.invoice_date ?? today,
      due_date:         invoice?.due_date     ?? defaultDueDate,
      status:           initialStatus(),
      notes:            invoice?.notes        ?? initialData?.notes        ?? "",
      billing_address:  invoice?.billing_address  ?? initialData?.billing_address  ?? null,
      shipping_address: invoice?.shipping_address ?? initialData?.shipping_address ?? null,
      items:            defaultItems,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // ── Queries ───────────────────────────────────────────────────────────────

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
    queryKey: ["products-for-invoice"],
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
        brand:         p.brand?.name    ?? undefined,
        category:      p.category?.name ?? undefined,
        cost_price:    p.cost_price     ?? null,
        selling_price: p.selling_price  ?? null,
        currentStock:  stockMap.get(p.id) ?? 0,
        reorderPoint:  p.reorder_point  ?? undefined,
        tax_rate:      p.tax_rate       ?? 18,
      }));
    },
  });

  // Existing movements for this invoice (edit mode only) — needed for stock restoration
  const { data: existingMovements = [] } = useQuery<StockMovement[]>({
    queryKey: ["invoice-movements-edit", invoice?.id],
    queryFn: async () => {
      if (!invoice) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("stock_movements")
        .select("id, product_id, location_id, quantity")
        .eq("document_id", invoice.id)
        .eq("document_type", "invoice")
        .eq("movement_type", "sale");
      return (data ?? []) as StockMovement[];
    },
    enabled: !!invoice,
    staleTime: Infinity,
  });

  const taxRateByProduct = useMemo(() => {
    const m = new Map<string, number>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of rawProducts as any[]) m.set(p.id, p.tax_rate ?? 18);
    return m;
  }, [rawProducts]);

  const products: ProductOption[] = rawProducts;

  // ── Totals ────────────────────────────────────────────────────────────────
  const watchedItems = useWatch({ control, name: "items" }) ?? [];
  const totals = useMemo(() => {
    let subtotal  = 0;
    let taxAmount = 0;
    for (const item of watchedItems) {
      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
      subtotal  += lineTotal;
      taxAmount += lineTotal * (Number(item.tax_rate) || 0) / 100;
    }
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  }, [watchedItems]);

  // ── Per-item stock availability ───────────────────────────────────────────
  // For edit: the current stock already reflects the deduction from this invoice.
  // We add back the old invoice quantities to get "true available" for validation.
  const restoredStockMap = useMemo(() => {
    const m = new Map<string, number>();
    if (invoice) {
      for (const it of invoice.items ?? []) {
        if (it.product_id) {
          m.set(it.product_id, (m.get(it.product_id) ?? 0) + it.quantity);
        }
      }
    }
    return m;
  }, [invoice]);

  const stockByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) {
      const base = p.currentStock ?? 0;
      const restored = restoredStockMap.get(p.id) ?? 0;
      m.set(p.id, base + restored);
    }
    return m;
  }, [products, restoredStockMap]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const customerId     = watch("customer_id");
  const currentStatus  = watch("status");
  const billingAddress  = watch("billing_address");
  const shippingAddress = watch("shipping_address");
  const selectedCustomer = customers.find(c => c.id === customerId) ?? null;

  function onCustomerChange(id: string, customer: CustomerOption | null) {
    setValue("customer_id", id, { shouldValidate: true });
    if (customer) {
      const billing = (customer.address || customer.city || customer.state)
        ? { line1: customer.address ?? "", line2: null, city: customer.city ?? "", state: customer.state ?? "", pincode: customer.pincode ?? "" }
        : null;
      setValue("billing_address", billing);
      setValue("shipping_address", customer.shipping_address ?? null);
    }
  }

  const onProductSelect = useCallback(
    (index: number, productId: string, product: ProductOption | null) => {
      setValue(`items.${index}.product_id`, productId);
      if (product) {
        if (!watch(`items.${index}.description`)) {
          setValue(`items.${index}.description`, product.name);
        }
        setValue(`items.${index}.unit_price`, product.selling_price ?? 0);
        setValue(`items.${index}.tax_rate`,   taxRateByProduct.get(productId) ?? 18);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setValue, taxRateByProduct],
  );

  // ── Submit ────────────────────────────────────────────────────────────────

  async function onSubmit(values: InvoiceFormData) {
    setSubmitError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { subtotal, taxAmount: tax_amount, total: total_amount } = totals;

    // ── Stock validation (create mode only) ────────────────────────────────
    // On edit, the current invoice's stock is already deducted. Step 1 of the
    // edit flow restores it before re-deducting, so we cannot validate against
    // the current stock level — it would always fail for fully-consumed items.
    if (!invoice) {
      const requestedByProduct = new Map<string, number>();
      for (const item of values.items) {
        if (item.product_id) {
          requestedByProduct.set(
            item.product_id,
            (requestedByProduct.get(item.product_id) ?? 0) + item.quantity,
          );
        }
      }

      const stockErrors: string[] = [];
      for (const [productId, requestedQty] of requestedByProduct) {
        const available = stockByProduct.get(productId) ?? 0;
        if (requestedQty > available) {
          const product = products.find(p => p.id === productId);
          stockErrors.push(
            `${product?.name ?? productId}: need ${requestedQty}, available ${available}`
          );
        }
      }
      if (stockErrors.length > 0) {
        setSubmitError("Insufficient stock:\n" + stockErrors.join("\n"));
        return;
      }
    }

    // ── Get default location for stock movements ────────────────────────────
    const locationId = await getDefaultLocationId(supabase);

    if (invoice) {
      // ── Edit mode ──────────────────────────────────────────────────────────

      // 1. Restore old stock for this invoice (before re-deducting new quantities)
      if (locationId && existingMovements.length > 0) {
        for (const mv of existingMovements) {
          const { error: restoreErr } = await supabase.rpc("increment_stock_level", {
            p_product_id:  mv.product_id,
            p_location_id: mv.location_id,
            p_delta:       mv.quantity,       // positive = restore
          });
          if (restoreErr) {
            setSubmitError("Failed to restore old stock: " + restoreErr.message);
            return;
          }
        }
        // Delete old movements
        await supabase
          .from("stock_movements")
          .delete()
          .eq("document_id", invoice.id)
          .eq("document_type", "invoice")
          .eq("movement_type", "sale");
      }

      // 2. Update invoice header
      const { error: invErr } = await supabase
        .from("invoices")
        .update({
          customer_id:      values.customer_id,
          invoice_date:     values.invoice_date,
          due_date:         values.due_date || null,
          status:           values.status,
          notes:            values.notes || null,
          billing_address:  values.billing_address  ?? null,
          shipping_address: values.shipping_address ?? null,
          subtotal, tax_amount, total_amount,
        })
        .eq("id", invoice.id);
      if (invErr) { setSubmitError(invErr.message); return; }

      // 3. Replace invoice items
      const { error: delErr } = await supabase
        .from("invoice_items")
        .delete()
        .eq("invoice_id", invoice.id);
      if (delErr) { setSubmitError(delErr.message); return; }

      const { error: insErr } = await supabase.from("invoice_items").insert(
        values.items.map((it, i) => ({
          invoice_id:  invoice.id,
          product_id:  it.product_id || null,
          description: it.description,
          quantity:    it.quantity,
          unit_price:  it.unit_price,
          tax_rate:    it.tax_rate,
          line_total:  it.quantity * it.unit_price,
          sort_order:  i,
        }))
      );
      if (insErr) {
        // Best-effort rollback
        if (invoice.items?.length) {
          await supabase.from("invoice_items").insert(
            invoice.items.map(it => ({
              invoice_id:  invoice.id,
              product_id:  it.product_id || null,
              description: it.description,
              quantity:    it.quantity,
              unit_price:  it.unit_price,
              tax_rate:    it.tax_rate,
              line_total:  it.line_total,
              sort_order:  it.sort_order,
            }))
          );
        }
        setSubmitError(insErr.message);
        return;
      }

      // 4. Create new stock movements and deduct from stock_levels
      if (locationId) {
        const productItems = values.items.filter(it => !!it.product_id);
        if (productItems.length > 0) {
          const { error: mvErr } = await supabase.from("stock_movements").insert(
            productItems.map(it => ({
              product_id:    it.product_id!,
              location_id:   locationId,
              movement_type: "sale",
              quantity:      it.quantity,
              reference_no:  invoice.invoice_number,
              document_id:   invoice.id,
              document_type: "invoice",
              customer_id:   values.customer_id || null,
              created_by:    user?.id ?? null,
              notes:         `Invoice ${invoice.invoice_number}`,
            }))
          );
          if (mvErr) {
            setSubmitError("Invoice saved, but stock movement failed: " + mvErr.message);
          } else {
            for (const it of productItems) {
              const { error: sErr } = await supabase.rpc("increment_stock_level", {
                p_product_id:  it.product_id!,
                p_location_id: locationId,
                p_delta:       -it.quantity,
              });
              if (sErr) {
                setSubmitError("Invoice saved, but stock deduction failed: " + sErr.message);
                break;
              }
            }
          }
        }
      }

      logAudit({ action: "updated", module: "invoices", record_id: invoice.id, record_name: invoice.invoice_number });
      onSuccess(invoice.id);

    } else {
      // ── Create mode ────────────────────────────────────────────────────────

      const { data: invData, error: invErr } = await supabase
        .from("invoices")
        .insert({
          customer_id:      values.customer_id,
          invoice_date:     values.invoice_date,
          due_date:         values.due_date || null,
          status:           values.status,
          notes:            values.notes || null,
          billing_address:  values.billing_address  ?? null,
          shipping_address: values.shipping_address ?? null,
          subtotal, tax_amount, total_amount,
          quotation_id:     initialData?.quotation_id ?? null,
          created_by:       user?.id ?? null,
          invoice_number:   "",
        })
        .select("id, invoice_number")
        .single();
      if (invErr) { setSubmitError(invErr.message); return; }

      const { error: insErr } = await supabase.from("invoice_items").insert(
        values.items.map((it, i) => ({
          invoice_id:  invData.id,
          product_id:  it.product_id || null,
          description: it.description,
          quantity:    it.quantity,
          unit_price:  it.unit_price,
          tax_rate:    it.tax_rate,
          line_total:  it.quantity * it.unit_price,
          sort_order:  i,
        }))
      );
      if (insErr) {
        await supabase.from("invoices").delete().eq("id", invData.id);
        setSubmitError(insErr.message);
        return;
      }

      // Stock movements and deduct from stock_levels
      if (locationId) {
        const productItems = values.items.filter(it => !!it.product_id);
        if (productItems.length > 0) {
          const { error: mvErr } = await supabase.from("stock_movements").insert(
            productItems.map(it => ({
              product_id:    it.product_id!,
              location_id:   locationId,
              movement_type: "sale",
              quantity:      it.quantity,
              reference_no:  invData.invoice_number,
              document_id:   invData.id,
              document_type: "invoice",
              customer_id:   values.customer_id || null,
              created_by:    user?.id ?? null,
              notes:         `Invoice ${invData.invoice_number}`,
            }))
          );
          if (mvErr) {
            setSubmitError("Invoice created, but stock movement failed: " + mvErr.message + ". Please manually record stock out in Inventory.");
          } else {
            for (const it of productItems) {
              const { error: sErr } = await supabase.rpc("increment_stock_level", {
                p_product_id:  it.product_id!,
                p_location_id: locationId,
                p_delta:       -it.quantity,
              });
              if (sErr) {
                setSubmitError("Invoice created, but stock deduction failed: " + sErr.message);
                break;
              }
            }
          }
        }
      } else {
        // No location configured — create invoice but skip stock tracking
        if (values.items.some(it => it.product_id)) {
          setSubmitError("Invoice created. No warehouse location found — stock was not deducted. Add a location in Inventory settings.");
        }
      }

      logAudit({ action: "created", module: "invoices", record_id: invData.id, record_name: invData.invoice_number });
      onSuccess(invData.id);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* ── Invoice Details ─────────────────────────────── */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Invoice Details</h3>

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
            <Label>Invoice Date *</Label>
            <Input type="date" {...register("invoice_date")} />
            {errors.invoice_date && (
              <p className="text-xs text-destructive">{errors.invoice_date.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Due Date</Label>
            <Input type="date" {...register("due_date")} />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={currentStatus}
              onValueChange={v => setValue("status", v as InvoiceFormData["status"])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Partial / Paid update automatically when payments are recorded.
            </p>
          </div>
        </div>
      </div>

      {/* ── Billing / Shipping Addresses ─────────────────── */}
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

      {/* ── Line Items ──────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Line Items</h3>
          <Button
            type="button" size="sm" variant="outline"
            onClick={() => append({ product_id: "", description: "", quantity: 1, unit_price: 0, tax_rate: 18 })}
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
          <span className="text-right">Unit Price</span>
          <span className="text-right">Tax %</span>
          <span className="text-right">Total</span>
          <span />
        </div>

        <div className="space-y-3">
          {fields.map((field, i) => {
            const qty       = Number(watch(`items.${i}.quantity`))   || 0;
            const price     = Number(watch(`items.${i}.unit_price`)) || 0;
            const lineTotal = qty * price;
            const prodId    = watch(`items.${i}.product_id`);
            const available = prodId ? (stockByProduct.get(prodId) ?? null) : null;
            const overStock = available !== null && qty > available;

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
                  {available !== null && (
                    <p className={cn("text-[11px]", overStock ? "text-destructive font-medium" : "text-muted-foreground")}>
                      {overStock && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
                      Available: {available}
                    </p>
                  )}
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
                    className={cn("text-right", overStock && "border-destructive focus:ring-destructive")}
                  />
                  {errors.items?.[i]?.quantity && (
                    <p className="text-xs text-destructive">{errors.items[i]?.quantity?.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">Unit Price (₹)</Label>
                  <Input type="number" min={0} step={0.01} {...register(`items.${i}.unit_price`)} className="text-right" />
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

      {/* ── Notes ───────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-5 space-y-2">
        <h3 className="text-sm font-semibold">Notes</h3>
        <textarea
          {...register("notes")}
          placeholder="Payment instructions, bank details, or any notes for the customer…"
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
          {isSubmitting ? "Saving…" : invoice ? "Update Invoice" : "Create Invoice"}
        </Button>
      </div>
    </form>
  );
}
