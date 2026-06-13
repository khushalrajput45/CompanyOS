"use client";

import { useState, useMemo, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { StockMovementForm } from "./stock-movement-form";
import type { StockLevel, StockMovement } from "@/lib/types";
import { format } from "date-fns";
import { useProfile } from "@/lib/hooks/useProfile";

// Stable row model factories
const coreRowModel = getCoreRowModel();
const filteredRowModel = getFilteredRowModel();
const paginationRowModel = getPaginationRowModel();

async function fetchStockLevels() {
  const supabase = createClient();
  const { data } = await supabase
    .from("stock_levels")
    .select(
      "*, product:products(id,sku,name,reorder_point,cost_price,selling_price), location:locations(id,name)"
    )
    .order("quantity");
  return (data ?? []) as (StockLevel & {
    product: { id: string; sku: string; name: string; reorder_point: number; cost_price: number | null; selling_price: number } | null;
  })[];
}

async function fetchMovements() {
  const supabase = createClient();
  const { data } = await supabase
    .from("stock_movements")
    .select(
      "*, product:products(id,sku,name), location:locations(id,name), vendor:vendors(id,name)"
    )
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []) as StockMovement[];
}

type EnrichedStockLevel = StockLevel & {
  product: { id: string; sku: string; name: string; reorder_point: number; cost_price: number | null; selling_price: number } | null;
};

// Defined at module scope to prevent remounting
function StockTable({
  data,
  columns,
  loading,
  emptyMsg,
  globalFilter,
}: {
  data: EnrichedStockLevel[];
  columns: ColumnDef<EnrichedStockLevel>[];
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
    getPaginationRowModel: paginationRowModel,
    initialState: { pagination: { pageSize: 25 } },
  });

  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
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

const IN_TYPES  = ["receipt", "transfer_in", "return", "adjustment"];
const OUT_TYPES = ["sale", "transfer_out", "damage"];
type TabValue = "current" | "low" | "out" | "movements";

function InventoryPageContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  // URL-driven initial state
  const [activeTab, setActiveTab]     = useState<TabValue>((searchParams.get("tab") as TabValue) ?? "current");
  const [movTypeFilter, setMovTypeFilter] = useState<"all"|"in"|"out">((searchParams.get("movType") as "all"|"in"|"out") ?? "all");
  const [movDateFilter, setMovDateFilter] = useState<"all"|"today">((searchParams.get("movDate") as "all"|"today") ?? "all");
  const [movRefFilter, setMovRefFilter]   = useState(searchParams.get("movRef") ?? "");

  const [globalFilter, setGlobalFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: stockLevels = [], isLoading: levelsLoading } = useQuery({
    queryKey: ["stock-levels"],
    queryFn: fetchStockLevels,
    staleTime: 30000,
  });

  const { data: movements = [], isLoading: movementsLoading } = useQuery({
    queryKey: ["stock-movements"],
    queryFn: fetchMovements,
    staleTime: 30000,
  });

  const stockColumns = useMemo<ColumnDef<EnrichedStockLevel>[]>(
    () => [
      {
        accessorFn: (r) => r.product?.sku,
        header: "SKU",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>
        ),
      },
      {
        accessorFn: (r) => r.product?.name,
        header: "Product",
        cell: ({ getValue }) => (
          <span className="font-medium text-sm">{getValue() as string}</span>
        ),
      },
      {
        accessorFn: (r) => r.location?.name,
        header: "Location",
      },
      {
        accessorKey: "quantity",
        header: "Current Stock",
        cell: ({ row }) => {
          const qty = row.original.quantity;
          const reorder = row.original.product?.reorder_point ?? 0;
          return (
            <span className={`font-semibold ${qty === 0 ? "text-red-600" : qty <= reorder ? "text-yellow-600" : "text-foreground"}`}>
              {qty}
            </span>
          );
        },
      },
      {
        id: "available_stock",
        header: "Available Stock",
        cell: ({ row }) => {
          const qty = row.original.quantity;
          return <span className="font-medium">{qty}</span>;
        },
      },
      {
        accessorFn: (r) => r.product?.reorder_point,
        header: "Reorder Level",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue() as number}</span>
        ),
      },
      ...(isAdmin
        ? [
            {
              id: "inventory_value",
              header: "Inventory Value",
              cell: ({ row }: { row: { original: EnrichedStockLevel } }) => {
                const qty = row.original.quantity;
                const p = row.original.product;
                const price = p?.cost_price ?? p?.selling_price ?? 0;
                return (
                  <span className="font-medium">
                    ₹{(qty * price).toLocaleString("en-IN")}
                  </span>
                );
              },
            } as ColumnDef<EnrichedStockLevel>,
          ]
        : []),
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const qty = row.original.quantity;
          const reorder = row.original.product?.reorder_point ?? 0;
          if (qty === 0)
            return <Badge variant="destructive" className="text-xs">Out of Stock</Badge>;
          if (qty <= reorder)
            return <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-xs">Low Stock</Badge>;
          return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">In Stock</Badge>;
        },
      },
    ],
    [isAdmin]
  );

  const movementColumns = useMemo<ColumnDef<StockMovement>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: "Date",
        cell: ({ getValue }) => format(new Date(getValue() as string), "dd MMM yyyy HH:mm"),
      },
      { accessorFn: (r) => r.product?.sku, header: "SKU",
        cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span>,
      },
      { accessorFn: (r) => (r.product as { name?: string } | null)?.name, header: "Product" },
      { accessorFn: (r) => (r.location as { name?: string } | null)?.name, header: "Location" },
      {
        accessorKey: "movement_type",
        header: "Type",
        cell: ({ getValue }) => {
          const t = getValue() as string;
          const isIn = ["receipt", "transfer_in", "return"].includes(t);
          return (
            <Badge
              variant="outline"
              className={`capitalize text-xs ${isIn ? "text-green-600 border-green-300 bg-green-50" : "text-red-600 border-red-300 bg-red-50"}`}
            >
              {t.replace("_", " ")}
            </Badge>
          );
        },
      },
      {
        accessorKey: "quantity",
        header: "Qty",
        cell: ({ row }) => {
          const t = row.original.movement_type;
          const isIn = ["receipt", "transfer_in", "return"].includes(t);
          return (
            <span className={`font-semibold ${isIn ? "text-green-600" : "text-red-600"}`}>
              {isIn ? "+" : "-"}{row.original.quantity}
            </span>
          );
        },
      },
      { accessorKey: "reference_no", header: "Ref #" },
      { accessorKey: "notes", header: "Notes" },
    ],
    []
  );

  // Apply movement filters
  const filteredMovements = useMemo(() => {
    return movements.filter(mv => {
      if (movTypeFilter === "in"  && !IN_TYPES.includes(mv.movement_type))  return false;
      if (movTypeFilter === "out" && !OUT_TYPES.includes(mv.movement_type)) return false;
      if (movDateFilter === "today") {
        const today = new Date(); today.setHours(0,0,0,0);
        if (new Date(mv.created_at as string) < today) return false;
      }
      return true;
    });
  }, [movements, movTypeFilter, movDateFilter]);

  // Movement table instance (for Movements tab)
  const movementTable = useReactTable({
    data: filteredMovements,
    columns: movementColumns,
    state: { globalFilter: movRefFilter || globalFilter },
    getCoreRowModel: coreRowModel,
    getFilteredRowModel: filteredRowModel,
    getPaginationRowModel: paginationRowModel,
    initialState: { pagination: { pageSize: 25 } },
  });

  const lowStock = useMemo(
    () => stockLevels.filter((sl) => {
      const reorder = sl.product?.reorder_point ?? 0;
      return sl.quantity > 0 && sl.quantity <= reorder;
    }),
    [stockLevels]
  );

  const outOfStock = useMemo(
    () => stockLevels.filter((sl) => sl.quantity === 0),
    [stockLevels]
  );

  const mvTotal = movementTable.getFilteredRowModel().rows.length;
  const mvState = movementTable.getState().pagination;

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

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search inventory..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabValue)}>
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
              emptyMsg="No low stock items — all levels OK"
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

          <TabsContent value="movements" className="mt-4 space-y-3">
            {/* Movement filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={movTypeFilter} onValueChange={v => { setMovTypeFilter(v as "all"|"in"|"out"); setMovRefFilter(""); }}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="in">Stock In</SelectItem>
                  <SelectItem value="out">Stock Out</SelectItem>
                </SelectContent>
              </Select>
              <Select value={movDateFilter} onValueChange={v => { setMovDateFilter(v as "all"|"today"); setMovRefFilter(""); }}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                </SelectContent>
              </Select>
              {movRefFilter && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 border border-blue-200 text-xs text-blue-700">
                  Ref: {movRefFilter}
                  <button onClick={() => setMovRefFilter("")} className="ml-1 hover:text-blue-900">✕</button>
                </div>
              )}
              <span className="text-xs text-muted-foreground ml-auto">{filteredMovements.length} movement{filteredMovements.length !== 1 ? "s" : ""}</span>
            </div>
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
            {mvTotal > mvState.pageSize && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Showing {mvState.pageIndex * mvState.pageSize + 1}–{Math.min((mvState.pageIndex + 1) * mvState.pageSize, mvTotal)} of {mvTotal}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => movementTable.previousPage()} disabled={!movementTable.getCanPreviousPage()}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-2">Page {mvState.pageIndex + 1} of {movementTable.getPageCount()}</span>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => movementTable.nextPage()} disabled={!movementTable.getCanNextPage()}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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
              queryClient.invalidateQueries({ queryKey: ["stock-levels-summary"] });
              queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense>
      <InventoryPageContent />
    </Suspense>
  );
}
