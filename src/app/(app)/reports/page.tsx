"use client";

import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download } from "lucide-react";
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
      .select(
        "id, sku, name, cost_price, selling_price, reorder_point, reorder_qty, unit, warranty_months"
      )
      .is("deleted_at", null)
      .eq("is_active", true),
    supabase.from("stock_levels").select("product_id, quantity"),
  ]);

  const stockByProduct = new Map<string, number>();
  for (const sl of stockLevels ?? []) {
    stockByProduct.set(
      sl.product_id,
      (stockByProduct.get(sl.product_id) ?? 0) + sl.quantity
    );
  }

  const reorderItems: ReorderItem[] = [];
  const deadStockItems: DeadStockItem[] = [];
  const marginItems: MarginItem[] = [];
  const warrantyItems: WarrantyItem[] = [];

  for (const p of products ?? []) {
    const qty = stockByProduct.get(p.id) ?? 0;

    // Reorder: at or below reorder point
    if (qty <= p.reorder_point) {
      reorderItems.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        current_qty: qty,
        reorder_point: p.reorder_point,
        reorder_qty: p.reorder_qty,
        unit: p.unit,
      });
    }

    // Dead stock: only meaningful when reorder_point > 0 and qty is 10x over it
    if (p.reorder_point > 0 && qty > p.reorder_point * 10) {
      deadStockItems.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        current_qty: qty,
        cost_price: p.cost_price,
        total_value: qty * (p.cost_price ?? p.selling_price ?? 0),
      });
    }

    if (p.cost_price && p.cost_price > 0) {
      const margin = p.selling_price - p.cost_price;
      marginItems.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        selling_price: p.selling_price,
        cost_price: p.cost_price,
        margin,
        margin_pct: (margin / p.cost_price) * 100,
      });
    }

    if (p.warranty_months && p.warranty_months > 0) {
      warrantyItems.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        warranty_months: p.warranty_months,
        selling_price: p.selling_price,
      });
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

// Defined outside ReportsPage to prevent remounting on every render
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
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead
                  key={h.id}
                  onClick={h.column.getToggleSortingHandler()}
                  className="cursor-pointer select-none"
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
              <TableCell
                colSpan={columns.length}
                className="text-center py-8 text-muted-foreground"
              >
                Loading...
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-center py-8 text-muted-foreground"
              >
                No data
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
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

export default function ReportsPage() {
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: fetchReports,
  });

  const reorderColumns: ColumnDef<ReorderItem>[] = [
    { accessorKey: "sku", header: "SKU" },
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
          <Badge variant="destructive">Critical</Badge>
        ) : (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
            Low
          </Badge>
        ),
    },
  ];

  const deadStockColumns: ColumnDef<DeadStockItem>[] = [
    { accessorKey: "sku", header: "SKU" },
    { accessorKey: "name", header: "Product" },
    { accessorKey: "current_qty", header: "Qty" },
    ...(isAdmin
      ? [
          {
            accessorKey: "cost_price",
            header: "Cost ₹",
            cell: ({ getValue }: { getValue: () => unknown }) =>
              getValue() != null
                ? `₹${(getValue() as number).toLocaleString("en-IN")}`
                : "—",
          } as ColumnDef<DeadStockItem>,
          {
            accessorKey: "total_value",
            header: "Total Value ₹",
            cell: ({ getValue }: { getValue: () => unknown }) =>
              `₹${(getValue() as number).toLocaleString("en-IN")}`,
          } as ColumnDef<DeadStockItem>,
        ]
      : []),
  ];

  const marginColumns: ColumnDef<MarginItem>[] = [
    { accessorKey: "sku", header: "SKU" },
    { accessorKey: "name", header: "Product" },
    {
      accessorKey: "selling_price",
      header: "Selling ₹",
      cell: ({ getValue }) =>
        `₹${(getValue() as number).toLocaleString("en-IN")}`,
    },
    {
      accessorKey: "cost_price",
      header: "Cost ₹",
      cell: ({ getValue }) =>
        `₹${(getValue() as number).toLocaleString("en-IN")}`,
    },
    {
      accessorKey: "margin",
      header: "Margin ₹",
      cell: ({ getValue }) =>
        `₹${(getValue() as number).toLocaleString("en-IN")}`,
    },
    {
      accessorKey: "margin_pct",
      header: "Margin %",
      cell: ({ getValue }) => `${(getValue() as number).toFixed(1)}%`,
    },
  ];

  const warrantyColumns: ColumnDef<WarrantyItem>[] = [
    { accessorKey: "sku", header: "SKU" },
    { accessorKey: "name", header: "Product" },
    { accessorKey: "warranty_months", header: "Warranty (months)" },
    {
      accessorKey: "selling_price",
      header: "Selling ₹",
      cell: ({ getValue }) =>
        `₹${(getValue() as number).toLocaleString("en-IN")}`,
    },
  ];

  return (
    <div>
      <Header title="Reports" />
      <div className="p-6 space-y-4">
        <Tabs defaultValue="reorder">
          <TabsList>
            <TabsTrigger value="reorder">Reorder Suggestions</TabsTrigger>
            <TabsTrigger value="dead">Dead Stock</TabsTrigger>
            {isAdmin && <TabsTrigger value="margin">Margin</TabsTrigger>}
            <TabsTrigger value="warranty">Warranty</TabsTrigger>
          </TabsList>

          <TabsContent value="reorder" className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {data?.reorderItems.length ?? 0} products need reordering
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportToExcel(data?.reorderItems ?? [], "reorder-suggestions")
                }
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
            <DataTable
              data={data?.reorderItems ?? []}
              columns={reorderColumns}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="dead" className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {data?.deadStockItems.length ?? 0} products with excess stock
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportToExcel(data?.deadStockItems ?? [], "dead-stock")
                }
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
            <DataTable
              data={data?.deadStockItems ?? []}
              columns={deadStockColumns}
              isLoading={isLoading}
            />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="margin" className="mt-4 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {data?.marginItems.length ?? 0} products with margin data
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportToExcel(data?.marginItems ?? [], "margin-report")
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
              <DataTable
                data={data?.marginItems ?? []}
                columns={marginColumns}
                isLoading={isLoading}
              />
            </TabsContent>
          )}

          <TabsContent value="warranty" className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {data?.warrantyItems.length ?? 0} products with warranty
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportToExcel(data?.warrantyItems ?? [], "warranty-expiry")
                }
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
            <DataTable
              data={data?.warrantyItems ?? []}
              columns={warrantyColumns}
              isLoading={isLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
