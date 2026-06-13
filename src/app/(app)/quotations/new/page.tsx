"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { QuotationForm } from "../quotation-form";

export default function NewQuotationPage() {
  const router      = useRouter();
  const queryClient = useQueryClient();

  function handleSuccess(id: string) {
    queryClient.invalidateQueries({ queryKey: ["quotations"] });
    router.push(`/quotations/${id}`);
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="New Quotation"
        breadcrumbs={[{ label: "Quotations", href: "/quotations" }, { label: "New Quotation" }]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <QuotationForm
            onSuccess={handleSuccess}
            onCancel={() => router.push("/quotations")}
          />
        </div>
      </div>
    </div>
  );
}
