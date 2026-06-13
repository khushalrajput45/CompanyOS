"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { QuotationForm } from "../../quotation-form";
import type { Quotation } from "@/lib/types";

async function fetchQuotationWithItems(id: string): Promise<Quotation> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("*, items:quotation_items(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return {
    ...d,
    items: (d.items ?? []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
  };
}

export default function EditQuotationPage() {
  const { id }      = useParams<{ id: string }>();
  const router      = useRouter();
  const queryClient = useQueryClient();

  const { data: quotation, isLoading, error } = useQuery({
    queryKey: ["quotation-edit", id],
    queryFn: () => fetchQuotationWithItems(id),
    staleTime: 30000,
    retry: 1,
  });

  function handleSuccess(quotationId: string) {
    queryClient.invalidateQueries({ queryKey: ["quotations"] });
    queryClient.invalidateQueries({ queryKey: ["quotation", quotationId] });
    queryClient.invalidateQueries({ queryKey: ["quotation-edit", quotationId] });
    router.push(`/quotations/${quotationId}`);
  }

  const displayName = quotation
    ? ((quotation.customer as unknown as { company_name?: string })?.company_name ?? "")
      || quotation.quotation_number
    : "Edit Quotation";

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="Edit Quotation"
          breadcrumbs={[{ label: "Quotations", href: "/quotations" }, { label: "Loading…" }]}
        />
        <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-4">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="Edit Quotation"
          breadcrumbs={[{ label: "Quotations", href: "/quotations" }, { label: "Not Found" }]}
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Quotation not found</p>
            <Button variant="outline" size="sm" onClick={() => router.push("/quotations")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back to Quotations
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`Edit — ${quotation.quotation_number}`}
        subtitle={displayName !== quotation.quotation_number ? displayName : undefined}
        breadcrumbs={[
          { label: "Quotations", href: "/quotations" },
          { label: quotation.quotation_number, href: `/quotations/${id}` },
          { label: "Edit" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <QuotationForm
            quotation={quotation}
            onSuccess={handleSuccess}
            onCancel={() => router.push(`/quotations/${id}`)}
          />
        </div>
      </div>
    </div>
  );
}
