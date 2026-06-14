"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pencil,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  FileText,
  Building2,
  ShoppingCart,
  IndianRupee,
  AlertCircle,
  Receipt,
  Banknote,
} from "lucide-react";
import type { Customer, Invoice, InvoiceStatus } from "@/lib/types";

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchCustomer(id: string): Promise<Customer> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

interface LedgerInvoice extends Invoice {
  balance_due: number;
}

async function fetchCustomerLedger(customerId: string): Promise<{
  invoices: LedgerInvoice[];
  payments: Array<{
    id: string; invoice_id: string; invoice_number: string;
    amount: number; payment_date: string;
    payment_method: string; notes: string | null;
  }>;
}> {
  const supabase = createClient();

  // Step 1: fetch this customer's invoices
  const { data: invData } = await supabase
    .from("invoices")
    .select("*")
    .eq("customer_id", customerId)
    .order("invoice_date", { ascending: false });

  const invoices: LedgerInvoice[] = (invData ?? []).map((inv: Invoice) => ({
    ...inv,
    balance_due: Math.max(0, inv.total_amount - (inv.amount_paid ?? 0)),
  }));

  if (invoices.length === 0) return { invoices, payments: [] };

  // Step 2: fetch payments only for those invoices (not all org payments)
  const invoiceIds = invoices.map(i => i.id);
  const { data: payData, error: payError } = await supabase
    .from("invoice_payments")
    .select("*, invoice:invoices(invoice_number)")
    .in("invoice_id", invoiceIds)
    .order("payment_date", { ascending: false });

  if (payError) {
    // invoice_payments table may not exist yet (migration 009 not applied)
    return { invoices, payments: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { invoices, payments: (payData ?? []).map((p: any) => ({
    ...p,
    invoice_number: p.invoice?.invoice_number ?? "—",
  })) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer",
  cheque: "Cheque", upi: "UPI", other: "Other",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5 border-b last:border-0">
      <span className="w-36 shrink-0 text-xs text-muted-foreground pt-0.5">{label}</span>
      <span className="text-sm flex-1 break-words">{value ?? <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
      <div className="px-5 py-3 border-b bg-muted/30">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();

  const { data: customer, isLoading, error } = useQuery({
    queryKey: ["customer", id],
    queryFn:  () => fetchCustomer(id),
    retry: 1,
  });

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["customer-ledger", id],
    queryFn:  () => fetchCustomerLedger(id),
    enabled:  !!id,
  });

  // ── Loading ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Customer" breadcrumbs={[{ label: "Customers", href: "/customers" }, { label: "Loading…" }]} />
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  // ── Error / Not found ────────────────────────────────────
  if (error || !customer) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Customer" breadcrumbs={[{ label: "Customers", href: "/customers" }, { label: "Not Found" }]} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Customer not found</p>
            <p className="text-sm text-muted-foreground">
              {error ? (error as Error).message : "This customer may have been deleted."}
            </p>
            <Button variant="outline" size="sm" onClick={() => router.push("/customers")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Customers
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const displayName = customer.company_name ?? customer.name;
  const fullAddress = [customer.address, customer.city, customer.state, customer.pincode]
    .filter(Boolean).join(", ");

  // ── Ledger calculations ───────────────────────────────────
  const invoices    = ledger?.invoices  ?? [];
  const payments    = ledger?.payments  ?? [];
  const totalSales  = invoices.reduce((s, i) => s + i.total_amount, 0);
  const totalPaid   = invoices.reduce((s, i) => s + (i.amount_paid ?? 0), 0);
  const outstanding = invoices.reduce((s, i) => s + i.balance_due, 0);
  const lastTxDate  = invoices.length > 0 ? invoices[0].invoice_date : null;

  return (
    <div className="flex flex-col h-full">
      <Header
        title={displayName}
        subtitle={customer.company_name ? customer.name : undefined}
        breadcrumbs={[{ label: "Customers", href: "/customers" }, { label: displayName }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/customers")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back
            </Button>
            <Button variant="outline" size="sm"
              onClick={() => router.push(`/invoices/new`)}>
              <Receipt className="h-4 w-4 mr-1.5" />
              New Invoice
            </Button>
            <Button size="sm" onClick={() => router.push(`/customers/${id}/edit`)}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* ── Financial overview ───────────────────────────── */}
          {ledgerLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-lg border bg-card p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="text-xs font-medium">Total Invoices</span>
                </div>
                <p className="text-2xl font-bold">{invoices.length}</p>
                <p className="text-[11px] text-muted-foreground">
                  {lastTxDate ? `Last: ${fmtDate(lastTxDate)}` : "No invoices yet"}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IndianRupee className="h-4 w-4" />
                  <span className="text-xs font-medium">Total Sales</span>
                </div>
                <p className="text-2xl font-bold tabular-nums">{fmtINR(totalSales)}</p>
                <p className="text-[11px] text-muted-foreground">Across all invoices</p>
              </div>
              <div className="rounded-lg border bg-green-50 border-green-200 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-green-700">
                  <Banknote className="h-4 w-4" />
                  <span className="text-xs font-medium">Total Amount Received</span>
                </div>
                <p className="text-2xl font-bold tabular-nums text-green-700">{fmtINR(totalPaid)}</p>
                <p className="text-[11px] text-green-600">{payments.length} payment{payments.length !== 1 ? "s" : ""}</p>
              </div>
              <div className={`rounded-lg border p-4 space-y-1.5 ${outstanding > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                <div className={`flex items-center gap-2 ${outstanding > 0 ? "text-red-700" : "text-green-700"}`}>
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs font-medium">Outstanding</span>
                </div>
                <p className={`text-2xl font-bold tabular-nums ${outstanding > 0 ? "text-red-700" : "text-green-700"}`}>
                  {fmtINR(outstanding)}
                </p>
                <p className={`text-[11px] ${outstanding > 0 ? "text-red-600" : "text-green-600"}`}>
                  {outstanding > 0 ? "Amount outstanding" : "Fully settled"}
                </p>
              </div>
            </div>
          )}

          {/* ── Invoice history ──────────────────────────────── */}
          <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
            <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                Invoice History
              </h2>
              <Button size="sm" variant="outline"
                onClick={() => router.push(`/invoices/new?customer_id=${id}`)}>
                <Receipt className="h-3.5 w-3.5 mr-1.5" />New Invoice
              </Button>
            </div>
            {ledgerLoading ? (
              <div className="p-5 space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded" />)}
              </div>
            ) : invoices.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No invoices yet for this customer.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <th className="text-left px-4 py-2.5">Invoice #</th>
                      <th className="text-left px-4 py-2.5">Date</th>
                      <th className="text-left px-4 py-2.5">Due</th>
                      <th className="text-right px-4 py-2.5">Total</th>
                      <th className="text-right px-4 py-2.5">Amt. Received</th>
                      <th className="text-right px-4 py-2.5">Outstanding</th>
                      <th className="text-left px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr
                        key={inv.id}
                        className="border-t hover:bg-muted/30 cursor-pointer"
                        onClick={() => router.push(`/invoices/${inv.id}`)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-primary">{inv.invoice_number}</span>
                        </td>
                        <td className="px-4 py-3">{fmtDate(inv.invoice_date)}</td>
                        <td className="px-4 py-3">
                          {inv.due_date ? (
                            <span className={inv.status !== "paid" && new Date(inv.due_date) < new Date() ? "text-destructive" : ""}>
                              {fmtDate(inv.due_date)}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtINR(inv.total_amount)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-green-600">{fmtINR(inv.amount_paid ?? 0)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          <span className={inv.balance_due > 0 ? "text-red-600" : "text-green-600"}>
                            {fmtINR(inv.balance_due)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs border ${STATUS_STYLES[inv.status]}`} variant="outline">
                            {STATUS_LABEL[inv.status]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/20 border-t font-semibold text-sm">
                      <td colSpan={3} className="px-4 py-3">Total</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtINR(totalSales)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-600">{fmtINR(totalPaid)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={outstanding > 0 ? "text-red-600" : "text-green-600"}>
                          {fmtINR(outstanding)}
                        </span>
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ── Payment history ──────────────────────────────── */}
          <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
            <div className="px-5 py-3 border-b bg-muted/30">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Banknote className="h-4 w-4 text-muted-foreground" />
                Payment History
              </h2>
            </div>
            {ledgerLoading ? (
              <div className="p-5 space-y-2">
                {[1,2].map(i => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : payments.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No payments recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <th className="text-left px-4 py-2.5">Date</th>
                      <th className="text-left px-4 py-2.5">Invoice</th>
                      <th className="text-left px-4 py-2.5">Method</th>
                      <th className="text-left px-4 py-2.5">Notes</th>
                      <th className="text-right px-4 py-2.5">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-3">{fmtDate(p.payment_date)}</td>
                        <td className="px-4 py-3">
                          <button
                            className="font-mono text-primary hover:underline text-xs"
                            onClick={() => router.push(`/invoices/${p.invoice_id}`)}>
                            {p.invoice_number}
                          </button>
                        </td>
                        <td className="px-4 py-3">{PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{p.notes ?? "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-green-600">
                          {fmtINR(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Customer Information ──────────────────────────── */}
          <Section title="Customer Information">
            <InfoRow
              label="Status"
              value={
                <Badge
                  variant={customer.is_active ? "default" : "secondary"}
                  className={customer.is_active
                    ? "bg-green-100 text-green-700 border-green-200 text-xs"
                    : "text-xs"}
                >
                  {customer.is_active ? "Active" : "Inactive"}
                </Badge>
              }
            />
            <InfoRow label="Contact Name" value={customer.name} />
            <InfoRow
              label="Company"
              value={
                customer.company_name ? (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {customer.company_name}
                  </span>
                ) : null
              }
            />
            <InfoRow
              label="Phone"
              value={
                customer.phone ? (
                  <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 text-primary hover:underline">
                    <Phone className="h-3.5 w-3.5" />
                    {customer.phone}
                  </a>
                ) : null
              }
            />
            <InfoRow
              label="Email"
              value={
                customer.email ? (
                  <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 text-primary hover:underline break-all">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {customer.email}
                  </a>
                ) : null
              }
            />
            <InfoRow
              label="Address"
              value={
                fullAddress ? (
                  <span className="flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <span>{fullAddress}</span>
                  </span>
                ) : null
              }
            />
            <InfoRow
              label="GST Number"
              value={customer.gst_number ? <span className="font-mono text-sm">{customer.gst_number}</span> : null}
            />
            <InfoRow
              label="Created"
              value={new Date(customer.created_at).toLocaleDateString("en-IN", {
                day: "2-digit", month: "short", year: "numeric",
              })}
            />
          </Section>

          {customer.notes && (
            <Section title="Notes">
              <div className="py-3 flex gap-3">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
