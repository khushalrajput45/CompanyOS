"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Package,
  Boxes,
  AlertTriangle,
  XCircle,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  PackageOpen,
  TrendingDown,
  FileUp,
  Download,
  Plus,
  Minus,
  Clock,
} from "lucide-react";
import { useProfile } from "@/lib/hooks/useProfile";
import { format } from "date-fns";
import { StockMovementForm } from "../inventory/stock-movement-form";
import Link from "next/link";
import * as XLSX from "xlsx";

const IN_TYPES = ["receipt", "transfer_in", "return", "adjustment"];
const OUT_TYPES = ["sale", "transfer_out", "damage"];

async function fetchDashboardData() {
  const supabase = createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { data: products },
    { data: stockLevels },
    { data: categories },
    { data: todayMovements },
    { data: recentMovements },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku, cost_price, selling_price, reorder_point, category_id, brand:brands(id,name)")
      .is("deleted_at", null)
      .eq("is_active", true),
    supabase.from("stock_levels").select("product_id, quantity"),
    supabase.from("categories").select("id, name"),
    supabase
      .from("stock_movements")
      .select("movement_type, quantity")
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("stock_movements")
      .select("id, movement_type, quantity, created_at, product:products(name, sku)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const stockByProduct = new Map<string, number>();
  for (const sl of stockLevels ?? []) {
    stockByProduct.set(sl.product_id, (stockByProduct.get(sl.product_id) ?? 0) + sl.quantity);
  }

  const categoryMap = new Map<string, string>();
  for (const cat of categories ?? []) {
    categoryMap.set(cat.id, cat.name);
  }

  let totalUnits = 0;
  let inventoryCostValue = 0;
  let inventorySaleValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let deadStockValue = 0;
  let deadStockUnits = 0;
  let reorderRequiredCount = 0;

  const categoryValueMap = new Map<string, { name: string; costValue: number; saleValue: number }>();
  const productValues: { id: string; name: string; sku: string; qty: number; costValue: number; saleValue: number }[] = [];
  const lowStockItems: { id: string; name: string; sku: string; currentStock: number; reorderPoint: number; brand: string }[] = [];

  for (const p of products ?? []) {
    const qty = stockByProduct.get(p.id) ?? 0;
    const costPrice = p.cost_price ?? p.selling_price ?? 0;
    const salePrice = p.selling_price ?? 0;

    totalUnits += qty;
    inventoryCostValue += qty * costPrice;
    inventorySaleValue += qty * salePrice;

    if (qty === 0) outOfStockCount++;
    if (qty > 0 && qty <= p.reorder_point) lowStockCount++;
    if (qty <= p.reorder_point) reorderRequiredCount++;

    if (p.reorder_point > 0 && qty > p.reorder_point * 10) {
      deadStockValue += qty * costPrice;
      deadStockUnits += qty;
    }

    if (p.category_id) {
      const catName = categoryMap.get(p.category_id) ?? "Other";
      const existing = categoryValueMap.get(p.category_id) ?? { name: catName, costValue: 0, saleValue: 0 };
      existing.costValue += qty * costPrice;
      existing.saleValue += qty * salePrice;
      categoryValueMap.set(p.category_id, existing);
    }

    if (qty > 0) {
      productValues.push({ id: p.id, name: p.name, sku: p.sku, qty, costValue: qty * costPrice, saleValue: qty * salePrice });
    }

    if (qty > 0 && qty <= p.reorder_point) {
      const brand = (p.brand as { name?: string } | null)?.name ?? "—";
      lowStockItems.push({ id: p.id, name: p.name, sku: p.sku, currentStock: qty, reorderPoint: p.reorder_point, brand });
    }
  }

  const grossMarginValue = inventorySaleValue - inventoryCostValue;

  let todayStockIn = 0;
  let todayStockOut = 0;
  for (const mv of todayMovements ?? []) {
    if (IN_TYPES.includes(mv.movement_type)) todayStockIn += mv.quantity;
    else if (OUT_TYPES.includes(mv.movement_type)) todayStockOut += mv.quantity;
  }

  const topProducts = productValues
    .sort((a, b) => b.saleValue - a.saleValue)
    .slice(0, 10);

  const categoryData = Array.from(categoryValueMap.values())
    .filter((c) => c.saleValue > 0 || c.costValue > 0)
    .sort((a, b) => b.saleValue - a.saleValue)
    .slice(0, 8);

  return {
    totalSKUs: products?.length ?? 0,
    totalUnits,
    inventoryCostValue,
    inventorySaleValue,
    grossMarginValue,
    lowStockCount,
    outOfStockCount,
    deadStockValue,
    deadStockUnits,
    todayStockIn,
    todayStockOut,
    reorderRequiredCount,
    categoryData,
    topProducts,
    lowStockItems: lowStockItems.slice(0, 15),
    recentMovements: recentMovements ?? [],
  };
}

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtShort(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  loading: boolean;
  sub?: string;
}

function KpiCard({ title, value, icon: Icon, iconBg, iconColor, loading, sub }: KpiCardProps) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground mb-1 leading-tight">{title}</p>
            <p className="text-xl font-bold text-foreground truncate">
              {loading ? "—" : value}
            </p>
            {sub && !loading && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
            )}
          </div>
          <div className={`rounded-lg p-2 shrink-0 ${iconBg}`}>
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  const [stockInOpen, setStockInOpen] = useState(false);
  const [stockOutOpen, setStockOutOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: fetchDashboardData,
    staleTime: 30000,
  });

  const row1 = useMemo<KpiCardProps[]>(
    () => [
      {
        title: "Total SKUs",
        value: data?.totalSKUs ?? 0,
        icon: Package,
        iconBg: "bg-blue-50",
        iconColor: "text-blue-600",
        loading: isLoading,
      },
      {
        title: "Total Units in Warehouse",
        value: (data?.totalUnits ?? 0).toLocaleString("en-IN"),
        icon: Boxes,
        iconBg: "bg-indigo-50",
        iconColor: "text-indigo-600",
        loading: isLoading,
      },
      {
        title: "Inventory Cost Value",
        value: isAdmin ? fmtShort(data?.inventoryCostValue ?? 0) : "—",
        icon: TrendingDown,
        iconBg: "bg-orange-50",
        iconColor: "text-orange-600",
        loading: isLoading,
        sub: isAdmin && data ? fmt(data.inventoryCostValue) : undefined,
      },
      {
        title: "Inventory Sale Value",
        value: isAdmin ? fmtShort(data?.inventorySaleValue ?? 0) : "—",
        icon: TrendingUp,
        iconBg: "bg-green-50",
        iconColor: "text-green-600",
        loading: isLoading,
        sub: isAdmin && data ? fmt(data.inventorySaleValue) : undefined,
      },
      {
        title: "Gross Margin Value",
        value: isAdmin ? fmtShort(data?.grossMarginValue ?? 0) : "—",
        icon: TrendingUp,
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-600",
        loading: isLoading,
        sub: isAdmin && data ? fmt(data.grossMarginValue) : undefined,
      },
      {
        title: "Low Stock Count",
        value: data?.lowStockCount ?? 0,
        icon: AlertTriangle,
        iconBg: "bg-yellow-50",
        iconColor: "text-yellow-600",
        loading: isLoading,
      },
    ],
    [data, isAdmin, isLoading]
  );

  const row2 = useMemo<KpiCardProps[]>(
    () => [
      {
        title: "Out of Stock",
        value: data?.outOfStockCount ?? 0,
        icon: XCircle,
        iconBg: "bg-red-50",
        iconColor: "text-red-600",
        loading: isLoading,
      },
      {
        title: "Dead Stock Value",
        value: isAdmin ? fmtShort(data?.deadStockValue ?? 0) : "—",
        icon: PackageOpen,
        iconBg: "bg-gray-50",
        iconColor: "text-gray-500",
        loading: isLoading,
      },
      {
        title: "Dead Stock Units",
        value: (data?.deadStockUnits ?? 0).toLocaleString("en-IN"),
        icon: Clock,
        iconBg: "bg-slate-50",
        iconColor: "text-slate-500",
        loading: isLoading,
      },
      {
        title: "Today's Stock In",
        value: (data?.todayStockIn ?? 0).toLocaleString("en-IN"),
        icon: ArrowDownCircle,
        iconBg: "bg-green-50",
        iconColor: "text-green-600",
        loading: isLoading,
        sub: "units received today",
      },
      {
        title: "Today's Stock Out",
        value: (data?.todayStockOut ?? 0).toLocaleString("en-IN"),
        icon: ArrowUpCircle,
        iconBg: "bg-blue-50",
        iconColor: "text-blue-600",
        loading: isLoading,
        sub: "units dispatched today",
      },
      {
        title: "Reorder Required",
        value: data?.reorderRequiredCount ?? 0,
        icon: RefreshCw,
        iconBg: "bg-purple-50",
        iconColor: "text-purple-600",
        loading: isLoading,
      },
    ],
    [data, isAdmin, isLoading]
  );

  function exportDashboard() {
    if (!data) return;
    const kpiSheet = [
      { Metric: "Total SKUs", Value: data.totalSKUs },
      { Metric: "Total Units in Warehouse", Value: data.totalUnits },
      ...(isAdmin
        ? [
            { Metric: "Inventory Cost Value", Value: data.inventoryCostValue },
            { Metric: "Inventory Sale Value", Value: data.inventorySaleValue },
            { Metric: "Gross Margin Value", Value: data.grossMarginValue },
          ]
        : []),
      { Metric: "Low Stock Count", Value: data.lowStockCount },
      { Metric: "Out of Stock Count", Value: data.outOfStockCount },
      { Metric: "Dead Stock Units", Value: data.deadStockUnits },
      { Metric: "Today Stock In", Value: data.todayStockIn },
      { Metric: "Today Stock Out", Value: data.todayStockOut },
      { Metric: "Reorder Required", Value: data.reorderRequiredCount },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiSheet), "Dashboard KPIs");
    if (isAdmin) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          data.topProducts.map((p) => ({
            SKU: p.sku,
            Product: p.name,
            Qty: p.qty,
            "Cost Value": p.costValue,
            "Sale Value": p.saleValue,
          }))
        ),
        "Top Products"
      );
    }
    XLSX.writeFile(wb, `warehouse-dashboard-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Warehouse Dashboard"
        subtitle="IT Hardware Inventory Overview"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="default" onClick={() => setStockInOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Stock In
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStockOutOpen(true)}>
              <Minus className="h-3.5 w-3.5 mr-1.5" />
              Stock Out
            </Button>
            <Link href="/import">
              <Button size="sm" variant="outline">
                <FileUp className="h-3.5 w-3.5 mr-1.5" />
                Import
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={exportDashboard} disabled={isLoading || !data}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Row 1 — Primary KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {row1.map((kpi) => (
            <KpiCard key={kpi.title} {...kpi} />
          ))}
        </div>

        {/* Row 2 — Secondary KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {row2.map((kpi) => (
            <KpiCard key={kpi.title} {...kpi} />
          ))}
        </div>

        {/* Row 3 — Category Chart + Top Products */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Category Chart */}
          <Card className="shadow-sm lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Inventory Value by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-52 bg-muted rounded animate-pulse" />
              ) : (data?.categoryData.length ?? 0) === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
                  No category data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data?.categoryData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={fmtShort}
                      width={60}
                    />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, name: any) => [fmt(value as number), name as string]}
                      contentStyle={{ fontSize: 12, borderRadius: "6px" }}
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                    {isAdmin && (
                      <Bar dataKey="costValue" name="Cost Value" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    )}
                    <Bar dataKey="saleValue" name="Sale Value" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top 10 Highest Value Products */}
          <Card className="shadow-sm lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top 10 Highest Value Products</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[260px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-2">Product</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-2 text-right">Qty</TableHead>
                      {isAdmin && (
                        <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-2 text-right">Cost Val</TableHead>
                      )}
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-2 text-right">Sale Val</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 4 : 3} className="text-center py-8 text-muted-foreground text-sm">Loading...</TableCell>
                      </TableRow>
                    ) : (data?.topProducts ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 4 : 3} className="text-center py-8 text-muted-foreground text-sm">No data</TableCell>
                      </TableRow>
                    ) : (
                      data?.topProducts.map((p) => (
                        <TableRow key={p.id} className="hover:bg-muted/30">
                          <TableCell className="py-1.5">
                            <div>
                              <p className="text-xs font-medium truncate max-w-[120px]">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground">{p.sku}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-right py-1.5">{p.qty}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-xs text-right py-1.5">{fmtShort(p.costValue)}</TableCell>
                          )}
                          <TableCell className="text-xs text-right py-1.5 font-medium text-green-600">{fmtShort(p.saleValue)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 4 — Low Stock Alerts + Recent Movements */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Low Stock Alert Table */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                Low Stock Alerts
                {(data?.lowStockItems.length ?? 0) > 0 && (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-xs">
                    {data?.lowStockItems.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-2">Product</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-2 text-center">Stock</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-2 text-center">Reorder</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-2">Brand</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">Loading...</TableCell></TableRow>
                  ) : (data?.lowStockItems.length ?? 0) === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">All stock levels OK</TableCell></TableRow>
                  ) : (
                    data?.lowStockItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="py-2">
                          <p className="text-xs font-medium truncate max-w-[140px]">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">{item.sku}</p>
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <span className="text-xs font-semibold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
                            {item.currentStock}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-center py-2 text-muted-foreground">{item.reorderPoint}</TableCell>
                        <TableCell className="text-xs py-2 text-muted-foreground">{item.brand}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recent Stock Movements */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                Recent Stock Movements
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-2">Time</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-2">Product</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-2">Type</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-2 text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">Loading...</TableCell></TableRow>
                  ) : (data?.recentMovements.length ?? 0) === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">No movements yet</TableCell></TableRow>
                  ) : (
                    data?.recentMovements.map((mv) => {
                      const product = mv.product as { name?: string; sku?: string } | null;
                      const isIn = IN_TYPES.includes(mv.movement_type);
                      return (
                        <TableRow key={mv.id} className="hover:bg-muted/30">
                          <TableCell className="text-[10px] text-muted-foreground py-2 whitespace-nowrap">
                            {mv.created_at ? format(new Date(mv.created_at), "dd MMM HH:mm") : "—"}
                          </TableCell>
                          <TableCell className="py-2">
                            <p className="text-xs font-medium truncate max-w-[120px]">{product?.name ?? "—"}</p>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] capitalize ${isIn ? "text-green-600 border-green-300 bg-green-50" : "text-red-600 border-red-300 bg-red-50"}`}
                            >
                              {mv.movement_type.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-right py-2">
                            <span className={isIn ? "text-green-600" : "text-red-600"}>
                              {isIn ? "+" : "-"}{mv.quantity}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stock In Dialog */}
      <Dialog open={stockInOpen} onOpenChange={setStockInOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Stock In</DialogTitle>
          </DialogHeader>
          <StockMovementForm
            defaultMovementType="receipt"
            onSuccess={() => {
              setStockInOpen(false);
              queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Stock Out Dialog */}
      <Dialog open={stockOutOpen} onOpenChange={setStockOutOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Stock Out</DialogTitle>
          </DialogHeader>
          <StockMovementForm
            defaultMovementType="sale"
            onSuccess={() => {
              setStockOutOpen(false);
              queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
