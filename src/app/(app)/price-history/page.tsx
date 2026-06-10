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
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
import type { PriceHistory } from "@/lib/types";
import { format } from "date-fns";
import { useProfile } from "@/lib/hooks/useProfile";

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
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const [globalFilter, setGlobalFilter] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["price-history"],
    queryFn: fetchPriceHistory,
  });

  const columns: ColumnDef<PriceHistory>[] = [
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ getValue }) =>
        format(new Date(getValue() as string), "dd MMM yyyy HH:mm"),
    },
    { accessorFn: (r) => r.product?.sku, header: "SKU" },
    { accessorFn: (r) => r.product?.name, header: "Product" },
    {
      accessorKey: "old_selling_price",
      header: "Old Selling ₹",
      cell: ({ getValue }) =>
        getValue() != null
          ? `₹${(getValue() as number).toLocaleString("en-IN")}`
          : "—",
    },
    {
      accessorKey: "new_selling_price",
      header: "New Selling ₹",
      cell: ({ getValue }) =>
        `₹${(getValue() as number).toLocaleString("en-IN")}`,
    },
    ...(isAdmin
      ? [
          {
            accessorKey: "old_cost_price",
            header: "Old Cost ₹",
            cell: ({ getValue }: { getValue: () => unknown }) =>
              getValue() != null
                ? `₹${(getValue() as number).toLocaleString("en-IN")}`
                : "—",
          } as ColumnDef<PriceHistory>,
          {
            accessorKey: "new_cost_price",
            header: "New Cost ₹",
            cell: ({ getValue }: { getValue: () => unknown }) =>
              getValue() != null
                ? `₹${(getValue() as number).toLocaleString("en-IN")}`
                : "—",
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
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      <Header title="Price History" />
      <div className="p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                    No price history found
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
        <p className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} records
        </p>
      </div>
    </div>
  );
}
