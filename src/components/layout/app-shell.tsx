"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, Building2 } from "lucide-react";
import { Sidebar } from "./sidebar";
import { useCompanySettings } from "@/lib/hooks/useCompanySettings";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { data: companySettings } = useCompanySettings();

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* ── Mobile sidebar overlay ──────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          style={{ background: "rgba(0,0,0,0.45)" }}
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* ── Main area ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Mobile top bar */}
        <div className="flex md:hidden items-center gap-3 px-4 h-12 border-b bg-sidebar shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white/80 hover:text-white p-1 -ml-1"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary shrink-0 overflow-hidden">
              {companySettings?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={companySettings.logo_url} alt="logo" className="h-full w-full object-contain" />
              ) : (
                <Building2 className="h-3.5 w-3.5 text-white" />
              )}
            </div>
            <span className="text-sm font-bold text-white truncate">
              {companySettings?.company_name ?? "Your Company"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
}
