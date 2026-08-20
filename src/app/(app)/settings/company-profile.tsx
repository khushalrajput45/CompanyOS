"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/utils/logAudit";
import { useProfile } from "@/lib/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Building2, Phone, MapPin, Landmark, FileText, Upload,
  CheckCircle2, AlertCircle, Loader2, TrendingUp, Palette, X,
} from "lucide-react";
import type { CompanySettings } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  "Proprietorship",
  "Partnership",
  "LLP (Limited Liability Partnership)",
  "Private Limited (Pvt. Ltd.)",
  "Public Limited (Ltd.)",
  "One Person Company (OPC)",
  "Other",
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  // Union Territories
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi (NCT)", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

const TAX_RATES = [0, 5, 12, 18, 28];

const BUSINESS_REQUIRES_CIN = [
  "LLP (Limited Liability Partnership)",
  "Private Limited (Pvt. Ltd.)",
  "Public Limited (Ltd.)",
  "One Person Company (OPC)",
];

// ── Validation helpers ────────────────────────────────────────────────────────

function validateGST(v: string) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(v);
}
function validatePAN(v: string) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(v);
}
function validateIFSC(v: string) {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(v);
}
function validatePhone(v: string) {
  const digits = v.replace(/[\s\-\+\(\)]/g, "");
  // Accept 10-digit mobile or with country code (+91XXXXXXXXXX = 12 digits)
  return /^(\d{10}|91\d{10})$/.test(digits);
}
function validateEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function validatePincode(v: string) {
  return /^\d{6}$/.test(v);
}
function validateWebsite(v: string) {
  return /^(https?:\/\/|www\.)\S+\.\S+/.test(v);
}

// ── Types ─────────────────────────────────────────────────────────────────────

type FormState = {
  // Business
  company_name: string;
  legal_business_name: string;
  business_type: string;
  gst_number: string;
  pan_number: string;
  tan_number: string;
  cin_number: string;
  msme_registration: string;
  // Contact
  phone: string;
  alternate_phone: string;
  email: string;
  support_email: string;
  website: string;
  // Address
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  // Banking
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  branch_name: string;
  upi_id: string;
  // Financial
  default_currency: string;
  default_tax_rate: string;
  financial_year_start: string;
  // Document numbering
  invoice_prefix: string;
  quotation_prefix: string;
  purchase_order_prefix: string;
  grn_prefix: string;
  vendor_payment_prefix: string;
  // Document defaults
  terms_and_conditions: string;
  payment_terms: string;
  default_notes: string;
  // Branding
  logo_url: string;
  signature_url: string;
};

const DEFAULTS: FormState = {
  company_name: "", legal_business_name: "", business_type: "", gst_number: "",
  pan_number: "", tan_number: "", cin_number: "", msme_registration: "",
  phone: "", alternate_phone: "", email: "", support_email: "", website: "",
  address_line_1: "", address_line_2: "", city: "", state: "", country: "India", pincode: "",
  bank_name: "", account_holder_name: "", account_number: "", ifsc_code: "", branch_name: "",
  upi_id: "",
  default_currency: "INR", default_tax_rate: "18", financial_year_start: "4",
  invoice_prefix: "INV", quotation_prefix: "QTN", purchase_order_prefix: "PO",
  grn_prefix: "GRN", vendor_payment_prefix: "VP",
  terms_and_conditions: "", payment_terms: "", default_notes: "",
  logo_url: "", signature_url: "",
};

function settingsToForm(s: CompanySettings): FormState {
  return {
    company_name:          s.company_name          ?? "",
    legal_business_name:   s.legal_business_name   ?? "",
    business_type:         s.business_type         ?? "",
    gst_number:            s.gst_number            ?? "",
    pan_number:            s.pan_number            ?? "",
    tan_number:            s.tan_number            ?? "",
    cin_number:            s.cin_number            ?? "",
    msme_registration:     s.msme_registration     ?? "",
    phone:                 s.phone                 ?? "",
    alternate_phone:       s.alternate_phone       ?? "",
    email:                 s.email                 ?? "",
    support_email:         s.support_email         ?? "",
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
    default_currency:      s.default_currency      || "INR",
    default_tax_rate:      String(s.default_tax_rate ?? 18),
    financial_year_start:  String(s.financial_year_start ?? 4),
    invoice_prefix:        s.invoice_prefix        || "INV",
    quotation_prefix:      s.quotation_prefix      || "QTN",
    purchase_order_prefix: s.purchase_order_prefix || "PO",
    grn_prefix:            s.grn_prefix            || "GRN",
    vendor_payment_prefix: s.vendor_payment_prefix || "VP",
    terms_and_conditions:  s.terms_and_conditions  ?? "",
    payment_terms:         s.payment_terms         ?? "",
    default_notes:         s.default_notes         ?? "",
    logo_url:              s.logo_url              ?? "",
    signature_url:         s.signature_url         ?? "",
  };
}

// ── UI Building blocks ────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon, title, subtitle, children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          {title}
        </CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({
  label, id, required, hint, children,
}: {
  label: string;
  id: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Row2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}
function Row3({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{children}</div>;
}
function Row4({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{children}</div>;
}
function Row5({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">{children}</div>;
}

// ── Image uploader sub-component ──────────────────────────────────────────────

interface ImageUploadProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  storagePath: (orgId: string, ts: number, ext: string) => string;
  disabled: boolean;
  previewClass?: string;
  hint?: string;
}

function ImageUploadField({
  label, value, onChange, storagePath, disabled, previewClass = "h-20 w-32", hint,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: profile } = useProfile();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"].includes(file.type)) {
      setError("Use PNG, JPG, WEBP, or SVG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("File must be under 2 MB.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "png";
      const orgId = profile?.organization_id ?? "shared";
      const path = storagePath(orgId, Date.now(), ext);
      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("company-logos").getPublicUrl(path);
      onChange(publicUrl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">{label}</p>
      <div className="flex items-start gap-4">
        {/* Preview box */}
        <div className={`${previewClass} rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/20 overflow-hidden shrink-0`}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={label} className="h-full w-full object-contain p-1.5" />
          ) : (
            <span className="text-[10px] text-muted-foreground/50 text-center px-2 leading-tight">
              No image
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-2 flex-1">
          {!disabled && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button" size="sm" variant="outline"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</>
                  : <><Upload className="h-3.5 w-3.5 mr-1.5" />Upload</>
                }
              </Button>
              {value && (
                <Button
                  type="button" size="sm" variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => { onChange(""); setError(null); }}
                >
                  <X className="h-3.5 w-3.5 mr-1" />Remove
                </Button>
              )}
              <button
                type="button"
                className="text-[11px] text-primary hover:underline"
                onClick={() => setShowUrlInput(v => !v)}
              >
                {showUrlInput ? "Hide URL" : "Use URL instead"}
              </button>
            </div>
          )}
          {showUrlInput && !disabled && (
            <Input
              placeholder="https://..."
              value={value}
              onChange={e => onChange(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  settings: CompanySettings | null;
  isAdmin: boolean;
}

export function CompanyProfileSettings({ settings, isAdmin }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => (settings ? settingsToForm(settings) : DEFAULTS));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));
  const setVal = (key: keyof FormState) => (v: string) =>
    setForm(prev => ({ ...prev, [key]: v }));

  const readOnly = !isAdmin;
  const showCIN = BUSINESS_REQUIRES_CIN.includes(form.business_type);

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};

    if (!form.company_name.trim()) errs.company_name = "Required.";

    if (form.gst_number && !validateGST(form.gst_number.trim()))
      errs.gst_number = "Invalid GST (e.g. 27AABCU9603R1ZX).";

    if (form.pan_number && !validatePAN(form.pan_number.trim()))
      errs.pan_number = "Invalid PAN (e.g. ABCDE1234F).";

    if (form.phone && !validatePhone(form.phone.trim()))
      errs.phone = "Enter a valid 10-digit phone number.";

    if (form.alternate_phone && !validatePhone(form.alternate_phone.trim()))
      errs.alternate_phone = "Enter a valid 10-digit phone number.";

    if (form.email && !validateEmail(form.email.trim()))
      errs.email = "Enter a valid email address.";

    if (form.support_email && !validateEmail(form.support_email.trim()))
      errs.support_email = "Enter a valid email address.";

    if (form.website && !validateWebsite(form.website.trim()))
      errs.website = "Enter a valid URL (e.g. www.company.in or https://...).";

    if (form.pincode && !validatePincode(form.pincode.trim()))
      errs.pincode = "Must be 6 digits.";

    if (form.ifsc_code && !validateIFSC(form.ifsc_code.trim()))
      errs.ifsc_code = "Invalid IFSC (e.g. SBIN0001234).";

    const prefixes = [
      "invoice_prefix", "quotation_prefix", "purchase_order_prefix",
      "grn_prefix", "vendor_payment_prefix",
    ] as const;
    prefixes.forEach(k => {
      if (!form[k].trim()) errs[k] = "Cannot be empty.";
    });

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error("Please fix the errors below.");

      const supabase = createClient();

      const payload = {
        // Business
        company_name:          form.company_name.trim()                 || null,
        legal_business_name:   form.legal_business_name.trim()          || null,
        business_type:         form.business_type                       || null,
        gst_number:            form.gst_number.trim().toUpperCase()     || null,
        pan_number:            form.pan_number.trim().toUpperCase()     || null,
        tan_number:            form.tan_number.trim().toUpperCase()     || null,
        cin_number:            form.cin_number.trim().toUpperCase()     || null,
        msme_registration:     form.msme_registration.trim()            || null,
        // Contact
        phone:                 form.phone.trim()                        || null,
        alternate_phone:       form.alternate_phone.trim()              || null,
        email:                 form.email.trim().toLowerCase()          || null,
        support_email:         form.support_email.trim().toLowerCase()  || null,
        website:               form.website.trim()                      || null,
        // Address
        address_line_1:        form.address_line_1.trim()               || null,
        address_line_2:        form.address_line_2.trim()               || null,
        city:                  form.city.trim()                         || null,
        state:                 form.state                               || null,
        country:               form.country.trim()                      || "India",
        pincode:               form.pincode.trim()                      || null,
        // Banking
        bank_name:             form.bank_name.trim()                    || null,
        account_holder_name:   form.account_holder_name.trim()          || null,
        account_number:        form.account_number.trim()               || null,
        ifsc_code:             form.ifsc_code.trim().toUpperCase()      || null,
        branch_name:           form.branch_name.trim()                  || null,
        upi_id:                form.upi_id.trim()                       || null,
        // Financial
        default_currency:      form.default_currency                    || "INR",
        default_tax_rate:      Number(form.default_tax_rate)            || 18,
        financial_year_start:  Number(form.financial_year_start)        || 4,
        // Branding
        logo_url:              form.logo_url.trim()                     || null,
        signature_url:         form.signature_url.trim()                || null,
        // Document numbering
        invoice_prefix:        form.invoice_prefix.trim().toUpperCase(),
        quotation_prefix:      form.quotation_prefix.trim().toUpperCase(),
        purchase_order_prefix: form.purchase_order_prefix.trim().toUpperCase(),
        grn_prefix:            form.grn_prefix.trim().toUpperCase(),
        vendor_payment_prefix: form.vendor_payment_prefix.trim().toUpperCase(),
        // Document defaults
        terms_and_conditions:  form.terms_and_conditions.trim()         || null,
        payment_terms:         form.payment_terms.trim()                || null,
        default_notes:         form.default_notes.trim()                || null,
      };

      if (settings) {
        const { error } = await supabase.from("company_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      // Detect which section changed for granular audit event
      const old = settings;
      let action = "company_profile_updated";
      if (old) {
        if (form.logo_url !== (old.logo_url ?? "")) action = "logo_changed";
        else if (form.gst_number !== (old.gst_number ?? "")) action = "gst_changed";
        else if (
          form.bank_name !== (old.bank_name ?? "") ||
          form.account_number !== (old.account_number ?? "") ||
          form.ifsc_code !== (old.ifsc_code ?? "")
        ) action = "bank_details_changed";
      }
      logAudit({ action, module: "company", record_name: form.company_name || "Company Profile" });
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      setFieldErrors({});
    },
  });

  const err = (k: keyof FormState) =>
    fieldErrors[k] ? <p className="text-[11px] text-destructive mt-0.5">{fieldErrors[k]}</p> : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-4xl">

      {/* Permission banner */}
      {!isAdmin && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted/60 border text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0" />
          View-only mode. Contact an Owner or Admin to make changes.
        </div>
      )}

      {/* ── 1. BUSINESS DETAILS ─────────────────────────────────────────── */}
      <SectionCard icon={Building2} title="Business Details">
        <Row2>
          <div>
            <Field label="Company Name" id="company_name" required>
              <Input
                id="company_name"
                placeholder="e.g. Acme IT Distributors"
                value={form.company_name}
                onChange={set("company_name")}
                disabled={readOnly}
              />
            </Field>
            {err("company_name")}
          </div>
          <Field label="Legal Business Name" id="legal_business_name"
            hint="As registered with GST / ROC">
            <Input
              id="legal_business_name"
              placeholder="Full registered legal name"
              value={form.legal_business_name}
              onChange={set("legal_business_name")}
              disabled={readOnly}
            />
          </Field>
        </Row2>

        <Row2>
          <Field label="Business Type" id="business_type">
            <Select value={form.business_type || "__none__"} onValueChange={v => setVal("business_type")(v === "__none__" ? "" : v)} disabled={readOnly}>
              <SelectTrigger id="business_type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Not specified —</SelectItem>
                {BUSINESS_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="MSME Registration" id="msme_registration"
            hint="Udyam Registration Number (if applicable)">
            <Input
              id="msme_registration"
              placeholder="UDYAM-XX-00-0000000"
              value={form.msme_registration}
              onChange={set("msme_registration")}
              className="font-mono"
              disabled={readOnly}
            />
          </Field>
        </Row2>

        <Row3>
          <div>
            <Field label="GST Number" id="gst_number">
              <Input
                id="gst_number"
                placeholder="27AABCU9603R1ZX"
                value={form.gst_number}
                onChange={e => setVal("gst_number")(e.target.value.toUpperCase())}
                className="font-mono"
                maxLength={15}
                disabled={readOnly}
              />
            </Field>
            {err("gst_number")}
          </div>
          <div>
            <Field label="PAN Number" id="pan_number">
              <Input
                id="pan_number"
                placeholder="ABCDE1234F"
                value={form.pan_number}
                onChange={e => setVal("pan_number")(e.target.value.toUpperCase())}
                className="font-mono"
                maxLength={10}
                disabled={readOnly}
              />
            </Field>
            {err("pan_number")}
          </div>
          <div>
            <Field label="TAN Number" id="tan_number" hint="Tax Deduction Account Number (for TDS)">
              <Input
                id="tan_number"
                placeholder="ABCD12345E"
                value={form.tan_number}
                onChange={e => setVal("tan_number")(e.target.value.toUpperCase())}
                className="font-mono"
                maxLength={10}
                disabled={readOnly}
              />
            </Field>
          </div>
        </Row3>

        {showCIN && (
          <Row2>
            <Field label="CIN Number" id="cin_number"
              hint="Company Identification Number (from MCA)">
              <Input
                id="cin_number"
                placeholder="U12345MH2020PTC123456"
                value={form.cin_number}
                onChange={e => setVal("cin_number")(e.target.value.toUpperCase())}
                className="font-mono"
                maxLength={21}
                disabled={readOnly}
              />
            </Field>
          </Row2>
        )}
      </SectionCard>

      {/* ── 2. CONTACT DETAILS ──────────────────────────────────────────── */}
      <SectionCard icon={Phone} title="Contact Details">
        <Row2>
          <div>
            <Field label="Primary Phone" id="phone">
              <Input id="phone" placeholder="+91 98765 43210"
                value={form.phone} onChange={set("phone")} disabled={readOnly} />
            </Field>
            {err("phone")}
          </div>
          <div>
            <Field label="Alternate Phone" id="alternate_phone">
              <Input id="alternate_phone" placeholder="+91 22 1234 5678"
                value={form.alternate_phone} onChange={set("alternate_phone")} disabled={readOnly} />
            </Field>
            {err("alternate_phone")}
          </div>
        </Row2>
        <Row3>
          <div>
            <Field label="Business Email" id="email">
              <Input id="email" type="email" placeholder="info@company.in"
                value={form.email} onChange={set("email")} disabled={readOnly} />
            </Field>
            {err("email")}
          </div>
          <div>
            <Field label="Support Email" id="support_email"
              hint="For customer-facing correspondence">
              <Input id="support_email" type="email" placeholder="support@company.in"
                value={form.support_email} onChange={set("support_email")} disabled={readOnly} />
            </Field>
            {err("support_email")}
          </div>
          <div>
            <Field label="Website" id="website">
              <Input id="website" placeholder="www.company.in"
                value={form.website} onChange={set("website")} disabled={readOnly} />
            </Field>
            {err("website")}
          </div>
        </Row3>
      </SectionCard>

      {/* ── 3. BUSINESS ADDRESS ─────────────────────────────────────────── */}
      <SectionCard icon={MapPin} title="Business Address"
        subtitle="Automatically printed on all invoices, quotations, and purchase orders.">
        <Field label="Address Line 1" id="address_line_1">
          <Input id="address_line_1" placeholder="Building name, street number"
            value={form.address_line_1} onChange={set("address_line_1")} disabled={readOnly} />
        </Field>
        <Field label="Address Line 2" id="address_line_2">
          <Input id="address_line_2" placeholder="Area, landmark (optional)"
            value={form.address_line_2} onChange={set("address_line_2")} disabled={readOnly} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="City" id="city">
            <Input id="city" placeholder="Mumbai"
              value={form.city} onChange={set("city")} disabled={readOnly} />
          </Field>
          <div>
            <Field label="Pincode" id="pincode">
              <Input id="pincode" placeholder="400001"
                value={form.pincode} onChange={set("pincode")} maxLength={6} disabled={readOnly} />
            </Field>
            {err("pincode")}
          </div>
        </div>
        <Row2>
          <Field label="State" id="state">
            <Select value={form.state || "__none__"} onValueChange={v => setVal("state")(v === "__none__" ? "" : v)} disabled={readOnly}>
              <SelectTrigger id="state">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="__none__">— Select state —</SelectItem>
                {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Country" id="country">
            <Input id="country" placeholder="India"
              value={form.country} onChange={set("country")} disabled={readOnly} />
          </Field>
        </Row2>
      </SectionCard>

      {/* ── 4. PAYMENT DETAILS ──────────────────────────────────────────── */}
      <SectionCard icon={Landmark} title="Payment Details"
        subtitle="Bank account and UPI details printed on invoices and quotations.">
        <Row2>
          <Field label="Bank Name" id="bank_name">
            <Input id="bank_name" placeholder="State Bank of India"
              value={form.bank_name} onChange={set("bank_name")} disabled={readOnly} />
          </Field>
          <Field label="Account Holder Name" id="account_holder_name"
            hint="As per bank records">
            <Input id="account_holder_name" placeholder="Acme Distributors"
              value={form.account_holder_name} onChange={set("account_holder_name")} disabled={readOnly} />
          </Field>
        </Row2>
        <Row3>
          <Field label="Account Number" id="account_number">
            <Input id="account_number" placeholder="00000000000000"
              value={form.account_number} onChange={set("account_number")}
              className="font-mono" disabled={readOnly} />
          </Field>
          <div>
            <Field label="IFSC Code" id="ifsc_code">
              <Input id="ifsc_code" placeholder="SBIN0001234"
                value={form.ifsc_code} onChange={e => setVal("ifsc_code")(e.target.value.toUpperCase())}
                className="font-mono" maxLength={11} disabled={readOnly} />
            </Field>
            {err("ifsc_code")}
          </div>
          <Field label="Branch Name" id="branch_name">
            <Input id="branch_name" placeholder="Fort Branch, Mumbai"
              value={form.branch_name} onChange={set("branch_name")} disabled={readOnly} />
          </Field>
        </Row3>
        <div className="max-w-xs">
          <Field label="UPI ID" id="upi_id" hint="e.g. acme@sbi or 9876543210@upi">
            <Input id="upi_id" placeholder="yourname@upi"
              value={form.upi_id} onChange={set("upi_id")}
              className="font-mono" disabled={readOnly} />
          </Field>
        </div>
      </SectionCard>

      {/* ── 5. FINANCIAL SETTINGS ───────────────────────────────────────── */}
      <SectionCard icon={TrendingUp} title="Financial Settings">
        <Row3>
          <Field label="Default Currency" id="default_currency">
            <Select value={form.default_currency} onValueChange={setVal("default_currency")} disabled={readOnly}>
              <SelectTrigger id="default_currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">INR — Indian Rupee (₹)</SelectItem>
                <SelectItem value="USD">USD — US Dollar ($)</SelectItem>
                <SelectItem value="EUR">EUR — Euro (€)</SelectItem>
                <SelectItem value="GBP">GBP — British Pound (£)</SelectItem>
                <SelectItem value="AED">AED — UAE Dirham</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Default GST Rate" id="default_tax_rate"
            hint="Applied to new products and invoices">
            <Select value={form.default_tax_rate} onValueChange={setVal("default_tax_rate")} disabled={readOnly}>
              <SelectTrigger id="default_tax_rate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAX_RATES.map(r => (
                  <SelectItem key={r} value={String(r)}>{r}% GST</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Financial Year Start" id="financial_year_start">
            <Select value={form.financial_year_start} onValueChange={setVal("financial_year_start")} disabled={readOnly}>
              <SelectTrigger id="financial_year_start">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">April 1 (Indian standard)</SelectItem>
                <SelectItem value="1">January 1 (Calendar year)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Row3>
      </SectionCard>

      {/* ── 6. DOCUMENT SETTINGS ────────────────────────────────────────── */}
      <SectionCard icon={FileText} title="Document Settings"
        subtitle="Prefixes and default content used when creating new documents.">

        {/* Prefixes */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Document Prefixes</p>
          <Row5>
            {(["invoice_prefix", "quotation_prefix", "purchase_order_prefix", "grn_prefix", "vendor_payment_prefix"] as const).map(k => {
              const labels: Record<string, string> = {
                invoice_prefix: "Invoice",
                quotation_prefix: "Quotation",
                purchase_order_prefix: "Purchase Order",
                grn_prefix: "Goods Receipt",
                vendor_payment_prefix: "Vendor Payment",
              };
              return (
                <div key={k}>
                  <Field label={labels[k]} id={k}>
                    <Input
                      id={k} value={form[k]}
                      onChange={e => setVal(k)(e.target.value.toUpperCase())}
                      className="font-mono" maxLength={10} disabled={readOnly}
                    />
                  </Field>
                  {err(k)}
                </div>
              );
            })}
          </Row5>
          {/* Live preview */}
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              ["invoice_prefix", "INV"], ["quotation_prefix", "QTN"],
              ["purchase_order_prefix", "PO"], ["grn_prefix", "GRN"],
              ["vendor_payment_prefix", "VP"],
            ].map(([k, fallback]) => (
              <span key={k} className="font-mono bg-muted/70 text-muted-foreground px-2 py-0.5 rounded text-[11px]">
                {form[k as keyof FormState] || fallback}-000001
              </span>
            ))}
          </div>
        </div>

        <div className="border-t pt-4 space-y-4">
          <p className="text-xs font-medium text-muted-foreground">
            Default Document Content
            <span className="ml-1 font-normal">(auto-inserted into new invoices & quotations)</span>
          </p>

          <Field label="Terms & Conditions" id="terms_and_conditions">
            <Textarea
              id="terms_and_conditions"
              placeholder={`1. Goods once sold will not be taken back.\n2. Payment to be made within the agreed terms.\n3. Subject to local jurisdiction.`}
              value={form.terms_and_conditions}
              onChange={set("terms_and_conditions")}
              rows={4}
              disabled={readOnly}
            />
          </Field>

          <Row2>
            <Field label="Payment Terms" id="payment_terms"
              hint="e.g. Net 30, 50% advance + 50% on delivery">
              <Input id="payment_terms" placeholder="Net 30 days from invoice date"
                value={form.payment_terms} onChange={set("payment_terms")} disabled={readOnly} />
            </Field>
            <Field label="Default Notes" id="default_notes"
              hint="Appears at the bottom of all documents">
              <Input id="default_notes" placeholder="Thank you for your business!"
                value={form.default_notes} onChange={set("default_notes")} disabled={readOnly} />
            </Field>
          </Row2>
        </div>
      </SectionCard>

      {/* ── 7. BRANDING ─────────────────────────────────────────────────── */}
      <SectionCard icon={Palette} title="Branding"
        subtitle="Logo appears on all PDFs and the sidebar. Signature appears on invoice, quotation, and PO footers.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <ImageUploadField
            label="Company Logo"
            value={form.logo_url}
            onChange={url => setForm(prev => ({ ...prev, logo_url: url }))}
            storagePath={(orgId, ts, ext) => `${orgId}/logo-${ts}.${ext}`}
            disabled={readOnly}
            previewClass="h-20 w-32"
            hint="PNG, JPG, SVG — max 2 MB. Use transparent background for best results."
          />
          <ImageUploadField
            label="Authorized Signature"
            value={form.signature_url}
            onChange={url => setForm(prev => ({ ...prev, signature_url: url }))}
            storagePath={(orgId, ts, ext) => `${orgId}/signature-${ts}.${ext}`}
            disabled={readOnly}
            previewClass="h-20 w-32"
            hint="PNG with transparent background recommended — max 2 MB."
          />
        </div>
      </SectionCard>

      {/* ── Save bar ────────────────────────────────────────────────────── */}
      {isAdmin && (
        <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur border-t shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-4 py-3 -mx-4 flex items-center gap-3">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="min-w-[140px]"
          >
            {saveMutation.isPending
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</>
              : "Save All Changes"
            }
          </Button>
          {saveMutation.isSuccess && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <CheckCircle2 className="h-4 w-4" />Saved successfully.
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
