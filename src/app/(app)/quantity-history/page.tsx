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
import { Search } from "lucide-react";
import type { StockMovement } from "@/lib/types";
import { format } from "date-fns";

async function fetchMovementLedger(productId?: string) {
  const supabase = createClient();
  let q = supabase
    .from("stock_movements")
    .select(
      "*, product:products(id,sku,name), location:locations(id,name)"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (productId) q = q.eq("product_id", productId);
  const { data } = await q;
  return (data ?? []) as StockMovement[];
}

export default function QuantityHistoryPage() {
  const [selectedProduct, setSelectedProduct] = useState<string>("");
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
    queryFn: () => fetchMovementLedger(selectedProduct || undefined),
  });

  const columns: ColumnDef<StockMovement>[] = [
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ getValue }) =>
        format(new Date(getValue() as string), "dd MMM yyyy HH:mm"),
    },
    { accessorFn: (r) => r.product?.sku, header: "SKU" },
    { accessorFn: (r) => r.product?.name, header: "Product" },
    { accessorFn: (r) => r.location?.name, header: "Location" },
    {
      accessorKey: "movement_type",
      header: "Type",
      cell: ({ getValue }) => (
        <Badge variant="outline" className="capitalize">
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
        const isOut = ["sale", "transfer_out", "damage"].includes(type);
        return (
          <span className={isOut ? "text-red-600" : "text-green-600"}>
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
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      <Header title="Quantity History" />
      <div className="p-6 space-y-4">
        <div className="flex gap-4">
          <Select
            value={selectedProduct}
            onValueChange={setSelectedProduct}
          >
            <SelectTrigger className="w-72">
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All products</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9"
            />
          </div>
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
                    No movements found
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
