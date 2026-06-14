"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import type { Customer } from "@/lib/types";

// ── Validation ────────────────────────────────────────────────────────────────

const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Too long"),
  company_name: z.string().max(100, "Too long").optional(),
  phone: z.string().max(20, "Too long").optional(),
  email: z
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
  address: z.string().max(500, "Too long").optional(),
  city: z.string().max(100, "Too long").optional(),
  state: z.string().max(100, "Too long").optional(),
  pincode: z
    .string()
    .max(6, "Too long")
    .optional()
    .refine(v => !v || /^[0-9]{6}$/.test(v), "Must be 6 digits"),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
});

type CustomerFormData = z.infer<typeof customerSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  customer?: Customer | null;
  onSuccess: (id: string) => void;
  onCancel?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CustomerForm({ customer, onSuccess, onCancel }: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(customerSchema) as any,
    defaultValues: {
      name:         customer?.name         ?? "",
      company_name: customer?.company_name ?? "",
      phone:        customer?.phone        ?? "",
      email:        customer?.email        ?? "",
      gst_number:   customer?.gst_number   ?? "",
      address:      customer?.address      ?? "",
      city:         customer?.city         ?? "",
      state:        customer?.state        ?? "",
      pincode:      customer?.pincode      ?? "",
      notes:        customer?.notes        ?? "",
      is_active:    customer?.is_active    ?? true,
    },
  });

  const isActive = watch("is_active");

  async function onSubmit(values: CustomerFormData) {
    setSubmitError(null);
    const supabase = createClient();

    const payload = {
      name:         values.name,
      company_name: values.company_name  || null,
      phone:        values.phone         || null,
      email:        values.email         || null,
      gst_number:   values.gst_number    || null,
      address:      values.address       || null,
      city:         values.city          || null,
      state:        values.state         || null,
      pincode:      values.pincode       || null,
      notes:        values.notes         || null,
      is_active:    values.is_active,
    };

    if (customer) {
      const { error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", customer.id);
      if (error) { setSubmitError(error.message); return; }
      logAudit({ action: "updated", module: "customers", record_id: customer.id, record_name: values.name });
      onSuccess(customer.id);
    } else {
      const { data, error } = await supabase
        .from("customers")
        .insert(payload)
        .select("id")
        .single();
      if (error) { setSubmitError(error.message); return; }
      logAudit({ action: "created", module: "customers", record_id: data.id, record_name: values.name });
      onSuccess(data.id);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Basic Info ───────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Basic Information
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Contact Name *</Label>
              <Input {...register("name")} placeholder="Rajesh Kumar" />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Company Name</Label>
              <Input {...register("company_name")} placeholder="ABC Technologies" />
              {errors.company_name && (
                <p className="text-xs text-destructive">{errors.company_name.message}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Contact Info ────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Contact Information
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input {...register("phone")} placeholder="+91 98201 11234" />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input {...register("email")} type="email" placeholder="rajesh@company.in" />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Address</Label>
            <Input {...register("address")} placeholder="Shop No. 12, Lamington Road" />
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
              <Input {...register("pincode")} placeholder="400007" maxLength={6} />
              {errors.pincode && (
                <p className="text-xs text-destructive">{errors.pincode.message}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── GST + Status ────────────────────────────────────── */}
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

      {/* ── Notes ───────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Notes
        </h3>
        <div className="space-y-1">
          <textarea
            {...register("notes")}
            placeholder="Any notes about this customer…"
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
          {isSubmitting ? "Saving…" : customer ? "Update Customer" : "Create Customer"}
        </Button>
      </div>
    </form>
  );
}
