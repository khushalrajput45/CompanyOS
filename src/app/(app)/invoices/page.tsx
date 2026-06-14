"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
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
  Plus, Search, Eye, Pencil, Trash2,
  ChevronLeft, ChevronRight, Receipt,
  ChevronUp, ChevronDown,
} from "lucide-react";
import type { Invoice, InvoiceStatus } from "@/lib/types";

// Stable row model factories
const coreRowModel       = getCoreRowModel();
const filteredRowModel   = getFilteredRowModel();
const sortedRowModel     = getSortedRowModel();
const paginationRowModel = getPaginationRowModel();

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft:   "bg-slate-100  text-slate-700  border-slate-200",
  sent:    "bg-blue-100   text-blue-700   border-blue-200",
  paid:    "bg-green-100  text-green-700  border-green-200",
  partial: "bg-violet-100 text-violet-700 border-violet-200",
  overdue: "bg-red-100    text-red-600    border-red-200",
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft", sent: "Sent", paid: "Paid",
  partial: "Partial", overdue: "Overdue",
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge className={`text-xs border ${STATUS_STYLES[status]}`} variant="outline">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

type InvoiceRow = Invoice & {
  customer_name:    string;
  customer_company: string | null;
  customer_phone:   string | null;
  customer_gst:     string | null;
};

async function fetchInvoices(): Promise<InvoiceRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, customer:customers(name, company_name, phone, gst_number)")
    .order("invoice_date", { ascending: false });
  if (error) throw error;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((inv: any) => {
    const isOverdue =
      (inv.status === "sent" || inv.status === "partial") &&
      inv.due_date &&
      new Date(inv.due_date) < today;
    return {
      ...inv,
      status:           isOverdue ? "overdue" as InvoiceStatus : inv.status,
      customer_name:    inv.customer?.name         ?? "—",
      customer_company: inv.customer?.company_name ?? null,
      customer_phone:   inv.customer?.phone        ?? null,
      customer_gst:     inv.customer?.gst_number   ?? null,
    };
  });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── Page ──────────────────────────────────────────────────────────────────────

function InvoicesPageContent() {
  const router      = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [globalFilter, setGlobalFilter] = useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "invoice_date", desc: true }]);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: invoices = [], isLoading, error } = useQuery({
    queryKey: ["invoices"],
    queryFn: fetchInvoices,
    retry: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();

      // Restore stock before deleting (same logic as detail-page delete)
      const { data: movements } = await supabase
        .from("stock_movements")
        .select("product_id, location_id, quantity")
        .eq("document_id", id)
        .eq("document_type", "invoice")
        .eq("movement_type", "sale");

      if (movements && movements.length > 0) {
        for (const mv of movements) {
          await supabase.rpc("increment_stock_level", {
            p_product_id:  mv.product_id,
            p_location_id: mv.location_id,
            p_delta:       mv.quantity,
          });
        }
        await supabase
          .from("stock_movements")
          .delete()
          .eq("document_id", id)
          .eq("document_type", "invoice")
          .eq("movement_type", "sale");
      }

      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  const handleDelete = useCallback((id: string, num: string) => {
    if (!confirm(`Delete invoice ${num}? This will restore any deducted inventory.`)) return;
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  const filteredData = useMemo(
    () => invoices.filter(inv => statusFilter === "all" || inv.status === statusFilter),
    [invoices, statusFilter]
  );

  const columns = useMemo<ColumnDef<InvoiceRow>[]>(() => [
    {
      accessorKey: "invoice_number",
      header: "Invoice #",
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-semibold text-primary">{getValue() as string}</span>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      // Include phone and GST so global filter searches them too
      accessorFn: row => [row.customer_name, row.customer_company, row.customer_phone, row.customer_gst]
        .filter(Boolean).join(" "),
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">{row.original.customer_name}</p>
          {row.original.customer_company && (
            <p className="text-xs text-muted-foreground">{row.original.customer_company}</p>
          )}
          {row.original.customer_phone && (
            <p className="text-xs text-muted-foreground">{row.original.customer_phone}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "invoice_date",
      header: "Date",
      cell: ({ getValue }) => <span className="text-sm">{fmtDate(getValue() as string)}</span>,
    },
    {
      accessorKey: "due_date",
      header: "Due Date",
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        if (!v) return <span className="text-sm text-muted-foreground">—</span>;
        const isOverdue = new Date(v) < new Date();
        return (
          <span className={`text-sm ${isOverdue ? "text-destructive" : ""}`}>
            {fmtDate(v)}
          </span>
        );
      },
    },
    {
      accessorKey: "total_amount",
      header: "Total",
      cell: ({ getValue }) => (
        <span className="text-sm font-semibold tabular-nums">{fmtINR(getValue() as number)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge status={getValue() as InvoiceStatus} />,
    },
    {
      id: "actions",
      header: "",
      size: 90,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="View"
            onClick={e => { e.stopPropagation(); router.push(`/invoices/${row.original.id}`); }}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Edit"
            onClick={e => { e.stopPropagation(); router.push(`/invoices/${row.original.id}/edit`); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Delete"
            onClick={e => { e.stopPropagation(); handleDelete(row.original.id, row.original.invoice_number); }}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ),
    },
  ], [router, handleDelete]);

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

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Invoices" />
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <p className="text-destructive font-medium">Failed to load invoices</p>
            <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Invoices"
        subtitle={isLoading ? "Loading…" : `${totalFiltered} invoice${totalFiltered !== 1 ? "s" : ""}`}
        actions={
          <Button size="sm" onClick={() => router.push("/invoices/new")}>
            <Plus className="h-4 w-4 mr-1.5" />New Invoice
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[120px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by invoice #, customer…"
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-9 sm:w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {deleteError && (
          <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive flex justify-between">
            <span>{deleteError}</span>
            <button onClick={() => setDeleteError(null)}>✕</button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
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
                        {header.column.getIsSorted() === "asc"  && <ChevronUp   className="h-3 w-3" />}
                        {header.column.getIsSorted() === "desc" && <ChevronDown className="h-3 w-3" />}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
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
                      <Receipt className="h-10 w-10 opacity-30" />
                      <p className="font-medium">
                        {globalFilter || statusFilter !== "all"
                          ? "No invoices match your filters"
                          : "No invoices yet"}
                      </p>
                      {!globalFilter && statusFilter === "all" && (
                        <Button size="sm" variant="outline" onClick={() => router.push("/invoices/new")}>
                          <Plus className="h-3.5 w-3.5 mr-1.5" />Create your first invoice
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map(row => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => router.push(`/invoices/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id} className="py-3">
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
        {!isLoading && totalFiltered > pageSize && (
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
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense>
      <InvoicesPageContent />
    </Suspense>
  );
}
