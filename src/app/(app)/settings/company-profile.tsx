"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2, Phone, MapPin, Landmark, Wallet,
  Palette, FileText, Upload, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import type { CompanySettings } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type FormState = {
  company_name: string;
  legal_business_name: string;
  gst_number: string;
  pan_number: string;
  phone: string;
  email: string;
  website: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  branch_name: string;
  upi_id: string;
  logo_url: string;
  invoice_prefix: string;
  quotation_prefix: string;
  purchase_order_prefix: string;
  grn_prefix: string;
};

const DEFAULTS: FormState = {
  company_name: "", legal_business_name: "", gst_number: "", pan_number: "",
  phone: "", email: "", website: "",
  address_line_1: "", address_line_2: "", city: "", state: "", country: "India", pincode: "",
  bank_name: "", account_holder_name: "", account_number: "", ifsc_code: "", branch_name: "",
  upi_id: "", logo_url: "",
  invoice_prefix: "INV", quotation_prefix: "QTN", purchase_order_prefix: "PO", grn_prefix: "GRN",
};

function settingsToForm(s: CompanySettings): FormState {
  return {
    company_name:          s.company_name          ?? "",
    legal_business_name:   s.legal_business_name   ?? "",
    gst_number:            s.gst_number            ?? "",
    pan_number:            s.pan_number            ?? "",
    phone:                 s.phone                 ?? "",
    email:                 s.email                 ?? "",
    website:               s.website               ?? "",
    address_line_1:        s.address_line_1        ?? "",
    address_line_2:        s.address_line_2        ?? "",
    city:                  s.city                  ?? "",
    state:                 s.state                 ?? "",
    country:               s.country               || "India",
    pincode:               s.pincode               ?? "",
    bank_name:             s.bank_name             ?? "",
    account_holder_name:   s.account_holder_name   ?? "",
    account_number:        s.account_number        ?? "",
    ifsc_code:             s.ifsc_code             ?? "",
    branch_name:           s.branch_name           ?? "",
    upi_id:                s.upi_id                ?? "",
    logo_url:              s.logo_url              ?? "",
    invoice_prefix:        s.invoice_prefix        || "INV",
    quotation_prefix:      s.quotation_prefix      || "QTN",
    purchase_order_prefix: s.purchase_order_prefix || "PO",
    grn_prefix:            s.grn_prefix            || "GRN",
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({
  label, id, required, children,
}: { label: string; id: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  settings: CompanySettings | null;
  isAdmin: boolean;
}

export function CompanyProfileSettings({ settings, isAdmin }: Props) {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const [form, setForm] = useState<FormState>(settings ? settingsToForm(settings) : DEFAULTS);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync form when settings load (e.g. on first render if data arrives async)
  useEffect(() => {
    if (settings) setForm(settingsToForm(settings));
  }, [settings?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  // ── Save mutation ──────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();

      // Validation
      if (!form.company_name.trim()) throw new Error("Company Name is required.");
      if (form.gst_number && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(form.gst_number)) {
        throw new Error("GST number format is invalid (e.g. 27AABCU9603R1ZX).");
      }
      if (form.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(form.pan_number)) {
        throw new Error("PAN number format is invalid (e.g. ABCDE1234F).");
      }
      if (form.ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.ifsc_code)) {
        throw new Error("IFSC code format is invalid (e.g. SBIN0001234).");
      }
      if (!form.invoice_prefix.trim() || !form.quotation_prefix.trim() ||
          !form.purchase_order_prefix.trim() || !form.grn_prefix.trim()) {
        throw new Error("Document prefixes cannot be empty.");
      }

      const payload = {
        company_name:          form.company_name.trim()          || null,
        legal_business_name:   form.legal_business_name.trim()   || null,
        gst_number:            form.gst_number.trim().toUpperCase() || null,
        pan_number:            form.pan_number.trim().toUpperCase() || null,
        phone:                 form.phone.trim()                  || null,
        email:                 form.email.trim().toLowerCase()    || null,
        website:               form.website.trim()                || null,
        address_line_1:        form.address_line_1.trim()         || null,
        address_line_2:        form.address_line_2.trim()         || null,
        city:                  form.city.trim()                   || null,
        state:                 form.state.trim()                  || null,
        country:               form.country.trim()                || "India",
        pincode:               form.pincode.trim()                || null,
        bank_name:             form.bank_name.trim()              || null,
        account_holder_name:   form.account_holder_name.trim()    || null,
        account_number:        form.account_number.trim()         || null,
        ifsc_code:             form.ifsc_code.trim().toUpperCase() || null,
        branch_name:           form.branch_name.trim()            || null,
        upi_id:                form.upi_id.trim()                 || null,
        logo_url:              form.logo_url.trim()               || null,
        invoice_prefix:        form.invoice_prefix.trim().toUpperCase(),
        quotation_prefix:      form.quotation_prefix.trim().toUpperCase(),
        purchase_order_prefix: form.purchase_order_prefix.trim().toUpperCase(),
        grn_prefix:            form.grn_prefix.trim().toUpperCase(),
      };

      if (settings) {
        const { error } = await supabase
          .from("company_settings")
          .update(payload)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("company_settings")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
    },
  });

  // ── Logo upload ────────────────────────────────────────────────────────────
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("Please upload an image file (PNG, JPG, WEBP, SVG).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Logo must be under 2 MB.");
      return;
    }
    setLogoError(null);
    setUploadingLogo(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "png";
      const orgId = profile?.organization_id ?? "shared";
      const fileName = `${orgId}/logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(fileName, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from("company-logos")
        .getPublicUrl(fileName);
      setForm(prev => ({ ...prev, logo_url: publicUrl }));
    } catch (err) {
      setLogoError((err as Error).message);
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const isReadOnly = !isAdmin;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-4xl">
      {!isAdmin && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted/60 border text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0" />
          You have view-only access to Company Settings. Contact an admin to make changes.
        </div>
      )}

      {/* ── 1. Business Information ─────────────────────────────── */}
      <SectionCard icon={Building2} title="Business Information">
        <Row>
          <Field label="Company Name" id="company_name" required>
            <Input
              id="company_name"
              placeholder="e.g. Acme Distributors"
              value={form.company_name}
              onChange={set("company_name")}
              disabled={isReadOnly}
            />
          </Field>
          <Field label="Legal Business Name" id="legal_business_name">
            <Input
              id="legal_business_name"
              placeholder="As registered with GST / ROC"
              value={form.legal_business_name}
              onChange={set("legal_business_name")}
              disabled={isReadOnly}
            />
          </Field>
        </Row>
        <Row>
          <Field label="GST Number" id="gst_number">
            <Input
              id="gst_number"
              placeholder="27AABCU9603R1ZX"
              value={form.gst_number}
              onChange={set("gst_number")}
              className="font-mono"
              maxLength={15}
              disabled={isReadOnly}
            />
          </Field>
          <Field label="PAN Number" id="pan_number">
            <Input
              id="pan_number"
              placeholder="ABCDE1234F"
              value={form.pan_number}
              onChange={set("pan_number")}
              className="font-mono"
              maxLength={10}
              disabled={isReadOnly}
            />
          </Field>
        </Row>
      </SectionCard>

      {/* ── 2. Contact Information ──────────────────────────────── */}
      <SectionCard icon={Phone} title="Contact Information">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Phone" id="phone">
            <Input
              id="phone"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={set("phone")}
              disabled={isReadOnly}
            />
          </Field>
          <Field label="Email" id="email">
            <Input
              id="email"
              type="email"
              placeholder="info@yourcompany.in"
              value={form.email}
              onChange={set("email")}
              disabled={isReadOnly}
            />
          </Field>
          <Field label="Website" id="website">
            <Input
              id="website"
              placeholder="www.yourcompany.in"
              value={form.website}
              onChange={set("website")}
              disabled={isReadOnly}
            />
          </Field>
        </div>
      </SectionCard>

      {/* ── 3. Business Address ─────────────────────────────────── */}
      <SectionCard icon={MapPin} title="Business Address">
        <Field label="Address Line 1" id="address_line_1">
          <Input
            id="address_line_1"
            placeholder="Building, Street"
            value={form.address_line_1}
            onChange={set("address_line_1")}
            disabled={isReadOnly}
          />
        </Field>
        <Field label="Address Line 2" id="address_line_2">
          <Input
            id="address_line_2"
            placeholder="Area, Landmark (optional)"
            value={form.address_line_2}
            onChange={set("address_line_2")}
            disabled={isReadOnly}
          />
        </Field>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="City" id="city">
            <Input id="city" placeholder="Mumbai" value={form.city} onChange={set("city")} disabled={isReadOnly} />
          </Field>
          <Field label="State" id="state">
            <Input id="state" placeholder="Maharashtra" value={form.state} onChange={set("state")} disabled={isReadOnly} />
          </Field>
          <Field label="Country" id="country">
            <Input id="country" placeholder="India" value={form.country} onChange={set("country")} disabled={isReadOnly} />
          </Field>
          <Field label="Pincode" id="pincode">
            <Input id="pincode" placeholder="400001" value={form.pincode} onChange={set("pincode")} maxLength={6} disabled={isReadOnly} />
          </Field>
        </div>
      </SectionCard>

      {/* ── 4. Banking Details ──────────────────────────────────── */}
      <SectionCard icon={Landmark} title="Banking Details">
        <Row>
          <Field label="Bank Name" id="bank_name">
            <Input id="bank_name" placeholder="State Bank of India" value={form.bank_name} onChange={set("bank_name")} disabled={isReadOnly} />
          </Field>
          <Field label="Account Holder Name" id="account_holder_name">
            <Input id="account_holder_name" placeholder="As per bank records" value={form.account_holder_name} onChange={set("account_holder_name")} disabled={isReadOnly} />
          </Field>
        </Row>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Account Number" id="account_number">
            <Input
              id="account_number"
              placeholder="00000000000000"
              value={form.account_number}
              onChange={set("account_number")}
              className="font-mono"
              disabled={isReadOnly}
            />
          </Field>
          <Field label="IFSC Code" id="ifsc_code">
            <Input
              id="ifsc_code"
              placeholder="SBIN0001234"
              value={form.ifsc_code}
              onChange={set("ifsc_code")}
              className="font-mono"
              maxLength={11}
              disabled={isReadOnly}
            />
          </Field>
          <Field label="Branch Name" id="branch_name">
            <Input id="branch_name" placeholder="Fort Branch, Mumbai" value={form.branch_name} onChange={set("branch_name")} disabled={isReadOnly} />
          </Field>
        </div>
      </SectionCard>

      {/* ── 5. UPI Information ──────────────────────────────────── */}
      <SectionCard icon={Wallet} title="UPI Information">
        <div className="max-w-sm">
          <Field label="UPI ID" id="upi_id">
            <Input
              id="upi_id"
              placeholder="yourname@upi"
              value={form.upi_id}
              onChange={set("upi_id")}
              className="font-mono"
              disabled={isReadOnly}
            />
          </Field>
        </div>
      </SectionCard>

      {/* ── 6. Branding ─────────────────────────────────────────── */}
      <SectionCard icon={Palette} title="Branding">
        <div className="flex items-start gap-6">
          {/* Logo preview */}
          <div className="shrink-0">
            <div className="h-24 w-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
              {form.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logo_url} alt="Company logo" className="h-full w-full object-contain p-1" />
              ) : (
                <Building2 className="h-8 w-8 text-muted-foreground/40" />
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 text-center">PNG, JPG, SVG<br/>Max 2 MB</p>
          </div>

          <div className="flex-1 space-y-3">
            <Field label="Logo URL" id="logo_url">
              <Input
                id="logo_url"
                placeholder="https://..."
                value={form.logo_url}
                onChange={set("logo_url")}
                disabled={isReadOnly}
              />
            </Field>
            {isAdmin && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">or</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={uploadingLogo}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadingLogo
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</>
                      : <><Upload className="h-3.5 w-3.5 mr-1.5" />Upload File</>
                    }
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>
                {logoError && <p className="text-xs text-destructive">{logoError}</p>}
              </>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── 7. Document Numbering ───────────────────────────────── */}
      <SectionCard icon={FileText} title="Document Numbering">
        <p className="text-xs text-muted-foreground -mt-1">
          Prefixes used when generating document numbers. Changing these affects new documents only.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Invoice Prefix" id="invoice_prefix">
            <Input
              id="invoice_prefix"
              value={form.invoice_prefix}
              onChange={set("invoice_prefix")}
              className="font-mono"
              maxLength={10}
              disabled={isReadOnly}
            />
          </Field>
          <Field label="Quotation Prefix" id="quotation_prefix">
            <Input
              id="quotation_prefix"
              value={form.quotation_prefix}
              onChange={set("quotation_prefix")}
              className="font-mono"
              maxLength={10}
              disabled={isReadOnly}
            />
          </Field>
          <Field label="PO Prefix" id="purchase_order_prefix">
            <Input
              id="purchase_order_prefix"
              value={form.purchase_order_prefix}
              onChange={set("purchase_order_prefix")}
              className="font-mono"
              maxLength={10}
              disabled={isReadOnly}
            />
          </Field>
          <Field label="GRN Prefix" id="grn_prefix">
            <Input
              id="grn_prefix"
              value={form.grn_prefix}
              onChange={set("grn_prefix")}
              className="font-mono"
              maxLength={10}
              disabled={isReadOnly}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span className="font-mono bg-muted/60 px-2 py-0.5 rounded">{form.invoice_prefix || "INV"}-000001</span>
          <span className="font-mono bg-muted/60 px-2 py-0.5 rounded">{form.quotation_prefix || "QTN"}-000001</span>
          <span className="font-mono bg-muted/60 px-2 py-0.5 rounded">{form.purchase_order_prefix || "PO"}-000001</span>
          <span className="font-mono bg-muted/60 px-2 py-0.5 rounded">{form.grn_prefix || "GRN"}-000001</span>
        </div>
      </SectionCard>

      {/* ── Save button ──────────────────────────────────────────── */}
      {isAdmin && (
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="min-w-[120px]"
          >
            {saveMutation.isPending
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</>
              : "Save Settings"
            }
          </Button>
          {saveMutation.isSuccess && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Settings saved successfully.
            </span>
          )}
          {saveMutation.isError && (
            <span className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {(saveMutation.error as Error).message}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
