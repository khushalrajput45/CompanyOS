"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";

// Stable row model factories — created once at module level
const coreRowModel = getCoreRowModel();
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
    .select("*, product:products(id,sku,name,reorder_point), location:locations(id,name)")
    .order("quantity");
  return (data ?? []) as StockLevel[];
}

async function fetchMovements() {
  const supabase = createClient();
  const { data } = await supabase
    .from("stock_movements")
    .select("*, product:products(id,sku,name), location:locations(id,name), vendor:vendors(id,name)")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as StockMovement[];
}

function StockTable({
  data,
  columns,
  loading,
  emptyMsg,
  globalFilter,
}: {
  data: StockLevel[];
  columns: ColumnDef<StockLevel>[];
  loading: boolean;
  emptyMsg: string;
  globalFilter: string;
}) {
  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    getCoreRowModel: coreRowModel,
    getFilteredRowModel: filteredRowModel,
  });

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
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
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                Loading...
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                {emptyMsg}
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
  );
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

  const stockColumns = useMemo<ColumnDef<StockLevel>[]>(
    () => [
      { accessorFn: (r) => r.product?.sku, header: "SKU" },
      { accessorFn: (r) => r.product?.name, header: "Product" },
      { accessorFn: (r) => r.location?.name, header: "Location" },
      {
        accessorKey: "quantity",
        header: "Qty on Hand",
        cell: ({ row }) => {
          const qty = row.original.quantity;
          const reorder = row.original.product?.reorder_point ?? 0;
          return (
            <span className={qty === 0 ? "text-red-600 font-semibold" : qty <= reorder ? "text-yellow-600 font-semibold" : "font-medium"}>
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
          if (qty === 0) return <Badge variant="destructive">Out of Stock</Badge>;
          if (qty <= reorder) return <Badge variant="outline" className="text-yellow-600 border-yellow-400">Low Stock</Badge>;
          return <Badge className="bg-green-100 text-green-700 border-green-200">In Stock</Badge>;
        },
      },
      {
        accessorFn: (r) => r.product?.reorder_point,
        header: "Reorder Point",
      },
    ],
    []
  );

  const movementColumns = useMemo<ColumnDef<StockMovement>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: "Date",
        cell: ({ getValue }) => format(new Date(getValue() as string), "dd MMM yyyy HH:mm"),
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
      { accessorKey: "quantity", header: "Qty" },
      { accessorKey: "reference_no", header: "Ref#" },
      { accessorKey: "notes", header: "Notes" },
    ],
    []
  );

  const movementTable = useReactTable({
    data: movements,
    columns: movementColumns,
    state: { globalFilter },
    getCoreRowModel: coreRowModel,
    getFilteredRowModel: filteredRowModel,
  });

  const lowStock = useMemo(
    () =>
      stockLevels.filter((sl) => {
        const reorder = sl.product?.reorder_point ?? 0;
        return sl.quantity > 0 && sl.quantity <= reorder;
      }),
    [stockLevels]
  );

  const outOfStock = useMemo(
    () => stockLevels.filter((sl) => sl.quantity === 0),
    [stockLevels]
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Inventory"
        subtitle={`${stockLevels.length} stock locations`}
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Record Movement
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search inventory..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Tabs defaultValue="current">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="current">
              Current Stock
              <Badge variant="secondary" className="ml-2 text-xs">{stockLevels.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="low">
              Low Stock
              <Badge variant="outline" className="ml-2 text-xs text-yellow-600 border-yellow-400">{lowStock.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="out">
              Out of Stock
              <Badge variant="destructive" className="ml-2 text-xs">{outOfStock.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="movements">Stock Movement</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="mt-4">
            <StockTable
              data={stockLevels}
              columns={stockColumns}
              loading={levelsLoading}
              emptyMsg="No stock data"
              globalFilter={globalFilter}
            />
          </TabsContent>

          <TabsContent value="low" className="mt-4">
            <StockTable
              data={lowStock}
              columns={stockColumns}
              loading={levelsLoading}
              emptyMsg="No low stock items"
              globalFilter={globalFilter}
            />
          </TabsContent>

          <TabsContent value="out" className="mt-4">
            <StockTable
              data={outOfStock}
              columns={stockColumns}
              loading={levelsLoading}
              emptyMsg="No out-of-stock items"
              globalFilter={globalFilter}
            />
          </TabsContent>

          <TabsContent value="movements" className="mt-4">
            <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  {movementTable.getHeaderGroups().map((hg) => (
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
                  {movementsLoading ? (
                    <TableRow>
                      <TableCell colSpan={movementColumns.length} className="text-center py-12 text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : movementTable.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={movementColumns.length} className="text-center py-12 text-muted-foreground">
                        No movements recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    movementTable.getRowModel().rows.map((row) => (
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
