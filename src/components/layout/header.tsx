"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

export function Header({ title, subtitle, actions, breadcrumbs }: HeaderProps) {
  const pathname = usePathname();

  const defaultBreadcrumbs = buildBreadcrumbs(pathname, title);
  const crumbs = breadcrumbs ?? defaultBreadcrumbs;

  return (
    <div className="flex h-14 items-center justify-between border-b bg-card px-3 sm:px-6 shrink-0 gap-2">
      <div className="min-w-0">
        {crumbs.length > 1 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5 overflow-hidden">
            {crumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1 min-w-0">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                <span className={`truncate ${i === crumbs.length - 1 ? "text-foreground font-medium" : ""}`}>
                  {crumb.label}
                </span>
              </span>
            ))}
          </div>
        )}
        <h1 className="text-base font-semibold leading-none truncate">
          {crumbs.length > 1 ? crumbs[crumbs.length - 1].label : title}
        </h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

const SEGMENT_LABELS: Record<string, string> = {
  settings:         "Administration",
  "company-profile": "Company Profile",
  "user-management": "User Management",
  "permissions":     "Permissions",
  "activity-log":    "Activity Log",
  "audit-logs":      "Audit Logs",
  dashboard:        "Dashboard",
  invoices:         "Invoices",
  quotations:       "Quotations",
  customers:        "Customers",
  products:         "Products",
  inventory:        "Inventory",
  vendors:          "Vendors",
  "purchase-orders": "Purchase Orders",
  grn:              "Goods Receipts",
  "vendor-payments": "Vendor Payments",
  reports:          "Reports",
  import:           "Import",
};

function buildBreadcrumbs(pathname: string, title: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return [{ label: title }];

  // Build readable crumbs from URL segments
  const crumbs = segments.map(seg => ({
    label: SEGMENT_LABELS[seg] ?? seg.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
  }));

  // De-duplicate consecutive identical labels
  return crumbs.filter((c, i) => i === 0 || c.label !== crumbs[i - 1].label);
}
