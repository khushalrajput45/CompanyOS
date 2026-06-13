"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { VendorForm } from "../vendor-form";

export default function NewVendorPage() {
  const router      = useRouter();
  const queryClient = useQueryClient();

  function handleSuccess(id: string) {
    queryClient.invalidateQueries({ queryKey: ["vendors"] });
    router.push(`/vendors/${id}`);
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Add Vendor"
        breadcrumbs={[{ label: "Vendors", href: "/vendors" }, { label: "New Vendor" }]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-lg border bg-card shadow-sm p-6">
            <VendorForm
              onSuccess={handleSuccess}
              onCancel={() => router.push("/vendors")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
