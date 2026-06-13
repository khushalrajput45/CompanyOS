"use client";

import { Header } from "@/components/layout/header";
import { UserManagement } from "../user-management";

export default function UserManagementPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="User Management" subtitle="Manage team members, roles and access" />
      <div className="flex-1 overflow-y-auto p-6">
        <UserManagement />
      </div>
    </div>
  );
}
