"use client";

import { useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pencil, ArrowLeft, Printer, Trash2,
  AlertCircle, CheckCircle2, XCircle, Send, Receipt,
} from "lucide-react";
import type { Quotation, QuotationItem, QuotationStatus, CompanySettings } from "@/lib/types";
import { useCompanySettings } from "@/lib/hooks/useCompanySettings";
import { escHtml as esc, buildCompanyHeader, buildPaymentDetails, buildSignatureBlock, buildTermsBlock } from "@/lib/utils/printUtils";

// ── Types ─────────────────────────────────────────────────────────────────────

type QuotationFull = Quotation & {
  customer: {
    name: string; company_name: string | null; phone: string | null;
    email: string | null; address: string | null; city: string | null;
    state: string | null; pincode: string | null; gst_number: string | null;
  };
  items: (QuotationItem & { product: { name: string; sku: string; hsn_code: string | null } | null })[];
};

// ── Data ──────────────────────────────────────────────────────────────────────

async function fetchQuotation(id: string): Promise<QuotationFull> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(`
      *,
      customer:customers(name, company_name, phone, email, address, city, state, pincode, gst_number),
      items:quotation_items(*, product:products(name, sku, hsn_code))
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return {
    ...d,
    items: (d.items ?? []).sort((a: QuotationItem, b: QuotationItem) => a.sort_order - b.sort_order),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
  });
}
function fmtINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_STYLES: Record<QuotationStatus, string> = {
  draft:    "bg-slate-100  text-slate-700  border-slate-200",
  sent:     "bg-blue-100   text-blue-700   border-blue-200",
  accepted: "bg-green-100  text-green-700  border-green-200",
  rejected: "bg-red-100    text-red-600    border-red-200",
  expired:  "bg-orange-100 text-orange-700 border-orange-200",
};

const STATUS_TRANSITIONS: Record<QuotationStatus, { label: string; next: QuotationStatus; icon: React.ComponentType<{ className?: string }>; confirm?: string }[]> = {
  draft:    [{ label: "Mark Sent",  next: "sent",     icon: Send }],
  sent:     [{ label: "Accept",     next: "accepted", icon: CheckCircle2,
               confirm: "Accept this quotation? This locks pricing and allows invoice creation." },
             { label: "Reject",     next: "rejected", icon: XCircle,
               confirm: "Reject this quotation? This action cannot be undone." }],
  accepted: [],
  rejected: [],
  expired:  [],
};

// ── PDF generation (window.open + print) ─────────────────────────────────────

function buildPrintHTML(q: QuotationFull, settings: CompanySettings | null): string {
  const customer = q.customer;
  const displayName = esc(customer.company_name ?? customer.name);
  const billingAddr = esc([customer.address, customer.city, customer.state, customer.pincode]
    .filter(Boolean).join(", "));

  const itemRows = q.items.map((it, i) => {
    const lineTotal = it.quantity * it.unit_price;
    const taxAmt    = lineTotal * it.tax_rate / 100;
    return `
      <tr>
        <td>${i + 1}</td>
        <td>
          <strong>${esc(it.description)}</strong>
          ${it.product?.sku ? `<br><small style="color:#666">${esc(it.product.sku)}</small>` : ""}
          ${it.product?.hsn_code ? `<br><small style="color:#666">HSN: ${esc(it.product.hsn_code)}</small>` : ""}
        </td>
        <td style="text-align:center">${it.quantity}</td>
        <td style="text-align:right">₹${it.unit_price.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
        <td style="text-align:right">₹${lineTotal.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
        <td style="text-align:center">${it.tax_rate}%</td>
        <td style="text-align:right">₹${taxAmt.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
        <td style="text-align:right"><strong>₹${(lineTotal + taxAmt).toLocaleString("en-IN", {minimumFractionDigits:2})}</strong></td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Quotation ${q.quotation_number}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;background:#fff;padding:20mm}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #2563eb}
    .company-name{font-size:22px;font-weight:700;color:#2563eb;margin-bottom:4px}
    .company-info{font-size:10px;color:#555;line-height:1.6}
    .doc-title{text-align:right}
    .doc-title h1{font-size:26px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:2px}
    .doc-title .num{font-size:13px;font-weight:600;margin-top:4px}
    .doc-title .status{display:inline-block;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:6px}
    .status-draft{background:#f1f5f9;color:#475569}
    .status-sent{background:#dbeafe;color:#1d4ed8}
    .status-accepted{background:#dcfce7;color:#16a34a}
    .status-rejected{background:#fee2e2;color:#dc2626}
    .status-expired{background:#ffedd5;color:#c2410c}
    .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
    .meta-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px}
    .meta-box h3{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:8px}
    .meta-box p{font-size:11px;color:#1a1a1a;line-height:1.7}
    .meta-box .label{color:#64748b;font-size:10px}
    .dates{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}
    .date-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;text-align:center}
    .date-box .label{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px}
    .date-box .value{font-size:12px;font-weight:600;margin-top:2px}
    table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:10.5px}
    thead tr{background:#2563eb;color:#fff}
    thead th{padding:8px 10px;text-align:left;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.5px}
    tbody tr{border-bottom:1px solid #f1f5f9}
    tbody tr:nth-child(even){background:#f8fafc}
    td{padding:8px 10px;vertical-align:top}
    .totals{display:flex;justify-content:flex-end;margin-bottom:20px}
    .totals-box{width:260px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden}
    .totals-row{display:flex;justify-content:space-between;padding:8px 14px;font-size:11px;border-bottom:1px solid #f1f5f9}
    .totals-row:last-child{border-bottom:none}
    .totals-row.grand{background:#2563eb;color:#fff;font-weight:700;font-size:13px}
    .notes{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px;margin-bottom:20px}
    .notes h4{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#92400e;margin-bottom:6px}
    .notes p{font-size:10.5px;color:#78350f;line-height:1.6;white-space:pre-wrap}
    .terms{margin-bottom:24px}
    .terms h4{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:6px}
    .terms ol{padding-left:16px;color:#475569;line-height:1.8}
    .footer{border-top:1px solid #e2e8f0;padding-top:14px;display:flex;justify-content:space-between;align-items:flex-end;margin-top:10px}
    .sig-box{text-align:center;min-width:160px}
    .sig-line{border-top:1px solid #1a1a1a;margin-top:40px;padding-top:6px;font-size:10px;color:#64748b}
    @media print{@page{size:A4;margin:12mm}body{padding:0}}
  </style>
</head>
<body>
  <div class="header">
    ${buildCompanyHeader(settings, "quotation")}
    <div class="doc-title">
      <h1>Quotation</h1>
      <div class="num">${esc(q.quotation_number)}</div>
      <div class="status status-${q.status}">${q.status.toUpperCase()}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <h3>Bill To</h3>
      <p>
        <strong>${displayName}</strong><br>
        ${esc(customer.name) !== displayName ? esc(customer.name) + "<br>" : ""}
        ${billingAddr ? billingAddr + "<br>" : ""}
        ${customer.phone ? "📞 " + esc(customer.phone) + "<br>" : ""}
        ${customer.email ? "✉ " + esc(customer.email) + "<br>" : ""}
        ${customer.gst_number ? "<span class='label'>GST: </span>" + esc(customer.gst_number) : ""}
      </p>
    </div>
    <div class="meta-box">
      <h3>Quotation Info</h3>
      <p>
        <span class="label">Quotation #</span><br><strong>${esc(q.quotation_number)}</strong><br>
        <span class="label">Date</span><br>${fmtDate(q.quotation_date)}<br>
        ${q.valid_until ? `<span class="label">Valid Until</span><br>${fmtDate(q.valid_until)}<br>` : ""}
      </p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:28px">#</th>
        <th>Description</th>
        <th style="text-align:center;width:50px">Qty</th>
        <th style="text-align:right;width:90px">Unit Price</th>
        <th style="text-align:right;width:90px">Amount</th>
        <th style="text-align:center;width:50px">Tax</th>
        <th style="text-align:right;width:90px">Tax Amt</th>
        <th style="text-align:right;width:100px">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>₹${q.subtotal.toLocaleString("en-IN", {minimumFractionDigits:2})}</span>
      </div>
      <div class="totals-row">
        <span>GST / Tax</span>
        <span>₹${q.tax_amount.toLocaleString("en-IN", {minimumFractionDigits:2})}</span>
      </div>
      <div class="totals-row grand">
        <span>TOTAL</span>
        <span>₹${q.total_amount.toLocaleString("en-IN", {minimumFractionDigits:2})}</span>
      </div>
    </div>
  </div>

  ${q.notes ? `
  <div class="notes">
    <h4>Notes</h4>
    <p>${esc(q.notes)}</p>
  </div>` : ""}

  ${buildPaymentDetails(settings)}
  ${buildTermsBlock(settings, "quotation")}

  <div class="footer">
    <div style="font-size:10px;color:#94a3b8">
      ${esc(settings?.company_name ?? "")} &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-IN")}
    </div>
    ${buildSignatureBlock(settings)}
  </div>
</body>
</html>`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QuotationDetailPage() {
  const { id }      = useParams<{ id: string }>();
  const router      = useRouter();
  const queryClient = useQueryClient();

  const { data: quotation, isLoading, error } = useQuery({
    queryKey: ["quotation", id],
    queryFn: () => fetchQuotation(id),
    retry: 1,
  });

  const { data: companySettings = null } = useCompanySettings();

  const statusMutation = useMutation({
    mutationFn: async (status: QuotationStatus) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("quotations").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotation", id] });
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase.from("quotations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      router.push("/quotations");
    },
  });

  // Auto-expire: if valid_until has passed and status is still "sent", mark as expired
  useEffect(() => {
    if (
      quotation?.status === "sent" &&
      quotation?.valid_until &&
      new Date(quotation.valid_until + "T23:59:59") < new Date()
    ) {
      statusMutation.mutate("expired");
    }
    // Run only when a different quotation is loaded, not on every statusMutation change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotation?.id, quotation?.status, quotation?.valid_until]);

  const handlePrint = useCallback(() => {
    if (!quotation) return;
    const html = buildPrintHTML(quotation, companySettings);
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { alert("Please allow pop-ups to generate PDF."); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => w.print();
  }, [quotation, companySettings]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Quotation" breadcrumbs={[{ label: "Quotations", href: "/quotations" }, { label: "Loading…" }]} />
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 max-w-5xl mx-auto w-full space-y-4">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Quotation" breadcrumbs={[{ label: "Quotations", href: "/quotations" }, { label: "Not Found" }]} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Quotation not found</p>
            <Button variant="outline" size="sm" onClick={() => router.push("/quotations")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back to Quotations
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const customer = quotation.customer;
  const displayName = customer.company_name ?? customer.name;
  const transitions = STATUS_TRANSITIONS[quotation.status] ?? [];

  return (
    <div className="flex flex-col h-full">
      <Header
        title={quotation.quotation_number}
        subtitle={displayName}
        breadcrumbs={[{ label: "Quotations", href: "/quotations" }, { label: quotation.quotation_number }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/quotations")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1.5" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push(`/quotations/${id}/edit`)}>
              <Pencil className="h-4 w-4 mr-1.5" />Edit
            </Button>
            <Button
              variant="ghost" size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm(`Delete ${quotation.quotation_number}?`)) deleteMutation.mutate();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* ── Status bar ────────────────────────────────── */}
          <div className="flex items-center flex-wrap gap-3 p-4 rounded-lg border bg-card shadow-sm">
            <Badge className={`text-sm capitalize border px-3 py-1 ${STATUS_STYLES[quotation.status]}`} variant="outline">
              {quotation.status}
            </Badge>
            <div className="h-4 w-px bg-border" />
            {transitions.map(t => (
              <Button
                key={t.next}
                size="sm"
                variant="outline"
                disabled={statusMutation.isPending}
                onClick={() => {
                  if (t.confirm && !confirm(t.confirm)) return;
                  statusMutation.mutate(t.next);
                }}
              >
                <t.icon className="h-3.5 w-3.5 mr-1.5" />
                {t.label}
              </Button>
            ))}
            {quotation.status === "accepted" && (
              <Button
                size="sm"
                variant="default"
                onClick={() => router.push(`/invoices/new?from_quotation=${id}`)}
              >
                <Receipt className="h-3.5 w-3.5 mr-1.5" />
                Create Invoice
              </Button>
            )}
            {(quotation.status === "rejected" || quotation.status === "expired") && (
              <span className="text-xs text-muted-foreground italic">Read only</span>
            )}
            {statusMutation.isError && (
              <span className="text-xs text-destructive">{(statusMutation.error as Error).message}</span>
            )}
          </div>

          {/* ── Customer + Dates ──────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="rounded-lg border bg-card shadow-sm p-5">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Customer</h2>
              <p className="font-semibold text-base">{displayName}</p>
              {customer.company_name && <p className="text-sm text-muted-foreground">{customer.name}</p>}
              {customer.phone && <p className="text-sm mt-2">📞 {customer.phone}</p>}
              {customer.email && <p className="text-sm">✉ {customer.email}</p>}
              {(customer.city || customer.state) && (
                <p className="text-sm text-muted-foreground mt-1">
                  {[customer.city, customer.state].filter(Boolean).join(", ")}
                </p>
              )}
              {customer.gst_number && (
                <p className="text-xs font-mono mt-2 text-muted-foreground">GST: {customer.gst_number}</p>
              )}
            </div>

            <div className="rounded-lg border bg-card shadow-sm p-5 space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Details</h2>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{fmtDate(quotation.quotation_date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valid Until</span>
                <span className={`font-medium ${quotation.valid_until && new Date(quotation.valid_until) < new Date() ? "text-destructive" : ""}`}>
                  {quotation.valid_until ? fmtDate(quotation.valid_until) : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items</span>
                <span className="font-medium">{quotation.items?.length ?? 0}</span>
              </div>
            </div>
          </div>

          {/* ── Line Items ────────────────────────────────── */}
          <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
            <div className="px-5 py-3 border-b bg-muted/30">
              <h2 className="text-sm font-semibold">Products / Services</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5">#</th>
                    <th className="text-left px-4 py-2.5">Description</th>
                    <th className="text-right px-4 py-2.5">Qty</th>
                    <th className="text-right px-4 py-2.5">Unit Price</th>
                    <th className="text-right px-4 py-2.5">Amount</th>
                    <th className="text-right px-4 py-2.5">Tax</th>
                    <th className="text-right px-4 py-2.5">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items?.map((item, i) => {
                    const lineAmt  = item.quantity * item.unit_price;
                    const taxAmt   = lineAmt * item.tax_rate / 100;
                    return (
                      <tr key={item.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{item.description}</p>
                          {item.product && (
                            <p className="text-xs text-muted-foreground font-mono">{item.product.sku}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtINR(item.unit_price)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtINR(lineAmt)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">
                          {item.tax_rate > 0 ? `${item.tax_rate}%` : "—"}
                          {item.tax_rate > 0 && <span className="block">{fmtINR(taxAmt)}</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtINR(lineAmt + taxAmt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t px-5 py-4 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums">{fmtINR(quotation.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GST / Tax</span>
                  <span className="font-medium tabular-nums">{fmtINR(quotation.tax_amount)}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t pt-2">
                  <span>Total</span>
                  <span className="tabular-nums">{fmtINR(quotation.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Notes ────────────────────────────────────── */}
          {quotation.notes && (
            <div className="rounded-lg border bg-amber-50 border-amber-200 shadow-sm p-5">
              <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Notes</h2>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{quotation.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
