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
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Search, Eye, Pencil, Trash2,
  ChevronLeft, ChevronRight, ShoppingBag,
  ChevronUp, ChevronDown,
} from "lucide-react";
import type { PurchaseOrder, POStatus } from "@/lib/types";
import { useProfile } from "@/lib/hooks/useProfile";
import { format } from "date-fns";

// Module-level row model factories
const coreRowModel       = getCoreRowModel();
const filteredRowModel   = getFilteredRowModel();
const sortedRowModel     = getSortedRowModel();
const paginationRowModel = getPaginationRowModel();

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<POStatus, string> = {
  draft:     "bg-slate-100  text-slate-700  border-slate-200",
  sent:      "bg-blue-100   text-blue-700   border-blue-200",
  partial:   "bg-orange-100 text-orange-700 border-orange-200",
  received:  "bg-green-100  text-green-700  border-green-200",
  cancelled: "bg-red-100    text-red-600    border-red-200",
};

const STATUS_LABEL: Record<POStatus, string> = {
  draft: "Draft", sent: "Sent", partial: "Partial",
  received: "Received", cancelled: "Cancelled",
};

function StatusBadge({ status }: { status: POStatus }) {
  return (
    <Badge className={`text-xs border ${STATUS_STYLES[status]}`} variant="outline">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

type PORow = PurchaseOrder & {
  vendor_name:    string;
  vendor_company: string | null;
};

async function fetchPOs(): Promise<PORow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*, vendor:vendors(id, name, company_name)")
    .order("po_date", { ascending: false });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((po: any) => ({
    ...po,
    vendor_name:    po.vendor?.name        ?? "—",
    vendor_company: po.vendor?.company_name ?? null,
  }));
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const router      = useRouter();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "po_date", desc: true }]);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: pos = [], isLoading, error } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: fetchPOs,
    staleTime: 30000,
    retry: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  const handleDelete = useCallback(
    (id: string, poNumber: string) => {
      if (confirm(`Delete purchase order "${poNumber}"? This cannot be undone.`)) {
        deleteMutation.mutate(id);
      }
    },
    [deleteMutation]
  );

  const columns = useMemo<ColumnDef<PORow>[]>(
    () => [
      {
        accessorKey: "po_number",
        header: "PO #",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-semibold">{getValue() as string}</span>
        ),
      },
      {
        id: "vendor",
        header: "Vendor",
        accessorFn: (r) => r.vendor_name,
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-sm">{row.original.vendor_name}</p>
            {row.original.vendor_company && (
              <p className="text-xs text-muted-foreground">{row.original.vendor_company}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "po_date",
        header: "PO Date",
        cell: ({ getValue }) =>
          format(new Date((getValue() as string) + "T00:00:00"), "dd MMM yyyy"),
      },
      {
        accessorKey: "expected_date",
        header: "Expected",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          if (!v) return <span className="text-muted-foreground">—</span>;
          try { return format(new Date(v + "T00:00:00"), "dd MMM yyyy"); }
          catch { return <span className="text-muted-foreground">—</span>; }
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue() as POStatus} />,
      },
      {
        accessorKey: "total_amount",
        header: "Total",
        cell: ({ getValue }) => (
          <span className="font-medium tabular-nums text-sm">
            ₹{(getValue() as number).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 90,
        cell: ({ row }) => (
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            <Button
              size="sm" variant="ghost" className="h-7 w-7 p-0"
              title="View"
              onClick={() => router.push(`/purchase-orders/${row.original.id}`)}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {(row.original.status === "draft" || row.original.status === "sent") && (
              <Button
                size="sm" variant="ghost" className="h-7 w-7 p-0"
                title="Edit"
                onClick={() => router.push(`/purchase-orders/${row.original.id}/edit`)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {isAdmin && row.original.status === "draft" && (
              <Button
                size="sm" variant="ghost" className="h-7 w-7 p-0"
                title="Delete"
                onClick={() => handleDelete(row.original.id, row.original.po_number)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [isAdmin, router, handleDelete]
  );

  const filteredData = useMemo(
    () => pos.filter(p => statusFilter === "all" || p.status === statusFilter),
    [pos, statusFilter]
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
        <Header title="Purchase Orders" subtitle="Error loading" />
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-destructive text-sm">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Purchase Orders"
        subtitle={`${totalFiltered} order${totalFiltered !== 1 ? "s" : ""}`}
        actions={
          <Button size="sm" onClick={() => router.push("/purchase-orders/new")}>
            <Plus className="h-4 w-4 mr-1.5" />
            New PO
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search POs, vendor…"
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
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
              {table.getHeaderGroups().map(hg => (
                <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                  {hg.headers.map(h => (
                    <TableHead
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      <span className="flex items-center gap-1">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc"  && <ChevronUp   className="h-3 w-3" />}
                        {h.column.getIsSorted() === "desc" && <ChevronDown className="h-3 w-3" />}
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
                    Loading…
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <ShoppingBag className="h-10 w-10 opacity-20" />
                      <p className="text-sm">No purchase orders found</p>
                      <Button size="sm" variant="outline" onClick={() => router.push("/purchase-orders/new")}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        Create your first PO
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map(row => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => router.push(`/purchase-orders/${row.original.id}`)}
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

        {/* Pagination */}
        {totalFiltered > pageSize && (
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
