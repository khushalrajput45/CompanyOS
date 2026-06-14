"use client";

import { Header } from "@/components/layout/header";
import { UserManagement } from "../user-management";
import { useProfile } from "@/lib/hooks/useProfile";

export default function UserManagementPage() {
  const { data: profile } = useProfile();
  const canManage = ["owner", "admin"].includes(profile?.role ?? "");

  return (
    <div className="flex flex-col h-full">
      <Header
        title="User Management"
        subtitle={canManage ? "Manage team members, roles and invitations" : "View-only — contact an Owner or Admin to make changes"}
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <UserManagement />
      </div>
    </div>
  );
}
