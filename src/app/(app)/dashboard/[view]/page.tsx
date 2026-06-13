"use client";

import { useState, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ArrowRight, LayoutDashboard, Download, FileSpreadsheet,
  Search, ChevronUp, ChevronDown, ChevronsUpDown, CheckCircle,
  TrendingDown, ShoppingBag, ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";
import { useProfile } from "@/lib/hooks/useProfile";

// ── Movement type constants ────────────────────────────────────────────────────
const IN_TYPES  = ["receipt", "transfer_in", "return", "adjustment"];
const OUT_TYPES = ["sale", "transfer_out", "damage"];

// ── Types ──────────────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";

type ColDef = {
  key: string; label: string;
  sortable?: boolean; align?: "right";
  render: (row: FlatRow) => React.ReactNode;
  exportValue?: (row: FlatRow) => string;
};

type FlatRow = Record<string, string | number | null | undefined>;

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function fmtShort(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000)    return `${sign}₹${(abs / 100_000).toFixed(1)}L`;
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function fmtDate(s: string | null | undefined) {
  if (!s || s === "—") return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtPct(n: number) { return n.toFixed(1) + "%"; }
function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr + "T00:00:00").getTime()) / 86_400_000);
}

// ── DB row types ───────────────────────────────────────────────────────────────

type DBInvoice = {
  id: string; invoice_number: string; invoice_date: string; due_date: string | null;
  total_amount: number; amount_paid: number; status: string;
  customer: { id: string; name: string } | null;
};
type DBPO = {
  id: string; po_number: string; po_date: string; total_amount: number; status: string;
  vendor: { id: string; name: string } | null;
};
type DBProduct = {
  id: string; name: string; sku: string;
  cost_price: number | null; selling_price: number; reorder_point: number;
};
type DBVendorPayment = { id: string; amount: number; payment_date: string; vendor_id: string | null };
type DBReceivedPO = {
  id: string; total_amount: number; po_date: string; vendor_id: string | null;
  vendor: { id: string; name: string } | null;
};
type DBStockMovement = {
  id: string; movement_type: string; quantity: number; unit_price: number | null;
  created_at: string; reference_no: string | null;
  product: { id: string; name: string; sku: string } | null;
};
type DBInvoicePayment = {
  id: string; amount: number; payment_date: string;
  invoice: { id: string; invoice_number: string; customer: { id: string; name: string } | null } | null;
};
type DBVendorPaymentFull = {
  id: string; payment_number: string; amount: number; payment_date: string;
  vendor: { id: string; name: string } | null;
};

// ── Data fetchers ──────────────────────────────────────────────────────────────

async function fetchInvoicesRange(start: string, end: string): Promise<DBInvoice[]> {
  const { data } = await createClient()
    .from("invoices")
    .select("id, invoice_number, invoice_date, due_date, total_amount, amount_paid, status, customer:customers(id, name)")
    .gte("invoice_date", start).lte("invoice_date", end)
    .neq("status", "draft")
    .order("invoice_date", { ascending: false });
  return (data ?? []) as unknown as DBInvoice[];
}

async function fetchPOsRange(start: string, end: string): Promise<DBPO[]> {
  const { data } = await createClient()
    .from("purchase_orders")
    .select("id, po_number, po_date, total_amount, status, vendor:vendors(id, name)")
    .gte("po_date", start).lte("po_date", end)
    .not("status", "in", '("draft","cancelled")')
    .order("po_date", { ascending: false });
  return (data ?? []) as unknown as DBPO[];
}

async function fetchOutstandingInvoices(): Promise<DBInvoice[]> {
  const { data } = await createClient()
    .from("invoices")
    .select("id, invoice_number, invoice_date, due_date, total_amount, amount_paid, status, customer:customers(id, name)")
    .in("status", ["sent", "partial", "overdue"])
    .order("total_amount", { ascending: false });
  return (data ?? []) as unknown as DBInvoice[];
}

async function fetchVendorOutstandingData(): Promise<{ pos: DBReceivedPO[]; payments: DBVendorPayment[] }> {
  const supabase = createClient();
  const [posRes, paymentsRes] = await Promise.all([
    supabase.from("purchase_orders")
      .select("id, total_amount, po_date, vendor_id, vendor:vendors(id, name)")
      .in("status", ["partial", "received"]),
    supabase.from("vendor_payments").select("id, amount, payment_date, vendor_id"),
  ]);
  return {
    pos:      (posRes.data      ?? []) as unknown as DBReceivedPO[],
    payments: (paymentsRes.data ?? []) as unknown as DBVendorPayment[],
  };
}

async function fetchInventoryDetail(): Promise<{
  products: DBProduct[]; stockMap: Map<string, number>; recentlyMovedIds: Set<string>;
}> {
  const supabase = createClient();
  const ago90 = new Date(); ago90.setDate(ago90.getDate() - 90);
  const [productsRes, stockRes, movRes] = await Promise.all([
    supabase.from("products")
      .select("id, name, sku, cost_price, selling_price, reorder_point")
      .is("deleted_at", null).eq("is_active", true),
    supabase.from("stock_levels").select("product_id, quantity"),
    supabase.from("stock_movements").select("product_id").gte("created_at", ago90.toISOString()),
  ]);
  const stockMap = new Map<string, number>();
  for (const sl of (stockRes.data ?? []) as { product_id: string; quantity: number }[]) {
    stockMap.set(sl.product_id, (stockMap.get(sl.product_id) ?? 0) + sl.quantity);
  }
  const recentlyMovedIds = new Set<string>(
    ((movRes.data ?? []) as { product_id: string }[]).map(m => m.product_id)
  );
  return { products: (productsRes.data ?? []) as unknown as DBProduct[], stockMap, recentlyMovedIds };
}

async function fetchStockMovements(start: string, end: string, types: string[]): Promise<DBStockMovement[]> {
  const startTs = new Date(start + "T00:00:00").toISOString();
  const endTs   = new Date(end   + "T23:59:59").toISOString();
  const { data } = await createClient()
    .from("stock_movements")
    .select("id, movement_type, quantity, unit_price, created_at, reference_no, product:products(id, name, sku)")
    .in("movement_type", types)
    .gte("created_at", startTs)
    .lte("created_at", endTs)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as DBStockMovement[];
}

async function fetchCashFlow(start: string, end: string): Promise<{ invPayments: DBInvoicePayment[]; vendPayments: DBVendorPaymentFull[] }> {
  const supabase = createClient();
  const [invRes, vendRes] = await Promise.all([
    supabase.from("invoice_payments")
      .select("id, amount, payment_date, invoice:invoices(id, invoice_number, customer:customers(id, name))")
      .gte("payment_date", start).lte("payment_date", end)
      .order("payment_date", { ascending: false }),
    supabase.from("vendor_payments")
      .select("id, payment_number, amount, payment_date, vendor:vendors(id, name)")
      .gte("payment_date", start).lte("payment_date", end)
      .order("payment_date", { ascending: false }),
  ]);
  return {
    invPayments:  (invRes.data  ?? []) as unknown as DBInvoicePayment[],
    vendPayments: (vendRes.data ?? []) as unknown as DBVendorPaymentFull[],
  };
}

// ── Row builders ───────────────────────────────────────────────────────────────

function buildSalesRows(invoices: DBInvoice[]): FlatRow[] {
  return invoices.map(inv => {
    const cust = inv.customer as { id: string; name: string } | null;
    return {
      _id: inv.id, _href: `/invoices/${inv.id}`,
      invoice_number: inv.invoice_number,
      customer_name: cust?.name ?? "—",
      invoice_date: inv.invoice_date,
      due_date: inv.due_date ?? "—",
      total_amount: inv.total_amount,
      amount_paid: inv.amount_paid,
      balance: Math.max(0, inv.total_amount - inv.amount_paid),
      status: inv.status,
    };
  });
}

function buildPurchasesRows(pos: DBPO[]): FlatRow[] {
  return pos.map(po => {
    const vend = po.vendor as { id: string; name: string } | null;
    return {
      _id: po.id, _href: `/purchase-orders/${po.id}`,
      po_number: po.po_number,
      vendor_name: vend?.name ?? "—",
      po_date: po.po_date,
      total_amount: po.total_amount,
      status: po.status,
    };
  });
}

function buildOverdueRows(invoices: DBInvoice[]): FlatRow[] {
  const today = new Date().toISOString().split("T")[0];
  return invoices
    .filter(inv => inv.due_date && inv.due_date < today)
    .map(inv => {
      const cust = inv.customer as { id: string; name: string } | null;
      return {
        _id: inv.id, _href: `/invoices/${inv.id}`,
        invoice_number: inv.invoice_number,
        customer_name: cust?.name ?? "—",
        total_amount: inv.total_amount,
        amount_paid: inv.amount_paid,
        outstanding: Math.max(0, inv.total_amount - inv.amount_paid),
        due_date: inv.due_date ?? "—",
        days_overdue: inv.due_date ? daysSince(inv.due_date) : 0,
      };
    })
    .sort((a, b) => (b.days_overdue as number) - (a.days_overdue as number));
}

function buildCustomerOutstandingRows(invoices: DBInvoice[]): FlatRow[] {
  const map = new Map<string, { custId: string; name: string; outstanding: number; count: number; oldest: string }>();
  for (const inv of invoices) {
    const cust = inv.customer as { id: string; name: string } | null;
    const cid = cust?.id ?? "_unknown";
    const owed = Math.max(0, inv.total_amount - inv.amount_paid);
    if (owed <= 0) continue;
    const ex = map.get(cid) ?? { custId: cid, name: cust?.name ?? "Unknown", outstanding: 0, count: 0, oldest: inv.invoice_date };
    map.set(cid, { ...ex, outstanding: ex.outstanding + owed, count: ex.count + 1, oldest: inv.invoice_date < ex.oldest ? inv.invoice_date : ex.oldest });
  }
  return Array.from(map.values())
    .sort((a, b) => b.outstanding - a.outstanding)
    .map((c, i) => ({
      _rank: i + 1, _href: c.custId !== "_unknown" ? `/customers/${c.custId}` : null,
      name: c.name, outstanding: c.outstanding, count: c.count,
      oldest_date: c.oldest, days: daysSince(c.oldest),
    }));
}

function buildVendorOutstandingRows(pos: DBReceivedPO[], payments: DBVendorPayment[]): FlatRow[] {
  const vendorMap = new Map<string, { name: string; total: number; count: number; oldest: string }>();
  for (const po of pos) {
    const vend = po.vendor as { id: string; name: string } | null;
    const vid = vend?.id ?? po.vendor_id;
    if (!vid) continue;
    const ex = vendorMap.get(vid) ?? { name: vend?.name ?? "Unknown", total: 0, count: 0, oldest: po.po_date };
    vendorMap.set(vid, { ...ex, total: ex.total + po.total_amount, count: ex.count + 1, oldest: po.po_date < ex.oldest ? po.po_date : ex.oldest });
  }
  const paidMap = new Map<string, { amount: number; lastDate: string }>();
  for (const vp of payments) {
    if (!vp.vendor_id) continue;
    const ex = paidMap.get(vp.vendor_id) ?? { amount: 0, lastDate: "" };
    paidMap.set(vp.vendor_id, { amount: ex.amount + vp.amount, lastDate: vp.payment_date > ex.lastDate ? vp.payment_date : ex.lastDate });
  }
  return Array.from(vendorMap.entries())
    .map(([vid, data]) => {
      const paid = paidMap.get(vid);
      const outstanding = Math.max(0, data.total - (paid?.amount ?? 0));
      return { vid, name: data.name, outstanding, po_count: data.count, last_pay_date: paid?.lastDate ?? null, days: daysSince(data.oldest) };
    })
    .filter(v => v.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .map((v, i) => ({
      _rank: i + 1, _href: `/vendors/${v.vid}`,
      name: v.name, outstanding: v.outstanding, po_count: v.po_count,
      last_pay_date: v.last_pay_date, days: v.days,
    }));
}

function buildInventoryRows(
  products: DBProduct[],
  stockMap: Map<string, number>,
  recentlyMovedIds: Set<string>,
  view: string,
): FlatRow[] {
  const rows = products.map(p => {
    const qty = stockMap.get(p.id) ?? 0;
    const cost = p.cost_price ?? p.selling_price;
    const sale = p.selling_price;
    const costVal = qty * cost; const saleVal = qty * sale;
    const margin = saleVal > 0 ? ((saleVal - costVal) / saleVal) * 100 : 0;
    return { id: p.id, sku: p.sku, name: p.name, qty, reorder_point: p.reorder_point, cost_price: cost, selling_price: sale, cost_value: costVal, sale_value: saleVal, margin_pct: margin, recently_moved: recentlyMovedIds.has(p.id) ? 1 : 0 };
  });

  if (view === "inventory-cost")
    return rows.filter(r => r.qty > 0).sort((a, b) => (b.cost_value as number) - (a.cost_value as number));
  if (view === "inventory-sale")
    return rows.filter(r => r.qty > 0).sort((a, b) => (b.sale_value as number) - (a.sale_value as number));
  if (view === "inventory-margin")
    return rows.filter(r => r.qty > 0).sort((a, b) => (b.margin_pct as number) - (a.margin_pct as number));
  if (view === "low-stock")
    return rows.filter(r => (r.qty as number) > 0 && (r.qty as number) <= (r.reorder_point as number)).sort((a, b) => (a.qty as number) - (b.qty as number));
  if (view === "out-of-stock")
    return rows.filter(r => (r.qty as number) === 0).sort((a, b) => (a.name as string).localeCompare(b.name as string));
  if (view === "dead-stock")
    return rows.filter(r => (r.qty as number) > 0 && !r.recently_moved).sort((a, b) => (b.qty as number) * (b.cost_price as number) - (a.qty as number) * (a.cost_price as number));
  if (view === "reorder-required")
    return rows.filter(r => (r.qty as number) <= (r.reorder_point as number)).sort((a, b) => (a.qty as number) - (b.qty as number));
  return rows;
}

function buildAllProductRows(products: DBProduct[], stockMap: Map<string, number>): FlatRow[] {
  return products
    .map(p => {
      const qty  = stockMap.get(p.id) ?? 0;
      const cost = p.cost_price ?? p.selling_price;
      const sale = p.selling_price;
      const stockStatus = qty === 0 ? "Out of Stock" : qty <= p.reorder_point ? "Low Stock" : "In Stock";
      return {
        _id: p.id,
        sku: p.sku, name: p.name, qty,
        reorder_point: p.reorder_point,
        cost_price: cost, selling_price: sale,
        cost_value: qty * cost, sale_value: qty * sale,
        stock_status: stockStatus,
      };
    })
    .sort((a, b) => (a.name as string).localeCompare(b.name as string));
}

function buildStockMovementRows(movements: DBStockMovement[]): FlatRow[] {
  return movements.map(m => {
    const prod = m.product as { id: string; name: string; sku: string } | null;
    const totalValue = m.quantity * (m.unit_price ?? 0);
    return {
      _id: m.id,
      time: m.created_at,
      movement_type: m.movement_type.replace(/_/g, " "),
      sku: prod?.sku ?? "—",
      product_name: prod?.name ?? "—",
      quantity: m.quantity,
      unit_price: m.unit_price ?? 0,
      total_value: totalValue,
      reference: m.reference_no ?? "—",
    };
  });
}

function buildCashFlowRows(invPayments: DBInvoicePayment[], vendPayments: DBVendorPaymentFull[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const p of invPayments) {
    const inv  = p.invoice as { id: string; invoice_number: string; customer: { id: string; name: string } | null } | null;
    const cust = (inv?.customer as { id: string; name: string } | null);
    rows.push({
      _id: `inv-${p.id}`, _href: inv ? `/invoices/${inv.id}` : null,
      date: p.payment_date, flow_type: "Receipt",
      reference: inv?.invoice_number ?? "—",
      party: cust?.name ?? "—",
      amount: p.amount, direction: "in",
    });
  }
  for (const p of vendPayments) {
    const vend = p.vendor as { id: string; name: string } | null;
    rows.push({
      _id: `vend-${p.id}`, _href: null,
      date: p.payment_date, flow_type: "Payment",
      reference: p.payment_number ?? "—",
      party: vend?.name ?? "—",
      amount: p.amount, direction: "out",
    });
  }
  return rows.sort((a, b) => (b.date as string).localeCompare(a.date as string));
}

function buildTopProductRows(movements: DBStockMovement[]): FlatRow[] {
  const map = new Map<string, { name: string; sku: string; qty: number; revenue: number }>();
  for (const m of movements) {
    const prod = m.product as { id: string; name: string; sku: string } | null;
    if (!prod) continue;
    const ex = map.get(prod.id) ?? { name: prod.name, sku: prod.sku, qty: 0, revenue: 0 };
    ex.qty     += m.quantity;
    ex.revenue += m.quantity * (m.unit_price ?? 0);
    map.set(prod.id, ex);
  }
  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .map((p, i) => ({
      _rank: i + 1,
      sku: p.sku, name: p.name,
      qty_sold: p.qty,
      avg_price: p.qty > 0 ? p.revenue / p.qty : 0,
      revenue: p.revenue,
    }));
}

// ── Column definitions ─────────────────────────────────────────────────────────

function getColumns(view: string): ColDef[] {
  const statusBadge = (s: string) => {
    const map: Record<string, string> = { paid: "bg-green-100 text-green-700", partial: "bg-yellow-100 text-yellow-700", sent: "bg-blue-100 text-blue-700", overdue: "bg-red-100 text-red-700", received: "bg-emerald-100 text-emerald-700", draft: "bg-slate-100 text-slate-600", cancelled: "bg-red-50 text-red-400" };
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${map[s] ?? "bg-slate-100 text-slate-600"}`}>{s}</span>;
  };
  const daysBadge = (days: number) => (
    <Badge variant="outline" className={`text-[11px] ${days > 60 ? "text-red-600 border-red-300 bg-red-50" : days > 30 ? "text-orange-600 border-orange-300 bg-orange-50" : "text-slate-600 border-slate-300"}`}>{days}d</Badge>
  );

  if (view === "sales") return [
    { key: "invoice_number", label: "Invoice #", sortable: true, render: r => <span className="font-mono text-xs font-semibold text-primary">{r.invoice_number}</span>, exportValue: r => String(r.invoice_number) },
    { key: "customer_name", label: "Customer", sortable: true, render: r => <span className="font-medium">{r.customer_name}</span> },
    { key: "invoice_date", label: "Date", sortable: true, render: r => <span className="text-muted-foreground text-xs">{fmtDate(String(r.invoice_date))}</span> },
    { key: "due_date", label: "Due Date", sortable: true, render: r => <span className="text-muted-foreground text-xs">{fmtDate(String(r.due_date))}</span> },
    { key: "total_amount", label: "Amount", sortable: true, align: "right", render: r => <span className="tabular-nums font-semibold text-blue-700">{fmtINR(r.total_amount as number)}</span>, exportValue: r => String(r.total_amount) },
    { key: "amount_paid", label: "Amt. Received", sortable: true, align: "right", render: r => <span className="tabular-nums text-green-600">{fmtINR(r.amount_paid as number)}</span>, exportValue: r => String(r.amount_paid) },
    { key: "balance", label: "Outstanding", sortable: true, align: "right", render: r => <span className="tabular-nums font-semibold text-rose-600">{fmtINR(r.balance as number)}</span>, exportValue: r => String(r.balance) },
    { key: "status", label: "Status", sortable: true, render: r => statusBadge(String(r.status)) },
  ];

  if (view === "purchases") return [
    { key: "po_number", label: "PO #", sortable: true, render: r => <span className="font-mono text-xs font-semibold text-primary">{r.po_number}</span> },
    { key: "vendor_name", label: "Vendor", sortable: true, render: r => <span className="font-medium">{r.vendor_name}</span> },
    { key: "po_date", label: "Date", sortable: true, render: r => <span className="text-muted-foreground text-xs">{fmtDate(String(r.po_date))}</span> },
    { key: "total_amount", label: "Amount", sortable: true, align: "right", render: r => <span className="tabular-nums font-semibold text-orange-600">{fmtINR(r.total_amount as number)}</span>, exportValue: r => String(r.total_amount) },
    { key: "status", label: "Status", sortable: true, render: r => statusBadge(String(r.status)) },
  ];

  if (view === "overdue-invoices") return [
    { key: "invoice_number", label: "Invoice #", sortable: true, render: r => <span className="font-mono text-xs font-semibold text-primary">{r.invoice_number}</span> },
    { key: "customer_name", label: "Customer", sortable: true, render: r => <span className="font-medium">{r.customer_name}</span> },
    { key: "total_amount", label: "Amount", sortable: true, align: "right", render: r => <span className="tabular-nums">{fmtINR(r.total_amount as number)}</span> },
    { key: "amount_paid", label: "Amt. Received", sortable: true, align: "right", render: r => <span className="tabular-nums text-green-600">{fmtINR(r.amount_paid as number)}</span> },
    { key: "outstanding", label: "Outstanding", sortable: true, align: "right", render: r => <span className="tabular-nums font-semibold text-red-600">{fmtINR(r.outstanding as number)}</span>, exportValue: r => String(r.outstanding) },
    { key: "due_date", label: "Due Date", sortable: true, render: r => <span className="text-muted-foreground text-xs">{fmtDate(String(r.due_date))}</span> },
    { key: "days_overdue", label: "Overdue", sortable: true, render: r => daysBadge(r.days_overdue as number), exportValue: r => `${r.days_overdue}d` },
  ];

  if (view === "customer-outstanding") return [
    { key: "_rank", label: "#", render: r => <span className="text-muted-foreground text-xs">{r._rank}</span> },
    { key: "name", label: "Customer", sortable: true, render: r => <span className="font-medium">{r.name}</span> },
    { key: "outstanding", label: "Outstanding", sortable: true, align: "right", render: r => <span className="tabular-nums font-semibold text-rose-600">{fmtINR(r.outstanding as number)}</span>, exportValue: r => String(r.outstanding) },
    { key: "count", label: "Invoices", sortable: true, align: "right", render: r => <span className="text-muted-foreground">{r.count}</span> },
    { key: "oldest_date", label: "Oldest Invoice", sortable: true, render: r => <span className="text-muted-foreground text-xs">{fmtDate(String(r.oldest_date))}</span> },
    { key: "days", label: "Days Pending", sortable: true, render: r => daysBadge(r.days as number), exportValue: r => `${r.days}d` },
  ];

  if (view === "vendor-outstanding") return [
    { key: "_rank", label: "#", render: r => <span className="text-muted-foreground text-xs">{r._rank}</span> },
    { key: "name", label: "Vendor", sortable: true, render: r => <span className="font-medium">{r.name}</span> },
    { key: "outstanding", label: "Outstanding", sortable: true, align: "right", render: r => <span className="tabular-nums font-semibold text-orange-600">{fmtINR(r.outstanding as number)}</span>, exportValue: r => String(r.outstanding) },
    { key: "po_count", label: "POs", sortable: true, align: "right", render: r => <span className="text-muted-foreground">{r.po_count}</span> },
    { key: "last_pay_date", label: "Last Payment", sortable: true, render: r => <span className="text-muted-foreground text-xs">{fmtDate(String(r.last_pay_date))}</span> },
    { key: "days", label: "Days", sortable: true, render: r => daysBadge(r.days as number), exportValue: r => `${r.days}d` },
  ];

  if (view === "inventory-cost" || view === "inventory-sale" || view === "inventory-margin") return [
    { key: "sku", label: "SKU", sortable: true, render: r => <span className="font-mono text-xs text-muted-foreground">{r.sku}</span> },
    { key: "name", label: "Product", sortable: true, render: r => <span className="font-medium">{r.name}</span> },
    { key: "qty", label: "Qty", sortable: true, align: "right", render: r => <span className="tabular-nums">{(r.qty as number).toLocaleString("en-IN")}</span> },
    { key: "cost_price", label: "Cost/Unit", sortable: true, align: "right", render: r => <span className="tabular-nums text-muted-foreground">{fmtINR(r.cost_price as number)}</span> },
    { key: "selling_price", label: "Sale/Unit", sortable: true, align: "right", render: r => <span className="tabular-nums text-muted-foreground">{fmtINR(r.selling_price as number)}</span> },
    { key: "cost_value", label: "Cost Value", sortable: true, align: "right", render: r => <span className="tabular-nums font-semibold text-orange-600">{fmtINR(r.cost_value as number)}</span>, exportValue: r => String(r.cost_value) },
    { key: "sale_value", label: "Sale Value", sortable: true, align: "right", render: r => <span className="tabular-nums font-semibold text-green-700">{fmtINR(r.sale_value as number)}</span>, exportValue: r => String(r.sale_value) },
    { key: "margin_pct", label: "Margin %", sortable: true, align: "right", render: r => {
      const raw = r.margin_pct;
      if (raw === "—" || raw == null) return <span className="text-muted-foreground">—</span>;
      const m = parseFloat(raw as string);
      return <span className={`tabular-nums font-semibold ${m >= 20 ? "text-green-700" : m >= 10 ? "text-yellow-600" : "text-red-600"}`}>{fmtPct(m)}</span>;
    }, exportValue: r => (r.margin_pct === "—" || r.margin_pct == null) ? "—" : fmtPct(parseFloat(r.margin_pct as string)) },
  ];

  if (view === "all-products") return [
    { key: "sku", label: "SKU", sortable: true, render: r => <span className="font-mono text-xs text-muted-foreground">{r.sku}</span> },
    { key: "name", label: "Product", sortable: true, render: r => <span className="font-medium">{r.name}</span> },
    { key: "qty", label: "Stock Qty", sortable: true, align: "right", render: r => {
      const q = r.qty as number;
      const rp = r.reorder_point as number;
      return <span className={`tabular-nums font-semibold ${q === 0 ? "text-red-600" : q <= rp ? "text-orange-600" : ""}`}>{q}</span>;
    }},
    { key: "reorder_point", label: "Reorder Pt", sortable: true, align: "right", render: r => <span className="tabular-nums text-muted-foreground">{r.reorder_point}</span> },
    { key: "cost_price", label: "Cost/Unit", sortable: true, align: "right", render: r => <span className="tabular-nums text-muted-foreground">{fmtINR(r.cost_price as number)}</span> },
    { key: "selling_price", label: "Sale/Unit", sortable: true, align: "right", render: r => <span className="tabular-nums text-muted-foreground">{fmtINR(r.selling_price as number)}</span> },
    { key: "cost_value", label: "Cost Value", sortable: true, align: "right", render: r => <span className="tabular-nums text-orange-600">{fmtINR(r.cost_value as number)}</span>, exportValue: r => String(r.cost_value) },
    { key: "sale_value", label: "Sale Value", sortable: true, align: "right", render: r => <span className="tabular-nums text-green-700">{fmtINR(r.sale_value as number)}</span>, exportValue: r => String(r.sale_value) },
    { key: "stock_status", label: "Status", sortable: true, render: r => {
      const s = r.stock_status as string;
      return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${s === "Out of Stock" ? "bg-red-50 text-red-600" : s === "Low Stock" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"}`}>{s}</span>;
    }},
  ];

  if (view === "cash-flow") return [
    { key: "date", label: "Date", sortable: true, render: r => <span className="text-xs text-muted-foreground">{fmtDate(String(r.date))}</span> },
    { key: "flow_type", label: "Type", sortable: true, render: r => (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${r.direction === "in" ? "text-green-700" : "text-red-600"}`}>
        {r.direction === "in"
          ? <ArrowDownCircle className="h-3.5 w-3.5" />
          : <ArrowUpCircle className="h-3.5 w-3.5" />}
        {String(r.flow_type)}
      </span>
    )},
    { key: "reference", label: "Reference", sortable: true, render: r => <span className="font-mono text-xs font-semibold text-primary">{r.reference}</span> },
    { key: "party", label: "Party", sortable: true, render: r => <span className="font-medium">{r.party}</span> },
    { key: "amount", label: "Amount", sortable: true, align: "right", render: r => (
      <span className={`tabular-nums font-semibold ${r.direction === "in" ? "text-green-700" : "text-red-600"}`}>
        {r.direction === "in" ? "+" : "−"}{fmtINR(r.amount as number)}
      </span>
    ), exportValue: r => `${r.direction === "in" ? "+" : "-"}${r.amount}` },
  ];

  if (["today-stock-in","today-stock-out","monthly-stock-in","monthly-stock-out"].includes(view)) return [
    { key: "time", label: "Date & Time", sortable: true, render: r => <span className="text-xs text-muted-foreground">{fmtDateTime(String(r.time))}</span> },
    { key: "sku", label: "SKU", sortable: true, render: r => <span className="font-mono text-xs text-muted-foreground">{r.sku}</span> },
    { key: "product_name", label: "Product", sortable: true, render: r => <span className="font-medium">{r.product_name}</span> },
    { key: "movement_type", label: "Movement", sortable: true, render: r => {
      const t = String(r.movement_type);
      const isIn = IN_TYPES.includes(t.replace(/ /g, "_"));
      return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${isIn ? "bg-green-50 text-green-700" : "bg-rose-50 text-rose-700"}`}>{t}</span>;
    }},
    { key: "quantity", label: "Quantity", sortable: true, align: "right", render: r => <span className="tabular-nums font-semibold">{(r.quantity as number).toLocaleString("en-IN")}</span> },
    { key: "unit_price", label: "Unit Price", sortable: true, align: "right", render: r => <span className="tabular-nums text-muted-foreground">{(r.unit_price as number) > 0 ? fmtINR(r.unit_price as number) : "—"}</span> },
    { key: "total_value", label: "Total Value", sortable: true, align: "right", render: r => <span className="tabular-nums font-semibold">{(r.total_value as number) > 0 ? fmtINR(r.total_value as number) : "—"}</span>, exportValue: r => String(r.total_value) },
    { key: "reference", label: "Reference", sortable: true, render: r => <span className="text-xs text-muted-foreground">{r.reference}</span> },
  ];

  if (view === "top-products") return [
    { key: "_rank", label: "#", render: r => <span className="text-muted-foreground text-xs">{r._rank}</span> },
    { key: "sku", label: "SKU", sortable: true, render: r => <span className="font-mono text-xs text-muted-foreground">{r.sku}</span> },
    { key: "name", label: "Product", sortable: true, render: r => <span className="font-medium">{r.name}</span> },
    { key: "qty_sold", label: "Qty Sold", sortable: true, align: "right", render: r => <span className="tabular-nums font-semibold">{(r.qty_sold as number).toLocaleString("en-IN")}</span> },
    { key: "avg_price", label: "Avg Price", sortable: true, align: "right", render: r => <span className="tabular-nums text-muted-foreground">{fmtINR(r.avg_price as number)}</span> },
    { key: "revenue", label: "Revenue", sortable: true, align: "right", render: r => <span className="tabular-nums font-semibold text-green-700">{fmtINR(r.revenue as number)}</span>, exportValue: r => String(r.revenue) },
  ];

  // stock alert views (low-stock, out-of-stock, dead-stock, reorder-required)
  return [
    { key: "sku", label: "SKU", sortable: true, render: r => <span className="font-mono text-xs text-muted-foreground">{r.sku}</span> },
    { key: "name", label: "Product", sortable: true, render: r => <span className="font-medium">{r.name}</span> },
    { key: "qty", label: "Stock Qty", sortable: true, align: "right", render: r => {
      const q = r.qty as number;
      return <span className={`tabular-nums font-semibold ${q === 0 ? "text-red-600" : q <= (r.reorder_point as number) ? "text-orange-600" : "text-foreground"}`}>{q}</span>;
    }},
    { key: "reorder_point", label: "Reorder Point", sortable: true, align: "right", render: r => <span className="tabular-nums text-muted-foreground">{r.reorder_point}</span> },
    { key: "cost_price", label: "Cost/Unit", sortable: true, align: "right", render: r => <span className="tabular-nums text-muted-foreground">{fmtINR(r.cost_price as number)}</span> },
    { key: "selling_price", label: "Sale/Unit", sortable: true, align: "right", render: r => <span className="tabular-nums text-muted-foreground">{fmtINR(r.selling_price as number)}</span> },
  ];
}

// ── View config ────────────────────────────────────────────────────────────────

const VIEW_META: Record<string, { title: string; defaultSort: string; defaultDir: SortDir }> = {
  "sales":                { title: "Sales Report",               defaultSort: "invoice_date", defaultDir: "desc" },
  "purchases":            { title: "Purchases Report",           defaultSort: "po_date",      defaultDir: "desc" },
  "profit":               { title: "Profit Analysis",            defaultSort: "invoice_date", defaultDir: "desc" },
  "overdue-invoices":     { title: "Overdue Invoices",           defaultSort: "days_overdue", defaultDir: "desc" },
  "customer-outstanding": { title: "Outstanding Customers",      defaultSort: "outstanding",  defaultDir: "desc" },
  "vendor-outstanding":   { title: "Outstanding Vendors",        defaultSort: "outstanding",  defaultDir: "desc" },
  "inventory-cost":       { title: "Inventory — Cost Valuation", defaultSort: "cost_value",   defaultDir: "desc" },
  "inventory-sale":       { title: "Inventory — Sale Valuation", defaultSort: "sale_value",   defaultDir: "desc" },
  "inventory-margin":     { title: "Inventory — Margin Analysis",defaultSort: "margin_pct",   defaultDir: "desc" },
  "low-stock":            { title: "Low Stock Products",         defaultSort: "qty",          defaultDir: "asc"  },
  "out-of-stock":         { title: "Out of Stock Products",      defaultSort: "name",         defaultDir: "asc"  },
  "dead-stock":           { title: "Dead Stock Products",        defaultSort: "cost_value",   defaultDir: "desc" },
  "reorder-required":     { title: "Reorder Required",           defaultSort: "qty",          defaultDir: "asc"  },
  "cash-flow":            { title: "Cash Flow",                  defaultSort: "date",         defaultDir: "desc" },
  "today-stock-in":       { title: "Today's Stock In",           defaultSort: "time",         defaultDir: "desc" },
  "today-stock-out":      { title: "Today's Stock Out",          defaultSort: "time",         defaultDir: "desc" },
  "monthly-stock-in":     { title: "Monthly Stock In",           defaultSort: "time",         defaultDir: "desc" },
  "monthly-stock-out":    { title: "Monthly Stock Out",          defaultSort: "time",         defaultDir: "desc" },
  "all-products":         { title: "All Products",               defaultSort: "name",         defaultDir: "asc"  },
  "top-products":         { title: "Top Selling Products",       defaultSort: "revenue",      defaultDir: "desc" },
};

// ── Sort helper ────────────────────────────────────────────────────────────────

function sortRows(rows: FlatRow[], col: string, dir: SortDir): FlatRow[] {
  return [...rows].sort((a, b) => {
    const av = a[col], bv = b[col];
    const an = typeof av === "number" ? av : typeof av === "string" ? av.toLowerCase() : 0;
    const bn = typeof bv === "number" ? bv : typeof bv === "string" ? bv.toLowerCase() : 0;
    if (an < bn) return dir === "asc" ? -1 : 1;
    if (an > bn) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

// ── Export helpers ─────────────────────────────────────────────────────────────

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(columns: ColDef[], rows: FlatRow[], title: string) {
  const headers = columns.map(c => `"${c.label}"`).join(",");
  const dataRows = rows.map(row =>
    columns.map(c => {
      const val = c.exportValue ? c.exportValue(row) : String(row[c.key] ?? "");
      return `"${val.replace(/"/g, '""')}"`;
    }).join(",")
  );
  downloadFile([headers, ...dataRows].join("\n"), `${title}.csv`, "text/csv;charset=utf-8");
}

function exportExcel(columns: ColDef[], rows: FlatRow[], title: string) {
  const headers = columns.map(c => c.label).join("\t");
  const dataRows = rows.map(row =>
    columns.map(c => c.exportValue ? c.exportValue(row) : String(row[c.key] ?? "")).join("\t")
  );
  downloadFile([headers, ...dataRows].join("\n"), `${title}.xls`, "application/vnd.ms-excel;charset=utf-8");
}

// ── Sort icon ──────────────────────────────────────────────────────────────────

function SortIcon({ col, active, dir }: { col: string; active: string; dir: SortDir }) {
  if (col !== active) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
  return dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

// ── Summary card ───────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export default function DashboardDetailPage() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  const view  = (params.view as string) ?? "";
  const meta  = VIEW_META[view] ?? { title: view, defaultSort: "", defaultDir: "desc" as SortDir };

  // URL params
  const urlStart = searchParams.get("start");
  const urlEnd   = searchParams.get("end");
  const urlTitle = searchParams.get("title");
  const pageTitle = urlTitle ? decodeURIComponent(urlTitle) : meta.title;

  const { start, end } = useMemo(() => {
    if (urlStart && urlEnd) return { start: urlStart, end: urlEnd };
    const now = new Date();
    return { start: `${now.getFullYear()}-01-01`, end: now.toISOString().split("T")[0] };
  }, [urlStart, urlEnd]);

  const dateRangeLabel = useMemo(() => {
    if (!urlStart && !urlEnd) return "";
    const s = new Date(start + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const e = new Date(end   + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    return s === e ? s : `${s} — ${e}`;
  }, [start, end, urlStart, urlEnd]);

  // Local state
  const [search,  setSearch]  = useState("");
  const [sortCol, setSortCol] = useState(meta.defaultSort);
  const [sortDir, setSortDir] = useState<SortDir>(meta.defaultDir);
  const [page,    setPage]    = useState(0);

  // Profit view sub-tab
  const [profitTab, setProfitTab] = useState<"invoices" | "purchases">("invoices");

  // ── Fetch flags ───────────────────────────────────────────────────────────
  const needInvoiceRange = view === "sales" || view === "profit";
  const needPORange      = view === "purchases" || view === "profit";
  const needOutstanding  = view === "customer-outstanding" || view === "overdue-invoices";
  const needVendorOuts   = view === "vendor-outstanding";
  const needInventory    = ["inventory-cost","inventory-sale","inventory-margin","low-stock","out-of-stock","dead-stock","reorder-required","all-products"].includes(view);
  const needCashFlow     = view === "cash-flow";

  const STOCK_MOV_VIEWS  = ["today-stock-in","today-stock-out","monthly-stock-in","monthly-stock-out","top-products"];
  const needStockMov     = STOCK_MOV_VIEWS.includes(view);
  const stockMovTypes: string[] = view === "today-stock-in"  || view === "monthly-stock-in"  ? IN_TYPES
                                : view === "today-stock-out" || view === "monthly-stock-out" ? OUT_TYPES
                                : view === "top-products"                                    ? ["sale"]
                                : [];

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: invoices    = [], isLoading: invLoading    } = useQuery({ queryKey: ["dd-inv",     start, end], queryFn: () => fetchInvoicesRange(start, end),              enabled: needInvoiceRange, staleTime: 60_000 });
  const { data: pos         = [], isLoading: poLoading     } = useQuery({ queryKey: ["dd-po",      start, end], queryFn: () => fetchPOsRange(start, end),                   enabled: needPORange,     staleTime: 60_000 });
  const { data: outstanding = [], isLoading: outLoading    } = useQuery({ queryKey: ["dd-out"],                  queryFn: fetchOutstandingInvoices,                          enabled: needOutstanding, staleTime: 60_000 });
  const { data: vendorOuts,       isLoading: vendOutLoad   } = useQuery({ queryKey: ["dd-vout"],                 queryFn: fetchVendorOutstandingData,                        enabled: needVendorOuts,  staleTime: 60_000 });
  const { data: inventoryData,    isLoading: invDataLoad   } = useQuery({ queryKey: ["dd-inv-data"],             queryFn: fetchInventoryDetail,                              enabled: needInventory,   staleTime: 60_000 });
  const { data: cashFlowData,     isLoading: cashFlowLoad  } = useQuery({ queryKey: ["dd-cashflow", start, end], queryFn: () => fetchCashFlow(start, end),                  enabled: needCashFlow,    staleTime: 60_000 });
  const { data: stockMovements = [], isLoading: stockMovLoad } = useQuery({ queryKey: ["dd-smov", start, end, view], queryFn: () => fetchStockMovements(start, end, stockMovTypes), enabled: needStockMov && stockMovTypes.length > 0, staleTime: 60_000 });

  const loading = invLoading || poLoading || outLoading || vendOutLoad || invDataLoad || cashFlowLoad || stockMovLoad;

  // ── Build rows ────────────────────────────────────────────────────────────
  const allRows = useMemo(() => {
    if (view === "sales")                return buildSalesRows(invoices);
    if (view === "purchases")            return buildPurchasesRows(pos);
    if (view === "overdue-invoices")     return buildOverdueRows(outstanding);
    if (view === "customer-outstanding") return buildCustomerOutstandingRows(outstanding);
    if (view === "vendor-outstanding")   return buildVendorOutstandingRows(vendorOuts?.pos ?? [], vendorOuts?.payments ?? []);
    if (view === "cash-flow")            return cashFlowData ? buildCashFlowRows(cashFlowData.invPayments, cashFlowData.vendPayments) : [];
    if (view === "top-products")         return buildTopProductRows(stockMovements);
    if (["today-stock-in","today-stock-out","monthly-stock-in","monthly-stock-out"].includes(view)) return buildStockMovementRows(stockMovements);
    if (view === "all-products" && inventoryData) return buildAllProductRows(inventoryData.products, inventoryData.stockMap);
    if (view === "profit") return profitTab === "invoices" ? buildSalesRows(invoices) : buildPurchasesRows(pos);
    if (needInventory && inventoryData) return buildInventoryRows(inventoryData.products, inventoryData.stockMap, inventoryData.recentlyMovedIds, view);
    return [];
  }, [view, invoices, pos, outstanding, vendorOuts, inventoryData, cashFlowData, stockMovements, profitTab, needInventory]);

  const columns = useMemo(() => getColumns(view === "profit" ? (profitTab === "invoices" ? "sales" : "purchases") : view), [view, profitTab]);

  // ── Search ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.toLowerCase();
    return allRows.filter(row =>
      Object.values(row).some(v => v != null && String(v).toLowerCase().includes(q))
    );
  }, [allRows, search]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => sortRows(filtered, sortCol, sortDir), [filtered, sortCol, sortDir]);

  // ── Paginate ──────────────────────────────────────────────────────────────
  const pageCount = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows  = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSort(col: string) {
    if (sortCol === col) { setSortDir(d => d === "asc" ? "desc" : "asc"); }
    else { setSortCol(col); setSortDir("desc"); }
    setPage(0);
  }

  function handleSearch(v: string) { setSearch(v); setPage(0); }

  // ── Profit summary ────────────────────────────────────────────────────────
  const profitSummary = useMemo(() => {
    if (view !== "profit") return null;
    const sales  = invoices.reduce((s, i) => s + i.total_amount, 0);
    const purch  = pos.reduce((s, p) => s + p.total_amount, 0);
    const profit = sales - purch;
    const margin = sales > 0 ? (profit / sales) * 100 : 0;
    return { sales, purch, profit, margin };
  }, [view, invoices, pos]);

  // ── Cash flow summary ─────────────────────────────────────────────────────
  const cashFlowSummary = useMemo(() => {
    if (view !== "cash-flow" || !cashFlowData) return null;
    const totalIn  = cashFlowData.invPayments.reduce((s, p) => s + p.amount, 0);
    const totalOut = cashFlowData.vendPayments.reduce((s, p) => s + p.amount, 0);
    return { totalIn, totalOut, net: totalIn - totalOut, invCount: cashFlowData.invPayments.length, vendCount: cashFlowData.vendPayments.length };
  }, [view, cashFlowData]);

  // ── Stock movement summary ────────────────────────────────────────────────
  const stockMovSummary = useMemo(() => {
    if (!["today-stock-in","today-stock-out","monthly-stock-in","monthly-stock-out"].includes(view)) return null;
    const totalQty = stockMovements.reduce((s, m) => s + m.quantity, 0);
    const totalVal = stockMovements.reduce((s, m) => s + m.quantity * (m.unit_price ?? 0), 0);
    return { totalQty, totalVal };
  }, [view, stockMovements]);

  // ── Top products summary ──────────────────────────────────────────────────
  const topProductsSummary = useMemo(() => {
    if (view !== "top-products") return null;
    const totalQty = stockMovements.reduce((s, m) => s + m.quantity, 0);
    const totalRev = stockMovements.reduce((s, m) => s + m.quantity * (m.unit_price ?? 0), 0);
    return { totalQty, totalRev, uniqueProducts: allRows.length };
  }, [view, stockMovements, allRows]);

  // ── Row click ─────────────────────────────────────────────────────────────
  function handleRowClick(row: FlatRow) {
    const href = row._href;
    if (href && typeof href === "string") router.push(href);
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function handleCSV()   { exportCSV(columns, sorted, pageTitle); }
  function handleExcel() { exportExcel(columns, sorted, pageTitle); }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Access restricted to admin / manager role.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Top navigation bar ──────────────────────────────────────────── */}
      <div className="border-b bg-card px-4 py-3 flex items-center gap-2 shrink-0 flex-wrap">
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
          onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
          onClick={() => window.history.forward()}>
          Forward <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
          onClick={() => router.push("/dashboard")}>
          <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">{pageTitle}</h1>
          {dateRangeLabel && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{dateRangeLabel}</p>
          )}
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs shrink-0"
          onClick={handleCSV}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs shrink-0"
          onClick={handleExcel}>
          <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
        </Button>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Profit summary cards */}
        {view === "profit" && profitSummary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Total Sales"     value={fmtShort(profitSummary.sales)}  sub={`${invoices.length} invoices`} color="text-blue-700" />
            <SummaryCard label="Total Purchases" value={fmtShort(profitSummary.purch)}  sub={`${pos.length} POs`}          color="text-orange-600" />
            <SummaryCard label="Net Profit"      value={fmtShort(profitSummary.profit)} color={profitSummary.profit >= 0 ? "text-green-700" : "text-red-600"} />
            <SummaryCard label="Margin"          value={fmtPct(profitSummary.margin)}   color={profitSummary.margin >= 0 ? "text-emerald-600" : "text-red-600"} />
          </div>
        )}

        {/* Cash flow summary cards */}
        {view === "cash-flow" && cashFlowSummary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Total Received"  value={fmtShort(cashFlowSummary.totalIn)}  sub={`${cashFlowSummary.invCount} payments from customers`} color="text-green-700" />
            <SummaryCard label="Total Paid Out"  value={fmtShort(cashFlowSummary.totalOut)} sub={`${cashFlowSummary.vendCount} vendor payments`}        color="text-red-600" />
            <SummaryCard label="Net Cash Flow"   value={fmtShort(cashFlowSummary.net)}      color={cashFlowSummary.net >= 0 ? "text-green-700" : "text-red-600"} />
            <SummaryCard label="Period"          value={dateRangeLabel || "Current Year"}   color="text-muted-foreground" />
          </div>
        )}

        {/* Stock movement summary */}
        {stockMovSummary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryCard label="Total Movements" value={String(stockMovements.length)}             sub="movement entries"   color="text-foreground" />
            <SummaryCard label="Total Quantity"  value={stockMovSummary.totalQty.toLocaleString("en-IN")} sub="units"        color={view.includes("-in") ? "text-green-700" : "text-rose-600"} />
            <SummaryCard label="Total Value"     value={fmtShort(stockMovSummary.totalVal)}        sub={stockMovSummary.totalVal > 0 ? "based on unit prices" : "unit prices not recorded"} color="text-blue-700" />
          </div>
        )}

        {/* Top products summary */}
        {topProductsSummary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryCard label="Products Sold"   value={String(topProductsSummary.uniqueProducts)} sub="distinct products"    color="text-foreground" />
            <SummaryCard label="Total Qty Sold"  value={topProductsSummary.totalQty.toLocaleString("en-IN")} sub="units dispatched" color="text-rose-600" />
            <SummaryCard label="Total Revenue"   value={fmtShort(topProductsSummary.totalRev)}   sub="from sale movements"   color="text-green-700" />
          </div>
        )}

        {/* Profit tab selector */}
        {view === "profit" && (
          <div className="flex gap-1 p-1 rounded-lg border bg-muted/30 w-fit">
            {(["invoices", "purchases"] as const).map(tab => (
              <button key={tab} onClick={() => { setProfitTab(tab); setPage(0); }}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                  profitTab === tab ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
                {tab === "invoices" ? `Invoices (${invoices.length})` : `Purchase Orders (${pos.length})`}
              </button>
            ))}
          </div>
        )}

        {/* Search bar */}
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input className="pl-9 h-9 text-sm" placeholder="Search…" value={search}
              onChange={e => handleSearch(e.target.value)} />
          </div>
          <span className="text-sm text-muted-foreground shrink-0 tabular-nums">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            {search && ` of ${allRows.length}`}
          </span>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : allRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <CheckCircle className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No records found</p>
              {["customer-outstanding","overdue-invoices","low-stock","out-of-stock"].includes(view) && (
                <p className="text-xs text-muted-foreground">Everything looks good!</p>
              )}
              {["today-stock-in","today-stock-out","monthly-stock-in","monthly-stock-out"].includes(view) && (
                <p className="text-xs text-muted-foreground">No movements recorded for this period.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground sticky top-0">
                    {columns.map(col => (
                      <th key={col.key}
                        className={`px-4 py-3 whitespace-nowrap ${col.align === "right" ? "text-right" : "text-left"} ${col.sortable ? "cursor-pointer select-none hover:text-foreground" : ""}`}
                        onClick={() => col.sortable && handleSort(col.key)}>
                        <div className={`flex items-center gap-1 ${col.align === "right" ? "justify-end" : ""}`}>
                          {col.label}
                          {col.sortable && <SortIcon col={col.key} active={sortCol} dir={sortDir} />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        {search
                          ? "No records match your search."
                          : view === "profit"
                            ? `No ${profitTab} found in this date range.`
                            : "No records found for this period."}
                      </td>
                    </tr>
                  ) : pageRows.map((row, i) => (
                    <tr key={String(row._id ?? i)}
                      className={`border-t transition-colors ${row._href ? "cursor-pointer hover:bg-muted/20" : ""}`}
                      onClick={() => handleRowClick(row)}>
                      {columns.map(col => (
                        <td key={col.key} className={`px-4 py-3 ${col.align === "right" ? "text-right" : ""}`}>
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>

                {/* Footer totals */}
                {!search && pageCount <= 1 && (view === "sales" || (view === "profit" && profitTab === "invoices")) && allRows.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/20 font-semibold text-sm">
                      <td colSpan={4} className="px-4 py-3">Total ({allRows.length} invoices)</td>
                      <td className="px-4 py-3 text-right tabular-nums text-blue-700">{fmtINR((allRows).reduce((s, r) => s + ((r.total_amount as number) ?? 0), 0))}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-600">{fmtINR((allRows).reduce((s, r) => s + ((r.amount_paid as number) ?? 0), 0))}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-rose-600">{fmtINR((allRows).reduce((s, r) => s + ((r.balance as number) ?? 0), 0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
                {!search && pageCount <= 1 && (view === "purchases" || (view === "profit" && profitTab === "purchases")) && allRows.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/20 font-semibold text-sm">
                      <td colSpan={3} className="px-4 py-3">Total ({allRows.length} purchase orders)</td>
                      <td className="px-4 py-3 text-right tabular-nums text-orange-600">{fmtINR((allRows).reduce((s, r) => s + (r.total_amount as number), 0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
                {!search && pageCount <= 1 && view === "customer-outstanding" && allRows.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/20 font-semibold text-sm">
                      <td colSpan={2} className="px-4 py-3">Total Outstanding</td>
                      <td className="px-4 py-3 text-right tabular-nums text-rose-600">{fmtINR((allRows).reduce((s, r) => s + (r.outstanding as number), 0))}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
                {!search && pageCount <= 1 && view === "vendor-outstanding" && allRows.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/20 font-semibold text-sm">
                      <td colSpan={2} className="px-4 py-3">Total Outstanding</td>
                      <td className="px-4 py-3 text-right tabular-nums text-orange-600">{fmtINR((allRows).reduce((s, r) => s + (r.outstanding as number), 0))}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
                {!search && pageCount <= 1 && (view === "inventory-cost" || view === "inventory-sale" || view === "inventory-margin") && allRows.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/20 font-semibold text-sm">
                      <td colSpan={5} className="px-4 py-3">Total ({allRows.length} products)</td>
                      <td className="px-4 py-3 text-right tabular-nums text-orange-600">{fmtINR((allRows).reduce((s, r) => s + (r.cost_value as number), 0))}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-700">{fmtINR((allRows).reduce((s, r) => s + (r.sale_value as number), 0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
                {!search && pageCount <= 1 && view === "cash-flow" && cashFlowSummary && allRows.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/20 font-semibold text-sm">
                      <td colSpan={3} className="px-4 py-3">Net Cash Flow</td>
                      <td />
                      <td className={`px-4 py-3 text-right tabular-nums font-bold ${cashFlowSummary.net >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {cashFlowSummary.net >= 0 ? "+" : "−"}{fmtINR(Math.abs(cashFlowSummary.net))}
                      </td>
                    </tr>
                  </tfoot>
                )}
                {!search && pageCount <= 1 && ["today-stock-in","today-stock-out","monthly-stock-in","monthly-stock-out"].includes(view) && stockMovSummary && allRows.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/20 font-semibold text-sm">
                      <td colSpan={4} className="px-4 py-3">Total ({allRows.length} movements)</td>
                      <td className="px-4 py-3 text-right tabular-nums">{stockMovSummary.totalQty.toLocaleString("en-IN")} units</td>
                      <td />
                      <td className="px-4 py-3 text-right tabular-nums text-blue-700">{stockMovSummary.totalVal > 0 ? fmtINR(stockMovSummary.totalVal) : "—"}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
                {!search && pageCount <= 1 && view === "top-products" && topProductsSummary && allRows.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/20 font-semibold text-sm">
                      <td colSpan={3} className="px-4 py-3">Total ({topProductsSummary.uniqueProducts} products)</td>
                      <td className="px-4 py-3 text-right tabular-nums">{topProductsSummary.totalQty.toLocaleString("en-IN")}</td>
                      <td />
                      <td className="px-4 py-3 text-right tabular-nums text-green-700">{fmtINR(topProductsSummary.totalRev)}</td>
                    </tr>
                  </tfoot>
                )}
                {!search && pageCount <= 1 && view === "all-products" && allRows.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/20 font-semibold text-sm">
                      <td colSpan={6} className="px-4 py-3">Total ({allRows.length} products)</td>
                      <td className="px-4 py-3 text-right tabular-nums text-orange-600">{fmtINR((allRows).reduce((s, r) => s + (r.cost_value as number), 0))}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-700">{fmtINR((allRows).reduce((s, r) => s + (r.sale_value as number), 0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {page + 1} of {pageCount} · {sorted.length} records
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => setPage(0)} disabled={page === 0}>«</Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹</Button>
              {Array.from({ length: Math.min(7, pageCount) }, (_, i) => {
                const pg = pageCount <= 7 ? i : Math.max(0, Math.min(page - 3 + i, pageCount - 7 + i));
                return (
                  <Button key={pg} variant={pg === page ? "default" : "outline"} size="sm"
                    className="h-8 w-8 p-0 text-xs" onClick={() => setPage(pg)}>
                    {pg + 1}
                  </Button>
                );
              })}
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page === pageCount - 1}>›</Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => setPage(pageCount - 1)} disabled={page === pageCount - 1}>»</Button>
            </div>
          </div>
        )}

        {/* Contextual action strip */}
        {["low-stock","out-of-stock","dead-stock","reorder-required"].includes(view) && !loading && allRows.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t items-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingDown className="h-3.5 w-3.5 text-orange-500" />
              Total Cost Value:
              <span className="font-semibold text-orange-600">
                {fmtINR(allRows.reduce((s, r) => s + (r.qty as number) * (r.cost_price as number), 0))}
              </span>
            </div>
            {view === "reorder-required" && (
              <Button variant="outline" size="sm" className="h-7 text-xs ml-auto"
                onClick={() => router.push("/purchase-orders/new")}>
                <ShoppingBag className="h-3.5 w-3.5 mr-1.5" /> New Purchase Order
              </Button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
