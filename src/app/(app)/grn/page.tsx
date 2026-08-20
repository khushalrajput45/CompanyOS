"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
} from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Eye, PackageCheck, Search, ChevronLeft, ChevronRight, X } from "lucide-react";
import { format } from "date-fns";

// ── Module-level row model factories ─────────────────────────────────────────

const coreRowModel      = getCoreRowModel();
const filteredRowModel  = getFilteredRowModel();
const sortedRowModel    = getSortedRowModel();
const paginatedRowModel = getPaginationRowModel();

// ── Types ─────────────────────────────────────────────────────────────────────

type GRNRow = {
  id: string;
  grn_number: string;
  receipt_date: string;
  notes: string | null;
  created_at: string;
  purchase_order: {
    id: string;
    po_number: string;
    vendor: { id: string; name: string; company_name: string | null } | null;
  } | null;
};

// ── Column definitions ────────────────────────────────────────────────────────

const columns: ColumnDef<GRNRow>[] = [
  {
    accessorKey: "grn_number",
    header: "GRN Number",
    cell: ({ row }) => (
      <span className="font-mono font-medium text-sm">
        {row.original.grn_number || "—"}
      </span>
    ),
  },
  {
    id: "po_number",
    header: "Purchase Order",
    accessorFn: row => row.purchase_order?.po_number ?? "",
    cell: ({ row }) => (
      <span className="font-mono text-sm text-primary">
        {row.original.purchase_order?.po_number ?? "—"}
      </span>
    ),
  },
  {
    id: "vendor",
    header: "Vendor",
    accessorFn: row => [
      row.purchase_order?.vendor?.name ?? "",
      row.purchase_order?.vendor?.company_name ?? "",
    ].join(" "),
    cell: ({ row }) => {
      const vendor = row.original.purchase_order?.vendor;
      if (!vendor) return <span className="text-muted-foreground text-sm">—</span>;
      return (
        <div>
          <p className="text-sm font-medium">{vendor.name}</p>
          {vendor.company_name && (
            <p className="text-xs text-muted-foreground">{vendor.company_name}</p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "receipt_date",
    header: "Receipt Date",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.receipt_date ? format(new Date(row.original.receipt_date + "T00:00:00"), "dd MMM yyyy") : "—"}
      </span>
    ),
  },
];

// ── Data fetcher ──────────────────────────────────────────────────────────────

async function fetchGRNs(): Promise<GRNRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("po_receipts")
    .select(
      "id, grn_number, receipt_date, notes, created_at, " +
      "purchase_order:purchase_orders(id, po_number, vendor:vendors(id, name, company_name))"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as GRNRow[];
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GRNListPage() {
  const router = useRouter();
  const [globalFilter, setGlobalFilter]   = useState("");
  const [sorting, setSorting]             = useState<SortingState>([]);
  const [pagination, setPagination]       = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["grn-list"],
    queryFn: fetchGRNs,
  });

  const filteredData = useMemo(() => {
    return data.filter(r => {
      if (dateFrom && r.receipt_date < dateFrom) return false;
      if (dateTo   && r.receipt_date > dateTo)   return false;
      return true;
    });
  }, [data, dateFrom, dateTo]);

  const hasDateFilter = dateFrom || dateTo;

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter, sorting, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange:      setSorting,
    onPaginationChange:   setPagination,
    getCoreRowModel:        coreRowModel,
    getFilteredRowModel:    filteredRowModel,
    getSortedRowModel:      sortedRowModel,
    getPaginationRowModel:  paginatedRowModel,
  });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Goods Receipts"
        breadcrumbs={[{ label: "Goods Receipts" }]}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-4">

          {/* Search + date filter */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search GRN, PO number, vendor…"
                  value={globalFilter}
                  onChange={e => {
                    setGlobalFilter(e.target.value);
                    setPagination(p => ({ ...p, pageIndex: 0 }));
                  }}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="date"
                  className="w-40 text-sm"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPagination(p => ({ ...p, pageIndex: 0 })); }}
                  title="From date"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  className="w-40 text-sm"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPagination(p => ({ ...p, pageIndex: 0 })); }}
                  title="To date"
                />
                {hasDateFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 text-muted-foreground"
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                    title="Clear date filter"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <span className="text-sm text-muted-foreground sm:ml-auto">
                {table.getFilteredRowModel().rows.length} receipts
              </span>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="rounded-lg border bg-card shadow-sm flex flex-col items-center justify-center py-16 text-center">
              <PackageCheck className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="font-medium text-muted-foreground">No goods receipts yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Receive goods from a Purchase Order to create GRNs.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map(hg => (
                    <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                      {hg.headers.map(header => (
                        <TableHead
                          key={header.id}
                          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer select-none"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === "asc"
                            ? " ↑"
                            : header.column.getIsSorted() === "desc"
                            ? " ↓"
                            : ""}
                        </TableHead>
                      ))}
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-20">
                        Actions
                      </TableHead>
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map(row => (
                    <TableRow
                      key={row.id}
                      className="hover:bg-muted/20 cursor-pointer"
                      onClick={() => router.push(`/grn/${row.original.id}`)}
                    >
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="View GRN"
                          onClick={() => router.push(`/grn/${row.original.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline" size="sm" className="h-7 w-7 p-0"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline" size="sm" className="h-7 w-7 p-0"
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
    </div>
  );
}
