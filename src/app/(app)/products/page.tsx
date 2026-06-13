"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import Link from "next/link";
import { Plus, Search, Pencil, Archive, RotateCcw, ChevronLeft, ChevronRight, TrendingUp, History } from "lucide-react";
import type { Product } from "@/lib/types";
import { ProductForm } from "./product-form";
import { useProfile } from "@/lib/hooks/useProfile";

// Stable row-model factories — created once at module level
const coreRowModel = getCoreRowModel();
const filteredRowModel = getFilteredRowModel();
const sortedRowModel = getSortedRowModel();
const paginationRowModel = getPaginationRowModel();

async function fetchProducts(archived = false): Promise<Product[]> {
  const supabase = createClient();
  const baseQuery = supabase
    .from("products")
    .select("*, brand:brands(id,name), category:categories(id,name)")
    .order("name");
  const { data, error } = archived
    ? await baseQuery.not("deleted_at", "is", null)
    : await baseQuery.is("deleted_at", null);
  if (error) throw error;
  return (data ?? []) as unknown as Product[];
}

async function fetchStockSummary(): Promise<{ product_id: string; quantity: number }[]> {
  const supabase = createClient();
  const { data } = await supabase.from("stock_levels").select("product_id, quantity");
  return data ?? [];
}

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Use false until after hydration so server/client column structure matches
  const isAdmin = mounted && (profile?.role === "admin" || profile?.role === "manager");
  // Initialize filters from URL params (dashboard drill-down)
  const [globalFilter, setGlobalFilter]     = useState(searchParams.get("search") ?? "");
  const [brandFilter, setBrandFilter]       = useState("all");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("categoryId") ?? "all");
  const [statusFilter, setStatusFilter]     = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: activeProducts = [], isLoading } = useQuery({
    queryKey: ["products", "active"],
    queryFn: () => fetchProducts(false),
    staleTime: 30000,
  });

  const { data: archivedProducts = [] } = useQuery({
    queryKey: ["products", "archived"],
    queryFn: () => fetchProducts(true),
    staleTime: 30000,
  });

  const products = showArchived ? archivedProducts : activeProducts;

  const { data: stockLevels = [] } = useQuery({
    queryKey: ["stock-levels-summary"],
    queryFn: fetchStockSummary,
    staleTime: 30000,
  });

  // Aggregate stock qty per product
  const stockByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const sl of stockLevels) {
      map.set(sl.product_id, (map.get(sl.product_id) ?? 0) + sl.quantity);
    }
    return map;
  }, [stockLevels]);

  const deleteMutation = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("products")
        .update({ deleted_at: archive ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["products", "active"] });
      queryClient.invalidateQueries({ queryKey: ["products", "archived"] });
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  const openEdit = useCallback((product: Product) => {
    setEditing(product);
    setDialogOpen(true);
  }, []);

  const openAdd = useCallback(() => {
    setEditing(null);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      if (confirm(`Archive product "${name}"? All inventory history is preserved.`)) {
        deleteMutation.mutate({ id, archive: true });
      }
    },
    [deleteMutation]
  );

  const brands = useMemo(
    () =>
      Array.from(
        new Map(
          products.filter((p) => p.brand).map((p) => [p.brand!.id, p.brand!])
        ).values()
      ),
    [products]
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Map(
          products.filter((p) => p.category).map((p) => [p.category!.id, p.category!])
        ).values()
      ),
    [products]
  );

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        accessorKey: "sku",
        header: "SKU",
        size: 110,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "Product Name",
        cell: ({ getValue }) => (
          <span className="font-medium text-sm">{getValue() as string}</span>
        ),
      },
      {
        accessorFn: (r) => r.brand?.name ?? "—",
        header: "Brand",
        cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span>,
      },
      {
        accessorFn: (r) => r.category?.name ?? "—",
        header: "Category",
        cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span>,
      },
      {
        id: "current_stock",
        header: "Current Stock",
        cell: ({ row }) => {
          const qty = stockByProduct.get(row.original.id) ?? 0;
          const reorder = row.original.reorder_point;
          return (
            <span
              className={`font-semibold text-sm ${
                qty === 0
                  ? "text-red-600"
                  : qty <= reorder
                  ? "text-yellow-600"
                  : "text-foreground"
              }`}
            >
              {qty}
            </span>
          );
        },
      },
      ...(isAdmin
        ? [
            {
              accessorKey: "cost_price",
              header: "Cost Price",
              cell: ({ getValue }: { getValue: () => unknown }) =>
                getValue()
                  ? `₹${(getValue() as number).toLocaleString("en-IN")}`
                  : "—",
            } as ColumnDef<Product>,
          ]
        : []),
      {
        accessorKey: "selling_price",
        header: "Selling Price",
        cell: ({ getValue }) =>
          `₹${(getValue() as number).toLocaleString("en-IN")}`,
      },
      {
        id: "inventory_value",
        header: "Inventory Value",
        cell: ({ row }) => {
          const qty = stockByProduct.get(row.original.id) ?? 0;
          const price = row.original.selling_price;
          const value = qty * price;
          return (
            <span className="text-sm font-medium">
              ₹{value.toLocaleString("en-IN")}
            </span>
          );
        },
      },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ getValue }) => (
          <Badge
            variant={getValue() ? "default" : "secondary"}
            className={
              getValue() ? "bg-green-100 text-green-700 border-green-200 text-xs" : "text-xs"
            }
          >
            {getValue() ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 90,
        cell: ({ row }) => (
          <div className="flex gap-1">
            {!row.original.deleted_at && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => openEdit(row.original)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {isAdmin && (
              row.original.deleted_at ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={() => deleteMutation.mutate({ id: row.original.id, archive: false })}
                >
                  <RotateCcw className="h-3 w-3" />Restore
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => handleDelete(row.original.id, row.original.name)}
                >
                  <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )
            )}
          </div>
        ),
      },
    ],
    [isAdmin, openEdit, handleDelete, deleteMutation, stockByProduct]
  );

  const filteredData = useMemo(
    () =>
      products.filter((p) => {
        if (showArchived) return true;
        if (brandFilter !== "all" && p.brand?.id !== brandFilter) return false;
        if (categoryFilter !== "all" && p.category?.id !== categoryFilter) return false;
        if (statusFilter === "active" && !p.is_active) return false;
        if (statusFilter === "inactive" && p.is_active) return false;
        return true;
      }),
    [products, brandFilter, categoryFilter, statusFilter, showArchived]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: coreRowModel,
    getFilteredRowModel: filteredRowModel,
    getSortedRowModel: sortedRowModel,
    getPaginationRowModel: paginationRowModel,
    initialState: { pagination: { pageSize: 25 } },
  });

  const totalFiltered = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Products"
        subtitle={`${totalFiltered} product${totalFiltered !== 1 ? "s" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            {(showArchived || archivedProducts.length > 0) && (
              <Button size="sm" variant={showArchived ? "default" : "outline"}
                onClick={() => setShowArchived(v => !v)}>
                <Archive className="h-3.5 w-3.5 mr-1.5" />
                {showArchived ? "Hide Archived" : archivedProducts.length > 0 ? `Archived (${archivedProducts.length})` : "Archived"}
              </Button>
            )}
            <Link href="/price-history">
              <Button variant="outline" size="sm" className="gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Price History
              </Button>
            </Link>
            <Link href="/quantity-history">
              <Button variant="outline" size="sm" className="gap-1.5">
                <History className="h-3.5 w-3.5" />
                Qty History
              </Button>
            </Link>
            {!showArchived && (
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Product
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="All Brands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {deleteError && (
          <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive flex items-center justify-between">
            <span>{deleteError}</span>
            <button onClick={() => setDeleteError(null)} className="ml-4 text-destructive/70 hover:text-destructive">✕</button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                    Loading products...
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/30">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalFiltered > pageSize && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, totalFiltered)} of {totalFiltered}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <ProductForm
            product={editing}
            onSuccess={() => {
              setDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["products", "active"] });
              queryClient.invalidateQueries({ queryKey: ["stock-levels-summary"] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsPageContent />
    </Suspense>
  );
}
