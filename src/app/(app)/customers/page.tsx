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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Search, Eye, Pencil, Archive, RotateCcw,
  ChevronLeft, ChevronRight, Users, ChevronUp, ChevronDown,
} from "lucide-react";
import type { Customer } from "@/lib/types";

const coreRowModel       = getCoreRowModel();
const filteredRowModel   = getFilteredRowModel();
const sortedRowModel     = getSortedRowModel();
const paginationRowModel = getPaginationRowModel();

async function fetchCustomers(): Promise<Customer[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export default function CustomersPage() {
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: customers = [], isLoading, error } = useQuery({
    queryKey: ["customers"],
    queryFn: fetchCustomers,
    staleTime: 30000,
    retry: 1,
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("customers")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("customers")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const handleArchive = useCallback((id: string, name: string) => {
    if (!confirm(`Archive customer "${name}"? They will be hidden from active lists but all history is preserved.`)) return;
    archiveMutation.mutate(id);
  }, [archiveMutation]);

  const filteredData = useMemo(
    () =>
      customers.filter(c => {
        if (!showArchived && c.deleted_at) return false;
        if (showArchived && !c.deleted_at) return false;
        if (statusFilter === "active"   && !c.is_active) return false;
        if (statusFilter === "inactive" && c.is_active)  return false;
        return true;
      }),
    [customers, statusFilter, showArchived]
  );

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Customer",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-sm">{row.original.name}</p>
            {row.original.company_name && (
              <p className="text-xs text-muted-foreground">{row.original.company_name}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ getValue }) => (
          <span className="text-sm">{(getValue() as string | null) ?? "—"}</span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v
            ? <a href={`mailto:${v}`} className="text-sm text-primary hover:underline">{v}</a>
            : <span className="text-sm text-muted-foreground">—</span>;
        },
      },
      {
        id: "location",
        header: "City / State",
        cell: ({ row }) => {
          const { city, state } = row.original;
          if (!city && !state) return <span className="text-sm text-muted-foreground">—</span>;
          return <span className="text-sm">{[city, state].filter(Boolean).join(", ")}</span>;
        },
      },
      {
        accessorKey: "gst_number",
        header: "GST Number",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v
            ? <span className="font-mono text-xs">{v}</span>
            : <span className="text-sm text-muted-foreground">—</span>;
        },
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
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {!row.original.deleted_at ? (
              <>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="View"
                  onClick={() => router.push(`/customers/${row.original.id}`)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Edit"
                  onClick={() => router.push(`/customers/${row.original.id}/edit`)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Archive"
                  onClick={() => handleArchive(row.original.id, row.original.name)}>
                  <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
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
    [router, handleArchive, restoreMutation]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel:       coreRowModel,
    getFilteredRowModel:   filteredRowModel,
    getSortedRowModel:     sortedRowModel,
    getPaginationRowModel: paginationRowModel,
    initialState: { pagination: { pageSize: 25 } },
  });

  const totalFiltered = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const archivedCount = customers.filter(c => !!c.deleted_at).length;

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Customers" />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <p className="text-destructive font-medium">Failed to load customers</p>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Customers"
        subtitle={isLoading ? "Loading…" : `${totalFiltered} customer${totalFiltered !== 1 ? "s" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            {archivedCount > 0 && (
              <Button size="sm" variant={showArchived ? "default" : "outline"}
                onClick={() => setShowArchived(v => !v)}>
                <Archive className="h-3.5 w-3.5 mr-1.5" />
                {showArchived ? "Hide Archived" : `Archived (${archivedCount})`}
              </Button>
            )}
            <Button size="sm" onClick={() => router.push("/customers/new")}>
              <Plus className="h-4 w-4 mr-1.5" />Add Customer
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, company, phone, email…"
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {!showArchived && (
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
          )}
        </div>

        {actionError && (
          <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive flex items-center justify-between">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="ml-4 text-destructive/70 hover:text-destructive">✕</button>
          </div>
        )}

        {showArchived && (
          <div className="rounded-md bg-orange-50 border border-orange-200 px-4 py-2 text-sm text-orange-700">
            Showing archived customers. Click Restore to make them active again.
          </div>
        )}

        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(hg => (
                <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                  {hg.headers.map(header => (
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
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="py-16">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Users className="h-10 w-10 opacity-30" />
                      <p className="font-medium">
                        {showArchived ? "No archived customers" : globalFilter || statusFilter !== "all"
                          ? "No customers match your filters"
                          : "No customers yet"}
                      </p>
                      {!globalFilter && statusFilter === "all" && !showArchived && (
                        <Button size="sm" variant="outline" onClick={() => router.push("/customers/new")}>
                          <Plus className="h-3.5 w-3.5 mr-1.5" />Add your first customer
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map(row => (
                  <TableRow
                    key={row.id}
                    className={`hover:bg-muted/30 cursor-pointer ${row.original.deleted_at ? "opacity-60" : ""}`}
                    onClick={() => !row.original.deleted_at && router.push(`/customers/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map(cell => (
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

        {!isLoading && totalFiltered > pageSize && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, totalFiltered)} of {totalFiltered}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2">Page {pageIndex + 1} of {table.getPageCount()}</span>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
