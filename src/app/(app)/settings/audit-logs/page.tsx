"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Download, RefreshCw } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  user_name: string;
  user_email: string | null;
  user_ip: string | null;
  action: string;
  module: string;
  record_id: string | null;
  record_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  authentication:  "Authentication",
  user_management: "User Management",
  company:         "Company",
  products:        "Products",
  customers:       "Customers",
  vendors:         "Vendors",
  quotations:      "Quotations",
  invoices:        "Invoices",
  purchase_orders: "Purchase Orders",
  grn:             "Goods Receipts",
  inventory:       "Inventory",
  vendor_payments: "Vendor Payments",
};

const ACTION_LABELS: Record<string, string> = {
  login:                "Login",
  logout:               "Logout",
  password_reset:       "Password Reset",
  password_changed:     "Password Changed",
  created:              "Created",
  updated:              "Updated",
  deleted:              "Deleted",
  approved:             "Approved",
  status_changed:       "Status Changed",
  payment_recorded:     "Payment Recorded",
  payment_deleted:      "Payment Deleted",
  goods_received:       "Goods Received",
  stock_adjusted:       "Stock Adjusted",
  stock_added:          "Stock Added",
  stock_removed:        "Stock Removed",
  user_invited:         "User Invited",
  role_changed:         "Role Changed",
  user_disabled:        "User Disabled",
  user_enabled:         "User Enabled",
  permissions_changed:  "Permissions Changed",
  company_profile_updated: "Profile Updated",
  logo_changed:         "Logo Changed",
  gst_changed:          "GST Changed",
  bank_details_changed: "Bank Details Changed",
};

const MODULE_COLORS: Record<string, string> = {
  authentication:  "bg-blue-50 text-blue-700 border-blue-200",
  user_management: "bg-purple-50 text-purple-700 border-purple-200",
  company:         "bg-amber-50 text-amber-700 border-amber-200",
  products:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  customers:       "bg-sky-50 text-sky-700 border-sky-200",
  vendors:         "bg-orange-50 text-orange-700 border-orange-200",
  quotations:      "bg-violet-50 text-violet-700 border-violet-200",
  invoices:        "bg-green-50 text-green-700 border-green-200",
  purchase_orders: "bg-indigo-50 text-indigo-700 border-indigo-200",
  grn:             "bg-teal-50 text-teal-700 border-teal-200",
  inventory:       "bg-rose-50 text-rose-700 border-rose-200",
  vendor_payments: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

const ACTION_COLORS: Record<string, string> = {
  created:          "text-green-700",
  updated:          "text-blue-700",
  deleted:          "text-red-700",
  approved:         "text-emerald-700",
  login:            "text-blue-600",
  logout:           "text-gray-600",
  payment_recorded: "text-green-700",
  payment_deleted:  "text-red-600",
  user_disabled:    "text-red-700",
  user_enabled:     "text-green-700",
};

const PAGE_SIZE = 50;

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchAuditLogs(): Promise<AuditLog[]> {
  const res = await fetch("/api/audit", { method: "GET" });
  const json = await res.json();
  if (!res.ok) {
    const detail = json.detail ? ` — ${json.detail}` : "";
    const userId = json.userId ? ` (uid: ${json.userId})` : "";
    throw new Error(`${json.error ?? "Failed to fetch audit logs"}${detail}${userId}`);
  }
  return json.data ?? [];
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDateInput(iso: string) {
  return iso.slice(0, 10); // yyyy-mm-dd
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [filterModule, setFilterModule] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [filterUser, setFilterUser]   = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]   = useState("");
  const [page, setPage]       = useState(1);

  const { data: logs = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: fetchAuditLogs,
    staleTime: 30_000,
  });

  // Unique users for filter dropdown
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach(l => { if (l.user_name) map.set(l.user_name, l.user_name); });
    return Array.from(map.values()).sort();
  }, [logs]);

  // Apply filters
  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterModule !== "all" && l.module !== filterModule) return false;
      if (filterAction !== "all" && l.action !== filterAction) return false;
      if (filterUser   !== "all" && l.user_name !== filterUser) return false;
      if (dateFrom && l.created_at < dateFrom) return false;
      if (dateTo   && l.created_at > dateTo + "T23:59:59") return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          l.user_name?.toLowerCase().includes(q) ||
          l.user_email?.toLowerCase().includes(q) ||
          l.record_name?.toLowerCase().includes(q) ||
          l.action?.toLowerCase().includes(q) ||
          l.module?.toLowerCase().includes(q) ||
          false
        );
      }
      return true;
    });
  }, [logs, filterModule, filterAction, filterUser, dateFrom, dateTo, search]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore   = filtered.length > paginated.length;

  function resetFilters() {
    setSearch(""); setFilterModule("all"); setFilterAction("all");
    setFilterUser("all"); setDateFrom(""); setDateTo(""); setPage(1);
  }

  function exportCSV() {
    const header = ["Date & Time", "User Name", "User Email", "Action", "Module", "Record Name", "Record ID", "IP Address"];
    const rows = filtered.map(l => [
      fmtDateTime(l.created_at),
      l.user_name,
      l.user_email ?? "",
      ACTION_LABELS[l.action] ?? l.action,
      MODULE_LABELS[l.module] ?? l.module,
      l.record_name ?? "",
      l.record_id ?? "",
      l.user_ip ?? "",
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `audit-logs-${fmtDateInput(new Date().toISOString())}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const hasActiveFilters = filterModule !== "all" || filterAction !== "all" || filterUser !== "all" || dateFrom || dateTo || search;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Audit Logs"
        subtitle="Complete history of every action performed in your ERP"
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">

        {/* ── Filters ── */}
        <div className="bg-card border rounded-lg p-3 space-y-2.5">
          {/* Row 1: Search + Export + Refresh */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by user, record, action…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={exportCSV} disabled={filtered.length === 0}>
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Row 2: Dropdowns + Date range */}
          <div className="flex flex-wrap gap-2">
            <Select value={filterModule} onValueChange={v => { setFilterModule(v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue placeholder="All Modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {Object.entries(MODULE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterAction} onValueChange={v => { setFilterAction(v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterUser} onValueChange={v => { setFilterUser(v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {uniqueUsers.map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="h-8 text-xs border border-input rounded-md px-2 bg-background text-foreground"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="h-8 text-xs border border-input rounded-md px-2 bg-background text-foreground"
              />
            </div>

            {hasActiveFilters && (
              <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={resetFilters}>
                Clear filters
              </Button>
            )}
          </div>

          {/* Results count */}
          <p className="text-[11px] text-muted-foreground">
            {isLoading ? "Loading…" : `${filtered.length.toLocaleString()} event${filtered.length !== 1 ? "s" : ""}`}
            {hasActiveFilters && logs.length > 0 ? ` of ${logs.length.toLocaleString()} total` : ""}
          </p>
        </div>

        {/* ── Table ── */}
        {isError ? (
          <div className="rounded-lg border bg-destructive/5 px-4 py-8 text-center text-sm text-destructive space-y-1">
            <p className="font-semibold">Failed to load audit logs</p>
            <p className="font-mono text-xs opacity-70">{(error as Error)?.message ?? "Unknown error"}</p>
          </div>
        ) : isLoading ? (
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="space-y-0">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0">
                  <Skeleton className="h-4 w-36 shrink-0" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-48 flex-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border bg-muted/20 py-20 text-center">
            <p className="text-sm font-medium text-muted-foreground">No events found</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {hasActiveFilters ? "Try adjusting your filters." : "Actions across the ERP will appear here."}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] sm:grid-cols-[160px_1fr_120px_140px_100px] gap-0 bg-muted/40 border-b px-4 py-2">
                {["Date & Time", "User / Record", "Action", "Module", "IP"].map(h => (
                  <span key={h} className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows */}
              <div className="divide-y">
                {paginated.map((log, i) => (
                  <div
                    key={log.id}
                    className={`grid grid-cols-1 sm:grid-cols-[160px_1fr_120px_140px_100px] gap-1 sm:gap-0 px-4 py-2.5 text-xs ${i % 2 === 1 ? "bg-muted/10" : ""}`}
                  >
                    {/* Date */}
                    <div className="text-muted-foreground font-mono text-[11px] leading-relaxed whitespace-nowrap">
                      {fmtDateTime(log.created_at)}
                    </div>

                    {/* User + Record */}
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{log.user_name}</p>
                      {log.user_email && (
                        <p className="text-muted-foreground text-[10px] truncate">{log.user_email}</p>
                      )}
                      {log.record_name && (
                        <p className="text-muted-foreground text-[10px] mt-0.5 truncate">
                          <span className="text-foreground/60">→</span> {log.record_name}
                        </p>
                      )}
                    </div>

                    {/* Action */}
                    <div className="flex items-start pt-0.5">
                      <span className={`font-medium ${ACTION_COLORS[log.action] ?? "text-foreground"}`}>
                        {ACTION_LABELS[log.action] ?? log.action.replace(/_/g, " ")}
                      </span>
                    </div>

                    {/* Module */}
                    <div className="flex items-start pt-0.5">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-normal ${MODULE_COLORS[log.module] ?? "bg-muted text-muted-foreground"}`}>
                        {MODULE_LABELS[log.module] ?? log.module}
                      </Badge>
                    </div>

                    {/* IP */}
                    <div className="flex items-start pt-0.5 text-[10px] text-muted-foreground font-mono">
                      {log.user_ip ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="text-center pt-1">
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>
                  Load more <span className="ml-1 text-muted-foreground">({filtered.length - paginated.length} remaining)</span>
                </Button>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground text-center pb-2">
              Showing {paginated.length.toLocaleString()} of {filtered.length.toLocaleString()} events.
              Audit logs are retained permanently and never auto-deleted.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
