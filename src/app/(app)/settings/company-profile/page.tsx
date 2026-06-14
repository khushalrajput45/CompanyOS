"use client";

import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/lib/hooks/useProfile";
import { useCompanySettings } from "@/lib/hooks/useCompanySettings";
import { CompanyProfileSettings } from "../company-profile";

export default function CompanyProfilePage() {
  const { data: profile } = useProfile();
  const { data: companySettings, isLoading } = useCompanySettings();
  const isAdmin = ["owner", "admin"].includes(profile?.role ?? "");

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Company Profile"
        subtitle={isAdmin ? "Business details, branding and document settings" : "View-only — contact an Owner or Admin to make changes"}
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-4 max-w-4xl">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-36 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        ) : (
          <CompanyProfileSettings settings={companySettings ?? null} isAdmin={isAdmin} />
        )}
      </div>
    </div>
  );
}
