"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { POForm } from "../../po-form";
import type { PurchaseOrder, PurchaseOrderItem } from "@/lib/types";

async function fetchPO(id: string): Promise<PurchaseOrder & { items: PurchaseOrderItem[] }> {
  const supabase = createClient();
  const [{ data: po, error: poErr }, { data: items, error: itemsErr }] = await Promise.all([
    supabase.from("purchase_orders").select("*, vendor:vendors(id,name,company_name)").eq("id", id).single(),
    supabase.from("purchase_order_items").select("*, product:products(id,sku,name)").eq("purchase_order_id", id).order("sort_order"),
  ]);
  if (poErr) throw poErr;
  if (itemsErr) throw itemsErr;
  return { ...(po as PurchaseOrder), items: (items ?? []) as PurchaseOrderItem[] };
}

export default function EditPOPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const queryClient = useQueryClient();

  const { data: po, isLoading, error } = useQuery({
    queryKey: ["purchase-order-edit", id],
    queryFn: () => fetchPO(id),
    staleTime: 30000,
    retry: 1,
  });

  function handleSuccess(poId: string) {
    queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    queryClient.invalidateQueries({ queryKey: ["purchase-order", poId] });
    queryClient.invalidateQueries({ queryKey: ["purchase-order-edit", poId] });
    router.push(`/purchase-orders/${poId}`);
  }

  // Block edit for partial/received/cancelled
  const blockEdit = po && !["draft", "sent"].includes(po.status);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Edit Purchase Order"
          breadcrumbs={[{ label: "Purchase Orders", href: "/purchase-orders" }, { label: "Loading…" }]} />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-60 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Edit Purchase Order"
          breadcrumbs={[{ label: "Purchase Orders", href: "/purchase-orders" }, { label: "Not Found" }]} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Purchase order not found</p>
            <Button variant="outline" size="sm" onClick={() => router.push("/purchase-orders")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back to Purchase Orders
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (blockEdit) {
    return (
      <div className="flex flex-col h-full">
        <Header title={`Edit — ${po.po_number}`}
          breadcrumbs={[
            { label: "Purchase Orders", href: "/purchase-orders" },
            { label: po.po_number, href: `/purchase-orders/${id}` },
            { label: "Edit" },
          ]} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Cannot edit a {po.status} purchase order</p>
            <p className="text-sm text-muted-foreground">
              Only draft and sent orders can be edited.
            </p>
            <Button variant="outline" size="sm" onClick={() => router.push(`/purchase-orders/${id}`)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back to PO
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`Edit — ${po.po_number}`}
        breadcrumbs={[
          { label: "Purchase Orders", href: "/purchase-orders" },
          { label: po.po_number, href: `/purchase-orders/${id}` },
          { label: "Edit" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <POForm
            po={po}
            onSuccess={handleSuccess}
            onCancel={() => router.push(`/purchase-orders/${id}`)}
          />
        </div>
      </div>
    </div>
  );
}
