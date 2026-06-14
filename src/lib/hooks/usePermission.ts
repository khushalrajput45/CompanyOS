"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "./useProfile";
import type { ModulePermission } from "@/lib/types";

// ── Default permissions by role (fallback when DB permissions are unavailable) ─

const DEFAULTS: Record<string, Record<string, boolean[]>> = {
  // [can_view, can_create, can_edit, can_delete, can_approve]
  owner:    { _: [true,  true,  true,  true,  true]  },
  admin:    { _: [true,  true,  true,  true,  true]  },
  manager:  { _: [true,  true,  true,  false, true]  },
  employee: { _: [true,  true,  false, false, false] },
  viewer:   { _: [true,  false, false, false, false] },
};

// Modules that managers/employees cannot view at all
const MANAGER_NO_VIEW  = new Set(["import"]);
const EMPLOYEE_NO_VIEW = new Set(["reports", "import"]);
const VIEWER_NO_VIEW   = new Set(["reports", "import"]);

function defaultsForRole(role: string, module: string): ModulePermission {
  const base = DEFAULTS[role]?.["_"] ?? [false, false, false, false, false];
  let [v, c, e, d, a] = base;

  if (role === "manager"  && MANAGER_NO_VIEW.has(module))  v = false;
  if (role === "employee" && EMPLOYEE_NO_VIEW.has(module)) { v = false; c = false; }
  if (role === "viewer"   && VIEWER_NO_VIEW.has(module))   v = false;

  return {
    id: "", organization_id: "", role, module,
    can_view: v, can_create: c, can_edit: e, can_delete: d, can_approve: a,
  };
}

// ── Fetch all permissions for this org ────────────────────────────────────────

async function fetchModulePermissions(): Promise<ModulePermission[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("module_permissions")
    .select("*");
  if (error) throw error;
  return data ?? [];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePermission(module: string) {
  const { data: profile } = useProfile();
  const role = profile?.role ?? "viewer";

  const { data: allPermissions = [] } = useQuery<ModulePermission[]>({
    queryKey: ["module-permissions"],
    queryFn: fetchModulePermissions,
    staleTime: 5 * 60 * 1000,  // 5 minutes — permissions don't change often
    enabled: !!profile,
  });

  // Owner and admin always get full access regardless of DB config
  if (role === "owner" || role === "admin") {
    return {
      canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true,
    };
  }

  const perm = allPermissions.find(p => p.role === role && p.module === module)
    ?? defaultsForRole(role, module);

  return {
    canView:    perm.can_view,
    canCreate:  perm.can_create,
    canEdit:    perm.can_edit,
    canDelete:  perm.can_delete,
    canApprove: perm.can_approve,
  };
}
