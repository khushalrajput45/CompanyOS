"use client";

import { useState, useMemo, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  AlertTriangle,
  Clock,
  TrendingUp,
  ArrowRight,
  BarChart3,
  Zap,
  Snail,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useProfile } from "@/lib/hooks/useProfile";
import { format } from "date-fns";
import * as XLSX from "xlsx";

// Stable row model factories
const coreRowModel = getCoreRowModel();
const sortedRowModel = getSortedRowModel();
const paginationRowModel = getPaginationRowModel();

interface InventoryItem {
  id: string; sku: string; name: string;
  qty: number; cost_price: number | null; selling_price: number;
  cost_value: number; sale_value: number; margin_pct: string;
}

interface ReorderItem {
  id: string; sku: string; name: string;
  current_qty: number; reorder_point: number; reorder_qty: number; unit: string;
}

interface DeadStockItem {
  id: string; sku: string; name: string;
  current_qty: number; cost_price: number | null; total_value: number;
}

interface MovementItem {
  id: string; date: string; sku: string; product: string;
  location: string; type: string; qty: number; reference: string;
}

interface FastMovingItem {
  id: string; sku: string; name: string;
  movement_qty_30d: number; current_qty: number;
}

interface SlowMovingItem {
  id: string; sku: string; name: string;
  current_qty: number; cost_price: number | null; stale_value: number;
}

async function fetchReports() {
  const supabase = createClient();
  const thirtyDaysAgo  = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const ninetyDaysAgo  = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [
    { data: products },
    { data: stockLevels },
    { data: recentMovements },
    { data: movementCounts },
    { data: recentlyMoved },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, sku, name, cost_price, selling_price, reorder_point, reorder_qty, unit")
      .is("deleted_at", null)
      .eq("is_active", true),
    supabase.from("stock_levels").select("product_id, quantity"),
    supabase
      .from("stock_movements")
      .select("id, movement_type, quantity, created_at, reference_no, product:products(sku,name), location:locations(name)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("stock_movements")
      .select("product_id, quantity")
      .gte("created_at", thirtyDaysAgo.toISOString()),
    // For dead stock: products with ANY movement in last 90 days
    supabase
      .from("stock_movements")
      .select("product_id")
      .gte("created_at", ninetyDaysAgo.toISOString()),
  ]);

  const stockByProduct = new Map<string, number>();
  for (const sl of stockLevels ?? []) {
    stockByProduct.set(sl.product_id, (stockByProduct.get(sl.product_id) ?? 0) + sl.quantity);
  }

  const movCountByProduct = new Map<string, number>();
  for (const mv of movementCounts ?? []) {
    movCountByProduct.set(mv.product_id, (movCountByProduct.get(mv.product_id) ?? 0) + mv.quantity);
  }

  // Dead stock: qty > 0 AND no movement in last 90 days
  const recentlyMovedIds = new Set((recentlyMoved ?? []).map(m => m.product_id));

  const inventoryItems: InventoryItem[] = [];
  const reorderItems: ReorderItem[] = [];
  const deadStockItems: DeadStockItem[] = [];
  const fastMovingItems: FastMovingItem[] = [];
  const slowMovingItems: SlowMovingItem[] = [];

  for (const p of products ?? []) {
    const qty = stockByProduct.get(p.id) ?? 0;
    const costPrice = p.cost_price;
    const salePrice = p.selling_price ?? 0;
    const costValue = qty * (costPrice ?? salePrice);
    const saleValue = qty * salePrice;
    const marginPct =
      costPrice && costPrice > 0
        ? (((salePrice - costPrice) / costPrice) * 100).toFixed(1) + "%"
        : "—";

    inventoryItems.push({ id: p.id, sku: p.sku, name: p.name, qty, cost_price: costPrice, selling_price: salePrice, cost_value: costValue, sale_value: saleValue, margin_pct: marginPct });

    if (qty <= p.reorder_point) {
      reorderItems.push({ id: p.id, sku: p.sku, name: p.name, current_qty: qty, reorder_point: p.reorder_point, reorder_qty: p.reorder_qty, unit: p.unit });
    }

    // Dead stock: qty > 0 AND no movement in last 90 days
    if (qty > 0 && !recentlyMovedIds.has(p.id)) {
      deadStockItems.push({ id: p.id, sku: p.sku, name: p.name, current_qty: qty, cost_price: costPrice, total_value: costValue });
    }

    const mQty = movCountByProduct.get(p.id) ?? 0;
    if (mQty > 0) {
      fastMovingItems.push({ id: p.id, sku: p.sku, name: p.name, movement_qty_30d: mQty, current_qty: qty });
    } else if (qty > 0) {
      slowMovingItems.push({ id: p.id, sku: p.sku, name: p.name, current_qty: qty, cost_price: costPrice, stale_value: costValue });
    }
  }

  fastMovingItems.sort((a, b) => b.movement_qty_30d - a.movement_qty_30d);
  inventoryItems.sort((a, b) => b.sale_value - a.sale_value);
  slowMovingItems.sort((a, b) => b.stale_value - a.stale_value);

  const movItems: MovementItem[] = (recentMovements ?? []).map((mv) => ({
    id: mv.id,
    date: mv.created_at ? format(new Date(mv.created_at), "dd MMM yyyy HH:mm") : "",
    sku: (mv.product as { sku?: string } | null)?.sku ?? "",
    product: (mv.product as { name?: string } | null)?.name ?? "",
    location: (mv.location as { name?: string } | null)?.name ?? "",
    type: mv.movement_type,
    qty: mv.quantity,
    reference: mv.reference_no ?? "",
  }));

  return { inventoryItems, reorderItems, deadStockItems, movItems, fastMovingItems, slowMovingItems };
}

function exportToExcel(data: unknown[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// At module scope — prevents remounting on parent re-render
function DataTable<T>({
  data,
  columns,
  isLoading,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  isLoading: boolean;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: coreRowModel,
    getSortedRowModel: sortedRowModel,
    getPaginationRowModel: paginationRowModel,
    initialState: { pagination: { pageSize: 25 } },
  });

  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                  No data
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-sm py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {total > pageSize && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2">Page {pageIndex + 1} of {table.getPageCount()}</span>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

type ReportKey = "valuation" | "lowstock" | "dead" | "movement" | "fast" | "slow";

function ReportsPageContent() {
  const searchParams = useSearchParams();
  const { data: profile } = useProfile();
  const isAdmin = ["owner","admin","manager"].includes(profile?.role ?? "");

  // Initialize from URL param (dashboard drill-down)
  const [activeReport, setActiveReport] = useState<ReportKey | null>(
    (searchParams.get("type") as ReportKey | null) ?? null
  );

  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: fetchReports,
    enabled: isAdmin,
  });

  const reportCards = useMemo(
    () =>
      [
        {
          key: "valuation" as ReportKey,
          title: "Inventory Valuation",
          description: "All products with current qty, cost & sale values",
          icon: BarChart3,
          iconBg: "bg-blue-50",
          iconColor: "text-blue-600",
          count: data?.inventoryItems.length ?? 0,
          countLabel: "products",
          show: true,
        },
        {
          key: "lowstock" as ReportKey,
          title: "Low Stock",
          description: "Products at or below reorder point",
          icon: AlertTriangle,
          iconBg: "bg-yellow-50",
          iconColor: "text-yellow-600",
          count: data?.reorderItems.length ?? 0,
          countLabel: "items need reorder",
          show: true,
        },
        {
          key: "dead" as ReportKey,
          title: "Dead Stock",
          description: "Products in stock with no movement in 90+ days",
          icon: Clock,
          iconBg: "bg-orange-50",
          iconColor: "text-orange-600",
          count: data?.deadStockItems.length ?? 0,
          countLabel: "excess items",
          show: true,
        },
        {
          key: "movement" as ReportKey,
          title: "Stock Movement",
          description: "Last 200 stock movements across all products",
          icon: RefreshCw,
          iconBg: "bg-indigo-50",
          iconColor: "text-indigo-600",
          count: data?.movItems.length ?? 0,
          countLabel: "recent movements",
          show: true,
        },
        {
          key: "fast" as ReportKey,
          title: "Fast Moving Items",
          description: "Products with highest movement volume (30 days)",
          icon: Zap,
          iconBg: "bg-green-50",
          iconColor: "text-green-600",
          count: data?.fastMovingItems.length ?? 0,
          countLabel: "active products",
          show: true,
        },
        {
          key: "slow" as ReportKey,
          title: "Slow Moving Items",
          description: "Products with no movements in last 30 days",
          icon: Snail,
          iconBg: "bg-gray-50",
          iconColor: "text-gray-500",
          count: data?.slowMovingItems.length ?? 0,
          countLabel: "stale products",
          show: true,
        },
      ].filter((r) => r.show),
    [data]
  );

  const inventoryColumns = useMemo<ColumnDef<InventoryItem>[]>(
    () => [
      { accessorKey: "sku", header: "SKU", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
      { accessorKey: "name", header: "Product" },
      { accessorKey: "qty", header: "Qty" },
      ...(isAdmin
        ? [
            {
              accessorKey: "cost_price",
              header: "Cost ₹",
              cell: ({ getValue }: { getValue: () => unknown }) =>
                getValue() != null ? `₹${(getValue() as number).toLocaleString("en-IN")}` : "—",
            } as ColumnDef<InventoryItem>,
            {
              accessorKey: "cost_value",
              header: "Cost Value",
              cell: ({ getValue }: { getValue: () => unknown }) =>
                getValue() != null ? `₹${(getValue() as number).toLocaleString("en-IN")}` : "—",
            } as ColumnDef<InventoryItem>,
          ]
        : []),
      {
        accessorKey: "selling_price",
        header: "Sale ₹",
        cell: ({ getValue }) => getValue() != null ? `₹${(getValue() as number).toLocaleString("en-IN")}` : "—",
      },
      {
        accessorKey: "sale_value",
        header: "Sale Value",
        cell: ({ getValue }) => (
          <span className="font-medium text-green-700">
            {getValue() != null ? `₹${(getValue() as number).toLocaleString("en-IN")}` : "—"}
          </span>
        ),
      },
      ...(isAdmin
        ? [
            {
              accessorKey: "margin_pct",
              header: "Margin",
            } as ColumnDef<InventoryItem>,
          ]
        : []),
    ],
    [isAdmin]
  );

  const reorderColumns = useMemo<ColumnDef<ReorderItem>[]>(
    () => [
      { accessorKey: "sku", header: "SKU", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
      { accessorKey: "name", header: "Product" },
      { accessorKey: "current_qty", header: "Current Qty" },
      { accessorKey: "reorder_point", header: "Reorder Point" },
      { accessorKey: "reorder_qty", header: "Suggested Order" },
      { accessorKey: "unit", header: "Unit" },
      {
        id: "urgency",
        header: "Urgency",
        cell: ({ row }) =>
          row.original.current_qty === 0 ? (
            <Badge variant="destructive" className="text-xs">Critical</Badge>
          ) : (
            <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-xs">Low</Badge>
          ),
      },
    ],
    []
  );

  const deadStockColumns = useMemo<ColumnDef<DeadStockItem>[]>(
    () => [
      { accessorKey: "sku", header: "SKU", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
      { accessorKey: "name", header: "Product" },
      { accessorKey: "current_qty", header: "Qty" },
      ...(isAdmin
        ? [
            {
              accessorKey: "cost_price",
              header: "Cost ₹",
              cell: ({ getValue }: { getValue: () => unknown }) =>
                getValue() != null ? `₹${(getValue() as number).toLocaleString("en-IN")}` : "—",
            } as ColumnDef<DeadStockItem>,
            {
              accessorKey: "total_value",
              header: "Total Value",
              cell: ({ getValue }: { getValue: () => unknown }) =>
                getValue() != null ? `₹${(getValue() as number).toLocaleString("en-IN")}` : "—",
            } as ColumnDef<DeadStockItem>,
          ]
        : []),
    ],
    [isAdmin]
  );

  const movementColumns = useMemo<ColumnDef<MovementItem>[]>(
    () => [
      { accessorKey: "date", header: "Date" },
      { accessorKey: "sku", header: "SKU", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
      { accessorKey: "product", header: "Product" },
      { accessorKey: "location", header: "Location" },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ getValue }) => {
          const t = getValue() as string;
          const isIn = ["receipt", "transfer_in", "return"].includes(t);
          return (
            <Badge variant="outline" className={`capitalize text-xs ${isIn ? "text-green-600 border-green-300" : "text-red-600 border-red-300"}`}>
              {t.replace("_", " ")}
            </Badge>
          );
        },
      },
      {
        accessorKey: "qty",
        header: "Qty",
        cell: ({ row }) => {
          const isIn = ["receipt", "transfer_in", "return"].includes(row.original.type);
          return (
            <span className={`font-semibold ${isIn ? "text-green-600" : "text-red-600"}`}>
              {isIn ? "+" : "-"}{row.original.qty}
            </span>
          );
        },
      },
      { accessorKey: "reference", header: "Reference" },
    ],
    []
  );

  const fastColumns = useMemo<ColumnDef<FastMovingItem>[]>(
    () => [
      { accessorKey: "sku", header: "SKU", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
      { accessorKey: "name", header: "Product" },
      { accessorKey: "movement_qty_30d", header: "Units Moved (30d)", cell: ({ getValue }) => <span className="font-semibold text-green-700">{getValue() as number}</span> },
      { accessorKey: "current_qty", header: "Current Stock" },
    ],
    []
  );

  const slowColumns = useMemo<ColumnDef<SlowMovingItem>[]>(
    () => [
      { accessorKey: "sku", header: "SKU", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
      { accessorKey: "name", header: "Product" },
      { accessorKey: "current_qty", header: "Qty" },
      ...(isAdmin
        ? [
            {
              accessorKey: "stale_value",
              header: "Stale Value",
              cell: ({ getValue }: { getValue: () => unknown }) =>
                getValue() != null ? `₹${(getValue() as number).toLocaleString("en-IN")}` : "—",
            } as ColumnDef<SlowMovingItem>,
          ]
        : []),
    ],
    [isAdmin]
  );

  const reportConfig = useMemo<
    Record<ReportKey, { data: unknown[]; columns: ColumnDef<unknown>[]; filename: string }>
  >(
    () => ({
      valuation: { data: data?.inventoryItems ?? [], columns: inventoryColumns as ColumnDef<unknown>[], filename: "inventory-valuation" },
      lowstock: { data: data?.reorderItems ?? [], columns: reorderColumns as ColumnDef<unknown>[], filename: "low-stock" },
      dead: { data: data?.deadStockItems ?? [], columns: deadStockColumns as ColumnDef<unknown>[], filename: "dead-stock" },
      movement: { data: data?.movItems ?? [], columns: movementColumns as ColumnDef<unknown>[], filename: "stock-movement" },
      fast: { data: data?.fastMovingItems ?? [], columns: fastColumns as ColumnDef<unknown>[], filename: "fast-moving" },
      slow: { data: data?.slowMovingItems ?? [], columns: slowColumns as ColumnDef<unknown>[], filename: "slow-moving" },
    }),
    [data, inventoryColumns, reorderColumns, deadStockColumns, movementColumns, fastColumns, slowColumns]
  );

  if (profile && !isAdmin) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Reports" subtitle="Inventory analytics and export" />
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Reports are only accessible to admins and managers.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Reports" subtitle="Inventory analytics and export" />

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6">
        {/* Report cards grid — 3 cols on md, 6 on xl */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {reportCards.map(({ key, title, description, icon: Icon, iconBg, iconColor, count }) => (
            <Card
              key={key}
              className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${activeReport === key ? "ring-2 ring-primary" : ""}`}
              onClick={() => setActiveReport(activeReport === key ? null : key)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className={`rounded-lg p-2.5 ${iconBg}`}>
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                  </div>
                  <span className="text-2xl font-bold">{isLoading ? "—" : count}</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardTitle className="text-xs font-semibold mb-1">{title}</CardTitle>
                <CardDescription className="text-[11px]">{description}</CardDescription>
                <div className="flex items-center gap-1 mt-3 text-xs text-primary font-medium">
                  {activeReport === key ? "Hide" : "View"}
                  <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active report table */}
        {activeReport && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm">
                  {reportCards.find((r) => r.key === activeReport)?.title}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {reportConfig[activeReport].data.length} results
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportToExcel(reportConfig[activeReport].data, reportConfig[activeReport].filename)
                }
              >
                <Download className="h-4 w-4 mr-1.5" />
                Export Excel
              </Button>
            </div>
            <DataTable
              data={reportConfig[activeReport].data}
              columns={reportConfig[activeReport].columns}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsPageContent />
    </Suspense>
  );
}
