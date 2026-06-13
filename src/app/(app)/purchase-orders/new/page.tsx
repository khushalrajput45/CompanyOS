"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { POForm } from "../po-form";

export default function NewPOPage() {
  const router      = useRouter();
  const queryClient = useQueryClient();

  function handleSuccess(id: string) {
    queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    router.push(`/purchase-orders/${id}`);
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="New Purchase Order"
        breadcrumbs={[
          { label: "Purchase Orders", href: "/purchase-orders" },
          { label: "New PO" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <POForm
            onSuccess={handleSuccess}
            onCancel={() => router.push("/purchase-orders")}
          />
        </div>
      </div>
    </div>
  );
}
