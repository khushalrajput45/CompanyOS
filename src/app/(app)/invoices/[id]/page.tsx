"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/utils/logAudit";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pencil, ArrowLeft, Printer, Trash2,
  AlertCircle, Send, XCircle, IndianRupee,
  Plus, Banknote, Link2,
} from "lucide-react";
import type { Invoice, InvoiceItem, InvoiceStatus, InvoicePayment, CompanySettings } from "@/lib/types";
import { useCompanySettings } from "@/lib/hooks/useCompanySettings";
import { escHtml as esc, buildCompanyHeader, buildPaymentDetails, buildSignatureBlock, buildTermsBlock } from "@/lib/utils/printUtils";

// ── Types ─────────────────────────────────────────────────────────────────────

type InvoiceFull = Invoice & {
  customer: {
    name: string; company_name: string | null; phone: string | null;
    email: string | null; address: string | null; city: string | null;
    state: string | null; pincode: string | null; gst_number: string | null;
  };
  items: (InvoiceItem & { product: { name: string; sku: string; hsn_code: string | null } | null })[];
};

// ── Data ──────────────────────────────────────────────────────────────────────

async function fetchInvoice(id: string): Promise<InvoiceFull> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      *,
      customer:customers(name, company_name, phone, email, address, city, state, pincode, gst_number),
      items:invoice_items(*, product:products(name, sku, hsn_code))
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return {
    ...d,
    items: (d.items ?? []).sort((a: InvoiceItem, b: InvoiceItem) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  };
}

async function fetchPayments(invoiceId: string): Promise<InvoicePayment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoice_payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("payment_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InvoicePayment[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function fmtDateShort(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer",
  cheque: "Cheque", upi: "UPI", other: "Other",
};

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft:   "bg-slate-100  text-slate-700  border-slate-200",
  sent:    "bg-blue-100   text-blue-700   border-blue-200",
  paid:    "bg-green-100  text-green-700  border-green-200",
  partial: "bg-violet-100 text-violet-700 border-violet-200",
  overdue: "bg-red-100    text-red-600    border-red-200",
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft", sent: "Sent", paid: "Paid",
  partial: "Partial", overdue: "Overdue",
};

// Manual status transitions (paid/partial are payment-driven, not here)
const STATUS_TRANSITIONS: Record<
  InvoiceStatus,
  { label: string; next: InvoiceStatus; icon: React.ComponentType<{ className?: string }> }[]
> = {
  draft:   [{ label: "Mark as Sent",  next: "sent",   icon: Send    }],
  sent:    [{ label: "Mark Overdue",  next: "overdue", icon: XCircle }],
  partial: [{ label: "Mark Overdue",  next: "overdue", icon: XCircle }],
  overdue: [{ label: "Revert to Sent", next: "sent",  icon: Send    }],
  paid:    [],
};

// ── PDF ───────────────────────────────────────────────────────────────────────

function buildPrintHTML(inv: InvoiceFull, settings: CompanySettings | null): string {
  const customer    = inv.customer;
  const displayName = esc(customer.company_name ?? customer.name);
  const billingAddr = esc([customer.address, customer.city, customer.state, customer.pincode]
    .filter(Boolean).join(", "));

  const itemRows = inv.items.map((it, i) => {
    const lineAmt = it.quantity * it.unit_price;
    const taxAmt  = lineAmt * it.tax_rate / 100;
    return `
      <tr>
        <td>${i + 1}</td>
        <td>
          <strong>${esc(it.description)}</strong>
          ${it.product?.sku      ? `<br><small style="color:#666">${esc(it.product.sku)}</small>` : ""}
          ${it.product?.hsn_code ? `<br><small style="color:#666">HSN: ${esc(it.product.hsn_code)}</small>` : ""}
        </td>
        <td style="text-align:center">${it.quantity}</td>
        <td style="text-align:right">₹${it.unit_price.toLocaleString("en-IN",{minimumFractionDigits:2})}</td>
        <td style="text-align:right">₹${lineAmt.toLocaleString("en-IN",{minimumFractionDigits:2})}</td>
        <td style="text-align:center">${it.tax_rate}%</td>
        <td style="text-align:right">₹${taxAmt.toLocaleString("en-IN",{minimumFractionDigits:2})}</td>
        <td style="text-align:right"><strong>₹${(lineAmt+taxAmt).toLocaleString("en-IN",{minimumFractionDigits:2})}</strong></td>
      </tr>`;
  }).join("");

  const isPaid = inv.status === "paid";
  const amountPaid = inv.amount_paid ?? 0;
  const balance    = Math.max(0, inv.total_amount - amountPaid);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Invoice ${inv.invoice_number}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;background:#fff;padding:20mm}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #2563eb}
    .company-name{font-size:22px;font-weight:700;color:#2563eb;margin-bottom:4px}
    .company-info{font-size:10px;color:#555;line-height:1.6}
    .doc-title{text-align:right;position:relative}
    .doc-title h1{font-size:26px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:2px}
    .doc-title .num{font-size:13px;font-weight:600;margin-top:4px}
    .doc-title .status-badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:6px}
    .status-draft{background:#f1f5f9;color:#475569}
    .status-sent{background:#dbeafe;color:#1d4ed8}
    .status-paid{background:#dcfce7;color:#16a34a}
    .status-partial{background:#ede9fe;color:#7c3aed}
    .status-overdue{background:#fee2e2;color:#dc2626}
    .paid-stamp{position:absolute;top:-10px;right:0;border:4px solid #16a34a;color:#16a34a;padding:4px 16px;border-radius:4px;font-size:18px;font-weight:900;letter-spacing:4px;transform:rotate(-15deg);opacity:0.6}
    .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
    .meta-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px}
    .meta-box h3{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:8px}
    .meta-box p{font-size:11px;color:#1a1a1a;line-height:1.7}
    .meta-box .label{color:#64748b;font-size:10px}
    table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:10.5px}
    thead tr{background:#2563eb;color:#fff}
    thead th{padding:8px 10px;text-align:left;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.5px}
    tbody tr{border-bottom:1px solid #f1f5f9}
    tbody tr:nth-child(even){background:#f8fafc}
    td{padding:8px 10px;vertical-align:top}
    .totals{display:flex;justify-content:flex-end;margin-bottom:20px}
    .totals-box{width:280px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden}
    .totals-row{display:flex;justify-content:space-between;padding:8px 14px;font-size:11px;border-bottom:1px solid #f1f5f9}
    .totals-row:last-child{border-bottom:none}
    .totals-row.grand{background:#2563eb;color:#fff;font-weight:700;font-size:13px}
    .totals-row.paid-row{color:#16a34a;font-weight:600}
    .totals-row.balance-row{background:#fef2f2;color:#dc2626;font-weight:700}
    .notes{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px;margin-bottom:20px}
    .notes h4{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#92400e;margin-bottom:6px}
    .notes p{font-size:10.5px;color:#78350f;line-height:1.6;white-space:pre-wrap}
    .footer{border-top:1px solid #e2e8f0;padding-top:14px;display:flex;justify-content:space-between;align-items:flex-end;margin-top:10px}
    .sig-box{text-align:center;min-width:160px}
    .sig-line{border-top:1px solid #1a1a1a;margin-top:40px;padding-top:6px;font-size:10px;color:#64748b}
    @media print{@page{size:A4;margin:12mm}body{padding:0}}
  </style>
</head>
<body>
  <div class="header">
    ${buildCompanyHeader(settings, "invoice")}
    <div class="doc-title">
      ${isPaid ? '<div class="paid-stamp">PAID</div>' : ""}
      <h1>Invoice</h1>
      <div class="num">${esc(inv.invoice_number)}</div>
      <div class="status-badge status-${inv.status}">${STATUS_LABEL[inv.status].toUpperCase()}</div>
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
        ${customer.gst_number ? `<span class="label">GST: </span>${esc(customer.gst_number)}` : ""}
      </p>
    </div>
    <div class="meta-box">
      <h3>Invoice Info</h3>
      <p>
        <span class="label">Invoice #</span><br><strong>${esc(inv.invoice_number)}</strong><br>
        <span class="label">Invoice Date</span><br>${fmtDate(inv.invoice_date)}<br>
        ${inv.due_date ? `<span class="label">Due Date</span><br><strong>${fmtDate(inv.due_date)}</strong><br>` : ""}
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
        <span>₹${inv.subtotal.toLocaleString("en-IN",{minimumFractionDigits:2})}</span>
      </div>
      <div class="totals-row">
        <span>GST / Tax</span>
        <span>₹${inv.tax_amount.toLocaleString("en-IN",{minimumFractionDigits:2})}</span>
      </div>
      <div class="totals-row grand">
        <span>TOTAL</span>
        <span>₹${inv.total_amount.toLocaleString("en-IN",{minimumFractionDigits:2})}</span>
      </div>
      ${amountPaid > 0 ? `
      <div class="totals-row paid-row">
        <span>Amount Received</span>
        <span>₹${amountPaid.toLocaleString("en-IN",{minimumFractionDigits:2})}</span>
      </div>
      ${balance > 0 ? `
      <div class="totals-row balance-row">
        <span>Balance Due</span>
        <span>₹${balance.toLocaleString("en-IN",{minimumFractionDigits:2})}</span>
      </div>` : ""}` : ""}
    </div>
  </div>

  ${inv.notes ? `
  <div class="notes">
    <h4>Notes / Payment Instructions</h4>
    <p>${esc(inv.notes)}</p>
  </div>` : ""}

  ${buildPaymentDetails(settings)}
  ${buildTermsBlock(settings, "invoice")}

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

export default function InvoiceDetailPage() {
  const { id }      = useParams<{ id: string }>();
  const router      = useRouter();
  const queryClient = useQueryClient();

  // ── Payment form state ────────────────────────────────────────────────────
  const [showPayForm, setShowPayForm]     = useState(false);
  const [payAmount, setPayAmount]         = useState("");
  const [payDate, setPayDate]             = useState(new Date().toISOString().split("T")[0]);
  const [payMethod, setPayMethod]         = useState("cash");
  const [payNotes, setPayNotes]           = useState("");
  const [payError, setPayError]           = useState<string | null>(null);

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ["invoice", id],
    queryFn:  () => fetchInvoice(id),
    retry: 1,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["invoice-payments", id],
    queryFn:  () => fetchPayments(id),
    enabled:  !!id,
  });

  const { data: companySettings = null } = useCompanySettings();

  const statusMutation = useMutation({
    mutationFn: async (status: InvoiceStatus) => {
      const supabase = createClient();
      const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, status) => {
      logAudit({ action: "status_changed", module: "invoices", record_id: id, record_name: invoice?.invoice_number, metadata: { new_status: status } });
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const addPaymentMutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(payAmount);
      if (isNaN(amt) || amt <= 0) throw new Error("Enter a valid amount greater than 0");
      const balance = (invoice?.total_amount ?? 0) - (invoice?.amount_paid ?? 0);
      if (amt > balance + 0.01) throw new Error(`Amount exceeds balance due: ${fmtINR(balance)}`);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("invoice_payments").insert({
        invoice_id:     id,
        amount:         amt,
        payment_date:   payDate,
        payment_method: payMethod,
        notes:          payNotes.trim() || null,
        created_by:     user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      logAudit({ action: "payment_recorded", module: "invoices", record_id: id, record_name: invoice?.invoice_number, metadata: { amount: payAmount, method: payMethod } });
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-payments", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setPayAmount(""); setPayNotes(""); setPayError(null);
      setShowPayForm(false);
    },
    onError: (err: Error) => setPayError(err.message),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("invoice_payments").delete().eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      logAudit({ action: "payment_deleted", module: "invoices", record_id: id, record_name: invoice?.invoice_number });
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-payments", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();

      // Restore stock for this invoice before deleting
      const { data: movements } = await supabase
        .from("stock_movements")
        .select("id, product_id, location_id, quantity")
        .eq("document_id", id)
        .eq("document_type", "invoice")
        .eq("movement_type", "sale");

      if (movements && movements.length > 0) {
        for (const mv of movements) {
          await supabase.rpc("increment_stock_level", {
            p_product_id:  mv.product_id,
            p_location_id: mv.location_id,
            p_delta:       mv.quantity,   // positive = restore stock
          });
        }
        await supabase
          .from("stock_movements")
          .delete()
          .eq("document_id", id)
          .eq("document_type", "invoice")
          .eq("movement_type", "sale");
      }

      // Delete invoice (cascade: invoice_items, invoice_payments)
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      logAudit({ action: "deleted", module: "invoices", record_id: id, record_name: invoice?.invoice_number });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      router.push("/invoices");
    },
  });

  const handlePrint = useCallback(() => {
    if (!invoice) return;
    const html = buildPrintHTML(invoice, companySettings);
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { alert("Please allow pop-ups to generate PDF."); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => w.print();
  }, [invoice, companySettings]);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Invoice" breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: "Loading…" }]} />
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 max-w-5xl mx-auto w-full space-y-4">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Invoice" breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: "Not Found" }]} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Invoice not found</p>
            <Button variant="outline" size="sm" onClick={() => router.push("/invoices")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back to Invoices
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const customer    = invoice.customer;
  const displayName = customer.company_name ?? customer.name;
  const transitions = STATUS_TRANSITIONS[invoice.status] ?? [];
  const amountPaid  = invoice.amount_paid ?? 0;
  const balanceDue  = Math.max(0, invoice.total_amount - amountPaid);

  return (
    <div className="flex flex-col h-full">
      <Header
        title={invoice.invoice_number}
        subtitle={displayName}
        breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: invoice.invoice_number }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/invoices")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1.5" />PDF
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={invoice.status === "paid"}
              title={invoice.status === "paid" ? "Paid invoices cannot be edited" : undefined}
              onClick={() => router.push(`/invoices/${id}/edit`)}>
              <Pencil className="h-4 w-4 mr-1.5" />Edit
            </Button>
            <Button
              variant="ghost" size="sm"
              className="text-destructive hover:text-destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (confirm(`Delete ${invoice.invoice_number}? This will restore any deducted inventory.`)) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* ── Status bar ─────────────────────────────────────── */}
          <div className="flex items-center flex-wrap gap-3 p-4 rounded-lg border bg-card shadow-sm">
            <Badge className={`text-sm capitalize border px-3 py-1 ${STATUS_STYLES[invoice.status]}`} variant="outline">
              {STATUS_LABEL[invoice.status]}
            </Badge>
            <div className="h-4 w-px bg-border" />
            {transitions.map(t => (
              <Button key={t.next} size="sm" variant="outline"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate(t.next)}>
                <t.icon className="h-3.5 w-3.5 mr-1.5" />
                {t.label}
              </Button>
            ))}
            {invoice.status !== "paid" && (
              <Button size="sm" variant="default"
                onClick={() => { setShowPayForm(v => !v); setPayError(null); }}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Record Payment
              </Button>
            )}
            {invoice.quotation_id && (
              <Button size="sm" variant="outline"
                onClick={() => router.push(`/quotations/${invoice.quotation_id}`)}>
                <Link2 className="h-3.5 w-3.5 mr-1.5" />View Quotation
              </Button>
            )}
            {statusMutation.isError && (
              <span className="text-xs text-destructive">{(statusMutation.error as Error).message}</span>
            )}
            {deleteMutation.isError && (
              <span className="text-xs text-destructive">{(deleteMutation.error as Error).message}</span>
            )}
          </div>

          {/* ── Record Payment form ─────────────────────────────── */}
          {showPayForm && (
            <div className="rounded-lg border bg-card shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Banknote className="h-4 w-4 text-muted-foreground" />
                Record Payment
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label>Amount (₹) *</Label>
                  <Input
                    type="number" min={0.01} step={0.01}
                    placeholder={`Max: ${fmtINR(balanceDue)}`}
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Payment Date *</Label>
                  <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Method</Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Input placeholder="Optional…" value={payNotes} onChange={e => setPayNotes(e.target.value)} />
                </div>
              </div>
              {payError && <p className="text-xs text-destructive">{payError}</p>}
              <div className="flex gap-2">
                <Button size="sm" disabled={addPaymentMutation.isPending || !payAmount}
                  onClick={() => addPaymentMutation.mutate()}>
                  {addPaymentMutation.isPending ? "Saving…" : "Save Payment"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowPayForm(false); setPayError(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* ── Payment summary strip ───────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-4 space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Invoice Total</p>
              <p className="text-lg font-bold tabular-nums">{fmtINR(invoice.total_amount)}</p>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Amount Received</p>
              <p className="text-lg font-bold tabular-nums text-green-600">{fmtINR(amountPaid)}</p>
            </div>
            <div className={`rounded-lg border p-4 space-y-1 ${balanceDue > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
              <p className="text-xs text-muted-foreground font-medium">Balance Due</p>
              <p className={`text-lg font-bold tabular-nums ${balanceDue > 0 ? "text-red-600" : "text-green-600"}`}>
                {fmtINR(balanceDue)}
              </p>
            </div>
          </div>

          {/* ── Customer + Dates ────────────────────────────────── */}
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
              <Button variant="link" size="sm" className="px-0 mt-2 h-auto text-xs"
                onClick={() => router.push(`/customers/${invoice.customer_id}`)}>
                View Customer Ledger →
              </Button>
            </div>

            <div className="rounded-lg border bg-card shadow-sm p-5 space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Details</h2>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoice Date</span>
                <span className="font-medium">{fmtDate(invoice.invoice_date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Due Date</span>
                <span className={`font-medium ${invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== "paid" ? "text-destructive" : ""}`}>
                  {invoice.due_date ? fmtDate(invoice.due_date) : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items</span>
                <span className="font-medium">{invoice.items?.length ?? 0}</span>
              </div>
            </div>
          </div>

          {/* ── Line Items ──────────────────────────────────────── */}
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
                  {invoice.items?.map((item, i) => {
                    const lineAmt = item.quantity * item.unit_price;
                    const taxAmt  = lineAmt * item.tax_rate / 100;
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
            <div className="border-t px-5 py-4 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums">{fmtINR(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GST / Tax</span>
                  <span className="font-medium tabular-nums">{fmtINR(invoice.tax_amount)}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t pt-2">
                  <span>Total</span>
                  <span className="tabular-nums">{fmtINR(invoice.total_amount)}</span>
                </div>
                {amountPaid > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-green-600 font-medium">
                      <span>Received</span>
                      <span className="tabular-nums">{fmtINR(amountPaid)}</span>
                    </div>
                    <div className={`flex justify-between text-sm font-bold border-t pt-2 ${balanceDue > 0 ? "text-red-600" : "text-green-600"}`}>
                      <span>Balance Due</span>
                      <span className="tabular-nums">{fmtINR(balanceDue)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Payment History ──────────────────────────────────── */}
          <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
            <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                Payment History
              </h2>
              <span className="text-xs text-muted-foreground">
                {payments.length} payment{payments.length !== 1 ? "s" : ""}
              </span>
            </div>
            {paymentsLoading ? (
              <div className="p-5 space-y-2">
                <Skeleton className="h-8 rounded" />
                <Skeleton className="h-8 rounded" />
              </div>
            ) : payments.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No payments recorded yet.
                {invoice.status !== "paid" && (
                  <button
                    className="block mx-auto mt-2 text-primary underline text-xs"
                    onClick={() => setShowPayForm(true)}>
                    Record first payment →
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5">Date</th>
                    <th className="text-left px-4 py-2.5">Method</th>
                    <th className="text-left px-4 py-2.5">Notes</th>
                    <th className="text-right px-4 py-2.5">Amount</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-3">{fmtDateShort(p.payment_date)}</td>
                      <td className="px-4 py-3">{PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{p.notes ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-green-600">
                        {fmtINR(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="text-xs text-destructive hover:underline"
                          onClick={() => {
                            if (confirm("Delete this payment? This will update the invoice balance.")) {
                              deletePaymentMutation.mutate(p.id);
                            }
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Notes ────────────────────────────────────────────── */}
          {invoice.notes && (
            <div className="rounded-lg border bg-amber-50 border-amber-200 shadow-sm p-5">
              <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Notes</h2>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
