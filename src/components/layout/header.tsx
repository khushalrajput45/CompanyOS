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
    <div className="flex h-14 items-center justify-between border-b bg-card px-6 shrink-0">
      <div>
        {crumbs.length > 1 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
            {crumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                <span className={i === crumbs.length - 1 ? "text-foreground font-medium" : ""}>
                  {crumb.label}
                </span>
              </span>
            ))}
          </div>
        )}
        <h1 className="text-base font-semibold leading-none">
          {crumbs.length > 1 ? crumbs[crumbs.length - 1].label : title}
        </h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

function buildBreadcrumbs(pathname: string, title: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return [{ label: title }];
  return [{ label: "Home" }, { label: title }];
}
