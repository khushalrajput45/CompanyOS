"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
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
  quantity: z.coerce.number().min(1, "Quantity must be >= 1"),
  reference_no: z.string().optional(),
  notes: z.string().optional(),
  vendor_id: z.string().optional(),
});

type MovementFormData = z.infer<typeof movementSchema>;

interface Props {
  onSuccess: () => void;
}

export function StockMovementForm({ onSuccess }: Props) {
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
    defaultValues: { movement_type: "receipt", quantity: 1 },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("id, sku, name")
        .is("deleted_at", null)
        .order("name");
      return data ?? [];
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

  const productId = watch("product_id");
  const locationId = watch("location_id");
  const movementType = watch("movement_type");
  const quantity = watch("quantity");

  // Live available stock for the selected product+location
  const { data: currentStock } = useQuery({
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
  const parsedQty = Number(quantity);
  const wouldGoNegative =
    isOutbound &&
    currentStock != null &&
    !isNaN(parsedQty) &&
    parsedQty > currentStock;

  async function onSubmit(values: MovementFormData) {
    setSubmitError(null);

    // Guard: prevent negative stock on outbound movements
    if (OUT_TYPES.includes(values.movement_type) && currentStock != null) {
      if (values.quantity > currentStock) {
        setSubmitError(
          `Insufficient stock. Available: ${currentStock}, requested: ${values.quantity}.`
        );
        return;
      }
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("stock_movements").insert({
      product_id: values.product_id,
      location_id: values.location_id,
      movement_type: values.movement_type,
      quantity: values.quantity,
      reference_no: values.reference_no || null,
      notes: values.notes || null,
      vendor_id: values.vendor_id || null,
      created_by: user?.id ?? null,
    });

    if (error) {
      setSubmitError(error.message);
      return;
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label>Product *</Label>
        <Select onValueChange={(v) => setValue("product_id", v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select product" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.sku} — {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.product_id && (
          <p className="text-xs text-destructive">{errors.product_id.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label>Location *</Label>
        <Select onValueChange={(v) => setValue("location_id", v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.location_id && (
          <p className="text-xs text-destructive">{errors.location_id.message}</p>
        )}
      </div>

      {/* Show available stock when product+location selected and it's an outbound type */}
      {isOutbound && currentStock != null && (
        <p className="text-sm text-muted-foreground">
          Available at this location:{" "}
          <span className={currentStock === 0 ? "text-destructive font-semibold" : "font-semibold"}>
            {currentStock}
          </span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Movement Type *</Label>
          <Select
            value={movementType}
            onValueChange={(v) =>
              setValue("movement_type", v as MovementFormData["movement_type"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "receipt",
                "sale",
                "transfer_in",
                "transfer_out",
                "adjustment",
                "return",
                "damage",
              ].map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Quantity *</Label>
          <Input type="number" min={1} {...register("quantity")} />
          {errors.quantity && (
            <p className="text-xs text-destructive">{errors.quantity.message}</p>
          )}
          {wouldGoNegative && (
            <p className="text-xs text-destructive">
              Exceeds available stock ({currentStock})
            </p>
          )}
        </div>
      </div>

      {movementType === "receipt" && (
        <div className="space-y-1">
          <Label>Vendor</Label>
          <Select onValueChange={(v) => setValue("vendor_id", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select vendor" />
            </SelectTrigger>
            <SelectContent>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1">
        <Label>Reference No</Label>
        <Input {...register("reference_no")} placeholder="PO-001, INV-123..." />
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
          {isSubmitting ? "Saving..." : "Record Movement"}
        </Button>
      </div>
    </form>
  );
}
