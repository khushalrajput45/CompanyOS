"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, AlertCircle, PackageCheck, ExternalLink } from "lucide-react";
import { format } from "date-fns";

// ── Local types ───────────────────────────────────────────────────────────────

type GRNDetail = {
  id: string;
  grn_number: string;
  receipt_date: string;
  notes: string | null;
  created_at: string;
  organization_id: string;
  purchase_order_id: string;
  purchase_order: {
    id: string;
    po_number: string;
    po_date: string;
    vendor: {
      id: string;
      name: string;
      company_name: string | null;
      phone: string | null;
      gst_number: string | null;
    } | null;
  } | null;
};

type GRNReceiptItem = {
  id: string;
  receipt_id: string;
  po_item_id: string;
  product_id: string | null;
  location_id: string | null;
  quantity: number;
  product: { id: string; sku: string; name: string } | null;
  location: { id: string; name: string } | null;
};

type StockMovementRow = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number | null;
  reference_no: string | null;
  notes: string | null;
  created_at: string;
  product: { id: string; sku: string; name: string } | null;
  location: { id: string; name: string } | null;
};

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchGRN(id: string): Promise<GRNDetail> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("po_receipts")
    .select(
      "id, grn_number, receipt_date, notes, created_at, organization_id, purchase_order_id, " +
      "purchase_order:purchase_orders(id, po_number, po_date, vendor:vendors(id, name, company_name, phone, gst_number))"
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as GRNDetail;
}

async function fetchGRNItems(receiptId: string): Promise<GRNReceiptItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("po_receipt_items")
    .select("*, product:products(id, sku, name), location:locations(id, name)")
    .eq("receipt_id", receiptId);
  if (error) throw error;
  return (data ?? []) as unknown as GRNReceiptItem[];
}

async function fetchStockMovements(grnNumber: string): Promise<StockMovementRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      "id, product_id, quantity, unit_price, reference_no, notes, created_at, " +
      "product:products(id, sku, name), location:locations(id, name)"
    )
    .eq("reference_no", grnNumber)
    .eq("movement_type", "receipt")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as StockMovementRow[];
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GRNDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: grn, isLoading, error } = useQuery({
    queryKey: ["grn", id],
    queryFn: () => fetchGRN(id),
    retry: 1,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["grn-items", id],
    queryFn: () => fetchGRNItems(id),
    enabled: !!grn,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["grn-movements", grn?.grn_number],
    queryFn: () => fetchStockMovements(grn!.grn_number),
    enabled: !!grn?.grn_number,
  });

  function fmtDate(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  }

  function fmtINR(n: number) {
    return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="Goods Receipt"
          breadcrumbs={[{ label: "Goods Receipts", href: "/grn" }, { label: "Loading…" }]}
        />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !grn) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="Goods Receipt"
          breadcrumbs={[{ label: "Goods Receipts", href: "/grn" }, { label: "Not Found" }]}
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Goods receipt not found</p>
            <Button variant="outline" size="sm" onClick={() => router.push("/grn")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back to Goods Receipts
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const po     = grn.purchase_order;
  const vendor = po?.vendor;

  return (
    <div className="flex flex-col h-full">
      <Header
        title={grn.grn_number || "Goods Receipt"}
        breadcrumbs={[
          { label: "Goods Receipts", href: "/grn" },
          { label: grn.grn_number || "GRN" },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push("/grn")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />Back
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* ── Header card ───────────────────────────────────── */}
          <div className="rounded-lg border bg-card shadow-sm p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <PackageCheck className="h-5 w-5 text-green-600" />
                  <h2 className="text-xl font-bold font-mono">{grn.grn_number || "—"}</h2>
                  <Badge
                    className="bg-green-100 text-green-700 border-green-200 text-xs border"
                    variant="outline"
                  >
                    Received
                  </Badge>
                </div>
                {po && (
                  <button
                    className="mt-1.5 text-sm text-primary hover:underline flex items-center gap-1"
                    onClick={() => router.push(`/purchase-orders/${po.id}`)}
                  >
                    {po.po_number}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}
                {vendor && (
                  <p className="text-muted-foreground font-medium mt-0.5">{vendor.name}</p>
                )}
                {vendor?.company_name && (
                  <p className="text-sm text-muted-foreground">{vendor.company_name}</p>
                )}
              </div>
              <div className="text-sm text-right space-y-1">
                <p>
                  <span className="text-muted-foreground">Receipt Date: </span>
                  {fmtDate(grn.receipt_date)}
                </p>
                {po?.po_date && (
                  <p>
                    <span className="text-muted-foreground">PO Date: </span>
                    {fmtDate(po.po_date)}
                  </p>
                )}
                {vendor?.phone && (
                  <p className="text-muted-foreground">{vendor.phone}</p>
                )}
                {vendor?.gst_number && (
                  <p className="font-mono text-xs text-muted-foreground">
                    GST: {vendor.gst_number}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Items Received ────────────────────────────────── */}
          <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h3 className="text-sm font-semibold">Items Received</h3>
            </div>
            {items.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No items recorded for this receipt.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    {["#", "Product", "SKU", "Qty Received", "Location"].map(h => (
                      <TableHead
                        key={h}
                        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, i) => (
                    <TableRow key={item.id} className="hover:bg-muted/20">
                      <TableCell className="text-muted-foreground text-xs w-8">{i + 1}</TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{item.product?.name ?? "—"}</p>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {item.product?.sku ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm font-medium text-green-600">
                        +{item.quantity}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.location?.name ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* ── Stock Movements (audit) ───────────────────────── */}
          {movements.length > 0 && (
            <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
              <div className="px-4 py-3 border-b bg-muted/30">
                <h3 className="text-sm font-semibold">Stock Movements</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Inventory entries created by this receipt
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    {["Product", "SKU", "Location", "Qty Added", "Unit Cost"].map(h => (
                      <TableHead
                        key={h}
                        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map(mov => (
                    <TableRow key={mov.id} className="hover:bg-muted/20">
                      <TableCell>
                        <p className="text-sm font-medium">{mov.product?.name ?? "—"}</p>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {mov.product?.sku ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {mov.location?.name ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm font-medium text-green-600">
                        +{mov.quantity}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm text-muted-foreground">
                        {mov.unit_price != null ? fmtINR(mov.unit_price) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* ── Notes ─────────────────────────────────────────── */}
          {grn.notes && (
            <div className="rounded-lg border bg-card shadow-sm p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Notes
              </p>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{grn.notes}</p>
            </div>
          )}

          {/* ── Meta ──────────────────────────────────────────── */}
          <div className="text-xs text-muted-foreground text-right">
            <p>Recorded {grn.created_at ? format(new Date(grn.created_at), "dd MMM yyyy, HH:mm") : "—"}</p>
          </div>

        </div>
      </div>
    </div>
  );
}
