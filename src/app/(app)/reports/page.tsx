"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";

// Stable row model factories — created once at module level
const coreRowModel = getCoreRowModel();
const sortedRowModel = getSortedRowModel();
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
import { Download, AlertTriangle, Clock, TrendingUp, ShieldCheck, ArrowRight } from "lucide-react";
import { useProfile } from "@/lib/hooks/useProfile";
import * as XLSX from "xlsx";

interface ReorderItem {
  id: string;
  sku: string;
  name: string;
  current_qty: number;
  reorder_point: number;
  reorder_qty: number;
  unit: string;
}

interface DeadStockItem {
  id: string;
  sku: string;
  name: string;
  current_qty: number;
  cost_price: number | null;
  total_value: number;
}

interface MarginItem {
  id: string;
  sku: string;
  name: string;
  selling_price: number;
  cost_price: number;
  margin: number;
  margin_pct: number;
}

interface WarrantyItem {
  id: string;
  sku: string;
  name: string;
  warranty_months: number;
  selling_price: number;
}

async function fetchReports() {
  const supabase = createClient();
  const [{ data: products }, { data: stockLevels }] = await Promise.all([
    supabase
      .from("products")
      .select("id, sku, name, cost_price, selling_price, reorder_point, reorder_qty, unit, warranty_months")
      .is("deleted_at", null)
      .eq("is_active", true),
    supabase.from("stock_levels").select("product_id, quantity"),
  ]);

  const stockByProduct = new Map<string, number>();
  for (const sl of stockLevels ?? []) {
    stockByProduct.set(sl.product_id, (stockByProduct.get(sl.product_id) ?? 0) + sl.quantity);
  }

  const reorderItems: ReorderItem[] = [];
  const deadStockItems: DeadStockItem[] = [];
  const marginItems: MarginItem[] = [];
  const warrantyItems: WarrantyItem[] = [];

  for (const p of products ?? []) {
    const qty = stockByProduct.get(p.id) ?? 0;
    if (qty <= p.reorder_point) {
      reorderItems.push({ id: p.id, sku: p.sku, name: p.name, current_qty: qty, reorder_point: p.reorder_point, reorder_qty: p.reorder_qty, unit: p.unit });
    }
    if (p.reorder_point > 0 && qty > p.reorder_point * 10) {
      deadStockItems.push({ id: p.id, sku: p.sku, name: p.name, current_qty: qty, cost_price: p.cost_price, total_value: qty * (p.cost_price ?? p.selling_price ?? 0) });
    }
    if (p.cost_price && p.cost_price > 0) {
      const margin = p.selling_price - p.cost_price;
      marginItems.push({ id: p.id, sku: p.sku, name: p.name, selling_price: p.selling_price, cost_price: p.cost_price, margin, margin_pct: (margin / p.cost_price) * 100 });
    }
    if (p.warranty_months && p.warranty_months > 0) {
      warrantyItems.push({ id: p.id, sku: p.sku, name: p.name, warranty_months: p.warranty_months, selling_price: p.selling_price });
    }
  }
  marginItems.sort((a, b) => b.margin_pct - a.margin_pct);
  return { reorderItems, deadStockItems, marginItems, warrantyItems };
}

function exportToExcel(data: unknown[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// Must be outside page component to avoid remounting
function DataTable<T>({ data, columns, isLoading }: { data: T[]; columns: ColumnDef<T>[]; isLoading: boolean }) {
  const table = useReactTable({ data, columns, getCoreRowModel: coreRowModel, getSortedRowModel: sortedRowModel });
  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
              {hg.headers.map((h) => (
                <TableHead key={h.id} onClick={h.column.getToggleSortingHandler()} className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
          ) : data.length === 0 ? (
            <TableRow><TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">No data</TableCell></TableRow>
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
  );
}

type ReportKey = "reorder" | "dead" | "margin" | "warranty";

export default function ReportsPage() {
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const [activeReport, setActiveReport] = useState<ReportKey | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: fetchReports,
  });

  const reportCards = useMemo(
    () =>
      [
        {
          key: "reorder" as ReportKey,
          title: "Reorder Suggestions",
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
          description: "Products with excess stock (10x reorder point)",
          icon: Clock,
          iconBg: "bg-orange-50",
          iconColor: "text-orange-600",
          count: data?.deadStockItems.length ?? 0,
          countLabel: "excess stock items",
          show: true,
        },
        {
          key: "margin" as ReportKey,
          title: "Margin Analysis",
          description: "Selling price vs cost price breakdown",
          icon: TrendingUp,
          iconBg: "bg-green-50",
          iconColor: "text-green-600",
          count: data?.marginItems.length ?? 0,
          countLabel: "products with margin data",
          show: isAdmin,
        },
        {
          key: "warranty" as ReportKey,
          title: "Warranty Tracker",
          description: "Products with warranty information",
          icon: ShieldCheck,
          iconBg: "bg-blue-50",
          iconColor: "text-primary",
          count: data?.warrantyItems.length ?? 0,
          countLabel: "products with warranty",
          show: true,
        },
      ].filter((r) => r.show),
    [data, isAdmin]
  );

  const reorderColumns = useMemo<ColumnDef<ReorderItem>[]>(
    () => [
      { accessorKey: "sku", header: "SKU" },
      { accessorKey: "name", header: "Product" },
      { accessorKey: "current_qty", header: "Current Qty" },
      { accessorKey: "reorder_point", header: "Reorder Point" },
      { accessorKey: "reorder_qty", header: "Suggested Order" },
      { accessorKey: "unit", header: "Unit" },
      { id: "urgency", header: "Urgency", cell: ({ row }) => row.original.current_qty === 0 ? <Badge variant="destructive">Critical</Badge> : <Badge variant="outline" className="text-yellow-600 border-yellow-400">Low</Badge> },
    ],
    []
  );

  const deadStockColumns = useMemo<ColumnDef<DeadStockItem>[]>(
    () => [
      { accessorKey: "sku", header: "SKU" },
      { accessorKey: "name", header: "Product" },
      { accessorKey: "current_qty", header: "Qty" },
      ...(isAdmin ? [
        { accessorKey: "cost_price", header: "Cost ₹", cell: ({ getValue }: { getValue: () => unknown }) => getValue() != null ? `₹${(getValue() as number).toLocaleString("en-IN")}` : "—" } as ColumnDef<DeadStockItem>,
        { accessorKey: "total_value", header: "Total Value ₹", cell: ({ getValue }: { getValue: () => unknown }) => `₹${(getValue() as number).toLocaleString("en-IN")}` } as ColumnDef<DeadStockItem>,
      ] : []),
    ],
    [isAdmin]
  );

  const marginColumns = useMemo<ColumnDef<MarginItem>[]>(
    () => [
      { accessorKey: "sku", header: "SKU" },
      { accessorKey: "name", header: "Product" },
      { accessorKey: "selling_price", header: "Selling ₹", cell: ({ getValue }) => `₹${(getValue() as number).toLocaleString("en-IN")}` },
      { accessorKey: "cost_price", header: "Cost ₹", cell: ({ getValue }) => `₹${(getValue() as number).toLocaleString("en-IN")}` },
      { accessorKey: "margin", header: "Margin ₹", cell: ({ getValue }) => `₹${(getValue() as number).toLocaleString("en-IN")}` },
      { accessorKey: "margin_pct", header: "Margin %", cell: ({ getValue }) => `${(getValue() as number).toFixed(1)}%` },
    ],
    []
  );

  const warrantyColumns = useMemo<ColumnDef<WarrantyItem>[]>(
    () => [
      { accessorKey: "sku", header: "SKU" },
      { accessorKey: "name", header: "Product" },
      { accessorKey: "warranty_months", header: "Warranty (months)" },
      { accessorKey: "selling_price", header: "Selling ₹", cell: ({ getValue }) => `₹${(getValue() as number).toLocaleString("en-IN")}` },
    ],
    []
  );

  const reportConfig = useMemo<Record<ReportKey, { data: unknown[]; columns: ColumnDef<unknown>[]; filename: string }>>(
    () => ({
      reorder: { data: data?.reorderItems ?? [], columns: reorderColumns as ColumnDef<unknown>[], filename: "reorder-suggestions" },
      dead: { data: data?.deadStockItems ?? [], columns: deadStockColumns as ColumnDef<unknown>[], filename: "dead-stock" },
      margin: { data: data?.marginItems ?? [], columns: marginColumns as ColumnDef<unknown>[], filename: "margin-report" },
      warranty: { data: data?.warrantyItems ?? [], columns: warrantyColumns as ColumnDef<unknown>[], filename: "warranty-tracker" },
    }),
    [data, reorderColumns, deadStockColumns, marginColumns, warrantyColumns]
  );

  return (
    <div className="flex flex-col h-full">
      <Header title="Reports" subtitle="Business intelligence and analytics" />

      <div className="flex-1 p-6 space-y-6">
        {/* Report cards grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reportCards.map(({ key, title, description, icon: Icon, iconBg, iconColor, count, countLabel }) => (
            <Card
              key={key}
              className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${activeReport === key ? "ring-2 ring-primary" : ""}`}
              onClick={() => setActiveReport(activeReport === key ? null : key)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className={`rounded-lg p-2.5 ${iconBg}`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                  </div>
                  <span className="text-2xl font-bold">{isLoading ? "—" : count}</span>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-sm font-semibold mb-1">{title}</CardTitle>
                <CardDescription className="text-xs">{description}</CardDescription>
                <div className="flex items-center gap-1 mt-3 text-xs text-primary font-medium">
                  {activeReport === key ? "Hide report" : "View report"}
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
              <h2 className="font-semibold text-sm">
                {reportCards.find((r) => r.key === activeReport)?.title}
                <span className="ml-2 text-muted-foreground font-normal">
                  — {reportConfig[activeReport].data.length} results
                </span>
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToExcel(reportConfig[activeReport].data, reportConfig[activeReport].filename)}
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
