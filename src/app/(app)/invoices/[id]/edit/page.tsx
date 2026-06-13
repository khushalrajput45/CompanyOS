"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { InvoiceForm } from "../../invoice-form";
import type { Invoice } from "@/lib/types";

async function fetchInvoiceWithItems(id: string): Promise<Invoice> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, items:invoice_items(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return {
    ...d,
    items: (d.items ?? []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    ),
  };
}

export default function EditInvoicePage() {
  const { id }      = useParams<{ id: string }>();
  const router      = useRouter();
  const queryClient = useQueryClient();

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ["invoice-edit", id],
    queryFn:  () => fetchInvoiceWithItems(id),
    staleTime: 30000,
    retry: 1,
  });

  function handleSuccess(invoiceId: string) {
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    queryClient.invalidateQueries({ queryKey: ["invoice-edit", invoiceId] });
    router.push(`/invoices/${invoiceId}`);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="Edit Invoice"
          breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: "Loading…" }]}
        />
        <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-4">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="Edit Invoice"
          breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: "Not Found" }]}
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Invoice not found</p>
            <Button variant="outline" size="sm" onClick={() => router.push("/invoices")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back to Invoices
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`Edit — ${invoice.invoice_number}`}
        breadcrumbs={[
          { label: "Invoices",          href: "/invoices" },
          { label: invoice.invoice_number, href: `/invoices/${id}` },
          { label: "Edit" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <InvoiceForm
            invoice={invoice}
            onSuccess={handleSuccess}
            onCancel={() => router.push(`/invoices/${id}`)}
          />
        </div>
      </div>
    </div>
  );
}
