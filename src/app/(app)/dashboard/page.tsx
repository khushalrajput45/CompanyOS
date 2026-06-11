"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  AlertTriangle,
  XCircle,
  Clock,
  DollarSign,
  MapPin,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useProfile } from "@/lib/hooks/useProfile";
import { format } from "date-fns";

async function fetchDashboardData() {
  const supabase = createClient();

  const [
    { data: products },
    { data: stockLevels },
    { data: locations },
    { data: priceHistory },
    { data: recentMovements },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku, cost_price, selling_price, reorder_point")
      .is("deleted_at", null)
      .eq("is_active", true),
    supabase.from("stock_levels").select("product_id, quantity, product:products(name,sku,reorder_point)"),
    supabase.from("locations").select("id").eq("is_active", true),
    supabase
      .from("price_history")
      .select("id, product:products(name,sku), new_selling_price, old_selling_price, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("stock_movements")
      .select("id, movement_type, quantity, created_at, product:products(name,sku)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const productMap = new Map((products ?? []).map((p) => [p.id, p]));
  const stockByProduct = new Map<string, number>();
  for (const sl of stockLevels ?? []) {
    stockByProduct.set(sl.product_id, (stockByProduct.get(sl.product_id) ?? 0) + sl.quantity);
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

  const lowStockItems = (stockLevels ?? []).filter((sl) => {
    const reorder = (sl.product as { reorder_point?: number })?.reorder_point ?? 0;
    return sl.quantity > 0 && sl.quantity <= reorder;
  });

  return {
    inventoryValue,
    lowStockCount,
    outOfStockCount,
    deadStockCount,
    totalProducts: productMap.size,
    totalLocations: locations?.length ?? 0,
    priceHistory: priceHistory ?? [],
    recentMovements: recentMovements ?? [],
    lowStockItems: lowStockItems.slice(0, 5),
  };
}

export default function DashboardPage() {
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: fetchDashboardData,
  });

  const kpis = useMemo(
    () => [
      {
        title: "Total Products",
        value: data?.totalProducts ?? 0,
        icon: Package,
        iconBg: "bg-blue-50",
        iconColor: "text-blue-600",
      },
      {
        title: "Low Stock Items",
        value: data?.lowStockCount ?? 0,
        icon: AlertTriangle,
        iconBg: "bg-yellow-50",
        iconColor: "text-yellow-600",
      },
      {
        title: "Out of Stock",
        value: data?.outOfStockCount ?? 0,
        icon: XCircle,
        iconBg: "bg-red-50",
        iconColor: "text-red-600",
      },
      {
        title: "Dead Stock",
        value: data?.deadStockCount ?? 0,
        icon: Clock,
        iconBg: "bg-orange-50",
        iconColor: "text-orange-600",
      },
      {
        title: "Inventory Value",
        value: isAdmin
          ? `₹${(data?.inventoryValue ?? 0).toLocaleString("en-IN")}`
          : "—",
        icon: DollarSign,
        iconBg: "bg-green-50",
        iconColor: "text-green-600",
      },
      {
        title: "Active Locations",
        value: data?.totalLocations ?? 0,
        icon: MapPin,
        iconBg: "bg-purple-50",
        iconColor: "text-purple-600",
      },
    ],
    [data, isAdmin]
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle={`Welcome back, ${profile?.full_name ?? "User"}`}
      />

      <div className="flex-1 p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {kpis.map(({ title, value, icon: Icon, iconBg, iconColor }) => (
            <Card key={title} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{title}</p>
                    <p className="text-2xl font-bold text-foreground">
                      {isLoading ? "—" : value}
                    </p>
                  </div>
                  <div className={`rounded-lg p-2 ${iconBg}`}>
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Activity columns */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Recent Price Changes */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Recent Price Changes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : data?.priceHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No recent changes</p>
              ) : (
                data?.priceHistory.map((ph) => {
                  const product = ph.product as { name?: string; sku?: string } | null;
                  const up = (ph.new_selling_price ?? 0) > (ph.old_selling_price ?? 0);
                  return (
                    <div key={ph.id} className="flex items-center gap-3">
                      <div className={`rounded-full p-1 ${up ? "bg-green-50" : "bg-red-50"}`}>
                        {up ? (
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{product?.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          ₹{ph.old_selling_price} → ₹{ph.new_selling_price}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {ph.created_at ? format(new Date(ph.created_at), "dd MMM") : ""}
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Recent Stock Movements */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Recent Stock Updates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : data?.recentMovements.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No recent movements</p>
              ) : (
                data?.recentMovements.map((mv) => {
                  const product = mv.product as { name?: string; sku?: string } | null;
                  const isIn = ["receipt", "transfer_in", "return"].includes(mv.movement_type);
                  return (
                    <div key={mv.id} className="flex items-center gap-3">
                      <div className={`rounded-full p-1 ${isIn ? "bg-green-50" : "bg-red-50"}`}>
                        <span className={`text-[10px] font-bold ${isIn ? "text-green-600" : "text-red-600"}`}>
                          {isIn ? "IN" : "OUT"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{product?.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {mv.movement_type.replace("_", " ")} · qty {mv.quantity}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {mv.created_at ? format(new Date(mv.created_at), "dd MMM") : ""}
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Low Stock Alerts */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : data?.lowStockItems.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">All stock levels OK</p>
              ) : (
                data?.lowStockItems.map((sl, i) => {
                  const product = sl.product as { name?: string; sku?: string; reorder_point?: number } | null;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="rounded-full p-1 bg-yellow-50">
                        <AlertTriangle className="h-3 w-3 text-yellow-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{product?.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Qty: {sl.quantity} / Reorder: {product?.reorder_point}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-[10px] shrink-0">
                        Low
                      </Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
