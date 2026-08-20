"use client";

import { useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { AlertTriangle, Pencil, Check, MapPin, Plus, PlusCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AddressData = {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
};

interface Props {
  customerName:    string;
  companyName?:    string | null;
  gstNumber?:      string | null;
  phone?:          string | null;
  billingAddress:  AddressData | null;
  shippingAddress: AddressData | null;
  onBillingChange:  (addr: AddressData | null) => void;
  onShippingChange: (addr: AddressData | null) => void;
  disabled?: boolean;
}

// ── Inline address display ────────────────────────────────────────────────────

function AddressLines({ addr }: { addr: AddressData }) {
  const cityLine = [addr.city, addr.state, addr.pincode].filter(Boolean).join(", ");
  return (
    <div className="text-sm space-y-0.5 text-foreground">
      {addr.line1 && <p>{addr.line1}</p>}
      {addr.line2 && <p>{addr.line2}</p>}
      {cityLine   && <p>{cityLine}</p>}
    </div>
  );
}

// ── Inline edit form ──────────────────────────────────────────────────────────

function AddressEditForm({
  initialAddr,
  onSave,
  onCancel,
}: {
  initialAddr: AddressData | null;
  onSave: (addr: AddressData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AddressData>(
    initialAddr ?? { line1: "", line2: "", city: "", state: "", pincode: "" }
  );
  const set = (k: keyof AddressData, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-2 pt-2 border-t">
      <div className="space-y-1">
        <Label className="text-xs">Address Line 1</Label>
        <Input
          value={form.line1}
          onChange={e => set("line1", e.target.value)}
          placeholder="Street, building, floor…"
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Address Line 2 <span className="text-muted-foreground">(optional)</span></Label>
        <Input
          value={form.line2 ?? ""}
          onChange={e => set("line2", e.target.value)}
          placeholder="Area, landmark…"
          className="h-9 text-sm"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">City</Label>
          <Input value={form.city}    onChange={e => set("city",    e.target.value)} placeholder="Mumbai" className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">State</Label>
          <Input value={form.state}   onChange={e => set("state",   e.target.value)} placeholder="Maharashtra" className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Pincode</Label>
          <Input value={form.pincode} onChange={e => set("pincode", e.target.value)} placeholder="400001" maxLength={6} className="h-9 text-sm" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" size="sm" className="h-8" onClick={() => onSave(form)}>
          <Check className="h-3.5 w-3.5 mr-1" />Save
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AddressCard({
  customerName,
  companyName,
  gstNumber,
  phone,
  billingAddress,
  shippingAddress,
  onBillingChange,
  onShippingChange,
  disabled,
}: Props) {
  const [editBilling,  setEditBilling]  = useState(false);
  const [editShipping, setEditShipping] = useState(false);
  const [addShipping,  setAddShipping]  = useState(false);

  const displayName = companyName || customerName;
  const hasShipping = !!shippingAddress;

  return (
    <div className="space-y-3">

      {/* ── Missing billing address warning ────────────────────── */}
      {!billingAddress && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          <span>
            <strong>Billing address missing.</strong>{" "}
            Customer has no address on file. You can add one for this document only below.
          </span>
        </div>
      )}

      {/* ── Address cards ───────────────────────────────────────── */}
      <div className={cn("grid gap-4", hasShipping ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>

        {/* BILL TO */}
        <div className="rounded-lg border bg-muted/20 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Bill To</span>
            </div>
            {!editBilling && !disabled && (
              <button
                type="button"
                onClick={() => setEditBilling(true)}
                className="text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" />
                Edit for this document
              </button>
            )}
          </div>

          {/* Customer meta */}
          <div>
            <p className="font-semibold text-sm">{displayName}</p>
            {companyName && customerName !== companyName && (
              <p className="text-xs text-muted-foreground">{customerName}</p>
            )}
            {gstNumber && (
              <p className="text-xs text-muted-foreground">GST: {gstNumber}</p>
            )}
            {phone && (
              <p className="text-xs text-muted-foreground">{phone}</p>
            )}
          </div>

          {/* Address or missing notice */}
          {billingAddress && !editBilling && <AddressLines addr={billingAddress} />}

          {!billingAddress && !editBilling && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setEditBilling(true)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />Add billing address for this document
            </button>
          )}

          {editBilling && (
            <AddressEditForm
              initialAddr={billingAddress}
              onSave={(addr) => { onBillingChange(addr); setEditBilling(false); }}
              onCancel={() => setEditBilling(false)}
            />
          )}
        </div>

        {/* SHIP TO */}
        {hasShipping && (
          <div className="rounded-lg border bg-muted/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ship To</span>
              </div>
              <div className="flex items-center gap-3">
                {!editShipping && !disabled && (
                  <button
                    type="button"
                    onClick={() => setEditShipping(true)}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <Pencil className="h-3 w-3" />Edit
                  </button>
                )}
                {!editShipping && !disabled && (
                  <button
                    type="button"
                    onClick={() => onShippingChange(null)}
                    className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />Remove
                  </button>
                )}
              </div>
            </div>

            {shippingAddress && !editShipping && <AddressLines addr={shippingAddress} />}

            {editShipping && (
              <AddressEditForm
                initialAddr={shippingAddress}
                onSave={(addr) => { onShippingChange(addr); setEditShipping(false); }}
                onCancel={() => setEditShipping(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Add shipping address link (when no shipping exists) */}
      {!hasShipping && !addShipping && !disabled && (
        <button
          type="button"
          onClick={() => setAddShipping(true)}
          className="text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8] hover:underline flex items-center gap-1.5 cursor-pointer"
        >
          <PlusCircle className="h-4 w-4 shrink-0" />Add separate shipping address for this document
        </button>
      )}

      {/* Inline add-shipping form */}
      {!hasShipping && addShipping && (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-2.5">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ship To</span>
          </div>
          <AddressEditForm
            initialAddr={null}
            onSave={(addr) => { onShippingChange(addr); setAddShipping(false); }}
            onCancel={() => setAddShipping(false)}
          />
        </div>
      )}
    </div>
  );
}
