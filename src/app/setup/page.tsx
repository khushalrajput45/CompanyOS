"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  ChevronRight,
  Upload,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ── Step metadata ─────────────────────────────────────────────────────────────

const STEPS = [
  { title: "Tax Information",  subtitle: "GST and PAN details" },
  { title: "Contact & Address", subtitle: "How customers can reach you" },
  { title: "Bank Details",     subtitle: "For payments and invoices" },
  { title: "Logo",             subtitle: "Your brand identity" },
] as const;

// ── Step field types ──────────────────────────────────────────────────────────

type Step1 = { gst_number: string; pan_number: string };
type Step2 = {
  phone: string; email: string;
  address_line_1: string; address_line_2: string;
  city: string; state: string; pincode: string;
};
type Step3 = {
  bank_name: string; account_holder_name: string;
  account_number: string; ifsc_code: string;
  branch_name: string; upi_id: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const [step, setStep]     = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const [step1, setStep1] = useState<Step1>({ gst_number: "", pan_number: "" });
  const [step2, setStep2] = useState<Step2>({
    phone: "", email: "", address_line_1: "", address_line_2: "",
    city: "", state: "", pincode: "",
  });
  const [step3, setStep3] = useState<Step3>({
    bank_name: "", account_holder_name: "",
    account_number: "", ifsc_code: "",
    branch_name: "", upi_id: "",
  });
  const [logoFile, setLogoFile]       = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if onboarding already completed
  useEffect(() => {
    if (!profile?.organization_id) return;
    const supabase = createClient();
    supabase
      .from("organizations")
      .select("onboarding_completed")
      .eq("id", profile.organization_id)
      .single()
      .then(({ data }) => {
        if (data?.onboarding_completed) router.replace("/dashboard");
      });
  }, [profile?.organization_id, router]);

  // Pre-fill contact email from auth profile
  useEffect(() => {
    if (profile?.email) {
      setStep2((s) => ({ ...s, email: s.email || profile.email }));
    }
  }, [profile?.email]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function upsert(data: Record<string, string>) {
    if (!profile) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("company_settings")
      .upsert(
        { organization_id: profile.organization_id, ...data },
        { onConflict: "organization_id" }
      );
    return error;
  }

  async function markDone() {
    if (!profile) return;
    const supabase = createClient();
    await supabase
      .from("organizations")
      .update({ onboarding_completed: true })
      .eq("id", profile.organization_id);
  }

  async function finish() {
    await markDone();
    router.push("/dashboard");
  }

  // ── Continue handler ───────────────────────────────────────────────────────

  async function handleContinue() {
    if (!profile) return;
    setError(null);
    setSaving(true);

    try {
      if (step === 0) {
        const err = await upsert({
          gst_number: step1.gst_number.trim(),
          pan_number: step1.pan_number.trim(),
        });
        if (err) throw err;
      }

      if (step === 1) {
        const err = await upsert({
          phone:          step2.phone.trim(),
          email:          step2.email.trim(),
          address_line_1: step2.address_line_1.trim(),
          address_line_2: step2.address_line_2.trim(),
          city:           step2.city.trim(),
          state:          step2.state.trim(),
          pincode:        step2.pincode.trim(),
        });
        if (err) throw err;
      }

      if (step === 2) {
        const err = await upsert({
          bank_name:          step3.bank_name.trim(),
          account_holder_name: step3.account_holder_name.trim(),
          account_number:     step3.account_number.trim(),
          ifsc_code:          step3.ifsc_code.trim().toUpperCase(),
          branch_name:        step3.branch_name.trim(),
          upi_id:             step3.upi_id.trim(),
        });
        if (err) throw err;
      }

      if (step === 3) {
        if (logoFile) {
          const supabase = createClient();
          const ext      = logoFile.name.split(".").pop();
          const fileName = `${profile.organization_id}/logo-${Date.now()}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from("company-logos")
            .upload(fileName, logoFile, { upsert: true });
          if (uploadErr) throw uploadErr;

          const { data: urlData } = supabase.storage
            .from("company-logos")
            .getPublicUrl(fileName);

          const err = await upsert({ logo_url: urlData.publicUrl });
          if (err) throw err;
        }
        await finish();
        return;
      }

      setStep((s) => s + 1);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message;
      setError(msg ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Skip handler ───────────────────────────────────────────────────────────

  async function handleSkip() {
    setError(null);
    if (step === STEPS.length - 1) {
      await finish();
    } else {
      setStep((s) => s + 1);
    }
  }

  // ── Logo input ─────────────────────────────────────────────────────────────

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Logo must be smaller than 5 MB.");
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-lg space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 rounded-xl" />
          <div className="flex gap-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Left sidebar: step list (desktop only) ─────────────────────────── */}
      <aside className="hidden lg:flex w-72 bg-sidebar text-sidebar-foreground flex-col p-8 shrink-0">
        <div className="flex items-center gap-3 mb-12">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shrink-0">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">CompanyOS</p>
            <p className="text-[10px] text-sidebar-foreground/50 mt-0.5">Setup Wizard</p>
          </div>
        </div>

        <div className="space-y-1">
          {STEPS.map((s, idx) => {
            const done   = idx < step;
            const active = idx === step;
            return (
              <div key={idx} className="flex items-start gap-3 py-3">
                {/* Step number / check bubble */}
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold shrink-0 mt-0.5 transition-colors ${
                  done   ? "bg-primary text-white" :
                  active ? "border-2 border-primary text-primary bg-transparent" :
                           "bg-sidebar-accent/20 text-sidebar-foreground/30"
                }`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                <div>
                  <p className={`text-sm font-medium leading-tight ${
                    active ? "text-white" :
                    done   ? "text-sidebar-foreground/60" :
                             "text-sidebar-foreground/35"
                  }`}>
                    {s.title}
                  </p>
                  <p className={`text-xs mt-0.5 ${
                    active ? "text-sidebar-foreground/55" : "text-sidebar-foreground/25"
                  }`}>
                    {s.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom note */}
        <p className="mt-auto text-xs text-sidebar-foreground/30 leading-relaxed">
          You can update all of this later from Company Profile settings.
        </p>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg">

          {/* Mobile progress bar */}
          <div className="lg:hidden flex items-center gap-1.5 mb-6">
            {STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  idx <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step heading */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Step {step + 1} of {STEPS.length}
            </p>
            <h1 className="text-2xl font-bold leading-tight">{STEPS[step].title}</h1>
            <p className="text-muted-foreground text-sm mt-1">{STEPS[step].subtitle}</p>
          </div>

          {/* Step form */}
          <Card>
            <CardContent className="p-6 space-y-4">

              {/* ── Step 1: GST + PAN ─────────────────────────────────────── */}
              {step === 0 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="gst">GST Number</Label>
                    <Input
                      id="gst"
                      placeholder="22AAAAA0000A1Z5"
                      value={step1.gst_number}
                      onChange={(e) =>
                        setStep1((s) => ({ ...s, gst_number: e.target.value.toUpperCase() }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      15-digit GST Identification Number
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pan">PAN Number</Label>
                    <Input
                      id="pan"
                      placeholder="AAAAA0000A"
                      value={step1.pan_number}
                      onChange={(e) =>
                        setStep1((s) => ({ ...s, pan_number: e.target.value.toUpperCase() }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      10-character Permanent Account Number
                    </p>
                  </div>
                </>
              )}

              {/* ── Step 2: Contact + Address ──────────────────────────────── */}
              {step === 1 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={step2.phone}
                        onChange={(e) =>
                          setStep2((s) => ({ ...s, phone: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Email</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        placeholder="info@company.com"
                        value={step2.email}
                        onChange={(e) =>
                          setStep2((s) => ({ ...s, email: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addr1">Address Line 1</Label>
                    <Input
                      id="addr1"
                      placeholder="123, Business Park, Sector 5"
                      value={step2.address_line_1}
                      onChange={(e) =>
                        setStep2((s) => ({ ...s, address_line_1: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addr2">
                      Address Line 2{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="addr2"
                      placeholder="Near Town Hall"
                      value={step2.address_line_2}
                      onChange={(e) =>
                        setStep2((s) => ({ ...s, address_line_2: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        placeholder="Mumbai"
                        value={step2.city}
                        onChange={(e) =>
                          setStep2((s) => ({ ...s, city: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        placeholder="Maharashtra"
                        value={step2.state}
                        onChange={(e) =>
                          setStep2((s) => ({ ...s, state: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pincode">Pincode</Label>
                      <Input
                        id="pincode"
                        placeholder="400001"
                        value={step2.pincode}
                        onChange={(e) =>
                          setStep2((s) => ({ ...s, pincode: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ── Step 3: Bank + UPI ─────────────────────────────────────── */}
              {step === 2 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bankName">Bank Name</Label>
                      <Input
                        id="bankName"
                        placeholder="HDFC Bank"
                        value={step3.bank_name}
                        onChange={(e) =>
                          setStep3((s) => ({ ...s, bank_name: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch">Branch</Label>
                      <Input
                        id="branch"
                        placeholder="Andheri West"
                        value={step3.branch_name}
                        onChange={(e) =>
                          setStep3((s) => ({ ...s, branch_name: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accHolder">Account Holder Name</Label>
                    <Input
                      id="accHolder"
                      placeholder="Acme Trading Pvt Ltd"
                      value={step3.account_holder_name}
                      onChange={(e) =>
                        setStep3((s) => ({ ...s, account_holder_name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="accNo">Account Number</Label>
                      <Input
                        id="accNo"
                        placeholder="00000000000000"
                        value={step3.account_number}
                        onChange={(e) =>
                          setStep3((s) => ({ ...s, account_number: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ifsc">IFSC Code</Label>
                      <Input
                        id="ifsc"
                        placeholder="HDFC0000001"
                        value={step3.ifsc_code}
                        onChange={(e) =>
                          setStep3((s) => ({
                            ...s,
                            ifsc_code: e.target.value.toUpperCase(),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="border-t pt-4 space-y-2">
                    <Label htmlFor="upi">
                      UPI ID{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="upi"
                      placeholder="business@upi"
                      value={step3.upi_id}
                      onChange={(e) =>
                        setStep3((s) => ({ ...s, upi_id: e.target.value }))
                      }
                    />
                  </div>
                </>
              )}

              {/* ── Step 4: Logo ───────────────────────────────────────────── */}
              {step === 3 && (
                <div className="space-y-4">
                  <div
                    className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="max-h-36 max-w-full object-contain rounded-lg"
                      />
                    ) : (
                      <>
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium">Click to upload your logo</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PNG, JPG, WebP — max 5 MB
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  {logoPreview && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => {
                        setLogoPreview(null);
                        setLogoFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-4 w-4" />
                      Remove logo
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground text-center">
                    Your logo appears on invoices, quotations, and purchase orders.
                    You can change it anytime in Company Profile.
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleSkip}
              disabled={saving}
            >
              Skip For Now
            </Button>
            <Button
              className="flex-1 gap-1.5"
              onClick={handleContinue}
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : step === STEPS.length - 1
                ? "Finish Setup"
                : "Continue"}
              {!saving && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
