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

const OUT_TYPES = ["sale", "transfer_out", "damage"];

const movementSchema = z.object({
  product_id: z.string().min(1, "Product is required"),
  location_id: z.string().min(1, "Location is required"),
  movement_type: z.enum([
    "receipt",
    "sale",
    "transfer_in",
    "transfer_out",
    "adjustment",
    "return",
    "damage",
  ]),
  quantity: z.coerce.number().int("Quantity must be a whole number").min(1, "Quantity must be ≥ 1"),
  reference_no: z.string().optional(),
  notes: z.string().optional(),
  vendor_id: z.string().optional(),
});

type MovementFormData = z.infer<typeof movementSchema>;

interface Props {
  onSuccess: () => void;
  defaultMovementType?: MovementFormData["movement_type"];
}

export function StockMovementForm({ onSuccess, defaultMovementType = "receipt" }: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MovementFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(movementSchema) as any,
    defaultValues: { movement_type: defaultMovementType, quantity: 1 },
  });

  // Fetch products with brand, category, and aggregated stock levels
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
        supabase
          .from("stock_levels")
          .select("product_id, quantity"),
      ]);

      const stockMap = new Map<string, number>();
      for (const s of stocks ?? []) {
        stockMap.set(s.product_id, (stockMap.get(s.product_id) ?? 0) + s.quantity);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (prods ?? []).map((p: any) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        brand: p.brand?.name ?? undefined,
        category: p.category?.name ?? undefined,
        cost_price: p.cost_price ?? null,
        selling_price: p.selling_price ?? null,
        currentStock: stockMap.get(p.id) ?? 0,
        reorderPoint: p.reorder_point ?? undefined,
      }));
    },
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("locations")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("vendors")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const productId   = watch("product_id");
  const locationId  = watch("location_id");
  const movementType = watch("movement_type");
  const quantity    = watch("quantity");

  // Live per-location stock for the selected product+location
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

  const isOutbound = OUT_TYPES.includes(movementType);
  const parsedQty  = Number(quantity);
  const wouldGoNegative =
    isOutbound &&
    locationStock != null &&
    !isNaN(parsedQty) &&
    parsedQty > locationStock;

  async function onSubmit(values: MovementFormData) {
    setSubmitError(null);

    if (OUT_TYPES.includes(values.movement_type) && locationStock != null) {
      if (values.quantity > locationStock) {
        setSubmitError(
          `Insufficient stock. Available: ${locationStock}, requested: ${values.quantity}.`
        );
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
      notes:         values.notes || null,
      vendor_id:     values.vendor_id || null,
      created_by:    user?.id ?? null,
    });

    if (error) {
      setSubmitError(error.message);
      return;
    }

    const actionMap: Record<string, string> = {
      purchase: "stock_added", return_in: "stock_added", adjustment_in: "stock_adjusted",
      sale: "stock_removed", return_out: "stock_removed", adjustment_out: "stock_adjusted",
    };
    logAudit({
      action: actionMap[values.movement_type] ?? "stock_adjusted",
      module: "inventory",
      record_name: values.reference_no || values.movement_type,
      metadata: { movement_type: values.movement_type, quantity: values.quantity },
    });

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Product — searchable combobox */}
      <div className="space-y-1">
        <Label>Product *</Label>
        <ProductCombobox
          products={products}
          value={productId ?? ""}
          onChange={(id) => {
            setValue("product_id", id, { shouldValidate: true });
          }}
          error={errors.product_id?.message}
          isOutbound={isOutbound}
          disabled={isSubmitting}
        />
        {errors.product_id && (
          <p className="text-xs text-destructive">{errors.product_id.message}</p>
        )}
      </div>

      {/* Location */}
      <div className="space-y-1">
        <Label>Location *</Label>
        <Select onValueChange={(v) => setValue("location_id", v, { shouldValidate: true })}>
          <SelectTrigger>
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

      {/* Per-location available stock banner */}
      {isOutbound && locationStock != null && (
        <p className="text-sm text-muted-foreground -mt-1">
          Available at this location:{" "}
          <span className={locationStock === 0 ? "text-destructive font-semibold" : "font-semibold"}>
            {locationStock}
          </span>
        </p>
      )}

      {/* Movement type + Quantity */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Movement Type *</Label>
          <Select
            value={movementType}
            onValueChange={(v) => setValue("movement_type", v as MovementFormData["movement_type"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["receipt", "sale", "transfer_in", "transfer_out", "adjustment", "return", "damage"] as const).map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Quantity *</Label>
          <Input type="number" min={1} step={1} onKeyDown={preventDecimalInput} {...register("quantity")} />
          {errors.quantity && (
            <p className="text-xs text-destructive">{errors.quantity.message}</p>
          )}
          {wouldGoNegative && (
            <p className="text-xs text-destructive">
              Exceeds available stock ({locationStock})
            </p>
          )}
        </div>
      </div>

      {/* Vendor (receipts only) */}
      {movementType === "receipt" && (
        <div className="space-y-1">
          <Label>Vendor</Label>
          <Select onValueChange={(v) => setValue("vendor_id", v)}>
            <SelectTrigger>
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

      <div className="space-y-1">
        <Label>Reference No</Label>
        <Input {...register("reference_no")} placeholder="PO-001, INV-123…" />
      </div>

      <div className="space-y-1">
        <Label>Notes</Label>
        <Input {...register("notes")} placeholder="Optional notes" />
      </div>

      {submitError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting || wouldGoNegative}>
          {isSubmitting ? "Saving…" : "Record Movement"}
        </Button>
      </div>
    </form>
  );
}
