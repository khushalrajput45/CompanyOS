"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";

const coreRowModel     = getCoreRowModel();
const filteredRowModel = getFilteredRowModel();
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Download, TrendingUp, TrendingDown } from "lucide-react";
import type { PriceHistory } from "@/lib/types";
import { format } from "date-fns";
import { useProfile } from "@/lib/hooks/useProfile";
import * as XLSX from "xlsx";

async function fetchPriceHistory() {
  const supabase = createClient();
  const { data } = await supabase
    .from("price_history")
    .select("*, product:products(id,sku,name)")
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []) as PriceHistory[];
}

export default function PriceHistoryPage() {
  const { data: profile } = useProfile();
  const isAdmin = ["owner","admin","manager"].includes(profile?.role ?? "");
  const [globalFilter, setGlobalFilter] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["price-history"],
    queryFn: fetchPriceHistory,
  });

  const columns: ColumnDef<PriceHistory>[] = [
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ getValue }) => { const v = getValue() as string | null; return v ? format(new Date(v), "dd MMM yyyy HH:mm") : "—"; },
    },
    { accessorFn: (r) => r.product?.sku, header: "SKU" },
    { accessorFn: (r) => r.product?.name, header: "Product" },
    {
      accessorKey: "old_selling_price",
      header: "Old Selling ₹",
      cell: ({ getValue }) =>
        getValue() != null ? `₹${(getValue() as number).toLocaleString("en-IN")}` : "—",
    },
    {
      accessorKey: "new_selling_price",
      header: "New Selling ₹",
      cell: ({ row, getValue }) => {
        const up = (getValue() as number) > (row.original.old_selling_price ?? 0);
        return (
          <span className={`flex items-center gap-1 font-medium ${up ? "text-green-600" : "text-red-600"}`}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            ₹{(getValue() as number).toLocaleString("en-IN")}
          </span>
        );
      },
    },
    ...(isAdmin
      ? [
          {
            accessorKey: "old_cost_price",
            header: "Old Cost ₹",
            cell: ({ getValue }: { getValue: () => unknown }) =>
              getValue() != null ? `₹${(getValue() as number).toLocaleString("en-IN")}` : "—",
          } as ColumnDef<PriceHistory>,
          {
            accessorKey: "new_cost_price",
            header: "New Cost ₹",
            cell: ({ getValue }: { getValue: () => unknown }) =>
              getValue() != null ? `₹${(getValue() as number).toLocaleString("en-IN")}` : "—",
          } as ColumnDef<PriceHistory>,
        ]
      : []),
    { accessorKey: "reason", header: "Reason" },
  ];

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: coreRowModel,
    getFilteredRowModel: filteredRowModel,
  });

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(
      data.map((r) => ({
        date: r.created_at ? format(new Date(r.created_at), "dd MMM yyyy") : "",
        sku: r.product?.sku,
        product: r.product?.name,
        old_selling: r.old_selling_price,
        new_selling: r.new_selling_price,
        reason: r.reason,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Price History");
    XLSX.writeFile(wb, "price-history.xlsx");
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Price History"
        subtitle={`${table.getFilteredRowModel().rows.length} records`}
        actions={
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by product or SKU..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                  {hg.headers.map((h) => (
                    <TableHead key={h.id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                    No price history found
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
      </div>
    </div>
  );
}
