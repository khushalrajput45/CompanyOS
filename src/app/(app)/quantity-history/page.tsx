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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Download } from "lucide-react";
import type { StockMovement } from "@/lib/types";
import { format } from "date-fns";
import * as XLSX from "xlsx";

async function fetchMovementLedger(productId?: string) {
  const supabase = createClient();
  let q = supabase
    .from("stock_movements")
    .select("*, product:products(id,sku,name), location:locations(id,name)")
    .order("created_at", { ascending: false })
    .limit(500);

  if (productId) q = q.eq("product_id", productId);
  const { data } = await q;
  return (data ?? []) as StockMovement[];
}

const OUT_TYPES = ["sale", "transfer_out", "damage"];

export default function QuantityHistoryPage() {
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [globalFilter, setGlobalFilter] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("id, sku, name")
        .is("deleted_at", null)
        .order("name");
      return data ?? [];
    },
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["quantity-history", selectedProduct],
    queryFn: () => fetchMovementLedger(selectedProduct === "all" ? undefined : selectedProduct),
  });

  const columns: ColumnDef<StockMovement>[] = [
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ getValue }) => { const v = getValue() as string | null; return v ? format(new Date(v), "dd MMM yyyy HH:mm") : "—"; },
    },
    { accessorFn: (r) => r.product?.sku, header: "SKU" },
    { accessorFn: (r) => r.product?.name, header: "Product" },
    { accessorFn: (r) => r.location?.name, header: "Location" },
    {
      accessorKey: "movement_type",
      header: "Type",
      cell: ({ getValue }) => (
        <Badge variant="outline" className="capitalize text-xs">
          {(getValue() as string).replace("_", " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "quantity",
      header: "Qty",
      cell: ({ row }) => {
        const type = row.original.movement_type;
        const qty = row.original.quantity;
        const isOut = OUT_TYPES.includes(type);
        return (
          <span className={`font-semibold ${isOut ? "text-red-600" : "text-green-600"}`}>
            {isOut ? "-" : "+"}
            {qty}
          </span>
        );
      },
    },
    { accessorKey: "reference_no", header: "Ref#" },
    { accessorKey: "notes", header: "Notes" },
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
    const rows = table.getFilteredRowModel().rows.map((r) => ({
      date: r.original.created_at ? format(new Date(r.original.created_at), "dd MMM yyyy") : "",
      sku: r.original.product?.sku,
      product: r.original.product?.name,
      location: r.original.location?.name,
      type: r.original.movement_type,
      qty: OUT_TYPES.includes(r.original.movement_type) ? -r.original.quantity : r.original.quantity,
      ref: r.original.reference_no,
      notes: r.original.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Qty History");
    XLSX.writeFile(wb, "quantity-history.xlsx");
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Quantity History"
        subtitle={`${table.getFilteredRowModel().rows.length} records`}
        actions={
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-4">
        <div className="flex flex-wrap gap-3">
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="w-72 h-9">
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
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
                    No movements found
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
