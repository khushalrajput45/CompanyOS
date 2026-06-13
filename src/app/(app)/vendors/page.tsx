"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
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
  Plus, Search, Eye, Pencil, Archive, RotateCcw,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Truck,
} from "lucide-react";
import type { Vendor } from "@/lib/types";
import { useProfile } from "@/lib/hooks/useProfile";

// Module-level row model factories
const coreRowModel       = getCoreRowModel();
const filteredRowModel   = getFilteredRowModel();
const sortedRowModel     = getSortedRowModel();
const paginationRowModel = getPaginationRowModel();

async function fetchVendors(): Promise<Vendor[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export default function VendorsPage() {
  const router      = useRouter();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: vendors = [], isLoading, error } = useQuery({
    queryKey: ["vendors"],
    queryFn: fetchVendors,
    staleTime: 30000,
    retry: 1,
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("vendors")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("vendors")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const handleArchive = useCallback(
    (id: string, name: string) => {
      if (confirm(`Archive vendor "${name}"? All purchase history is preserved.`)) {
        archiveMutation.mutate(id);
      }
    },
    [archiveMutation]
  );

  const columns = useMemo<ColumnDef<Vendor>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Vendor Name",
        cell: ({ row, getValue }) => (
          <div>
            <p className="font-medium text-sm">{getValue() as string}</p>
            {row.original.company_name && (
              <p className="text-xs text-muted-foreground">{row.original.company_name}</p>
            )}
          </div>
        ),
      },
      {
        id: "location",
        header: "Location",
        accessorFn: (r) => [r.city, r.state].filter(Boolean).join(", ") || "—",
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ getValue }) =>
          getValue() ? (
            <a
              href={`tel:${getValue() as string}`}
              className="text-sm text-primary hover:underline"
            >
              {getValue() as string}
            </a>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ getValue }) =>
          getValue() ? (
            <a
              href={`mailto:${getValue() as string}`}
              className="text-sm text-primary hover:underline truncate max-w-[180px] block"
            >
              {getValue() as string}
            </a>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          ),
      },
      {
        accessorKey: "contact_person",
        header: "Contact",
        cell: ({ getValue }) => (
          <span className="text-sm">{(getValue() as string | null) ?? "—"}</span>
        ),
      },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row, getValue }) => {
          if (row.original.deleted_at) {
            return <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">Archived</Badge>;
          }
          return (
            <Badge
              variant={getValue() ? "default" : "secondary"}
              className={getValue() ? "bg-green-100 text-green-700 border-green-200 text-xs" : "text-xs"}
            >
              {getValue() ? "Active" : "Inactive"}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        size: 90,
        cell: ({ row }) => (
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            {!row.original.deleted_at ? (
              <>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="View"
                  onClick={() => router.push(`/vendors/${row.original.id}`)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Edit"
                  onClick={() => router.push(`/vendors/${row.original.id}/edit`)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Archive"
                    onClick={() => handleArchive(row.original.id, row.original.name)}>
                    <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" title="Restore"
                onClick={() => restoreMutation.mutate(row.original.id)}>
                <RotateCcw className="h-3 w-3" />
                Restore
              </Button>
            )}
          </div>
        ),
      },
    ],
    [isAdmin, router, handleArchive, restoreMutation]
  );

  const filteredData = useMemo(
    () =>
      vendors.filter((v) => {
        if (!showArchived && v.deleted_at) return false;
        if (showArchived && !v.deleted_at) return false;
        if (!showArchived && statusFilter === "active" && !v.is_active) return false;
        if (!showArchived && statusFilter === "inactive" && v.is_active) return false;
        return true;
      }),
    [vendors, statusFilter, showArchived]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: coreRowModel,
    getFilteredRowModel: filteredRowModel,
    getSortedRowModel: sortedRowModel,
    getPaginationRowModel: paginationRowModel,
    initialState: { pagination: { pageSize: 25 } },
  });

  const totalFiltered = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Vendors" subtitle="Error loading vendors" />
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-destructive text-sm">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Vendors"
        subtitle={`${totalFiltered} vendor${totalFiltered !== 1 ? "s" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            {vendors.filter(v => !!v.deleted_at).length > 0 && (
              <Button size="sm" variant={showArchived ? "default" : "outline"}
                onClick={() => setShowArchived(v => !v)}>
                <Archive className="h-3.5 w-3.5 mr-1.5" />
                {showArchived ? "Hide Archived" : `Archived (${vendors.filter(v => !!v.deleted_at).length})`}
              </Button>
            )}
            <Button size="sm" onClick={() => router.push("/vendors/new")}>
              <Plus className="h-4 w-4 mr-1.5" />Add Vendor
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {actionError && (
          <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive flex items-center justify-between">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="ml-4 text-destructive/70 hover:text-destructive">✕</button>
          </div>
        )}
        {showArchived && (
          <div className="rounded-md bg-orange-50 border border-orange-200 px-4 py-2 text-sm text-orange-700">
            Showing archived vendors. Click Restore to make them active again.
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
                      <span className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" && <ChevronUp className="h-3 w-3" />}
                        {header.column.getIsSorted() === "desc" && <ChevronDown className="h-3 w-3" />}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                    Loading vendors...
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <Truck className="h-10 w-10 opacity-20" />
                      <p className="text-sm">No vendors found</p>
                      <Button size="sm" variant="outline" onClick={() => router.push("/vendors/new")}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        Add your first vendor
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => router.push(`/vendors/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="py-2.5"
                        onClick={
                          cell.column.id === "actions"
                            ? (e) => e.stopPropagation()
                            : undefined
                        }
                      >
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
              Showing {pageIndex * pageSize + 1}–
              {Math.min((pageIndex + 1) * pageSize, totalFiltered)} of {totalFiltered}
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
    </div>
  );
}
