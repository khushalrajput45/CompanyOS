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
import { Search, AlertCircle, Banknote, ChevronLeft, ChevronRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type VPRow = {
  id: string;
  payment_number: string;
  payment_date: string;
  payment_method: string;
  reference_no: string | null;
  amount: number;
  vendor_id: string;
  purchase_order_id: string | null;
  vendor: { id: string; name: string; company_name: string | null } | null;
  purchase_order: { id: string; po_number: string } | null;
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

async function fetchVendorPayments(): Promise<VPRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendor_payments")
    .select(
      "id, payment_number, payment_date, payment_method, reference_no, amount, " +
      "vendor_id, purchase_order_id, " +
      "vendor:vendors(id, name, company_name), " +
      "purchase_order:purchase_orders(id, po_number)"
    )
    .order("payment_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as VPRow[];
}

// ── Module-level row model factories (avoid recreation on every render) ────────

const coreRowModel    = getCoreRowModel<VPRow>();
const filteredRowModel = getFilteredRowModel<VPRow>();
const paginationRowModel = getPaginationRowModel<VPRow>();

// ── Global filter ─────────────────────────────────────────────────────────────

const globalFilter: FilterFn<VPRow> = (row, _col, filterValue: string) => {
  const q = filterValue.toLowerCase();
  const d = row.original;
  return (
    (d.payment_number ?? "").toLowerCase().includes(q) ||
    (d.vendor?.name ?? "").toLowerCase().includes(q) ||
    (d.vendor?.company_name ?? "").toLowerCase().includes(q) ||
    (d.reference_no ?? "").toLowerCase().includes(q) ||
    (d.purchase_order?.po_number ?? "").toLowerCase().includes(q)
  );
};

// ── Column definitions ────────────────────────────────────────────────────────

const columns: ColumnDef<VPRow>[] = [
  {
    accessorKey: "payment_number",
    header: "Payment #",
    cell: ({ getValue }) => (
      <span className="font-mono font-semibold text-primary text-xs">
        {String(getValue())}
      </span>
    ),
  },
  {
    accessorKey: "payment_date",
    header: "Date",
    cell: ({ getValue }) => fmtDate(String(getValue())),
  },
  {
    id: "vendor",
    header: "Vendor",
    cell: ({ row }) => {
      const v = row.original.vendor;
      if (!v) return <span className="text-muted-foreground">—</span>;
      return (
        <div>
          <p className="font-medium text-sm">{v.name}</p>
          {v.company_name && (
            <p className="text-xs text-muted-foreground">{v.company_name}</p>
          )}
        </div>
      );
    },
  },
  {
    id: "po_ref",
    header: "PO Ref",
    cell: ({ row }) => {
      const po = row.original.purchase_order;
      return po ? (
        <span className="font-mono text-xs text-muted-foreground">{po.po_number}</span>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      );
    },
  },
  {
    accessorKey: "payment_method",
    header: "Method",
    cell: ({ getValue }) => METHOD_LABELS[String(getValue())] ?? String(getValue()),
  },
  {
    accessorKey: "reference_no",
    header: "Reference",
    cell: ({ getValue }) => {
      const v = getValue();
      return v ? (
        <span className="font-mono text-xs text-muted-foreground">{String(v)}</span>
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

export default function VendorPaymentsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["vendor-payments-list"],
    queryFn: fetchVendorPayments,
    staleTime: 30000,
  });

  const totalAmount = useMemo(
    () => data.reduce((s, r) => s + r.amount, 0),
    [data]
  );

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter: search },
    onGlobalFilterChange: setSearch,
    globalFilterFn: globalFilter,
    getCoreRowModel: coreRowModel,
    getFilteredRowModel: filteredRowModel,
    getPaginationRowModel: paginationRowModel,
    initialState: { pagination: { pageSize: 20 } },
  });

  const filteredTotal = useMemo(
    () => table.getFilteredRowModel().rows.reduce((s, r) => s + r.original.amount, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table.getFilteredRowModel().rows, search]
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Vendor Payments"
        breadcrumbs={[{ label: "Vendor Payments" }]}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-4">

          {/* ── Search + summary ─────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search payment #, vendor, reference…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground shrink-0">
              {search
                ? `${table.getFilteredRowModel().rows.length} of ${data.length} · ${fmtINR(filteredTotal)}`
                : `${data.length} payments · ${fmtINR(totalAmount)}`}
            </div>
          </div>

          {/* ── Table ────────────────────────────────────────── */}
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 rounded" />)}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Could not load payments. Ensure migration 014 is applied.
                </p>
              </div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Banknote className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium text-sm">No payments recorded yet</p>
                <p className="text-xs text-muted-foreground">
                  Record a payment from a vendor&apos;s detail page.
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
                            if (row.original.vendor_id) {
                              router.push(`/vendors/${row.original.vendor_id}`);
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

                {/* ── Pagination ─────────────────────────────── */}
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
