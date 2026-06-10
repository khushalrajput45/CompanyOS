"use client";

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

  async function onSubmit(values: MovementFormData) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("stock_movements").insert({
      product_id: values.product_id,
      location_id: values.location_id,
      movement_type: values.movement_type,
      quantity: values.quantity,
      reference_no: values.reference_no || null,
      notes: values.notes || null,
      vendor_id: values.vendor_id || null,
      created_by: user?.id ?? null,
    });

    onSuccess();
  }

  const movementType = watch("movement_type");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label>Product *</Label>
        <Select
          onValueChange={(v) => setValue("product_id", v)}
        >
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

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Record Movement"}
        </Button>
      </div>
    </form>
  );
}
