"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  AlertTriangle,
  XCircle,
  Clock,
  DollarSign,
  MapPin,
} from "lucide-react";
import { useProfile } from "@/lib/hooks/useProfile";

async function fetchDashboardKPIs() {
  const supabase = createClient();

  const [{ data: products }, { data: stockLevels }, { data: locations }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, cost_price, selling_price, reorder_point")
        .is("deleted_at", null)
        .eq("is_active", true),
      supabase.from("stock_levels").select("product_id, quantity"),
      supabase.from("locations").select("id").eq("is_active", true),
    ]);

  const productMap = new Map(
    (products ?? []).map((p) => [p.id, p])
  );

  const stockByProduct = new Map<string, number>();
  for (const sl of stockLevels ?? []) {
    stockByProduct.set(
      sl.product_id,
      (stockByProduct.get(sl.product_id) ?? 0) + sl.quantity
    );
  }

  let inventoryValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let deadStockCount = 0;

  for (const [pid, product] of productMap) {
    const qty = stockByProduct.get(pid) ?? 0;
    inventoryValue += qty * (product.cost_price ?? product.selling_price ?? 0);
    if (qty === 0) outOfStockCount++;
    else if (qty <= product.reorder_point) lowStockCount++;
    if (product.reorder_point > 0 && qty > product.reorder_point * 10) deadStockCount++;
  }

  return {
    inventoryValue,
    lowStockCount,
    outOfStockCount,
    deadStockCount,
    totalProducts: productMap.size,
    totalLocations: locations?.length ?? 0,
  };
}

export default function DashboardPage() {
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  const { data: kpis, isLoading } = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: fetchDashboardKPIs,
  });

  const cards = [
    {
      title: "Total Products",
      value: kpis?.totalProducts ?? 0,
      icon: Package,
      color: "text-blue-600",
      show: true,
    },
    {
      title: "Low Stock Items",
      value: kpis?.lowStockCount ?? 0,
      icon: AlertTriangle,
      color: "text-yellow-600",
      show: true,
    },
    {
      title: "Out of Stock",
      value: kpis?.outOfStockCount ?? 0,
      icon: XCircle,
      color: "text-red-600",
      show: true,
    },
    {
      title: "Dead Stock Items",
      value: kpis?.deadStockCount ?? 0,
      icon: Clock,
      color: "text-orange-600",
      show: true,
    },
    {
      title: "Inventory Value",
      value: isAdmin
        ? `₹${(kpis?.inventoryValue ?? 0).toLocaleString("en-IN")}`
        : "—",
      icon: DollarSign,
      color: "text-green-600",
      show: true,
    },
    {
      title: "Active Locations",
      value: kpis?.totalLocations ?? 0,
      icon: MapPin,
      color: "text-purple-600",
      show: true,
    },
  ];

  return (
    <div>
      <Header title="Dashboard" />
      <div className="p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-20 bg-muted rounded-t-lg" />
                <CardContent className="h-10 bg-muted/50 rounded-b-lg" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ title, value, icon: Icon, color }) => (
              <Card key={title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
