"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { CustomerForm } from "../customer-form";

export default function NewCustomerPage() {
  const router      = useRouter();
  const queryClient = useQueryClient();

  function handleSuccess(id: string) {
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    router.push(`/customers/${id}`);
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Add Customer"
        breadcrumbs={[{ label: "Customers", href: "/customers" }, { label: "New Customer" }]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-lg border bg-card shadow-sm p-6">
            <CustomerForm
              onSuccess={handleSuccess}
              onCancel={() => router.push("/customers")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
