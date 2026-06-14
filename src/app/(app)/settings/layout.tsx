"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Users, Shield, History, ClipboardList } from "lucide-react";
import { useProfile } from "@/lib/hooks/useProfile";

const SETTINGS_NAV = [
  {
    href: "/settings/company-profile",
    label: "Company Profile",
    description: "Business details, branding & documents",
    icon: Building2,
    minRole: ["owner", "admin", "manager", "employee", "viewer"],
  },
  {
    href: "/settings/user-management",
    label: "User Management",
    description: "Team members, roles & invitations",
    icon: Users,
    minRole: ["owner", "admin"],
  },
  {
    href: "/settings/permissions",
    label: "Permissions",
    description: "Module access by role",
    icon: Shield,
    minRole: ["owner", "admin"],
  },
  {
    href: "/settings/activity-log",
    label: "Activity Log",
    description: "Admin actions & audit trail",
    icon: History,
    minRole: ["owner", "admin"],
  },
  {
    href: "/settings/audit-logs",
    label: "Audit Logs",
    description: "Full ERP action history",
    icon: ClipboardList,
    minRole: ["owner", "admin"],
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: profile } = useProfile();
  const role = profile?.role ?? "";

  const visibleNav = SETTINGS_NAV.filter(item => item.minRole.includes(role));

  return (
    <div className="flex h-full min-h-0">
      {/* Settings sidebar */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col border-r bg-muted/20">
        <div className="px-4 pt-5 pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Administration
          </p>
        </div>
        <nav className="flex-1 px-2 pb-4 space-y-0.5">
          {visibleNav.map(item => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-start gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors group ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"}`} />
                <div>
                  <p className={`font-medium leading-none ${active ? "text-primary-foreground" : ""}`}>
                    {item.label}
                  </p>
                  <p className={`text-[10px] mt-0.5 leading-tight ${active ? "text-primary-foreground/70" : "text-muted-foreground/70"}`}>
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
