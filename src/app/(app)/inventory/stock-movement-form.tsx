"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { ProductCombobox, type ProductOption } from "@/components/ui/product-combobox";
import { preventDecimalInput } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Package, MapPin, ArrowLeftRight, Hash, FileText, AlertTriangle,
  TrendingUp, TrendingDown,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const OUT_TYPES = ["sale", "transfer_out", "damage"];

const MOVEMENT_TYPES = [
  { value: "receipt",      label: "Goods Receipt",        direction: "in",  hint: "Stock in from supplier"        },
  { value: "return",       label: "Customer Return",      direction: "in",  hint: "Returned stock from customer"  },
  { value: "transfer_in",  label: "Transfer In",          direction: "in",  hint: "Received from another location"},
  { value: "adjustment",   label: "Physical Count Adjustment", direction: "in", hint: "Correct stock from physical count" },
  { value: "sale",         label: "Sales Issue",          direction: "out", hint: "Stock out for a sale"          },
  { value: "transfer_out", label: "Transfer Out",         direction: "out", hint: "Sent to another location"      },
  { value: "damage",       label: "Damaged Goods",        direction: "out", hint: "Write-off for loss or damage"  },
] as const;

// ── Schema ────────────────────────────────────────────────────────────────────

const movementSchema = z.object({
  product_id:    z.string().min(1, "Select a product"),
  location_id:   z.string().min(1, "Select a location"),
  movement_type: z.enum(["receipt","sale","transfer_in","transfer_out","adjustment","return","damage"]),
  quantity:      z.coerce.number()
                  .int("Quantity must be a whole number")
                  .min(1, "Quantity must be at least 1"),
  reference_no:  z.string().optional(),
  notes:         z.string().optional(),
  vendor_id:     z.string().optional(),
});

type MovementFormData = z.infer<typeof movementSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(n: number | null | undefined) {
  return n != null ? `₹${n.toLocaleString("en-IN")}` : "—";
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onSuccess: () => void;
  defaultMovementType?: MovementFormData["movement_type"];
  onCancel?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StockMovementForm({ onSuccess, defaultMovementType = "receipt", onCancel }: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MovementFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(movementSchema) as any,
    defaultValues: { movement_type: defaultMovementType },
  });

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: products = [] } = useQuery<ProductOption[]>({
    queryKey: ["products-for-movement"],
    queryFn: async () => {
      const supabase = createClient();
      const [{ data: prods }, { data: stocks }] = await Promise.all([
        supabase
          .from("products")
          .select("id, sku, name, reorder_point, cost_price, selling_price, brand:brands(id,name), category:categories(id,name)")
          .is("deleted_at", null)
          .order("name"),
        supabase.from("stock_levels").select("product_id, quantity"),
      ]);
      const stockMap = new Map<string, number>();
      for (const s of stocks ?? []) {
        stockMap.set(s.product_id, (stockMap.get(s.product_id) ?? 0) + s.quantity);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (prods ?? []).map((p: any) => ({
        id:            p.id,
        sku:           p.sku,
        name:          p.name,
        brand:         p.brand?.name    ?? undefined,
        category:      p.category?.name ?? undefined,
        cost_price:    p.cost_price     ?? null,
        selling_price: p.selling_price  ?? null,
        currentStock:  stockMap.get(p.id) ?? 0,
        reorderPoint:  p.reorder_point  ?? undefined,
      }));
    },
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("locations").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("vendors").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const productId    = watch("product_id");
  const locationId   = watch("location_id");
  const movementType = watch("movement_type");
  const quantity     = watch("quantity");

  const isOutbound        = OUT_TYPES.includes(movementType);
  const movementMeta      = MOVEMENT_TYPES.find(m => m.value === movementType);

  const { data: locationStock } = useQuery({
    queryKey: ["stock-check", productId, locationId],
    queryFn: async () => {
      if (!productId || !locationId) return null;
      const supabase = createClient();
      const { data } = await supabase
        .from("stock_levels")
        .select("quantity")
        .eq("product_id", productId)
        .eq("location_id", locationId)
        .maybeSingle();
      return data?.quantity ?? 0;
    },
    enabled: !!productId && !!locationId,
  });

  const parsedQty      = Number(quantity);
  const wouldGoNegative =
    isOutbound && locationStock != null && !isNaN(parsedQty) && parsedQty > locationStock;

  // ── Submit ────────────────────────────────────────────────────────────────

  async function onSubmit(values: MovementFormData) {
    setSubmitError(null);
    if (OUT_TYPES.includes(values.movement_type) && locationStock != null) {
      if (values.quantity > locationStock) {
        setSubmitError(`Insufficient stock. Available: ${locationStock} units, requested: ${values.quantity}.`);
        return;
      }
    }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("stock_movements").insert({
      product_id:    values.product_id,
      location_id:   values.location_id,
      movement_type: values.movement_type,
      quantity:      values.quantity,
      reference_no:  values.reference_no || null,
      notes:         values.notes        || null,
      vendor_id:     values.vendor_id    || null,
      created_by:    user?.id            ?? null,
    });
    if (error) { setSubmitError(error.message); return; }

    const delta = OUT_TYPES.includes(values.movement_type) ? -values.quantity : values.quantity;
    const { error: sErr } = await supabase.rpc("increment_stock_level", {
      p_product_id:  values.product_id,
      p_location_id: values.location_id,
      p_delta:       delta,
    });
    if (sErr) { setSubmitError("Movement recorded, but stock level update failed: " + sErr.message); return; }

    const actionMap: Record<string, string> = {
      receipt: "stock_added", return: "stock_added", transfer_in: "stock_added", adjustment: "stock_adjusted",
      sale: "stock_removed", transfer_out: "stock_removed", damage: "stock_removed",
    };
    logAudit({
      action: actionMap[values.movement_type] ?? "stock_adjusted",
      module: "inventory",
      record_name: values.reference_no || values.movement_type,
      metadata: { movement_type: values.movement_type, quantity: values.quantity },
    });
    onSuccess();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

      {/* ── Section 1: Product ────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Product</span>
        </div>

        <div>
          <ProductCombobox
            products={products}
            value={productId ?? ""}
            onChange={(id, product) => {
              setValue("product_id", id, { shouldValidate: true });
              setSelectedProduct(product);
            }}
            placeholder="Search by name, SKU, or brand…"
            isOutbound={isOutbound}
            disabled={isSubmitting}
            hideDetails
          />
          {errors.product_id && (
            <p className="mt-1 text-xs text-destructive">{errors.product_id.message}</p>
          )}
        </div>

        {/* Product info card */}
        {selectedProduct && (
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <div className="grid grid-cols-3 gap-x-6 gap-y-3">
              <div>
                <p className="text-[11px] text-muted-foreground mb-0.5 uppercase tracking-wide">Current Stock</p>
                <p className={cn(
                  "text-base font-bold",
                  (selectedProduct.currentStock ?? 0) === 0 ? "text-red-600" :
                  selectedProduct.reorderPoint && (selectedProduct.currentStock ?? 0) <= selectedProduct.reorderPoint
                    ? "text-yellow-600" : "text-emerald-700"
                )}>
                  {selectedProduct.currentStock ?? 0} units
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-0.5 uppercase tracking-wide">Reorder Level</p>
                <p className="text-base font-semibold">{selectedProduct.reorderPoint ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-0.5 uppercase tracking-wide">Cost Price</p>
                <p className="text-base font-semibold">{fmtINR(selectedProduct.cost_price)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-0.5 uppercase tracking-wide">Selling Price</p>
                <p className="text-base font-semibold">{fmtINR(selectedProduct.selling_price)}</p>
              </div>
              {selectedProduct.category && (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-0.5 uppercase tracking-wide">Category</p>
                  <p className="text-sm font-medium">{selectedProduct.category}</p>
                </div>
              )}
              {selectedProduct.brand && (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-0.5 uppercase tracking-wide">Brand</p>
                  <p className="text-sm font-medium">{selectedProduct.brand}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Section 2: Movement Details ───────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Movement Details</span>
        </div>

        {/* Location + Movement Type */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">
              Location <span className="text-destructive">*</span>
            </Label>
            <Select onValueChange={(v) => setValue("location_id", v, { shouldValidate: true })}>
              <SelectTrigger className="h-10">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground mr-1 shrink-0" />
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.location_id && (
              <p className="text-xs text-destructive">{errors.location_id.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">
              Movement Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={movementType}
              onValueChange={(v) => setValue("movement_type", v as MovementFormData["movement_type"])}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Stock In</div>
                {MOVEMENT_TYPES.filter(m => m.direction === "in").map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      {t.label}
                    </div>
                  </SelectItem>
                ))}
                <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold border-t mt-1 pt-2">Stock Out</div>
                {MOVEMENT_TYPES.filter(m => m.direction === "out").map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      {t.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Movement type hint */}
        {movementMeta && (
          <div className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-xs",
            isOutbound
              ? "bg-red-50 border border-red-100 text-red-700"
              : "bg-emerald-50 border border-emerald-100 text-emerald-700"
          )}>
            {isOutbound
              ? <TrendingDown className="h-3.5 w-3.5 shrink-0" />
              : <TrendingUp className="h-3.5 w-3.5 shrink-0" />}
            <span>{movementMeta.hint}</span>
            {isOutbound && locationStock != null && locationId && (
              <span className="ml-auto font-semibold">
                Available at location: {locationStock} units
              </span>
            )}
          </div>
        )}

        {/* Quantity */}
        <div className="space-y-1.5">
          <Label className="text-sm">
            Quantity <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            min={1}
            step={1}
            onKeyDown={preventDecimalInput}
            placeholder="0"
            {...register("quantity")}
            className={cn(
              "h-12 text-2xl font-bold text-center tracking-wider",
              wouldGoNegative && "border-destructive focus-visible:ring-destructive"
            )}
          />
          {errors.quantity && (
            <p className="text-xs text-destructive">{errors.quantity.message}</p>
          )}
          {wouldGoNegative && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Exceeds available stock at this location ({locationStock} units)
            </div>
          )}
        </div>

        {/* Vendor — only for receipts */}
        {movementType === "receipt" && (
          <div className="space-y-1.5">
            <Label className="text-sm">Vendor <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Select onValueChange={(v) => setValue("vendor_id", v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ── Section 3: Reference ──────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Reference</span>
          <span className="text-xs text-muted-foreground">(optional)</span>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm flex items-center gap-1.5">
            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
            Reference Number
          </Label>
          <Input
            {...register("reference_no")}
            className="h-10"
            placeholder="e.g. PO-001, GRN-045, INV-123…"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Notes</Label>
          <textarea
            {...register("notes")}
            rows={3}
            placeholder="Add any relevant notes, reason, or remarks…"
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2
                       focus:ring-ring focus:ring-offset-2 resize-none"
          />
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      {submitError && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          {submitError}
        </div>
      )}

      {/* ── Actions ───────────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pt-1 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting || wouldGoNegative}
          className="px-8"
        >
          {isSubmitting ? "Recording…" : "Record Movement"}
        </Button>
      </div>
    </form>
  );
}
