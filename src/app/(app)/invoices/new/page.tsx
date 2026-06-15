"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceForm, type InvoiceInitialData } from "../invoice-form";

// ── Quotation fetch (used when converting from quotation) ─────────────────────

async function fetchQuotationForConversion(id: string): Promise<InvoiceInitialData> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("id, customer_id, notes, billing_address, shipping_address, items:quotation_items(product_id, description, quantity, unit_price, tax_rate, sort_order)")
    .eq("id", id)
    .single();
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return {
    quotation_id:     d.id,
    customer_id:      d.customer_id,
    notes:            d.notes ?? null,
    billing_address:  d.billing_address  ?? null,
    shipping_address: d.shipping_address ?? null,
    items: (d.items ?? [])
      .sort((a: { sort_order: number | null }, b: { sort_order: number | null }) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((it: { product_id: string | null; description: string; quantity: number; unit_price: number; tax_rate: number }) => ({
        product_id:  it.product_id,
        description: it.description,
        quantity:    it.quantity,
        unit_price:  it.unit_price,
        tax_rate:    it.tax_rate,
      })),
  };
}

// ── Inner component (uses useSearchParams — must be inside Suspense) ──────────

function NewInvoiceContent() {
  const router       = useRouter();
  const queryClient  = useQueryClient();
  const searchParams = useSearchParams();
  const fromQuotationId = searchParams.get("from_quotation");
  const prefilledCustomerId = searchParams.get("customer_id");

  const { data: initialData, isLoading, error } = useQuery({
    queryKey: ["quotation-for-conversion", fromQuotationId],
    queryFn:  () => fetchQuotationForConversion(fromQuotationId!),
    enabled:  !!fromQuotationId,
    staleTime: Infinity,
    retry: 1,
  });

  function handleSuccess(id: string) {
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    router.push(`/invoices/${id}`);
  }

  const title = fromQuotationId ? "Invoice from Quotation" : "New Invoice";

  if (fromQuotationId && isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title={title}
          breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: "Loading…" }]}
        />
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 max-w-5xl mx-auto w-full space-y-4">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (fromQuotationId && error) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title={title}
          breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: "Error" }]}
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <p className="font-medium text-destructive">Failed to load quotation</p>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title={title}
        breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: title }]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <InvoiceForm
            initialData={initialData ?? (prefilledCustomerId ? { customer_id: prefilledCustomerId, quotation_id: null, notes: null, items: [] } : null)}
            onSuccess={handleSuccess}
            onCancel={() => router.push("/invoices")}
          />
        </div>
      </div>
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense>
      <NewInvoiceContent />
    </Suspense>
  );
}
