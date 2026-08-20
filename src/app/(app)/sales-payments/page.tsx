"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, flexRender,
  type ColumnDef, type FilterFn,
} from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, AlertCircle, Banknote, ChevronLeft, ChevronRight, X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SPRow = {
  id: string;
  payment_date: string;
  payment_method: string;
  amount: number;
  notes: string | null;
  invoice_id: string;
  invoice: {
    id: string;
    invoice_number: string;
    customer: { id: string; name: string; company_name: string | null } | null;
  } | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer", cheque: "Cheque",
  upi: "UPI", neft: "NEFT", rtgs: "RTGS", other: "Other",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Data fetcher ──────────────────────────────────────────────────────────────

async function fetchSalesPayments(): Promise<SPRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoice_payments")
    .select(
      "id, payment_date, payment_method, amount, notes, invoice_id, " +
      "invoice:invoices(id, invoice_number, customer:customers(id, name, company_name))"
    )
    .order("payment_date", { ascending: false })
    .order("created_at",   { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SPRow[];
}

// ── Module-level row model factories ──────────────────────────────────────────

const coreRowModel       = getCoreRowModel<SPRow>();
const filteredRowModel   = getFilteredRowModel<SPRow>();
const paginationRowModel = getPaginationRowModel<SPRow>();

// ── Global filter ─────────────────────────────────────────────────────────────

const globalFilterFn: FilterFn<SPRow> = (row, _col, filterValue: string) => {
  const q = filterValue.toLowerCase();
  const d = row.original;
  return (
    (d.invoice?.invoice_number ?? "").toLowerCase().includes(q) ||
    (d.invoice?.customer?.name ?? "").toLowerCase().includes(q) ||
    (d.invoice?.customer?.company_name ?? "").toLowerCase().includes(q) ||
    (d.notes ?? "").toLowerCase().includes(q)
  );
};

// ── Column definitions ────────────────────────────────────────────────────────

const columns: ColumnDef<SPRow>[] = [
  {
    accessorKey: "payment_date",
    header: "Date",
    cell: ({ getValue }) => fmtDate(String(getValue())),
  },
  {
    id: "invoice",
    header: "Invoice #",
    cell: ({ row }) => (
      <span className="font-mono font-semibold text-primary text-xs">
        {row.original.invoice?.invoice_number ?? "—"}
      </span>
    ),
  },
  {
    id: "customer",
    header: "Customer",
    cell: ({ row }) => {
      const c = row.original.invoice?.customer;
      if (!c) return <span className="text-muted-foreground">—</span>;
      return (
        <div>
          <p className="font-medium text-sm">{c.name}</p>
          {c.company_name && (
            <p className="text-xs text-muted-foreground">{c.company_name}</p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "payment_method",
    header: "Method",
    cell: ({ getValue }) => METHOD_LABELS[String(getValue())] ?? String(getValue()),
  },
  {
    accessorKey: "notes",
    header: "Notes",
    cell: ({ getValue }) => {
      const v = getValue();
      return v ? (
        <span className="text-xs text-muted-foreground">{String(v)}</span>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      );
    },
  },
  {
    accessorKey: "amount",
    header: () => <span className="float-right">Amount</span>,
    cell: ({ getValue }) => (
      <span className="float-right font-semibold text-green-700 tabular-nums">
        {fmtINR(Number(getValue()))}
      </span>
    ),
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SalesPaymentsPage() {
  const router = useRouter();
  const [search, setSearch]   = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["sales-payments-list"],
    queryFn: fetchSalesPayments,
  });

  const filteredData = useMemo(() => {
    return data.filter(r => {
      if (dateFrom && r.payment_date < dateFrom) return false;
      if (dateTo   && r.payment_date > dateTo)   return false;
      return true;
    });
  }, [data, dateFrom, dateTo]);

  const totalAmount = useMemo(() => data.reduce((s, r) => s + r.amount, 0), [data]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter: search },
    onGlobalFilterChange: setSearch,
    globalFilterFn,
    getCoreRowModel: coreRowModel,
    getFilteredRowModel: filteredRowModel,
    getPaginationRowModel: paginationRowModel,
    initialState: { pagination: { pageSize: 20 } },
  });

  const filteredTotal = useMemo(
    () => table.getFilteredRowModel().rows.reduce((s, r) => s + r.original.amount, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table.getFilteredRowModel().rows, search, dateFrom, dateTo]
  );

  const hasDateFilter = dateFrom || dateTo;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Sales Payments"
        breadcrumbs={[{ label: "Sales Payments" }]}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-4">

          {/* ── Filters ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search invoice #, customer…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="date"
                  className="w-40 text-sm"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  title="From date"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  className="w-40 text-sm"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
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
              <div className="text-sm text-muted-foreground shrink-0 sm:ml-auto">
                {(search || hasDateFilter)
                  ? `${table.getFilteredRowModel().rows.length} of ${data.length} · ${fmtINR(filteredTotal)}`
                  : `${data.length} payments · ${fmtINR(totalAmount)}`}
              </div>
            </div>
          </div>

          {/* ── Table ────────────────────────────────────────────── */}
          <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 rounded" />)}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Could not load payments.</p>
              </div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Banknote className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium text-sm">No payments recorded yet</p>
                <p className="text-xs text-muted-foreground">
                  Record a payment from an invoice&apos;s detail page.
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map(hg => (
                      <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                        {hg.headers.map(h => (
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
                    {table.getRowModel().rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">
                          No payments match your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      table.getRowModel().rows.map(row => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => {
                            if (row.original.invoice_id) {
                              router.push(`/invoices/${row.original.invoice_id}`);
                            }
                          }}
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

                {/* ── Pagination ─────────────────────────────────── */}
                {table.getPageCount() > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
