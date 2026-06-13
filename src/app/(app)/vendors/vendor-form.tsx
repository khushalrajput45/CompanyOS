"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import type { Vendor } from "@/lib/types";

// ── Validation ────────────────────────────────────────────────────────────────

const vendorSchema = z.object({
  name:           z.string().min(1, "Vendor name is required").max(100, "Too long"),
  company_name:   z.string().max(100, "Too long").optional(),
  contact_person: z.string().max(100, "Too long").optional(),
  phone:          z.string().max(20, "Too long").optional(),
  email:          z
    .string()
    .optional()
    .refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email"),
  gst_number: z
    .string()
    .max(15, "Too long")
    .optional()
    .refine(
      v => !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v),
      "Invalid GST number (e.g. 27AABCA1234B1Z5)"
    ),
  address:  z.string().max(500, "Too long").optional(),
  city:     z.string().max(100, "Too long").optional(),
  state:    z.string().max(100, "Too long").optional(),
  pincode:  z
    .string()
    .max(6, "Too long")
    .optional()
    .refine(v => !v || /^[0-9]{6}$/.test(v), "Must be 6 digits"),
  notes:     z.string().optional(),
  is_active: z.boolean().default(true),
});

type VendorFormData = z.infer<typeof vendorSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  vendor?: Vendor | null;
  onSuccess: (id: string) => void;
  onCancel?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VendorForm({ vendor, onSuccess, onCancel }: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<VendorFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(vendorSchema) as any,
    defaultValues: {
      name:           vendor?.name           ?? "",
      company_name:   vendor?.company_name   ?? "",
      contact_person: vendor?.contact_person ?? "",
      phone:          vendor?.phone          ?? "",
      email:          vendor?.email          ?? "",
      gst_number:     vendor?.gst_number     ?? "",
      address:        vendor?.address        ?? "",
      city:           vendor?.city           ?? "",
      state:          vendor?.state          ?? "",
      pincode:        vendor?.pincode        ?? "",
      notes:          vendor?.notes          ?? "",
      is_active:      vendor?.is_active      ?? true,
    },
  });

  const isActive = watch("is_active");

  async function onSubmit(values: VendorFormData) {
    setSubmitError(null);
    const supabase = createClient();

    const payload = {
      name:           values.name,
      company_name:   values.company_name   || null,
      contact_person: values.contact_person || null,
      phone:          values.phone          || null,
      email:          values.email          || null,
      gst_number:     values.gst_number     || null,
      address:        values.address        || null,
      city:           values.city           || null,
      state:          values.state          || null,
      pincode:        values.pincode        || null,
      notes:          values.notes          || null,
      is_active:      values.is_active,
    };

    if (vendor) {
      const { error } = await supabase
        .from("vendors")
        .update(payload)
        .eq("id", vendor.id);
      if (error) { setSubmitError(error.message); return; }
      onSuccess(vendor.id);
    } else {
      const { data, error } = await supabase
        .from("vendors")
        .insert(payload)
        .select("id")
        .single();
      if (error) { setSubmitError(error.message); return; }
      onSuccess(data.id);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Vendor Info ──────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Vendor Information
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Vendor Name *</Label>
              <Input {...register("name")} placeholder="Dell India Distributor" />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Company Name</Label>
              <Input {...register("company_name")} placeholder="Dell Technologies India Pvt Ltd" />
              {errors.company_name && (
                <p className="text-xs text-destructive">{errors.company_name.message}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Contact Info ─────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Contact Information
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Contact Person</Label>
              <Input {...register("contact_person")} placeholder="Rajesh Menon" />
              {errors.contact_person && (
                <p className="text-xs text-destructive">{errors.contact_person.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input {...register("phone")} placeholder="+91 98201 11234" />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input {...register("email")} type="email" placeholder="procurement@vendor.com" />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Address</Label>
            <Input {...register("address")} placeholder="Plot 45, MIDC Industrial Area" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>City</Label>
              <Input {...register("city")} placeholder="Mumbai" />
            </div>
            <div className="space-y-1">
              <Label>State</Label>
              <Input {...register("state")} placeholder="Maharashtra" />
            </div>
            <div className="space-y-1">
              <Label>Pincode</Label>
              <Input {...register("pincode")} placeholder="400093" maxLength={6} />
              {errors.pincode && (
                <p className="text-xs text-destructive">{errors.pincode.message}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── GST + Status ─────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          GST & Status
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>GST Number</Label>
            <Input
              {...register("gst_number")}
              placeholder="27AABCA1234B1Z5"
              maxLength={15}
              className="font-mono uppercase"
              onChange={e => setValue("gst_number", e.target.value.toUpperCase())}
            />
            {errors.gst_number && (
              <p className="text-xs text-destructive">{errors.gst_number.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={isActive ? "true" : "false"}
              onValueChange={v => setValue("is_active", v === "true")}
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
      </div>

      {/* ── Notes ────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Notes
        </h3>
        <div className="space-y-1">
          <textarea
            {...register("notes")}
            placeholder="Products supplied, payment terms, special conditions…"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2
                       focus:ring-ring focus:ring-offset-2 resize-none"
          />
        </div>
      </div>

      {submitError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : vendor ? "Update Vendor" : "Create Vendor"}
        </Button>
      </div>
    </form>
  );
}
