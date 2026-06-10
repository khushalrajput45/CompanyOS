"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search } from "lucide-react";
import { StockMovementForm } from "./stock-movement-form";
import type { StockLevel, StockMovement } from "@/lib/types";
import { format } from "date-fns";

async function fetchStockLevels() {
  const supabase = createClient();
  const { data } = await supabase
    .from("stock_levels")
    .select(
      "*, product:products(id,sku,name,reorder_point), location:locations(id,name)"
    )
    .order("quantity");
  return (data ?? []) as StockLevel[];
}

async function fetchMovements() {
  const supabase = createClient();
  const { data } = await supabase
    .from("stock_movements")
    .select(
      "*, product:products(id,sku,name), location:locations(id,name), vendor:vendors(id,name)"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as StockMovement[];
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [globalFilter, setGlobalFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: stockLevels = [], isLoading: levelsLoading } = useQuery({
    queryKey: ["stock-levels"],
    queryFn: fetchStockLevels,
  });

  const { data: movements = [], isLoading: movementsLoading } = useQuery({
    queryKey: ["stock-movements"],
    queryFn: fetchMovements,
  });

  const levelColumns: ColumnDef<StockLevel>[] = [
    { accessorFn: (r) => r.product?.sku, header: "SKU" },
    { accessorFn: (r) => r.product?.name, header: "Product" },
    { accessorFn: (r) => r.location?.name, header: "Location" },
    {
      accessorKey: "quantity",
      header: "Qty",
      cell: ({ row }) => {
        const qty = row.original.quantity;
        const reorder = row.original.product?.reorder_point ?? 0;
        return (
          <span
            className={
              qty === 0
                ? "text-red-600 font-semibold"
                : qty <= reorder
                ? "text-yellow-600 font-semibold"
                : ""
            }
          >
            {qty}
          </span>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const qty = row.original.quantity;
        const reorder = row.original.product?.reorder_point ?? 0;
        if (qty === 0)
          return <Badge variant="destructive">Out of Stock</Badge>;
        if (qty <= reorder)
          return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Low Stock</Badge>;
        return <Badge variant="secondary">OK</Badge>;
      },
    },
  ];

  const movementColumns: ColumnDef<StockMovement>[] = [
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
    { accessorKey: "quantity", header: "Qty" },
    { accessorKey: "reference_no", header: "Ref#" },
    { accessorKey: "notes", header: "Notes" },
  ];

  const levelTable = useReactTable({
    data: stockLevels,
    columns: levelColumns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const movementTable = useReactTable({
    data: movements,
    columns: movementColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      <Header title="Inventory" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search inventory..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Record Movement
          </Button>
        </div>

        <Tabs defaultValue="levels">
          <TabsList>
            <TabsTrigger value="levels">Stock Levels</TabsTrigger>
            <TabsTrigger value="movements">Movements</TabsTrigger>
          </TabsList>

          <TabsContent value="levels" className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {levelTable.getHeaderGroups().map((hg) => (
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
                  {levelsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : levelTable.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No stock data
                      </TableCell>
                    </TableRow>
                  ) : (
                    levelTable.getRowModel().rows.map((row) => (
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
          </TabsContent>

          <TabsContent value="movements" className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {movementTable.getHeaderGroups().map((hg) => (
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
                  {movementsLoading ? (
                    <TableRow>
                      <TableCell colSpan={movementColumns.length} className="text-center py-8 text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : movementTable.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={movementColumns.length} className="text-center py-8 text-muted-foreground">
                        No movements recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    movementTable.getRowModel().rows.map((row) => (
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
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Stock Movement</DialogTitle>
          </DialogHeader>
          <StockMovementForm
            onSuccess={() => {
              setDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
              queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
