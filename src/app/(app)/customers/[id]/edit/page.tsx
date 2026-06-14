"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { CustomerForm } from "../../customer-form";
import type { Customer } from "@/lib/types";

async function fetchCustomer(id: string): Promise<Customer> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export default function EditCustomerPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const queryClient = useQueryClient();

  const { data: customer, isLoading, error } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer(id),
    retry: 1,
  });

  function handleSuccess(customerId: string) {
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
    router.push(`/customers/${customerId}`);
  }

  const displayName = customer?.company_name ?? customer?.name ?? "Edit Customer";

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="Edit Customer"
          breadcrumbs={[
            { label: "Customers", href: "/customers" },
            { label: "Loading…" },
          ]}
        />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-36 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="Edit Customer"
          breadcrumbs={[{ label: "Customers", href: "/customers" }, { label: "Not Found" }]}
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Customer not found</p>
            <Button variant="outline" size="sm" onClick={() => router.push("/customers")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Customers
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`Edit — ${displayName}`}
        breadcrumbs={[
          { label: "Customers", href: "/customers" },
          { label: displayName, href: `/customers/${id}` },
          { label: "Edit" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-lg border bg-card shadow-sm p-6">
            <CustomerForm
              customer={customer}
              onSuccess={handleSuccess}
              onCancel={() => router.push(`/customers/${id}`)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
