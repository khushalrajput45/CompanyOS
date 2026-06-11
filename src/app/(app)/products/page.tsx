"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/lib/types";
import { ProductForm } from "./product-form";
import { useProfile } from "@/lib/hooks/useProfile";

// Stable row-model factories — created once at module level
const coreRowModel = getCoreRowModel();
const filteredRowModel = getFilteredRowModel();
const sortedRowModel = getSortedRowModel();
const paginationRowModel = getPaginationRowModel();

async function fetchProducts(): Promise<Product[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, brand:brands(id,name), category:categories(id,name)")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const [globalFilter, setGlobalFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("products")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  // Stable action callbacks — don't change unless their deps change
  const openEdit = useCallback((product: Product) => {
    setEditing(product);
    setDialogOpen(true);
  }, []);

  const openAdd = useCallback(() => {
    setEditing(null);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm("Delete this product?")) deleteMutation.mutate(id);
    },
    [deleteMutation]
  );

  // Derived filter lists — only recompute when products changes
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
          products
            .filter((p) => p.category)
            .map((p) => [p.category!.id, p.category!])
        ).values()
      ),
    [products]
  );

  // Column definitions — memoized, only rebuild when isAdmin or action callbacks change
  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      { accessorKey: "sku", header: "SKU", size: 120 },
      { accessorKey: "name", header: "Product Name" },
      { accessorFn: (r) => r.brand?.name ?? "—", header: "Brand" },
      { accessorFn: (r) => r.category?.name ?? "—", header: "Category" },
      {
        accessorKey: "selling_price",
        header: "Selling Price",
        cell: ({ getValue }) =>
          `₹${(getValue() as number).toLocaleString("en-IN")}`,
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
      { accessorKey: "reorder_point", header: "Reorder Pt." },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ getValue }) => (
          <Badge
            variant={getValue() ? "default" : "secondary"}
            className={
              getValue() ? "bg-green-100 text-green-700 border-green-200" : ""
            }
          >
            {getValue() ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => openEdit(row.original)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => handleDelete(row.original.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [isAdmin, openEdit, handleDelete]
  );

  // Pre-filtered data (brand/category/status) — memoized
  const filteredData = useMemo(
    () =>
      products.filter((p) => {
        if (brandFilter !== "all" && p.brand?.id !== brandFilter) return false;
        if (categoryFilter !== "all" && p.category?.id !== categoryFilter)
          return false;
        if (statusFilter === "active" && !p.is_active) return false;
        if (statusFilter === "inactive" && p.is_active) return false;
        return true;
      }),
    [products, brandFilter, categoryFilter, statusFilter]
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
    initialState: { pagination: { pageSize: 20 } },
  });

  const totalFiltered = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Products"
        subtitle={`${totalFiltered} product${totalFiltered !== 1 ? "s" : ""}`}
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Product
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-4">
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
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
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
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
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
            <button
              onClick={() => setDeleteError(null)}
              className="ml-4 text-destructive/70 hover:text-destructive"
            >
              ✕
            </button>
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
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
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
                    className="text-center py-12 text-muted-foreground"
                  >
                    Loading products...
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/30">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-sm py-2.5">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
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
              Showing {pageIndex * pageSize + 1}–
              {Math.min((pageIndex + 1) * pageSize, totalFiltered)} of{" "}
              {totalFiltered}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2">
                Page {pageIndex + 1} of {table.getPageCount()}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
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
              queryClient.invalidateQueries({ queryKey: ["products"] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
