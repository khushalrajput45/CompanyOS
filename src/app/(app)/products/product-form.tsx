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
import type { Product } from "@/lib/types";
import { BrandCategoryManager } from "@/components/ui/brand-category-manager";
import { preventDecimalInput } from "@/lib/utils";

const productSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  brand_id: z.string().optional(),
  category_id: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  selling_price: z.coerce.number().min(0, "Must be >= 0"),
  cost_price: z.coerce.number().min(0).optional(),
  mrp: z.coerce.number().min(0).optional(),
  reorder_point: z.coerce.number().int("Quantity must be a whole number").min(0).default(0),
  reorder_qty: z.coerce.number().int("Quantity must be a whole number").min(0).default(0),
  warranty_months: z.coerce.number().int("Must be a whole number").min(0).optional(),
  hsn_code: z.string().optional(),
  tax_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  is_active: z.boolean().default(true),
});

type ProductFormData = z.infer<typeof productSchema>;

interface Props {
  product: Product | null;
  onSuccess: () => void;
}

export function ProductForm({ product, onSuccess }: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      sku: product?.sku ?? "",
      name: product?.name ?? "",
      description: product?.description ?? "",
      brand_id: product?.brand_id ?? undefined,
      category_id: product?.category_id ?? undefined,
      unit: product?.unit ?? "pcs",
      selling_price: product?.selling_price ?? 0,
      cost_price: product?.cost_price ?? undefined,
      mrp: product?.mrp ?? undefined,
      reorder_point: product?.reorder_point ?? 0,
      reorder_qty: product?.reorder_qty ?? 0,
      warranty_months: product?.warranty_months ?? undefined,
      hsn_code: product?.hsn_code ?? "",
      tax_rate: product?.tax_rate ?? null,
      is_active: product?.is_active ?? true,
    },
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("brands")
        .select("id, name")
        .is("deleted_at", null)
        .order("name");
      return data ?? [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("categories")
        .select("id, name")
        .is("deleted_at", null)
        .order("name");
      return data ?? [];
    },
  });

  async function onSubmit(values: ProductFormData) {
    setSubmitError(null);
    const supabase = createClient();
    const payload = {
      sku: values.sku,
      name: values.name,
      description: values.description || null,
      brand_id: values.brand_id || null,
      category_id: values.category_id || null,
      unit: values.unit,
      selling_price: values.selling_price,
      cost_price: values.cost_price ?? null,
      mrp: values.mrp ?? null,
      reorder_point: values.reorder_point,
      reorder_qty: values.reorder_qty,
      warranty_months: values.warranty_months ?? null,
      hsn_code: values.hsn_code || null,
      tax_rate: values.tax_rate ?? null,
      is_active: values.is_active,
    };

    if (product) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", product.id);
      if (error) { setSubmitError(error.message); return; }
      logAudit({ action: "updated", module: "products", record_id: product.id, record_name: values.name });

      const sellingChanged = values.selling_price !== product.selling_price;
      const costChanged = (values.cost_price ?? null) !== product.cost_price;
      if (sellingChanged || costChanged) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error: phError } = await supabase.from("price_history").insert({
          product_id: product.id,
          old_selling_price: product.selling_price,
          new_selling_price: values.selling_price,
          old_cost_price: product.cost_price ?? null,
          new_cost_price: values.cost_price ?? null,
          reason: "Manual update",
          changed_by: user?.id ?? null,
        });
        if (phError) {
          // Product was saved; only the audit trail failed. Show a warning but still close.
          // eslint-disable-next-line no-console
          console.warn("price_history insert failed:", phError.message);
        }
      }
    } else {
      const { data: inserted, error } = await supabase.from("products").insert(payload).select("id").single();
      if (error) {
        setSubmitError(
          error.message.includes("unique")
            ? `SKU "${values.sku}" already exists.`
            : error.message
        );
        return;
      }
      logAudit({ action: "created", module: "products", record_id: inserted?.id, record_name: values.name });
    }
    onSuccess();
  }

  const isActive = watch("is_active");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>SKU *</Label>
          <Input {...register("sku")} placeholder="SKU-001" />
          {errors.sku && (
            <p className="text-xs text-destructive">{errors.sku.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Unit *</Label>
          <Input {...register("unit")} placeholder="pcs" />
          {errors.unit && (
            <p className="text-xs text-destructive">{errors.unit.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label>Name *</Label>
        <Input {...register("name")} placeholder="Product name" />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label>Description</Label>
        <Input {...register("description")} placeholder="Optional description" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Brand</Label>
          <div className="flex gap-2">
            <Select
              value={watch("brand_id") ?? ""}
              onValueChange={(v) => setValue("brand_id", v || undefined)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <BrandCategoryManager
              type="brand"
              onCreated={(id) => setValue("brand_id", id)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Category</Label>
          <div className="flex gap-2">
            <Select
              value={watch("category_id") ?? ""}
              onValueChange={(v) => setValue("category_id", v || undefined)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <BrandCategoryManager
              type="category"
              onCreated={(id) => setValue("category_id", id)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>Selling Price (₹) *</Label>
          <Input type="number" step="0.01" {...register("selling_price")} />
          {errors.selling_price && (
            <p className="text-xs text-destructive">
              {errors.selling_price.message}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Cost Price (₹)</Label>
          <Input type="number" step="0.01" {...register("cost_price")} />
        </div>
        <div className="space-y-1">
          <Label>MRP (₹)</Label>
          <Input type="number" step="0.01" {...register("mrp")} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>Reorder Point</Label>
          <Input type="number" step={1} min={0} onKeyDown={preventDecimalInput} {...register("reorder_point")} />
          {errors.reorder_point && (
            <p className="text-xs text-destructive">{errors.reorder_point.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Reorder Qty</Label>
          <Input type="number" step={1} min={0} onKeyDown={preventDecimalInput} {...register("reorder_qty")} />
          {errors.reorder_qty && (
            <p className="text-xs text-destructive">{errors.reorder_qty.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Warranty (months)</Label>
          <Input type="number" step={1} min={0} onKeyDown={preventDecimalInput} {...register("warranty_months")} />
          {errors.warranty_months && (
            <p className="text-xs text-destructive">{errors.warranty_months.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>HSN Code</Label>
          <Input {...register("hsn_code")} placeholder="84713020" />
        </div>
        <div className="space-y-1">
          <Label>GST Rate (%)</Label>
          <Select
            value={watch("tax_rate") != null ? String(watch("tax_rate")) : ""}
            onValueChange={(v) => setValue("tax_rate", v === "" ? null : Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select rate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— None —</SelectItem>
              <SelectItem value="0">0% (Exempt)</SelectItem>
              <SelectItem value="5">5%</SelectItem>
              <SelectItem value="12">12%</SelectItem>
              <SelectItem value="18">18%</SelectItem>
              <SelectItem value="28">28%</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select
            value={isActive ? "true" : "false"}
            onValueChange={(v) => setValue("is_active", v === "true")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {submitError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : product ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
