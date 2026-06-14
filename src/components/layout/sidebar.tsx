"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  ShoppingBag,
  ClipboardList,
  Banknote,
  FileText,
  Receipt,
  Warehouse,
  BarChart3,
  FileUp,
  LogOut,
  Building2,
  ChevronDown,
  TrendingUp,
  ShoppingCart,
  FileSpreadsheet,
  SlidersHorizontal,
  UserCog,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { useCompanySettings } from "@/lib/hooks/useCompanySettings";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type NavItem  = { href: string; label: string; icon: React.ElementType };
type NavGroup = { key: string; label: string; icon: React.ElementType; items: NavItem[]; minRole?: string[] };

const NAV_GROUPS: NavGroup[] = [
  {
    key: "sales",
    label: "Sales",
    icon: TrendingUp,
    items: [
      { href: "/customers",  label: "Customers",  icon: Users    },
      { href: "/quotations", label: "Quotations", icon: FileText },
      { href: "/invoices",   label: "Invoices",   icon: Receipt  },
    ],
  },
  {
    key: "purchasing",
    label: "Purchasing",
    icon: ShoppingCart,
    items: [
      { href: "/vendors",         label: "Vendors",         icon: Truck         },
      { href: "/purchase-orders", label: "Purchase Orders", icon: ShoppingBag   },
      { href: "/grn",             label: "Goods Receipts",  icon: ClipboardList },
      { href: "/vendor-payments", label: "Vendor Payments", icon: Banknote      },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    icon: Package,
    items: [
      { href: "/products",  label: "Products",  icon: Package   },
      { href: "/inventory", label: "Inventory", icon: Warehouse },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    icon: BarChart3,
    minRole: ["owner", "admin", "manager"],
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    icon: SlidersHorizontal,
    minRole: ["owner", "admin"],
    items: [
      { href: "/settings/company-profile", label: "Company Profile", icon: Building2 },
      { href: "/settings/user-management", label: "User Management",  icon: UserCog   },
    ],
  },
  {
    key: "import-export",
    label: "Import / Export",
    icon: FileSpreadsheet,
    minRole: ["owner", "admin"],
    items: [
      { href: "/import", label: "Excel Import", icon: FileUp },
    ],
  },
];

export function Sidebar({ onClose }: { onClose?: () => void } = {}) {
  const pathname = usePathname();
  const router   = useRouter();
  const { data: profile } = useProfile();
  const { data: companySettings } = useCompanySettings();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(NAV_GROUPS.map(g => [g.key, true]))
  );

  function toggleGroup(key: string) {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleLogout() {
    // Log before signing out so the session is still valid
    await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout", module: "authentication" }),
    }).catch(() => {});
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <aside className="flex h-screen w-60 flex-col bg-sidebar text-sidebar-foreground shrink-0">

      {/* Company branding */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0 overflow-hidden">
          {companySettings?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={companySettings.logo_url} alt="logo" className="h-full w-full object-contain p-0.5" />
          ) : (
            <span className="text-[11px] font-bold text-white leading-none">
              {companySettings?.company_name
                ? companySettings.company_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
                : <Building2 className="h-4 w-4 text-white" />
              }
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white leading-none truncate">
            {companySettings?.company_name ?? "Your Company"}
          </p>
          <p className="text-[10px] text-sidebar-foreground/50 mt-0.5">ERP Platform</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/50 hover:text-white p-1 -mr-1 shrink-0">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">

        <Link
          href="/dashboard"
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            pathname === "/dashboard" || pathname.startsWith("/dashboard/")
              ? "bg-sidebar-accent text-white"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-white"
          }`}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          Dashboard
        </Link>

        <div className="pt-2 pb-1">
          <div className="border-t border-sidebar-border/50" />
        </div>

        {NAV_GROUPS.filter(group =>
          !group.minRole || group.minRole.includes(profile?.role ?? "")
        ).map(group => {
          const GroupIcon = group.icon;
          const isOpen    = openGroups[group.key] ?? true;
          const hasActive = group.items.some(
            item => pathname === item.href || pathname.startsWith(item.href + "/")
          );

          return (
            <div key={group.key}>
              <button
                onClick={() => toggleGroup(group.key)}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  hasActive ? "text-sidebar-foreground/80" : "text-sidebar-foreground/40 hover:text-sidebar-foreground/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <GroupIcon className="h-3.5 w-3.5 shrink-0" />
                  {group.label}
                </div>
                <ChevronDown
                  className="h-3 w-3 shrink-0 opacity-60 transition-transform duration-150"
                  style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                />
              </button>

              <div
                className="overflow-hidden transition-all duration-150"
                style={{ maxHeight: isOpen ? "400px" : "0px" }}
              >
                <div className="mt-0.5 mb-1 space-y-0.5">
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + "/");
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-2.5 rounded-md pl-7 pr-3 py-1.5 text-sm transition-colors ${
                          active
                            ? "bg-sidebar-accent text-white font-medium"
                            : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-white"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3 shrink-0">
        <div className="flex items-center gap-3 px-1 py-1">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary text-white text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">
              {profile?.full_name ?? "User"}
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 capitalize">
              {profile?.role ?? ""}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sidebar-foreground/40 hover:text-white transition-colors p-1 rounded"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

    </aside>
  );
}
