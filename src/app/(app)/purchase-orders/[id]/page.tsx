"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Printer, Pencil, Trash2, ArrowLeft,
  Send, XCircle, PackageCheck, AlertCircle, CheckCircle2, ExternalLink,
} from "lucide-react";
import type { PurchaseOrder, PurchaseOrderItem, POStatus, Location, Vendor, CompanySettings } from "@/lib/types";
import { useCompanySettings } from "@/lib/hooks/useCompanySettings";
import { escHtml as esc, buildCompanyHeader } from "@/lib/utils/printUtils";
import { useProfile } from "@/lib/hooks/useProfile";
import { format } from "date-fns";
import { preventDecimalInput } from "@/lib/utils";

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<POStatus, string> = {
  draft:     "bg-slate-100  text-slate-700  border-slate-200",
  sent:      "bg-blue-100   text-blue-700   border-blue-200",
  partial:   "bg-orange-100 text-orange-700 border-orange-200",
  received:  "bg-green-100  text-green-700  border-green-200",
  cancelled: "bg-red-100    text-red-600    border-red-200",
};

const STATUS_LABEL: Record<POStatus, string> = {
  draft: "Draft", sent: "Sent", partial: "Partially Received",
  received: "Received", cancelled: "Cancelled",
};

// ── Data ──────────────────────────────────────────────────────────────────────

type FullPO = PurchaseOrder & {
  items: PurchaseOrderItem[];
  vendor: Vendor | null;
};

async function fetchPO(id: string): Promise<FullPO> {
  const supabase = createClient();
  const [{ data: po, error: poErr }, { data: items, error: iErr }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("*, vendor:vendors(*)")
      .eq("id", id)
      .single(),
    supabase
      .from("purchase_order_items")
      .select("*, product:products(id,sku,name)")
      .eq("purchase_order_id", id)
      .order("sort_order"),
  ]);
  if (poErr) throw poErr;
  if (iErr) throw iErr;
  return {
    ...(po as PurchaseOrder),
    vendor: (po as FullPO).vendor ?? null,
    items: (items ?? []) as PurchaseOrderItem[],
  };
}

async function fetchLocations(): Promise<Location[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("locations")
    .select("*")
    .eq("is_active", true)
    .order("name");
  return (data ?? []) as Location[];
}

// ── PDF builder ───────────────────────────────────────────────────────────────

function buildPOPrintHTML(po: FullPO, settings: CompanySettings | null): string {
  const fmtDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const fmtINR = (n: number) =>
    "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  const rows = (po.items ?? []).map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(item.description)}</td>
      <td class="right">${item.quantity}</td>
      <td class="right">${esc(item.unit_cost?.toString())}</td>
      <td class="right">${item.tax_rate}%</td>
      <td class="right">${fmtINR(item.line_total)}</td>
    </tr>`).join("");

  const vendor = po.vendor;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Purchase Order ${esc(po.po_number)}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:32px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
    .company-name{font-size:20px;font-weight:bold}
    .po-title{font-size:24px;font-weight:bold;text-align:right}
    .po-meta{text-align:right;margin-top:4px;color:#555}
    .section{margin-bottom:20px}
    .label{font-size:10px;text-transform:uppercase;color:#888;margin-bottom:2px}
    .value{font-weight:500}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th{background:#f3f4f6;padding:8px;text-align:left;font-size:11px;text-transform:uppercase;border-bottom:2px solid #e5e7eb}
    td{padding:8px;border-bottom:1px solid #e5e7eb;vertical-align:top}
    .right{text-align:right}
    .totals{margin-top:16px;display:flex;justify-content:flex-end}
    .totals-table{width:280px}
    .totals-table td{border:none;padding:4px 8px}
    .totals-total td{font-weight:bold;font-size:14px;border-top:2px solid #111;padding-top:8px}
    .footer{margin-top:40px;display:flex;justify-content:space-between;font-size:11px;color:#555}
    .sig-box{border-top:1px solid #111;width:200px;padding-top:4px;text-align:center}
    @media print{body{padding:16px}}
  </style>
</head>
<body>
  <div class="header">
    ${buildCompanyHeader(settings, "purchase_order")}
    <div>
      <div class="po-title">${esc(po.po_number)}</div>
      <div class="po-meta">Date: ${fmtDate(po.po_date)}</div>
      ${po.expected_date ? `<div class="po-meta">Expected: ${fmtDate(po.expected_date)}</div>` : ""}
      <div class="po-meta">Status: ${STATUS_LABEL[po.status]}</div>
    </div>
  </div>

  <div style="display:flex;gap:40px;margin-bottom:24px">
    <div class="section">
      <div class="label">Vendor / Supplier</div>
      <div class="value">${esc(vendor?.name)}</div>
      ${vendor?.company_name ? `<div>${esc(vendor.company_name)}</div>` : ""}
      ${vendor?.phone ? `<div>${esc(vendor.phone)}</div>` : ""}
      ${vendor?.email ? `<div>${esc(vendor.email)}</div>` : ""}
      ${vendor?.address ? `<div>${esc(vendor.address)}</div>` : ""}
      ${vendor?.city || vendor?.state ? `<div>${esc([vendor.city, vendor.state].filter(Boolean).join(", "))}</div>` : ""}
      ${vendor?.gst_number ? `<div>GST: ${esc(vendor.gst_number)}</div>` : ""}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:32px">#</th>
        <th>Description</th>
        <th class="right" style="width:80px">Qty</th>
        <th class="right" style="width:100px">Unit Cost</th>
        <th class="right" style="width:70px">Tax</th>
        <th class="right" style="width:110px">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <table class="totals-table">
      <tr><td>Subtotal</td><td class="right">${fmtINR(po.subtotal)}</td></tr>
      <tr><td>GST / Tax</td><td class="right">${fmtINR(po.tax_amount)}</td></tr>
      <tr class="totals-total"><td>Total</td><td class="right">${fmtINR(po.total_amount)}</td></tr>
    </table>
  </div>

  ${po.notes ? `<div style="margin-top:24px"><div class="label">Notes</div><div style="white-space:pre-line">${esc(po.notes)}</div></div>` : ""}

  <div class="footer">
    <div><div class="sig-box">Prepared By</div></div>
    <div><div class="sig-box">Authorized Signatory</div></div>
  </div>
</body>
</html>`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PODetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const { data: companySettings } = useCompanySettings();

  // GRN success state
  const [lastGRN, setLastGRN] = useState<{ id: string; grn_number: string } | null>(null);

  // Receive Goods dialog state
  const [receiveOpen, setReceiveOpen]           = useState(false);
  const [receiveDate, setReceiveDate]           = useState(new Date().toISOString().split("T")[0]);
  const [receiveLocationId, setReceiveLocationId] = useState("");
  const [receiveNotes, setReceiveNotes]         = useState("");
  const [receiveQtys, setReceiveQtys]           = useState<Record<string, string>>({});
  const [receiveError, setReceiveError]         = useState<string | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: po, isLoading, error } = useQuery({
    queryKey: ["purchase-order", id],
    queryFn: () => fetchPO(id),
    staleTime: 30000,
    retry: 1,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations-active"],
    queryFn: fetchLocations,
    staleTime: 60000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────

  const statusMutation = useMutation({
    mutationFn: async (newStatus: POStatus) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: async (items: Array<{ po_item_id: string; qty: number }>) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("receive_po_goods", {
        p_po_id:        id,
        p_location_id:  receiveLocationId,
        p_receipt_date: receiveDate,
        p_notes:        receiveNotes || null,
        p_items:        items,
      });
      if (error) throw error;
      return data as { id: string; grn_number: string };
    },
    onSuccess: (data) => {
      setLastGRN(data);
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels-summary"] });
      queryClient.invalidateQueries({ queryKey: ["quantity-history"] });
      queryClient.invalidateQueries({ queryKey: ["grn-list"] });
      setReceiveOpen(false);
      setReceiveQtys({});
      setReceiveNotes("");
      setReceiveError(null);
    },
    onError: (err: Error) => setReceiveError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      router.push("/purchase-orders");
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function fmtINR(n: number) {
    return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  }

  function fmtDate(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  }

  function printPO() {
    if (!po) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(buildPOPrintHTML(po, companySettings ?? null));
    w.document.close();
    w.print();
  }

  // ── Status transitions ───────────────────────────────────────────────────────

  const STATUS_TRANSITIONS: Record<POStatus, Array<{
    label: string; next: POStatus; icon: React.ElementType;
    variant?: "default" | "destructive" | "outline";
    confirm?: string;
  }>> = {
    draft: [
      { label: "Mark Sent", next: "sent", icon: Send },
      { label: "Cancel PO", next: "cancelled", icon: XCircle, variant: "destructive",
        confirm: "Cancel this purchase order? This cannot be undone." },
    ],
    sent: [
      { label: "Cancel PO", next: "cancelled", icon: XCircle, variant: "destructive",
        confirm: "Cancel this purchase order? This cannot be undone." },
    ],
    partial: [
      { label: "Cancel PO", next: "cancelled", icon: XCircle, variant: "destructive",
        confirm: "Cancel this purchase order? Goods already received will remain in inventory." },
    ],
    received:  [],
    cancelled: [],
  };

  const canReceive = po && ["draft", "sent", "partial"].includes(po.status);
  const canEdit    = po && ["draft", "sent"].includes(po.status);

  // ── Pending items for receive dialog ────────────────────────────────────────

  const pendingItems = useMemo(
    () => (po?.items ?? []).filter(it => it.quantity > it.received_qty),
    [po]
  );

  function handleReceiveSubmit() {
    setReceiveError(null);

    if (!receiveLocationId) {
      setReceiveError("Please select a location");
      return;
    }

    const items = pendingItems
      .map(item => ({
        po_item_id: item.id,
        qty: parseInt(receiveQtys[item.id] ?? "0", 10) || 0,
      }))
      .filter(item => item.qty > 0);

    if (items.length === 0) {
      setReceiveError("Enter at least one quantity to receive");
      return;
    }

    receiveMutation.mutate(items);
  }

  // ── Loading / error states ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Purchase Order"
          breadcrumbs={[{ label: "Purchase Orders", href: "/purchase-orders" }, { label: "Loading…" }]} />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Purchase Order"
          breadcrumbs={[{ label: "Purchase Orders", href: "/purchase-orders" }, { label: "Not Found" }]} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Purchase order not found</p>
            <Button variant="outline" size="sm" onClick={() => router.push("/purchase-orders")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back to Purchase Orders
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const transitions = STATUS_TRANSITIONS[po.status] ?? [];

  return (
    <div className="flex flex-col h-full">
      <Header
        title={po.po_number}
        breadcrumbs={[
          { label: "Purchase Orders", href: "/purchase-orders" },
          { label: po.po_number },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/purchase-orders")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back
            </Button>
            <Button variant="outline" size="sm" onClick={printPO}>
              <Printer className="h-4 w-4 mr-1.5" />Print
            </Button>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => router.push(`/purchase-orders/${id}/edit`)}>
                <Pencil className="h-4 w-4 mr-1.5" />Edit
              </Button>
            )}
            {canReceive && (
              <Button size="sm" onClick={() => setReceiveOpen(true)}>
                <PackageCheck className="h-4 w-4 mr-1.5" />Receive Goods
              </Button>
            )}
            {transitions.map(t => (
              <Button
                key={t.next}
                size="sm"
                variant={t.variant ?? "outline"}
                disabled={statusMutation.isPending}
                onClick={() => {
                  if (t.confirm && !confirm(t.confirm)) return;
                  statusMutation.mutate(t.next);
                }}
              >
                <t.icon className="h-4 w-4 mr-1.5" />
                {t.label}
              </Button>
            ))}
            {isAdmin && po.status === "draft" && (
              <Button
                size="sm" variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (!confirm(`Delete ${po.po_number}? This cannot be undone.`)) return;
                  deleteMutation.mutate();
                }}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />Delete
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* ── GRN Success Banner ────────────────────────────── */}
          {lastGRN && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Goods received successfully</p>
                  <p className="text-xs font-mono text-green-700 mt-0.5">{lastGRN.grn_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 border-green-300 text-green-700 hover:bg-green-100"
                  onClick={() => router.push(`/grn/${lastGRN.id}`)}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  View GRN
                </Button>
                <button
                  className="text-green-500 hover:text-green-700"
                  onClick={() => setLastGRN(null)}
                  aria-label="Dismiss"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── PO Header ─────────────────────────────────────── */}
          <div className="rounded-lg border bg-card shadow-sm p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold font-mono">{po.po_number}</h2>
                  <Badge className={`text-xs border ${STATUS_STYLES[po.status]}`} variant="outline">
                    {STATUS_LABEL[po.status]}
                  </Badge>
                </div>
                {po.vendor && (
                  <p className="text-muted-foreground mt-1 font-medium">{po.vendor.name}</p>
                )}
                {po.vendor?.company_name && (
                  <p className="text-sm text-muted-foreground">{po.vendor.company_name}</p>
                )}
              </div>
              <div className="text-sm text-right space-y-1">
                <p><span className="text-muted-foreground">PO Date:</span> {fmtDate(po.po_date)}</p>
                {po.expected_date && (
                  <p><span className="text-muted-foreground">Expected:</span> {fmtDate(po.expected_date)}</p>
                )}
                {po.vendor?.phone && (
                  <p className="text-muted-foreground">{po.vendor.phone}</p>
                )}
                {po.vendor?.gst_number && (
                  <p className="font-mono text-xs text-muted-foreground">GST: {po.vendor.gst_number}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Line Items ────────────────────────────────────── */}
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {["#", "Description", "Ordered", "Received", "Pending", "Unit Cost", "Tax %", "Line Total"].map(h => (
                    <TableHead key={h} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(po.items ?? []).map((item, i) => {
                  const pending = Math.max(0, item.quantity - item.received_qty);
                  const fullyReceived = item.received_qty >= item.quantity;
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/20">
                      <TableCell className="text-muted-foreground text-xs w-8">{i + 1}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{item.description}</p>
                        {item.product && (
                          <p className="text-xs text-muted-foreground font-mono">{item.product.sku}</p>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">{item.quantity}</TableCell>
                      <TableCell className="tabular-nums text-sm">
                        <span className={item.received_qty > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                          {item.received_qty}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        <span className={pending > 0 ? "text-orange-600" : "text-muted-foreground"}>
                          {fullyReceived ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-3 w-3" />Done
                            </span>
                          ) : pending}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">{fmtINR(item.unit_cost)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.tax_rate}%</TableCell>
                      <TableCell className="tabular-nums text-sm font-medium">{fmtINR(item.line_total)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* ── Totals ────────────────────────────────────────── */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72 rounded-lg border bg-card shadow-sm p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">{fmtINR(po.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">GST / Tax</span>
                <span className="font-medium tabular-nums">{fmtINR(po.tax_amount)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2">
                <span>Total</span>
                <span className="tabular-nums">{fmtINR(po.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* ── Notes ─────────────────────────────────────────── */}
          {po.notes && (
            <div className="rounded-lg border bg-card shadow-sm p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</p>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{po.notes}</p>
            </div>
          )}

          {/* ── Meta ──────────────────────────────────────────── */}
          <div className="text-xs text-muted-foreground text-right space-y-0.5">
            <p>Created {format(new Date(po.created_at), "dd MMM yyyy, HH:mm")}</p>
            {po.updated_at !== po.created_at && (
              <p>Updated {format(new Date(po.updated_at), "dd MMM yyyy, HH:mm")}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Receive Goods Dialog ─────────────────────────────── */}
      <Dialog open={receiveOpen} onOpenChange={open => {
        if (!receiveMutation.isPending) {
          setReceiveOpen(open);
          if (!open) { setReceiveError(null); }
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receive Goods — {po.po_number}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Receipt metadata */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Stock Location *</Label>
                <Select value={receiveLocationId} onValueChange={setReceiveLocationId}>
                  <SelectTrigger className={!receiveLocationId && receiveError ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select location…" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                        <span className="text-muted-foreground ml-1 text-xs capitalize">({loc.type})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Receipt Date</Label>
                <Input
                  type="date"
                  value={receiveDate}
                  onChange={e => setReceiveDate(e.target.value)}
                />
              </div>
            </div>

            {/* Items to receive */}
            <div>
              <p className="text-sm font-semibold mb-2">Items Pending</p>
              {pendingItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  All items have been fully received.
                </p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Ordered</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Received</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Pending</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right w-28">Receive Now</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingItems.map(item => {
                        const pending = item.quantity - item.received_qty;
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <p className="text-sm font-medium">{item.description}</p>
                              {item.product && (
                                <p className="text-xs text-muted-foreground font-mono">{item.product.sku}</p>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">{item.quantity}</TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{item.received_qty}</TableCell>
                            <TableCell className="text-right tabular-nums text-sm font-medium text-orange-600">{pending}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min={0}
                                max={pending}
                                step={1}
                                className="h-8 text-right w-24 ml-auto"
                                placeholder={`max ${pending}`}
                                value={receiveQtys[item.id] ?? ""}
                                onKeyDown={preventDecimalInput}
                                onChange={e =>
                                  setReceiveQtys(prev => ({ ...prev, [item.id]: e.target.value }))
                                }
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <textarea
                value={receiveNotes}
                onChange={e => setReceiveNotes(e.target.value)}
                placeholder="Delivery note, condition of goods, remarks…"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                           placeholder:text-muted-foreground focus:outline-none focus:ring-2
                           focus:ring-ring focus:ring-offset-2 resize-none"
              />
            </div>

            {receiveError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {receiveError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReceiveOpen(false)}
              disabled={receiveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReceiveSubmit}
              disabled={receiveMutation.isPending || pendingItems.length === 0}
            >
              <PackageCheck className="h-4 w-4 mr-1.5" />
              {receiveMutation.isPending ? "Receiving…" : "Confirm Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
