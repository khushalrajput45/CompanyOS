"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Pencil, ArrowLeft, Phone, Mail, MapPin, User, FileText,
  AlertCircle, IndianRupee, Package, Banknote, ShoppingBag,
  PlusCircle, TrendingDown,
} from "lucide-react";
import type { Vendor, POStatus, POPaymentStatus } from "@/lib/types";

// ── Local types ───────────────────────────────────────────────────────────────

type PORow = {
  id: string;
  po_number: string;
  po_date: string;
  expected_date: string | null;
  status: POStatus;
  total_amount: number;
  amount_paid: number;
  payment_status: POPaymentStatus;
};

type GRNLedgerRow = {
  receipt_id: string;
  grn_number: string;
  receipt_date: string;
  purchase_order_id: string;
  po_number: string;
  receipt_value: number;
};

type VendorPaymentRow = {
  id: string;
  vendor_id: string;
  purchase_order_id: string | null;
  payment_number: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_no: string | null;
  notes: string | null;
  created_at: string;
  purchase_order: { id: string; po_number: string } | null;
};

type LedgerEntry = {
  id: string;
  date: string;
  type: "grn" | "payment";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  link?: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  upi: "UPI",
  neft: "NEFT",
  rtgs: "RTGS",
  other: "Other",
};

const PO_STATUS_STYLES: Record<POStatus, string> = {
  draft:     "bg-slate-100  text-slate-700  border-slate-200",
  sent:      "bg-blue-100   text-blue-700   border-blue-200",
  partial:   "bg-orange-100 text-orange-700 border-orange-200",
  received:  "bg-green-100  text-green-700  border-green-200",
  cancelled: "bg-red-100    text-red-600    border-red-200",
};

const PO_STATUS_LABEL: Record<POStatus, string> = {
  draft: "Draft", sent: "Sent", partial: "Partial",
  received: "Received", cancelled: "Cancelled",
};

// Computed payment status includes 'overdue' (client-side: pending + received >30 days ago)
type DisplayPayStatus = POPaymentStatus | "overdue";

const PAY_STATUS_STYLES: Record<DisplayPayStatus, string> = {
  pending: "bg-slate-100  text-slate-700  border-slate-200",
  partial: "bg-orange-100 text-orange-700 border-orange-200",
  paid:    "bg-green-100  text-green-700  border-green-200",
  overdue: "bg-red-100    text-red-600    border-red-200",
};

const PAY_STATUS_LABEL: Record<DisplayPayStatus, string> = {
  pending: "Pending", partial: "Partial", paid: "Paid", overdue: "Overdue",
};

const today = new Date().toISOString().split("T")[0];
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtINR2(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Overdue: received goods but still pending after 30 days
function getDisplayPayStatus(po: PORow): DisplayPayStatus {
  if (po.payment_status === "paid")    return "paid";
  if (po.payment_status === "partial") return "partial";
  if (["partial", "received"].includes(po.status) && po.po_date < thirtyDaysAgo) return "overdue";
  return "pending";
}

// ── Component helpers ─────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card shadow-sm p-5 space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchVendor(id: string): Promise<Vendor> {
  const supabase = createClient();
  const { data, error } = await supabase.from("vendors").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function fetchVendorLedger(vendorId: string): Promise<{
  pos: PORow[];
  grns: GRNLedgerRow[];
  payments: VendorPaymentRow[];
}> {
  const supabase = createClient();

  const [posResult, grnsResult, paymentsResult] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("id, po_number, po_date, expected_date, status, total_amount, amount_paid, payment_status")
      .eq("vendor_id", vendorId)
      .not("status", "eq", "cancelled")
      .order("po_date", { ascending: true }),
    supabase.rpc("get_vendor_grn_entries", { p_vendor_id: vendorId }),
    supabase
      .from("vendor_payments")
      .select("*, purchase_order:purchase_orders(id, po_number)")
      .eq("vendor_id", vendorId)
      .order("payment_date", { ascending: true }),
  ]);

  if (posResult.error) throw posResult.error;

  return {
    pos:      (posResult.data ?? []) as unknown as PORow[],
    grns:     grnsResult.error ? [] : (grnsResult.data ?? []) as unknown as GRNLedgerRow[],
    payments: paymentsResult.error ? [] : (paymentsResult.data ?? []) as unknown as VendorPaymentRow[],
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VendorDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const queryClient = useQueryClient();

  // Payment dialog state
  const [payOpen,   setPayOpen]   = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate,   setPayDate]   = useState(today);
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payPOId,   setPayPOId]   = useState("none");
  const [payRef,    setPayRef]    = useState("");
  const [payNotes,  setPayNotes]  = useState("");
  const [payError,  setPayError]  = useState<string | null>(null);

  function resetPayForm() {
    setPayAmount(""); setPayDate(today); setPayMethod("bank_transfer");
    setPayPOId("none"); setPayRef(""); setPayNotes(""); setPayError(null);
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: vendor, isLoading, error } = useQuery({
    queryKey: ["vendor", id],
    queryFn:  () => fetchVendor(id),
    retry: 1,
  });

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["vendor-ledger", id],
    queryFn:  () => fetchVendorLedger(id),
    enabled:  !!id,
  });

  // ── Payment mutation ──────────────────────────────────────────────────────────

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(payAmount);
      if (!amt || amt <= 0) throw new Error("Enter a valid amount greater than zero");
      const supabase = createClient();
      const { error: err } = await supabase.from("vendor_payments").insert({
        vendor_id:         id,
        purchase_order_id: payPOId === "none" ? null : payPOId,
        amount:            amt,
        payment_date:      payDate,
        payment_method:    payMethod,
        reference_no:      payRef.trim() || null,
        notes:             payNotes.trim() || null,
      });
      if (err) throw err;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-ledger", id] });
      queryClient.invalidateQueries({ queryKey: ["vendor-payments-list"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setPayOpen(false);
      resetPayForm();
    },
    onError: (err: Error) => setPayError(err.message),
  });

  // ── Computed values ───────────────────────────────────────────────────────────

  const ledgerEntries = useMemo((): LedgerEntry[] => {
    if (!ledger) return [];

    const raw: Omit<LedgerEntry, "balance">[] = [];

    // Debits: one entry per GRN (goods receipt creates the payable liability)
    for (const grn of ledger.grns) {
      if (grn.receipt_value > 0) {
        raw.push({
          id:          `grn-${grn.receipt_id}`,
          date:        grn.receipt_date,
          type:        "grn",
          reference:   grn.grn_number,
          description: `Goods Receipt · ${grn.po_number}`,
          debit:       grn.receipt_value,
          credit:      0,
          link:        `/grn/${grn.receipt_id}`,
        });
      }
    }

    // Credits: payments
    for (const p of ledger.payments) {
      raw.push({
        id:          `pay-${p.id}`,
        date:        p.payment_date,
        type:        "payment",
        reference:   p.payment_number || p.reference_no || (PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method),
        description: `Payment — ${PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}` +
                     (p.purchase_order ? ` · ${p.purchase_order.po_number}` : ""),
        debit:       0,
        credit:      p.amount,
        link:        p.purchase_order ? `/purchase-orders/${p.purchase_order.id}` : undefined,
      });
    }

    // Sort chronologically, stable tie-break by id
    raw.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

    let running = 0;
    return raw.map(e => {
      running += e.debit - e.credit;
      return { ...e, balance: running };
    });
  }, [ledger]);

  const totalPurchases = useMemo(
    () => (ledger?.grns ?? []).reduce((s, g) => s + g.receipt_value, 0),
    [ledger]
  );

  const totalPaid = useMemo(
    () => (ledger?.payments ?? []).reduce((s, p) => s + p.amount, 0),
    [ledger]
  );

  const outstanding = totalPurchases - totalPaid;

  const openPOs = useMemo(
    () => (ledger?.pos ?? []).filter(po => ["draft", "sent", "partial"].includes(po.status)).length,
    [ledger]
  );

  const lastReceiptDate = useMemo(() => {
    const grns = ledger?.grns ?? [];
    return grns.length > 0
      ? grns.reduce((l, g) => (g.receipt_date > l ? g.receipt_date : l), grns[0].receipt_date)
      : null;
  }, [ledger]);

  const lastPaymentDate = useMemo(() => {
    const pmts = ledger?.payments ?? [];
    return pmts.length > 0
      ? pmts.reduce((l, p) => (p.payment_date > l ? p.payment_date : l), pmts[0].payment_date)
      : null;
  }, [ledger]);

  const linkablePOs = useMemo(
    () => (ledger?.pos ?? []).filter(po => ["sent", "partial", "received"].includes(po.status)),
    [ledger]
  );

  // ── Loading / error states ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Vendor"
          breadcrumbs={[{ label: "Vendors", href: "/vendors" }, { label: "Loading…" }]} />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto space-y-4">
            <Skeleton className="h-20 rounded-lg" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Vendor"
          breadcrumbs={[{ label: "Vendors", href: "/vendors" }, { label: "Not Found" }]} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Vendor not found</p>
            <Button variant="outline" size="sm" onClick={() => router.push("/vendors")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back to Vendors
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const locationParts = [vendor.city, vendor.state, vendor.pincode].filter(Boolean);
  const fullAddress   = [vendor.address, locationParts.join(", ")].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col h-full">
      <Header
        title={vendor.name}
        breadcrumbs={[{ label: "Vendors", href: "/vendors" }, { label: vendor.name }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/vendors")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back
            </Button>
            <Button variant="outline" size="sm" onClick={() => { resetPayForm(); setPayOpen(true); }}>
              <Banknote className="h-4 w-4 mr-1.5" />Record Payment
            </Button>
            <Button size="sm" onClick={() => router.push(`/vendors/${id}/edit`)}>
              <Pencil className="h-4 w-4 mr-1.5" />Edit
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-4">

          {/* ── Vendor header ───────────────────────────────── */}
          <div className="rounded-lg border bg-card shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{vendor.name}</h2>
                {vendor.company_name && (
                  <p className="text-muted-foreground mt-0.5">{vendor.company_name}</p>
                )}
              </div>
              <Badge
                className={vendor.is_active
                  ? "bg-green-100 text-green-700 border-green-200 shrink-0"
                  : "shrink-0"}
                variant={vendor.is_active ? "default" : "secondary"}
              >
                {vendor.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          {/* ── Overview cards ──────────────────────────────── */}
          {ledgerLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

              {/* Total Purchases */}
              <div className="rounded-lg border bg-card p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShoppingBag className="h-4 w-4" />
                  <span className="text-xs font-medium">Total Purchases</span>
                </div>
                <p className="text-2xl font-bold tabular-nums">{fmtINR(totalPurchases)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {lastReceiptDate ? `Last receipt: ${fmtDate(lastReceiptDate)}` : "No receipts yet"}
                </p>
              </div>

              {/* Total Paid to Vendor */}
              <div className="rounded-lg border bg-green-50 border-green-200 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-green-700">
                  <Banknote className="h-4 w-4" />
                  <span className="text-xs font-medium">Total Paid to Vendor</span>
                </div>
                <p className="text-2xl font-bold tabular-nums text-green-700">{fmtINR(totalPaid)}</p>
                <p className="text-[11px] text-green-600">
                  {lastPaymentDate ? `Last: ${fmtDate(lastPaymentDate)}` : `${ledger?.payments.length ?? 0} payments`}
                </p>
              </div>

              {/* Outstanding */}
              <div className={`rounded-lg border p-4 space-y-1.5 ${
                outstanding > 0.005 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
              }`}>
                <div className={`flex items-center gap-2 ${outstanding > 0.005 ? "text-red-700" : "text-green-700"}`}>
                  <IndianRupee className="h-4 w-4" />
                  <span className="text-xs font-medium">Outstanding</span>
                </div>
                <p className={`text-2xl font-bold tabular-nums ${outstanding > 0.005 ? "text-red-700" : "text-green-700"}`}>
                  {fmtINR(Math.max(0, outstanding))}
                </p>
                <p className={`text-[11px] ${outstanding > 0.005 ? "text-red-600" : "text-green-600"}`}>
                  {outstanding > 0.005 ? "Amount payable" : "Fully settled"}
                </p>
              </div>

              {/* Open POs */}
              <div className="rounded-lg border bg-card p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span className="text-xs font-medium">Open POs</span>
                </div>
                <p className="text-2xl font-bold">{openPOs}</p>
                <p className="text-[11px] text-muted-foreground">
                  {(ledger?.pos.length ?? 0)} total POs
                </p>
              </div>

            </div>
          )}

          {/* ── Account Ledger ──────────────────────────────── */}
          <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
            <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                Account Ledger
              </h2>
              <span className="text-xs text-muted-foreground">Chronological · oldest first</span>
            </div>

            {ledgerLoading ? (
              <div className="p-5 space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded" />)}
              </div>
            ) : ledgerEntries.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No transactions yet. Receive goods from a PO to see entries here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <th className="text-left px-4 py-2.5">Date</th>
                      <th className="text-left px-4 py-2.5">Type</th>
                      <th className="text-left px-4 py-2.5">Reference · Description</th>
                      <th className="text-right px-4 py-2.5">Debit (Dr)</th>
                      <th className="text-right px-4 py-2.5">Credit (Cr)</th>
                      <th className="text-right px-4 py-2.5">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t bg-muted/10">
                      <td colSpan={5} className="px-4 py-2 text-xs text-muted-foreground">
                        Opening Balance
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-muted-foreground tabular-nums">
                        ₹0.00
                      </td>
                    </tr>

                    {ledgerEntries.map(entry => (
                      <tr
                        key={entry.id}
                        className={`border-t transition-colors ${
                          entry.type === "payment"
                            ? "bg-green-50/40 hover:bg-green-50"
                            : "hover:bg-muted/20"
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">{fmtDate(entry.date)}</td>
                        <td className="px-4 py-3">
                          <Badge
                            className={
                              entry.type === "grn"
                                ? "bg-purple-100 text-purple-700 border-purple-200 text-xs border font-normal"
                                : "bg-green-100 text-green-700 border-green-200 text-xs border font-normal"
                            }
                            variant="outline"
                          >
                            {entry.type === "grn" ? "Goods Receipt" : "Payment"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {entry.link ? (
                            <button
                              className="font-mono text-xs text-primary hover:underline block"
                              onClick={() => router.push(entry.link!)}
                            >
                              {entry.reference}
                            </button>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">
                              {entry.reference}
                            </span>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {entry.debit > 0 ? (
                            <span className="font-semibold text-orange-700">{fmtINR2(entry.debit)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {entry.credit > 0 ? (
                            <span className="font-semibold text-green-700">{fmtINR2(entry.credit)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          <span className={entry.balance > 0.005 ? "text-red-600" : "text-green-600"}>
                            {fmtINR2(entry.balance)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/20 border-t font-semibold">
                      <td colSpan={3} className="px-4 py-3 text-sm">Closing Balance</td>
                      <td className="px-4 py-3 text-right tabular-nums text-orange-700">
                        {fmtINR2(totalPurchases)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-700">
                        {fmtINR2(totalPaid)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={outstanding > 0.005 ? "text-red-600" : "text-green-600"}>
                          {fmtINR2(Math.max(0, outstanding))}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ── Purchase Orders ─────────────────────────────── */}
          <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
            <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                Purchase Orders
              </h2>
              <Button size="sm" variant="outline" onClick={() => router.push("/purchase-orders/new")}>
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />New PO
              </Button>
            </div>

            {ledgerLoading ? (
              <div className="p-5 space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded" />)}
              </div>
            ) : !(ledger?.pos.length) ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No purchase orders for this vendor yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <th className="text-left px-4 py-2.5">PO Number</th>
                      <th className="text-left px-4 py-2.5">Date</th>
                      <th className="text-left px-4 py-2.5">Receipt</th>
                      <th className="text-left px-4 py-2.5">Payment</th>
                      <th className="text-right px-4 py-2.5">PO Value</th>
                      <th className="text-right px-4 py-2.5">Paid to Vendor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(ledger?.pos ?? [])].reverse().map(po => {
                      const displayPayStatus = getDisplayPayStatus(po);
                      return (
                        <tr
                          key={po.id}
                          className="border-t hover:bg-muted/20 cursor-pointer"
                          onClick={() => router.push(`/purchase-orders/${po.id}`)}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono font-semibold text-primary">{po.po_number}</span>
                          </td>
                          <td className="px-4 py-3">{fmtDate(po.po_date)}</td>
                          <td className="px-4 py-3">
                            <Badge
                              className={`text-xs border ${PO_STATUS_STYLES[po.status]}`}
                              variant="outline"
                            >
                              {PO_STATUS_LABEL[po.status]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {["partial", "received"].includes(po.status) ? (
                              <Badge
                                className={`text-xs border ${PAY_STATUS_STYLES[displayPayStatus]}`}
                                variant="outline"
                              >
                                {PAY_STATUS_LABEL[displayPayStatus]}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{fmtINR(po.total_amount)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            <span className={po.amount_paid > 0 ? "font-semibold text-green-700" : "text-muted-foreground"}>
                              {po.amount_paid > 0 ? fmtINR(po.amount_paid) : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Payment History ─────────────────────────────── */}
          <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
            <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Banknote className="h-4 w-4 text-muted-foreground" />
                Payment History
              </h2>
              <Button size="sm" onClick={() => { resetPayForm(); setPayOpen(true); }}>
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />Record Payment
              </Button>
            </div>

            {ledgerLoading ? (
              <div className="p-5 space-y-2">
                {[1,2].map(i => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : !(ledger?.payments.length) ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No payments recorded yet.{" "}
                <button
                  className="text-primary hover:underline"
                  onClick={() => { resetPayForm(); setPayOpen(true); }}
                >
                  Record first payment
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <th className="text-left px-4 py-2.5">Payment #</th>
                      <th className="text-left px-4 py-2.5">Date</th>
                      <th className="text-left px-4 py-2.5">PO Ref</th>
                      <th className="text-left px-4 py-2.5">Method</th>
                      <th className="text-left px-4 py-2.5">Reference No.</th>
                      <th className="text-right px-4 py-2.5">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(ledger?.payments ?? [])].reverse().map(p => (
                      <tr key={p.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-primary">
                            {p.payment_number || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{fmtDate(p.payment_date)}</td>
                        <td className="px-4 py-3">
                          {p.purchase_order ? (
                            <button
                              className="font-mono text-primary hover:underline text-xs"
                              onClick={() => router.push(`/purchase-orders/${p.purchase_order!.id}`)}
                            >
                              {p.purchase_order.po_number}
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {p.reference_no ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-green-700">
                          {fmtINR2(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/20 border-t font-semibold">
                      <td colSpan={5} className="px-4 py-3">Total Paid to Vendor</td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-700">
                        {fmtINR2(totalPaid)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ── Vendor Info (2-col grid) ─────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Section title="Contact Information">
              <div className="space-y-3">
                <InfoRow icon={User}   label="Contact Person" value={vendor.contact_person} />
                <InfoRow icon={Phone}  label="Phone"          value={vendor.phone} />
                <InfoRow icon={Mail}   label="Email"          value={vendor.email} />
                <InfoRow icon={MapPin} label="Address"        value={fullAddress || null} />
              </div>
            </Section>

            <Section title="GST Information">
              <div className="space-y-3">
                {vendor.gst_number ? (
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">GST Number</p>
                      <p className="text-sm font-mono font-medium tracking-wider">
                        {vendor.gst_number}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No GST number on file</p>
                )}
              </div>
            </Section>
          </div>

          {vendor.notes && (
            <Section title="Notes">
              <p className="text-sm text-muted-foreground whitespace-pre-line">{vendor.notes}</p>
            </Section>
          )}

          {/* Meta */}
          <div className="text-xs text-muted-foreground text-right space-y-0.5">
            <p>
              Added {vendor.created_at ? new Date(vendor.created_at).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
              }) : "—"}
            </p>
            {vendor.updated_at && vendor.updated_at !== vendor.created_at && (
              <p>
                Updated {new Date(vendor.updated_at).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Record Payment Dialog ───────────────────────────────────────────── */}
      <Dialog open={payOpen} onOpenChange={open => {
        if (!paymentMutation.isPending) {
          setPayOpen(open);
          if (!open) resetPayForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Payment — {vendor.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  min={0.01}
                  step={0.01}
                  placeholder="0.00"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Date</Label>
                <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Against PO (optional)</Label>
                <Select value={payPOId} onValueChange={setPayPOId}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {linkablePOs.map(po => (
                      <SelectItem key={po.id} value={po.id}>
                        {po.po_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reference Number (optional)</Label>
              <Input
                placeholder="NEFT/RTGS UTR, cheque no., UPI ref…"
                value={payRef}
                onChange={e => setPayRef(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <textarea
                value={payNotes}
                onChange={e => setPayNotes(e.target.value)}
                rows={2}
                placeholder="Remarks…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                           placeholder:text-muted-foreground focus:outline-none focus:ring-2
                           focus:ring-ring focus:ring-offset-2 resize-none"
              />
            </div>

            {payError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {payError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={paymentMutation.isPending}
              onClick={() => setPayOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={paymentMutation.isPending || !payAmount}
              onClick={() => { setPayError(null); paymentMutation.mutate(); }}
            >
              <Banknote className="h-4 w-4 mr-1.5" />
              {paymentMutation.isPending ? "Saving…" : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
