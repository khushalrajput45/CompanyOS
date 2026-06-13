"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { VendorForm } from "../../vendor-form";
import type { Vendor } from "@/lib/types";

async function fetchVendor(id: string): Promise<Vendor> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export default function EditVendorPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const queryClient = useQueryClient();

  const { data: vendor, isLoading, error } = useQuery({
    queryKey: ["vendor", id],
    queryFn: () => fetchVendor(id),
    staleTime: 30000,
    retry: 1,
  });

  function handleSuccess(vendorId: string) {
    queryClient.invalidateQueries({ queryKey: ["vendors"] });
    queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] });
    router.push(`/vendors/${vendorId}`);
  }

  const displayName = vendor?.company_name ?? vendor?.name ?? "Edit Vendor";

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="Edit Vendor"
          breadcrumbs={[{ label: "Vendors", href: "/vendors" }, { label: "Loading…" }]}
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

  if (error || !vendor) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="Edit Vendor"
          breadcrumbs={[{ label: "Vendors", href: "/vendors" }, { label: "Not Found" }]}
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Vendor not found</p>
            <Button variant="outline" size="sm" onClick={() => router.push("/vendors")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Vendors
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
          { label: "Vendors", href: "/vendors" },
          { label: displayName, href: `/vendors/${id}` },
          { label: "Edit" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-lg border bg-card shadow-sm p-6">
            <VendorForm
              vendor={vendor}
              onSuccess={handleSuccess}
              onCancel={() => router.push(`/vendors/${id}`)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
