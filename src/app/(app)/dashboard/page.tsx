"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Line, ComposedChart,
} from "recharts";
import {
  TrendingUp, TrendingDown, Package, Boxes, AlertTriangle, XCircle,
  RefreshCw, PackageOpen, ArrowDownCircle, ArrowUpCircle, IndianRupee,
  ShoppingBag, Banknote, Users, Truck, FileText, PackageCheck,
  Clock, CheckCircle, CreditCard, ClipboardList,
} from "lucide-react";
import { useProfile } from "@/lib/hooks/useProfile";
import { format } from "date-fns";

// ── Movement categories ────────────────────────────────────────────────────────
const IN_TYPES  = ["receipt", "transfer_in", "return", "adjustment"];
const OUT_TYPES = ["sale", "transfer_out", "damage"];

// ── Filter types & labels ──────────────────────────────────────────────────────
type PeriodFilter = "current-month" | "last-month" | "last-3months" | "last-6months" | "last-12months";
type YearFilter   = "current-fy" | "prev-fy" | "custom";

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  "current-month":  "Current Month",
  "last-month":     "Last Month",
  "last-3months":   "Last 3 Months",
  "last-6months":   "Last 6 Months",
  "last-12months":  "Last 12 Months",
};

// ── Formatters & helpers ───────────────────────────────────────────────────────
function fmtINR(n: number) {
  return "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function fmtShort(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000)    return `${sign}₹${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000)      return `${sign}₹${(abs / 1_000).toFixed(0)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}
function fmtPct(n: number)  { return n.toFixed(1) + "%"; }
function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function getDelta(cur: number, prev: number): number | null {
  return prev === 0 ? null : ((cur - prev) / prev) * 100;
}
function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr + "T00:00:00").getTime()) / 86_400_000);
}
function inRange(d: string, s: string, e: string) { return d >= s && d <= e; }
function fmt(d: Date) { return d.toISOString().split("T")[0]; }
function som(y: number, m: number) { return new Date(y, m, 1); }
function eom(y: number, m: number) { return new Date(y, m + 1, 0); }
function datePrefixMonth(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-`;
}

function computeFilterDates(period: PeriodFilter, fy: YearFilter, customYear: string) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();

  let pStart: Date, pEnd: Date, ppStart: Date, ppEnd: Date;
  switch (period) {
    case "current-month":
      pStart = som(y, m);       pEnd   = now;
      ppStart = som(y, m - 1);  ppEnd  = eom(y, m - 1);
      break;
    case "last-month":
      pStart = som(y, m - 1);   pEnd   = eom(y, m - 1);
      ppStart = som(y, m - 2);  ppEnd  = eom(y, m - 2);
      break;
    case "last-3months":
      pStart = som(y, m - 2);   pEnd   = now;
      ppStart = som(y, m - 5);  ppEnd  = eom(y, m - 3);
      break;
    case "last-6months":
      pStart = som(y, m - 5);   pEnd   = now;
      ppStart = som(y, m - 11); ppEnd  = eom(y, m - 6);
      break;
    default: // last-12months
      pStart = som(y, m - 11);  pEnd   = now;
      ppStart = som(y, m - 23); ppEnd  = eom(y, m - 12);
  }

  let fyYear: number;
  if      (fy === "current-fy") fyYear = y;
  else if (fy === "prev-fy")    fyYear = y - 1;
  else                          fyYear = parseInt(customYear, 10) || y;

  const yStart  = new Date(fyYear, 0, 1);
  const yEnd    = fy === "current-fy" ? now : new Date(fyYear, 11, 31);
  const pyStart = new Date(fyYear - 1, 0, 1);
  const pyEnd   = new Date(fyYear - 1, 11, 31);

  const periodDisplayLabel =
    period === "current-month" || period === "last-month"
      ? new Date(fmt(pStart) + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" })
      : PERIOD_LABELS[period];

  return {
    pStart: fmt(pStart),   pEnd: fmt(pEnd),
    ppStart: fmt(ppStart), ppEnd: fmt(ppEnd),
    yStart: fmt(yStart),   yEnd: fmt(yEnd),
    pyStart: fmt(pyStart), pyEnd: fmt(pyEnd),
    fyYear, periodLabel: PERIOD_LABELS[period],
    periodDisplayLabel, fyLabel: `FY ${fyYear}`,
  };
}

// ── Local data types ───────────────────────────────────────────────────────────
type InvRow = {
  id: string; total_amount: number; amount_paid: number;
  invoice_date: string; due_date: string | null; status: string;
  customer_id: string | null;
  customer: { id: string; name: string } | null;
};
type InvWithCustomer = InvRow & { invoice_number: string };
type PORow  = { id: string; total_amount: number; po_date: string; status: string };
type InvPayRow  = { id: string; amount: number; payment_date: string };
type VendPayRow = { id: string; amount: number; payment_date: string; vendor_id: string | null };
type ReceivedPORow = {
  id: string; total_amount: number; po_date: string;
  vendor_id: string | null; vendor: { id: string; name: string } | null;
};
type SaleMovRow = {
  quantity: number; unit_price: number | null;
  product: { id: string; name: string; sku: string } | null;
};
type ProdRow    = { id: string; name: string; sku: string; cost_price: number | null; selling_price: number; reorder_point: number };
type ProdWithQty = ProdRow & { qty: number };

type ActivityInvoice   = { id: string; invoice_number: string; total_amount: number; created_at: string; customer: { name: string } | null };
type ActivityPayment   = { id: string; amount: number; created_at: string; invoice: { id: string; invoice_number: string; customer: { name: string } | null } | null };
type ActivityPO        = { id: string; po_number: string; total_amount: number; created_at: string; vendor: { name: string } | null };
type ActivityGRN       = { id: string; grn_number: string; created_at: string; purchase_order: { po_number: string; vendor: { name: string } | null } | null };
type ActivityMovement  = { id: string; movement_type: string; quantity: number; created_at: string; reference_no: string | null; product: { name: string; sku: string } | null };
type ActivityCustomer  = { id: string; name: string; created_at: string };
type ActivityVendor    = { id: string; name: string; created_at: string };
type ActivityQuotation = { id: string; quotation_number: string; total_amount: number; created_at: string; customer: { name: string } | null };
type ActivityVendPay   = { id: string; payment_number: string; amount: number; created_at: string; vendor: { name: string } | null };

type ActivityFeedItem = {
  id: string; time: string;
  icon: "invoice" | "payment" | "po" | "grn" | "stock_in" | "stock_out" | "customer" | "vendor" | "quotation" | "vendor_payment";
  title: string; sub: string; amount?: number; href?: string;
};

const ACTIVITY_ICON_MAP = {
  invoice:        { icon: FileText,        bg: "bg-blue-100",    color: "text-blue-600"    },
  payment:        { icon: Banknote,        bg: "bg-green-100",   color: "text-green-600"   },
  po:             { icon: ShoppingBag,     bg: "bg-indigo-100",  color: "text-indigo-600"  },
  grn:            { icon: PackageCheck,    bg: "bg-purple-100",  color: "text-purple-600"  },
  stock_in:       { icon: ArrowDownCircle, bg: "bg-teal-100",    color: "text-teal-600"    },
  stock_out:      { icon: ArrowUpCircle,   bg: "bg-rose-100",    color: "text-rose-600"    },
  customer:       { icon: Users,           bg: "bg-slate-100",   color: "text-slate-600"   },
  vendor:         { icon: Truck,           bg: "bg-slate-100",   color: "text-slate-600"   },
  quotation:      { icon: ClipboardList,   bg: "bg-amber-100",   color: "text-amber-600"   },
  vendor_payment: { icon: CreditCard,      bg: "bg-emerald-100", color: "text-emerald-600" },
};

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchInventoryData() {
  const supabase = createClient();
  const now = new Date();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1);
  const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [productsRes, stockRes, todayMovRes, monthMovRes, recentlyMovedRes] = await Promise.all([
    supabase.from("products")
      .select("id, name, sku, cost_price, selling_price, reorder_point")
      .is("deleted_at", null).eq("is_active", true),
    supabase.from("stock_levels").select("product_id, quantity"),
    supabase.from("stock_movements").select("movement_type, quantity")
      .gte("created_at", todayStart.toISOString()),
    supabase.from("stock_movements").select("movement_type, quantity")
      .gte("created_at", monthStart.toISOString()),
    supabase.from("stock_movements").select("product_id")
      .gte("created_at", ninetyDaysAgo.toISOString()),
  ]);

  return {
    products:      (productsRes.data ?? []) as unknown as ProdRow[],
    stockLevels:   stockRes.data ?? [],
    todayMov:      todayMovRes.data ?? [],
    monthMov:      monthMovRes.data ?? [],
    recentlyMoved: recentlyMovedRes.data ?? [],
  };
}

async function fetchFinancialData() {
  const supabase = createClient();
  const twoYearsAgo = `${new Date().getFullYear() - 2}-01-01`;

  const [invRes, poRes, invPayRes, vendPayRes, outstandingInvRes, receivedPORes, saleMovRes] = await Promise.all([
    supabase.from("invoices")
      .select("id, total_amount, amount_paid, invoice_date, due_date, status, customer_id, customer:customers(id, name)")
      .gte("invoice_date", twoYearsAgo).neq("status", "draft"),

    supabase.from("purchase_orders")
      .select("id, total_amount, po_date, status")
      .gte("po_date", twoYearsAgo).not("status", "in", '("draft","cancelled")'),

    supabase.from("invoice_payments")
      .select("id, amount, payment_date").gte("payment_date", twoYearsAgo),

    supabase.from("vendor_payments")
      .select("id, amount, payment_date, vendor_id").gte("payment_date", twoYearsAgo),

    supabase.from("invoices")
      .select("id, invoice_number, total_amount, amount_paid, invoice_date, due_date, customer:customers(id, name)")
      .in("status", ["sent", "partial", "overdue"]).order("total_amount", { ascending: false }),

    supabase.from("purchase_orders")
      .select("id, total_amount, po_date, vendor_id, vendor:vendors(id, name)")
      .in("status", ["partial", "received"]),

    supabase.from("stock_movements")
      .select("quantity, unit_price, product:products(id, name, sku)")
      .eq("movement_type", "sale").gte("created_at", twoYearsAgo),
  ]);

  return {
    invoices:           (invRes.data           ?? []) as unknown as InvRow[],
    pos:                (poRes.data             ?? []) as unknown as PORow[],
    invPayments:        (invPayRes.data         ?? []) as unknown as InvPayRow[],
    vendPayments:       (vendPayRes.data        ?? []) as unknown as VendPayRow[],
    outstandingInvoices:(outstandingInvRes.data ?? []) as unknown as InvWithCustomer[],
    receivedPOs:        (receivedPORes.data     ?? []) as unknown as ReceivedPORow[],
    saleMov:            (saleMovRes.data        ?? []) as unknown as SaleMovRow[],
  };
}

async function fetchActivityData() {
  const supabase = createClient();

  const [invRes, payRes, poRes, grnRes, movRes, custRes, vendRes, quotRes, vpRes] = await Promise.all([
    supabase.from("invoices")
      .select("id, invoice_number, total_amount, created_at, customer:customers(name)")
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("invoice_payments")
      .select("id, amount, created_at, invoice:invoices(id, invoice_number, customer:customers(name))")
      .order("created_at", { ascending: false }).limit(4),
    supabase.from("purchase_orders")
      .select("id, po_number, total_amount, created_at, vendor:vendors(name)")
      .order("created_at", { ascending: false }).limit(4),
    supabase.from("po_receipts")
      .select("id, grn_number, created_at, purchase_order:purchase_orders(po_number, vendor:vendors(name))")
      .order("created_at", { ascending: false }).limit(4),
    supabase.from("stock_movements")
      .select("id, movement_type, quantity, created_at, reference_no, product:products(name, sku)")
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("customers")
      .select("id, name, created_at").order("created_at", { ascending: false }).limit(3),
    supabase.from("vendors")
      .select("id, name, created_at").order("created_at", { ascending: false }).limit(3),
    supabase.from("quotations")
      .select("id, quotation_number, total_amount, created_at, customer:customers(name)")
      .order("created_at", { ascending: false }).limit(4),
    supabase.from("vendor_payments")
      .select("id, payment_number, amount, created_at, vendor:vendors(name)")
      .order("created_at", { ascending: false }).limit(4),
  ]);

  return {
    invoices:     (invRes.data  ?? []) as unknown as ActivityInvoice[],
    payments:     (payRes.data  ?? []) as unknown as ActivityPayment[],
    pos:          (poRes.data   ?? []) as unknown as ActivityPO[],
    grns:         (grnRes.data  ?? []) as unknown as ActivityGRN[],
    movements:    (movRes.data  ?? []) as unknown as ActivityMovement[],
    customers:    (custRes.data ?? []) as unknown as ActivityCustomer[],
    vendors:      (vendRes.data ?? []) as unknown as ActivityVendor[],
    quotations:   (quotRes.data ?? []) as unknown as ActivityQuotation[],
    vendPayments: (vpRes.data   ?? []) as unknown as ActivityVendPay[],
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface StatProps {
  title: string; value: string; sub?: string;
  delta?: number | null; deltaLabel?: string; positiveUp?: boolean;
  icon: React.ElementType; iconBg: string; iconColor: string;
  loading: boolean; onClick?: () => void;
}
function StatCard({ title, value, sub, delta, deltaLabel, positiveUp = true, icon: Icon, iconBg, iconColor, loading, onClick }: StatProps) {
  const isGood = delta == null ? null : (positiveUp ? delta >= 0 : delta <= 0);
  const absD   = delta != null ? Math.abs(delta) : null;
  return (
    <div
      className={`rounded-lg border bg-card p-4 space-y-2 transition-all ${onClick ? "cursor-pointer hover:border-primary/40 hover:shadow-sm" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground leading-tight">{title}</p>
        <div className={`rounded-md p-1.5 shrink-0 ${iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold tabular-nums tracking-tight">
        {loading ? <span className="text-muted-foreground">—</span> : value}
      </p>
      {!loading && (
        <div className="flex items-center justify-between gap-2">
          {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
          {absD !== null && delta != null && (
            <div className={`flex items-center gap-0.5 shrink-0 text-[11px] font-medium ${
              isGood === true ? "text-green-600" : isGood === false ? "text-red-500" : "text-muted-foreground"
            }`}>
              {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {fmtPct(absD)} {deltaLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface AlertStatProps {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; scheme: "orange" | "red" | "yellow" | "gray";
  loading: boolean; onClick?: () => void;
}
const ALERT_SCHEME = {
  orange: { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700", iconBg: "bg-orange-100", iconColor: "text-orange-600" },
  red:    { border: "border-red-200",    bg: "bg-red-50",    text: "text-red-700",    iconBg: "bg-red-100",    iconColor: "text-red-600"    },
  yellow: { border: "border-yellow-200", bg: "bg-yellow-50", text: "text-yellow-700", iconBg: "bg-yellow-100", iconColor: "text-yellow-600" },
  gray:   { border: "border-slate-200",  bg: "bg-slate-50",  text: "text-slate-700",  iconBg: "bg-slate-100",  iconColor: "text-slate-600"  },
};
function AlertStat({ title, value, sub, icon: Icon, scheme, loading, onClick }: AlertStatProps) {
  const s = ALERT_SCHEME[scheme];
  return (
    <div
      className={`rounded-lg border p-4 space-y-2 ${s.border} ${s.bg} ${onClick ? "cursor-pointer hover:shadow-sm" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-medium ${s.text}`}>{title}</p>
        <div className={`rounded-md p-1.5 shrink-0 ${s.iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${s.iconColor}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${s.text}`}>
        {loading ? "—" : value}
      </p>
      {sub && !loading && <p className={`text-[11px] ${s.text} opacity-75`}>{sub}</p>}
    </div>
  );
}
function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-3 pb-1 border-b border-border">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ── Dashboard page ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router  = useRouter();
  const { data: profile } = useProfile();
  const isAdmin = ["owner","admin","manager"].includes(profile?.role ?? "");

  // Filters
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("current-month");
  const [yearFilter,   setYearFilter]   = useState<YearFilter>("current-fy");
  const [customYear,   setCustomYear]   = useState(String(new Date().getFullYear()));

  // Data queries
  const { data: invData, isLoading: invLoading } = useQuery({ queryKey: ["dashboard-inventory"], queryFn: fetchInventoryData,  staleTime: 30_000 });
  const { data: finData, isLoading: finLoading } = useQuery({ queryKey: ["dashboard-financial"], queryFn: fetchFinancialData,  staleTime: 30_000 });
  const { data: actData, isLoading: actLoading } = useQuery({ queryKey: ["dashboard-activity"],  queryFn: fetchActivityData,   staleTime: 30_000 });

  // Filter dates
  const filterDates = useMemo(() => computeFilterDates(periodFilter, yearFilter, customYear), [periodFilter, yearFilter, customYear]);

  // ── Navigation helpers ────────────────────────────────────────────────────
  function goTo(view: string) {
    const p = new URLSearchParams({ period: periodFilter, fy: yearFilter });
    if (yearFilter === "custom") p.set("year", customYear);
    router.push(`/dashboard/${view}?${p}`);
  }
  function goToRange(view: string, start: string, end: string, title?: string) {
    const p = new URLSearchParams({ start, end });
    if (title) p.set("title", encodeURIComponent(title));
    router.push(`/dashboard/${view}?${p}`);
  }

  // ── Inventory computed ─────────────────────────────────────────────────────

  const inv = useMemo(() => {
    if (!invData) return null;
    const { products, stockLevels, todayMov, monthMov, recentlyMoved } = invData;

    const stockByProduct = new Map<string, number>();
    for (const sl of stockLevels) {
      stockByProduct.set(sl.product_id, (stockByProduct.get(sl.product_id) ?? 0) + (sl.quantity as number));
    }
    const recentlyMovedIds = new Set((recentlyMoved as { product_id: string }[]).map(m => m.product_id));

    let totalUnits = 0, costVal = 0, saleVal = 0;
    let lowStock = 0, outOfStock = 0, reorderReq = 0, deadStockCount = 0;

    const lowStockProds: ProdWithQty[] = [];
    const outOfStockProds: ProdWithQty[] = [];
    const deadStockProds: ProdWithQty[] = [];
    const reorderProds: ProdWithQty[] = [];
    const allWithStock: ProdWithQty[] = [];

    for (const p of products) {
      const qty  = stockByProduct.get(p.id) ?? 0;
      const cost = (p.cost_price ?? p.selling_price ?? 0);
      const sale = (p.selling_price ?? 0);
      const prod: ProdWithQty = { ...p, qty };
      totalUnits += qty;
      costVal    += qty * cost;
      saleVal    += qty * sale;
      if (qty === 0)                         { outOfStock++; outOfStockProds.push(prod); }
      if (qty > 0 && qty <= p.reorder_point) { lowStock++;   lowStockProds.push(prod);   }
      if (qty <= p.reorder_point)            { reorderReq++; reorderProds.push(prod);    }
      if (qty > 0 && !recentlyMovedIds.has(p.id)) { deadStockCount++; deadStockProds.push(prod); }
      if (qty > 0)                           { allWithStock.push(prod); }
    }

    lowStockProds.sort((a, b) => a.qty - b.qty);
    outOfStockProds.sort((a, b) => a.name.localeCompare(b.name));
    deadStockProds.sort((a, b) => b.qty * (b.cost_price ?? b.selling_price ?? 0) - a.qty * (a.cost_price ?? a.selling_price ?? 0));
    reorderProds.sort((a, b) => a.qty - b.qty);
    allWithStock.sort((a, b) => b.qty * (b.cost_price ?? b.selling_price ?? 0) - a.qty * (a.cost_price ?? a.selling_price ?? 0));

    let todayIn = 0, todayOut = 0, monthIn = 0, monthOut = 0;
    for (const mv of todayMov as { movement_type: string; quantity: number }[]) {
      if      (IN_TYPES.includes(mv.movement_type))  todayIn  += mv.quantity;
      else if (OUT_TYPES.includes(mv.movement_type)) todayOut += mv.quantity;
    }
    for (const mv of monthMov as { movement_type: string; quantity: number }[]) {
      if      (IN_TYPES.includes(mv.movement_type))  monthIn  += mv.quantity;
      else if (OUT_TYPES.includes(mv.movement_type)) monthOut += mv.quantity;
    }

    return {
      totalSKUs: products.length, totalUnits,
      costVal, saleVal, marginVal: saleVal - costVal,
      lowStock, outOfStock, reorderReq, deadStockCount,
      todayIn, todayOut, monthIn, monthOut,
      lowStockProds, outOfStockProds, deadStockProds, reorderProds, allWithStock,
    };
  }, [invData]);

  // ── Financial computed ─────────────────────────────────────────────────────

  const fin = useMemo(() => {
    if (!finData) return null;
    const { invoices, pos, invPayments, vendPayments, outstandingInvoices, receivedPOs, saleMov } = finData;
    const { pStart, pEnd, ppStart, ppEnd, yStart, yEnd, pyStart, pyEnd } = filterDates;
    const now = new Date();

    // Year slices
    const yearInvs     = invoices.filter(i => inRange(i.invoice_date, yStart, yEnd));
    const prevYearInvs = invoices.filter(i => inRange(i.invoice_date, pyStart, pyEnd));
    const yearPOs      = pos.filter(p => inRange(p.po_date, yStart, yEnd));
    const prevYearPOs  = pos.filter(p => inRange(p.po_date, pyStart, pyEnd));

    // Period slices
    const periodInvs     = invoices.filter(i => inRange(i.invoice_date, pStart, pEnd));
    const prevPeriodInvs = invoices.filter(i => inRange(i.invoice_date, ppStart, ppEnd));
    const periodPOs      = pos.filter(p => inRange(p.po_date, pStart, pEnd));
    const prevPeriodPOs  = pos.filter(p => inRange(p.po_date, ppStart, ppEnd));

    const sumInv = (arr: InvRow[]) => arr.reduce((s, i) => s + i.total_amount, 0);
    const sumPO  = (arr: PORow[])  => arr.reduce((s, p) => s + p.total_amount, 0);

    const yearlySales     = sumInv(yearInvs);
    const prevYearlySales = sumInv(prevYearInvs);
    const yearlyPurch     = sumPO(yearPOs);
    const prevYearlyPurch = sumPO(prevYearPOs);
    const yearlyProfit    = yearlySales - yearlyPurch;
    const prevYearlyProfit= prevYearlySales - prevYearlyPurch;
    const yearlyMargin    = yearlySales > 0 ? (yearlyProfit / yearlySales) * 100 : 0;
    const prevYearlyMargin= prevYearlySales > 0 ? (prevYearlyProfit / prevYearlySales) * 100 : 0;

    const periodSales     = sumInv(periodInvs);
    const prevPeriodSales = sumInv(prevPeriodInvs);
    const periodPurch     = sumPO(periodPOs);
    const prevPeriodPurch = sumPO(prevPeriodPOs);
    const periodProfit    = periodSales - periodPurch;
    const prevPeriodProfit= prevPeriodSales - prevPeriodPurch;
    const periodMargin    = periodSales > 0 ? (periodProfit / periodSales) * 100 : 0;
    const prevPeriodMargin= prevPeriodSales > 0 ? (prevPeriodProfit / prevPeriodSales) * 100 : 0;

    // Customer outstanding
    const customerOutstanding = outstandingInvoices.reduce(
      (s, inv) => s + Math.max(0, inv.total_amount - inv.amount_paid), 0
    );

    // Vendor outstanding
    const totalReceivedValue = receivedPOs.reduce((s, po) => s + po.total_amount, 0);
    const totalVendorPaid    = vendPayments.reduce((s, p) => s + p.amount, 0);
    const vendorOutstanding  = Math.max(0, totalReceivedValue - totalVendorPaid);

    // Cash flow for selected period
    const paymentsIn  = invPayments.filter(p => inRange(p.payment_date, pStart, pEnd)).reduce((s, p) => s + p.amount, 0);
    const paymentsOut = vendPayments.filter(p => inRange(p.payment_date, pStart, pEnd)).reduce((s, p) => s + p.amount, 0);
    const netCashFlow = paymentsIn - paymentsOut;

    // 12-month trend
    const trend = Array.from({ length: 12 }, (_, i) => {
      const d   = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const pfx = datePrefixMonth(d);
      const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      const sales = invoices.filter(inv => inv.invoice_date.startsWith(pfx)).reduce((s, inv) => s + inv.total_amount, 0);
      const purch = pos.filter(p => p.po_date.startsWith(pfx)).reduce((s, p) => s + p.total_amount, 0);
      const mStart = fmt(d); const mEnd = fmt(eom(d.getFullYear(), d.getMonth()));
      return { label, sales, profit: sales - purch, mStart, mEnd };
    });

    // Top pending collections
    const custMap = new Map<string, { custId: string; name: string; outstanding: number; oldest: string; count: number }>();
    for (const inv of outstandingInvoices) {
      const cust = inv.customer as { id: string; name: string } | null;
      const cid  = cust?.id ?? "_unknown";
      const outstanding = Math.max(0, inv.total_amount - inv.amount_paid);
      if (outstanding <= 0) continue;
      const ex = custMap.get(cid) ?? { custId: cid, name: cust?.name ?? "Unknown", outstanding: 0, oldest: inv.invoice_date, count: 0 };
      custMap.set(cid, {
        custId: ex.custId, name: ex.name,
        outstanding: ex.outstanding + outstanding,
        oldest: inv.invoice_date < ex.oldest ? inv.invoice_date : ex.oldest,
        count: ex.count + 1,
      });
    }
    const topCollections = Array.from(custMap.values())
      .sort((a, b) => b.outstanding - a.outstanding).slice(0, 10)
      .map(c => ({ ...c, days: daysSince(c.oldest) }));

    // Overdue invoices
    const todayStr = new Date().toISOString().split("T")[0];
    const overdueInvs   = outstandingInvoices.filter(inv => inv.due_date && inv.due_date < todayStr);
    const overdueAmount = overdueInvs.reduce((s, inv) => s + Math.max(0, inv.total_amount - inv.amount_paid), 0);
    const overdueCount  = overdueInvs.length;

    // Outstanding vendors
    const vendorPOMap = new Map<string, { name: string; total: number; count: number; oldestDate: string }>();
    for (const po of receivedPOs) {
      const vendor = po.vendor as { id: string; name: string } | null;
      const vid    = vendor?.id ?? po.vendor_id;
      if (!vid) continue;
      const ex = vendorPOMap.get(vid) ?? { name: vendor?.name ?? "Unknown", total: 0, count: 0, oldestDate: po.po_date };
      vendorPOMap.set(vid, {
        name: ex.name, total: ex.total + po.total_amount, count: ex.count + 1,
        oldestDate: po.po_date < ex.oldestDate ? po.po_date : ex.oldestDate,
      });
    }
    const vendorPaidMap = new Map<string, { amount: number; lastDate: string }>();
    for (const vp of vendPayments) {
      if (!vp.vendor_id) continue;
      const ex = vendorPaidMap.get(vp.vendor_id) ?? { amount: 0, lastDate: "" };
      vendorPaidMap.set(vp.vendor_id, {
        amount: ex.amount + vp.amount,
        lastDate: vp.payment_date > ex.lastDate ? vp.payment_date : ex.lastDate,
      });
    }
    const outstandingVendors = Array.from(vendorPOMap.entries())
      .map(([vid, data]) => {
        const paid = vendorPaidMap.get(vid);
        return {
          vendorId: vid, name: data.name,
          outstanding: Math.max(0, data.total - (paid?.amount ?? 0)),
          poCount: data.count, lastPayDate: paid?.lastDate || null,
          days: daysSince(data.oldestDate),
        };
      })
      .filter(v => v.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding);

    // Top customers (last 6 months, fixed)
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixStr = fmt(sixMonthsAgo);
    const custSalesMap = new Map<string, { custId: string; name: string; total: number; count: number }>();
    for (const inv of invoices.filter(i => i.invoice_date >= sixStr)) {
      const cust = inv.customer as { id: string; name: string } | null;
      if (!cust) continue;
      const ex = custSalesMap.get(cust.id) ?? { custId: cust.id, name: cust.name, total: 0, count: 0 };
      ex.total += inv.total_amount; ex.count += 1;
      custSalesMap.set(cust.id, ex);
    }
    const topCustomers = Array.from(custSalesMap.values())
      .sort((a, b) => b.total - a.total).slice(0, 5);

    // Top products by revenue
    const prodMap = new Map<string, { name: string; sku: string; qty: number; revenue: number }>();
    for (const mov of saleMov) {
      const prod = mov.product as { id: string; name: string; sku: string } | null;
      if (!prod) continue;
      const ex = prodMap.get(prod.id) ?? { name: prod.name, sku: prod.sku, qty: 0, revenue: 0 };
      ex.qty     += mov.quantity;
      ex.revenue += mov.quantity * (mov.unit_price ?? 0);
      prodMap.set(prod.id, ex);
    }
    const topProducts = Array.from(prodMap.values())
      .sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return {
      yearlySales, prevYearlySales, yearlyPurch, prevYearlyPurch,
      yearlyProfit, prevYearlyProfit, yearlyMargin, prevYearlyMargin,
      periodSales, prevPeriodSales, periodPurch, prevPeriodPurch,
      periodProfit, prevPeriodProfit, periodMargin, prevPeriodMargin,
      customerOutstanding, vendorOutstanding,
      netCashFlow, paymentsIn, paymentsOut,
      trend, topCollections,
      overdueAmount, overdueCount,
      outstandingVendors,
      topCustomers, topProducts,
    };
  }, [finData, filterDates]);

  // ── Activity feed computed ─────────────────────────────────────────────────

  const activities = useMemo((): ActivityFeedItem[] => {
    if (!actData) return [];
    const items: ActivityFeedItem[] = [];

    for (const inv of actData.invoices) {
      const cust = inv.customer as { name: string } | null;
      items.push({ id: `inv-${inv.id}`, time: inv.created_at, icon: "invoice",
        title: `Invoice ${inv.invoice_number}`, sub: cust?.name ?? "—",
        amount: inv.total_amount, href: `/invoices/${inv.id}` });
    }
    for (const pay of actData.payments) {
      const invObj = pay.invoice as { id: string; invoice_number: string; customer: { name: string } | null } | null;
      const cname  = (invObj?.customer as { name: string } | null)?.name ?? "";
      items.push({ id: `pay-${pay.id}`, time: pay.created_at, icon: "payment",
        title: "Payment Received",
        sub: [invObj?.invoice_number, cname].filter(Boolean).join(" · "),
        amount: pay.amount, href: invObj?.id ? `/invoices/${invObj.id}` : undefined });
    }
    for (const po of actData.pos) {
      const vend = po.vendor as { name: string } | null;
      items.push({ id: `po-${po.id}`, time: po.created_at, icon: "po",
        title: `PO ${po.po_number}`, sub: vend?.name ?? "—",
        amount: po.total_amount, href: `/purchase-orders/${po.id}` });
    }
    for (const grn of actData.grns) {
      const poObj = grn.purchase_order as { po_number: string; vendor: { name: string } | null } | null;
      const vname = (poObj?.vendor as { name: string } | null)?.name ?? "";
      items.push({ id: `grn-${grn.id}`, time: grn.created_at, icon: "grn",
        title: `GRN ${grn.grn_number || grn.id.substring(0, 8)}`,
        sub: [poObj?.po_number, vname].filter(Boolean).join(" · "),
        href: `/grn/${grn.id}` });
    }
    for (const mv of actData.movements) {
      const isIn = IN_TYPES.includes(mv.movement_type);
      const prod = mv.product as { name: string; sku: string } | null;
      items.push({ id: `mv-${mv.id}`, time: mv.created_at,
        icon: isIn ? "stock_in" : "stock_out",
        title: isIn ? `Stock In +${mv.quantity}` : `Stock Out −${mv.quantity}`,
        sub: prod?.name ?? mv.reference_no ?? "—",
        href: "/inventory" });
    }
    for (const c of actData.customers) {
      items.push({ id: `cust-${c.id}`, time: c.created_at, icon: "customer",
        title: "Customer Added", sub: c.name, href: `/customers/${c.id}` });
    }
    for (const v of actData.vendors) {
      items.push({ id: `vend-${v.id}`, time: v.created_at, icon: "vendor",
        title: "Vendor Added", sub: v.name, href: `/vendors/${v.id}` });
    }
    for (const q of actData.quotations) {
      const cust = q.customer as { name: string } | null;
      items.push({ id: `quot-${q.id}`, time: q.created_at, icon: "quotation",
        title: `Quotation ${q.quotation_number}`, sub: cust?.name ?? "—",
        amount: q.total_amount, href: `/quotations/${q.id}` });
    }
    for (const vp of actData.vendPayments) {
      const vend = vp.vendor as { name: string } | null;
      items.push({ id: `vp-${vp.id}`, time: vp.created_at, icon: "vendor_payment",
        title: `Vendor Payment ${vp.payment_number}`, sub: vend?.name ?? "—",
        amount: vp.amount, href: "/vendor-payments" });
    }

    return items
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 10);
  }, [actData]);

  const finL = finLoading;
  const invL = invLoading;

  // ── Render ────────────────────────────────────────────────────────────────

  const now              = new Date();
  const todayStr         = now.toISOString().split("T")[0];
  const monthStartStr    = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const sixMonthsAgoStr  = (() => { const d = new Date(now); d.setMonth(d.getMonth() - 6); return d.toISOString().split("T")[0]; })();

  return (
    <div className="flex flex-col h-full">

      {/* ── Custom Dashboard Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b bg-card px-3 sm:px-6 py-3 shrink-0 gap-2 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
            {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Select value={periodFilter} onValueChange={v => setPeriodFilter(v as PeriodFilter)}>
            <SelectTrigger className="h-8 w-28 sm:w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map(k => (
                <SelectItem key={k} value={k} className="text-xs">{PERIOD_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={v => setYearFilter(v as YearFilter)}>
            <SelectTrigger className="h-8 w-24 sm:w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current-fy" className="text-xs">FY {now.getFullYear()}</SelectItem>
              <SelectItem value="prev-fy" className="text-xs">FY {now.getFullYear() - 1}</SelectItem>
              <SelectItem value="custom" className="text-xs">Custom Year</SelectItem>
            </SelectContent>
          </Select>
          {yearFilter === "custom" && (
            <input
              type="number"
              value={customYear}
              onChange={e => setCustomYear(e.target.value)}
              className="h-8 w-16 sm:w-20 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              min={2020} max={2035}
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-8 bg-background">

        {/* ═══════════════════════════════════════════════════
            SECTION 1 — FINANCIAL OVERVIEW (YEARLY)
        ═══════════════════════════════════════════════════ */}
        <div className="space-y-3">
          <SectionHead title="Financial Overview" sub={filterDates.fyLabel} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              title="Yearly Sales"
              value={isAdmin ? fmtShort(fin?.yearlySales ?? 0) : "—"}
              sub={isAdmin && fin ? fmtINR(fin.yearlySales) : undefined}
              delta={isAdmin ? getDelta(fin?.yearlySales ?? 0, fin?.prevYearlySales ?? 0) : undefined}
              deltaLabel="vs prev year" positiveUp
              icon={TrendingUp} iconBg="bg-blue-50" iconColor="text-blue-600"
              loading={finL}
              onClick={isAdmin ? () => goToRange("sales", filterDates.yStart, filterDates.yEnd, "Yearly Sales") : undefined}
            />
            <StatCard
              title="Yearly Purchases"
              value={isAdmin ? fmtShort(fin?.yearlyPurch ?? 0) : "—"}
              sub={isAdmin && fin ? fmtINR(fin.yearlyPurch) : undefined}
              delta={isAdmin ? getDelta(fin?.yearlyPurch ?? 0, fin?.prevYearlyPurch ?? 0) : undefined}
              deltaLabel="vs prev year" positiveUp={false}
              icon={ShoppingBag} iconBg="bg-orange-50" iconColor="text-orange-600"
              loading={finL}
              onClick={isAdmin ? () => goToRange("purchases", filterDates.yStart, filterDates.yEnd, "Yearly Purchases") : undefined}
            />
            <StatCard
              title="Yearly Profit"
              value={isAdmin ? fmtShort(fin?.yearlyProfit ?? 0) : "—"}
              sub={isAdmin && fin ? fmtINR(fin.yearlyProfit) : undefined}
              delta={isAdmin ? getDelta(fin?.yearlyProfit ?? 0, fin?.prevYearlyProfit ?? 0) : undefined}
              deltaLabel="vs prev year" positiveUp
              icon={IndianRupee} iconBg="bg-green-50" iconColor="text-green-600"
              loading={finL}
              onClick={isAdmin ? () => goToRange("profit", filterDates.yStart, filterDates.yEnd, "Yearly Profit") : undefined}
            />
            <StatCard
              title="Yearly Margin %"
              value={isAdmin ? fmtPct(fin?.yearlyMargin ?? 0) : "—"}
              sub={isAdmin && fin ? `Prev: ${fmtPct(fin.prevYearlyMargin)}` : undefined}
              delta={isAdmin && fin ? (fin.yearlyMargin - fin.prevYearlyMargin) : undefined}
              deltaLabel="pts" positiveUp
              icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600"
              loading={finL}
              onClick={isAdmin ? () => goToRange("profit", filterDates.yStart, filterDates.yEnd, "Yearly Profit") : undefined}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 2 — PERIOD PERFORMANCE
        ═══════════════════════════════════════════════════ */}
        <div className="space-y-3">
          <SectionHead title="Period Performance" sub={filterDates.periodDisplayLabel} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              title={`${filterDates.periodLabel} Sales`}
              value={isAdmin ? fmtShort(fin?.periodSales ?? 0) : "—"}
              sub={isAdmin && fin ? fmtINR(fin.periodSales) : undefined}
              delta={isAdmin ? getDelta(fin?.periodSales ?? 0, fin?.prevPeriodSales ?? 0) : undefined}
              deltaLabel="vs prior" positiveUp
              icon={TrendingUp} iconBg="bg-blue-50" iconColor="text-blue-600"
              loading={finL}
              onClick={isAdmin ? () => goToRange("sales", filterDates.pStart, filterDates.pEnd, filterDates.periodDisplayLabel + " Sales") : undefined}
            />
            <StatCard
              title={`${filterDates.periodLabel} Purchases`}
              value={isAdmin ? fmtShort(fin?.periodPurch ?? 0) : "—"}
              sub={isAdmin && fin ? fmtINR(fin.periodPurch) : undefined}
              delta={isAdmin ? getDelta(fin?.periodPurch ?? 0, fin?.prevPeriodPurch ?? 0) : undefined}
              deltaLabel="vs prior" positiveUp={false}
              icon={ShoppingBag} iconBg="bg-orange-50" iconColor="text-orange-600"
              loading={finL}
              onClick={isAdmin ? () => goToRange("purchases", filterDates.pStart, filterDates.pEnd, filterDates.periodDisplayLabel + " Purchases") : undefined}
            />
            <StatCard
              title={`${filterDates.periodLabel} Profit`}
              value={isAdmin ? fmtShort(fin?.periodProfit ?? 0) : "—"}
              sub={isAdmin && fin ? fmtINR(fin.periodProfit) : undefined}
              delta={isAdmin ? getDelta(fin?.periodProfit ?? 0, fin?.prevPeriodProfit ?? 0) : undefined}
              deltaLabel="vs prior" positiveUp
              icon={IndianRupee} iconBg="bg-green-50" iconColor="text-green-600"
              loading={finL}
              onClick={isAdmin ? () => goToRange("profit", filterDates.pStart, filterDates.pEnd, filterDates.periodDisplayLabel + " Profit") : undefined}
            />
            <StatCard
              title="Period Margin %"
              value={isAdmin ? fmtPct(fin?.periodMargin ?? 0) : "—"}
              sub={isAdmin && fin ? `Prior: ${fmtPct(fin.prevPeriodMargin)}` : undefined}
              delta={isAdmin && fin ? (fin.periodMargin - fin.prevPeriodMargin) : undefined}
              deltaLabel="pts" positiveUp
              icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600"
              loading={finL}
              onClick={isAdmin ? () => goToRange("profit", filterDates.pStart, filterDates.pEnd, filterDates.periodDisplayLabel + " Profit") : undefined}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 3 — OUTSTANDING & CASH
        ═══════════════════════════════════════════════════ */}
        <div className="space-y-3">
          <SectionHead title="Outstanding & Cash Flow" sub={`Cash flow for ${filterDates.periodDisplayLabel}`} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              title="Customer Outstanding"
              value={isAdmin ? fmtShort(fin?.customerOutstanding ?? 0) : "—"}
              sub={isAdmin && fin ? `${fmtINR(fin.customerOutstanding)} receivable` : undefined}
              icon={Users} iconBg="bg-rose-50" iconColor="text-rose-600"
              loading={finL}
              onClick={isAdmin ? () => goTo("customer-outstanding") : undefined}
            />
            <StatCard
              title="Vendor Outstanding"
              value={isAdmin ? fmtShort(fin?.vendorOutstanding ?? 0) : "—"}
              sub={isAdmin && fin ? `${fmtINR(fin.vendorOutstanding)} payable` : undefined}
              icon={Truck} iconBg="bg-orange-50" iconColor="text-orange-600"
              loading={finL}
              onClick={isAdmin ? () => goTo("vendor-outstanding") : undefined}
            />
            <AlertStat
              title="Overdue Invoices"
              value={isAdmin ? (fin?.overdueCount ?? 0) : "—"}
              sub={isAdmin && fin ? `${fmtINR(fin.overdueAmount)} overdue` : undefined}
              icon={Clock} scheme="red" loading={finL}
              onClick={isAdmin ? () => goTo("overdue-invoices") : undefined}
            />
            <div className={`rounded-lg border bg-card p-4 space-y-2 ${isAdmin ? "cursor-pointer hover:border-primary/40 hover:shadow-sm" : ""}`}
              onClick={isAdmin ? () => goToRange("cash-flow", filterDates.pStart, filterDates.pEnd, "Cash Flow — " + filterDates.periodDisplayLabel) : undefined}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Net Cash Flow</p>
                <div className="rounded-md p-1.5 shrink-0 bg-teal-50">
                  <Banknote className="h-3.5 w-3.5 text-teal-600" />
                </div>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${finL ? "text-muted-foreground" : (fin?.netCashFlow ?? 0) >= 0 ? "text-green-700" : "text-red-600"}`}>
                {finL ? "—" : (isAdmin ? fmtShort(fin?.netCashFlow ?? 0) : "—")}
              </p>
              {!finL && isAdmin && fin && (
                <p className="text-[11px] text-muted-foreground">{fmtINR(fin.paymentsIn)} in · {fmtINR(fin.paymentsOut)} out</p>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 4 — INVENTORY SNAPSHOT
        ═══════════════════════════════════════════════════ */}
        <div className="space-y-3">
          <SectionHead title="Inventory Snapshot" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <StatCard
              title="Inventory Cost Value"
              value={isAdmin ? fmtShort(inv?.costVal ?? 0) : "—"}
              sub={isAdmin && inv ? fmtINR(inv.costVal) : undefined}
              icon={TrendingDown} iconBg="bg-orange-50" iconColor="text-orange-600"
              loading={invL}
              onClick={isAdmin ? () => goTo("inventory-cost") : undefined}
            />
            <StatCard
              title="Inventory Sale Value"
              value={isAdmin ? fmtShort(inv?.saleVal ?? 0) : "—"}
              sub={isAdmin && inv ? fmtINR(inv.saleVal) : undefined}
              icon={TrendingUp} iconBg="bg-green-50" iconColor="text-green-600"
              loading={invL}
              onClick={isAdmin ? () => goTo("inventory-sale") : undefined}
            />
            <StatCard
              title="Inventory Margin"
              value={isAdmin ? fmtShort(inv?.marginVal ?? 0) : "—"}
              sub={isAdmin && inv && inv.saleVal > 0 ? fmtPct(((inv.marginVal) / inv.saleVal) * 100) + " margin" : undefined}
              icon={IndianRupee} iconBg="bg-emerald-50" iconColor="text-emerald-600"
              loading={invL}
              onClick={isAdmin ? () => goTo("inventory-margin") : undefined}
            />
            <StatCard
              title="Total SKUs"
              value={(inv?.totalSKUs ?? 0).toLocaleString("en-IN")}
              sub="Active products"
              icon={Package} iconBg="bg-blue-50" iconColor="text-blue-600"
              loading={invL}
              onClick={() => goTo("all-products")}
            />
            <StatCard
              title="Total Units"
              value={(inv?.totalUnits ?? 0).toLocaleString("en-IN")}
              sub="Across all locations"
              icon={Boxes} iconBg="bg-indigo-50" iconColor="text-indigo-600"
              loading={invL}
              onClick={() => goTo("inventory-cost")}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 5 — OPERATIONS
        ═══════════════════════════════════════════════════ */}
        <div className="space-y-3">
          <SectionHead title="Operations" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              title="Today's Stock In"
              value={(inv?.todayIn ?? 0).toLocaleString("en-IN")}
              sub="units received today"
              icon={ArrowDownCircle} iconBg="bg-green-50" iconColor="text-green-600"
              loading={invL} onClick={() => goToRange("today-stock-in", todayStr, todayStr, "Today's Stock In")}
            />
            <StatCard
              title="Today's Stock Out"
              value={(inv?.todayOut ?? 0).toLocaleString("en-IN")}
              sub="units dispatched today"
              icon={ArrowUpCircle} iconBg="bg-blue-50" iconColor="text-blue-600"
              loading={invL} onClick={() => goToRange("today-stock-out", todayStr, todayStr, "Today's Stock Out")}
            />
            <StatCard
              title="Monthly Stock In"
              value={(inv?.monthIn ?? 0).toLocaleString("en-IN")}
              sub="units received this month"
              icon={ArrowDownCircle} iconBg="bg-teal-50" iconColor="text-teal-600"
              loading={invL} onClick={() => goToRange("monthly-stock-in", monthStartStr, todayStr, "Monthly Stock In")}
            />
            <StatCard
              title="Monthly Stock Out"
              value={(inv?.monthOut ?? 0).toLocaleString("en-IN")}
              sub="units dispatched this month"
              icon={ArrowUpCircle} iconBg="bg-violet-50" iconColor="text-violet-600"
              loading={invL} onClick={() => goToRange("monthly-stock-out", monthStartStr, todayStr, "Monthly Stock Out")}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 6 — INVENTORY ALERTS
        ═══════════════════════════════════════════════════ */}
        <div className="space-y-3">
          <SectionHead title="Inventory Alerts" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <AlertStat
              title="Low Stock"
              value={inv?.lowStock ?? 0}
              sub={inv?.lowStock ? "products below reorder point" : "All within limits"}
              icon={AlertTriangle} scheme="orange" loading={invL}
              onClick={() => goTo("low-stock")}
            />
            <AlertStat
              title="Out of Stock"
              value={inv?.outOfStock ?? 0}
              sub={inv?.outOfStock ? "SKUs with zero inventory" : "No stockouts"}
              icon={XCircle} scheme="red" loading={invL}
              onClick={() => goTo("out-of-stock")}
            />
            <AlertStat
              title="Dead Stock"
              value={inv?.deadStockCount ?? 0}
              sub="no movement in 90 days"
              icon={PackageOpen} scheme="gray" loading={invL}
              onClick={() => goTo("dead-stock")}
            />
            <AlertStat
              title="Reorder Required"
              value={inv?.reorderReq ?? 0}
              sub={inv?.reorderReq ? "items at or below reorder qty" : "No reorders needed"}
              icon={RefreshCw} scheme="yellow" loading={invL}
              onClick={() => goTo("reorder-required")}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 7 — MONTHLY PROFIT TREND (12 MONTHS)
        ═══════════════════════════════════════════════════ */}
        <div className="space-y-3">
          <SectionHead title="Monthly Profit Trend" sub="Last 12 months · Click a bar to drill into that month" />
          <div className="rounded-lg border bg-card shadow-sm p-5">
            {finLoading || !fin ? (
              <div className="h-56 rounded bg-muted animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={fin.trend} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtShort} width={56} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any, name: any) => [fmtINR(v as number), name as string]}
                    contentStyle={{ fontSize: 12, borderRadius: "6px", cursor: "pointer" }}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="sales" name="Sales" fill="#3b82f6" radius={[3,3,0,0]} maxBarSize={32}
                    style={{ cursor: "pointer" }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onClick={(data: any) => isAdmin && goToRange("profit", data.mStart as string, data.mEnd as string, `${data.label as string} — Detail`)}
                  />
                  <Line
                    dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2}
                    dot={{ r: 3 }} activeDot={{ r: 5, style: { cursor: "pointer" } }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 8 — TOP CUSTOMERS + TOP PRODUCTS
        ═══════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <SectionHead title="Top Customers" sub="By sales · Last 6 months · Click to open ledger" />
            <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
              {finLoading ? (
                <div className="p-5 space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-9 rounded bg-muted animate-pulse" />)}</div>
              ) : !isAdmin ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Restricted to admin / manager role.</div>
              ) : !fin || fin.topCustomers.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No sales in the last 6 months.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="text-left px-4 py-2.5">#</th>
                      <th className="text-left px-4 py-2.5">Customer</th>
                      <th className="text-right px-4 py-2.5">Sales</th>
                      <th className="text-right px-4 py-2.5">Inv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fin.topCustomers.map((c, i) => (
                      <tr key={c.custId + i} className="border-t hover:bg-muted/20 cursor-pointer"
                        onClick={() => router.push(`/customers/${c.custId}`)}>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-blue-600">{fmtINR(c.total)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{c.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <SectionHead title="Top Selling Products" sub="By revenue · From stock movements" />
            <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
              {finLoading ? (
                <div className="p-5 space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-9 rounded bg-muted animate-pulse" />)}</div>
              ) : !isAdmin ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Restricted to admin / manager role.</div>
              ) : !fin || fin.topProducts.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No sales data yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="text-left px-4 py-2.5">#</th>
                      <th className="text-left px-4 py-2.5">Product</th>
                      <th className="text-right px-4 py-2.5">Qty</th>
                      <th className="text-right px-4 py-2.5">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fin.topProducts.map((p, i) => (
                      <tr key={p.sku + i} className="border-t hover:bg-muted/20 cursor-pointer"
                        onClick={() => goToRange("top-products", sixMonthsAgoStr, todayStr, "Top Selling Products")}>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{p.qty.toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-green-700">{fmtINR(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 9 — TOP PENDING COLLECTIONS + RECENT ACTIVITY
        ═══════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="space-y-3">
            <SectionHead title="Top Pending Collections" sub="Highest outstanding customers" />
            <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
              {finLoading ? (
                <div className="p-5 space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-10 rounded bg-muted animate-pulse" />)}</div>
              ) : !isAdmin ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Restricted to admin / manager role.</div>
              ) : !fin || fin.topCollections.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-700">No outstanding collections</p>
                  <p className="text-xs text-muted-foreground mt-0.5">All invoices are settled.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="text-left px-4 py-2.5">#</th>
                      <th className="text-left px-4 py-2.5">Customer</th>
                      <th className="text-right px-4 py-2.5">Outstanding</th>
                      <th className="text-right px-4 py-2.5">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fin.topCollections.map((c, i) => (
                      <tr key={c.name + i} className="border-t hover:bg-muted/20 cursor-pointer"
                        onClick={() => c.custId !== "_unknown" ? router.push(`/customers/${c.custId}`) : goTo("customer-outstanding")}>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-rose-600">{fmtINR(c.outstanding)}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant="outline" className={`text-[11px] ${c.days > 60 ? "text-red-600 border-red-300 bg-red-50" : c.days > 30 ? "text-orange-600 border-orange-300 bg-orange-50" : "text-slate-600 border-slate-300"}`}>
                            {c.days}d
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/20 border-t font-semibold">
                      <td colSpan={2} className="px-4 py-3 text-sm">Total Outstanding</td>
                      <td className="px-4 py-3 text-right tabular-nums text-rose-600">
                        {fmtINR(fin.topCollections.reduce((s, c) => s + c.outstanding, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <SectionHead title="Recent Activity" sub="Latest 10 system events" />
            <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
              {actLoading ? (
                <div className="p-5 space-y-3">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-40 rounded bg-muted animate-pulse" />
                        <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No recent activity. Start by creating an invoice or purchase order.
                </div>
              ) : (
                <div className="divide-y">
                  {activities.map(item => {
                    const { icon: ActivityIcon, bg, color } = ACTIVITY_ICON_MAP[item.icon] ?? ACTIVITY_ICON_MAP["invoice"];
                    const timeStr = (() => {
                      const d = new Date(item.time);
                      const diff = Date.now() - d.getTime();
                      if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
                      if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
                      return format(d, "dd MMM");
                    })();
                    return (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 px-4 py-3 transition-colors ${item.href ? "cursor-pointer hover:bg-muted/20" : ""}`}
                        onClick={item.href ? () => router.push(item.href!) : undefined}
                      >
                        <div className={`rounded-full p-2 shrink-0 mt-0.5 ${bg}`}>
                          <ActivityIcon className={`h-3.5 w-3.5 ${color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <span className="text-[11px] text-muted-foreground shrink-0">{timeStr}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                        </div>
                        {item.amount !== undefined && isAdmin && (
                          <span className="text-xs font-semibold text-muted-foreground shrink-0 tabular-nums">
                            {fmtShort(item.amount)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
