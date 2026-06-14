"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertCircle, Lock, Loader2 } from "lucide-react";
import { useProfile } from "@/lib/hooks/useProfile";
import type { ModulePermission, UserRole } from "@/lib/types";

// ── Module definitions ─────────────────────────────────────────────────────────

const MODULES = [
  { key: "customers",       label: "Customers" },
  { key: "quotations",      label: "Quotations" },
  { key: "invoices",        label: "Invoices" },
  { key: "products",        label: "Products" },
  { key: "inventory",       label: "Inventory" },
  { key: "vendors",         label: "Vendors" },
  { key: "purchase_orders", label: "Purchase Orders" },
  { key: "grn",             label: "Goods Receipts" },
  { key: "vendor_payments", label: "Vendor Payments" },
  { key: "reports",         label: "Reports" },
  { key: "import",          label: "Import / Export" },
] as const;

const ACTIONS = [
  { key: "can_view",    label: "View",    short: "V" },
  { key: "can_create",  label: "Create",  short: "C" },
  { key: "can_edit",    label: "Edit",    short: "E" },
  { key: "can_delete",  label: "Delete",  short: "D" },
  { key: "can_approve", label: "Approve", short: "A" },
] as const;

type Action = typeof ACTIONS[number]["key"];

// Editable roles only (owner/admin are always full access)
const EDITABLE_ROLES: { key: UserRole; label: string; color: string }[] = [
  { key: "manager",  label: "Manager",  color: "text-blue-700 bg-blue-50 border-blue-200" },
  { key: "employee", label: "Employee", color: "text-gray-700 bg-gray-50 border-gray-200" },
  { key: "viewer",   label: "Viewer",   color: "text-slate-600 bg-slate-50 border-slate-200" },
];

// ── Data fetching ─────────────────────────────────────────────────────────────

type PermMatrix = Record<string, Record<string, Record<Action, boolean>>>;
// PermMatrix[role][module][action] = boolean

async function fetchPermissions(): Promise<PermMatrix> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("module_permissions")
    .select("*")
    .in("role", ["manager", "employee", "viewer"]);
  if (error) throw error;

  const matrix: PermMatrix = {};
  for (const p of (data ?? []) as ModulePermission[]) {
    if (!matrix[p.role]) matrix[p.role] = {};
    matrix[p.role][p.module] = {
      can_view:    p.can_view,
      can_create:  p.can_create,
      can_edit:    p.can_edit,
      can_delete:  p.can_delete,
      can_approve: p.can_approve,
    };
  }
  return matrix;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const isOwnerOrAdmin = ["owner", "admin"].includes(profile?.role ?? "");

  const { data: matrix, isLoading } = useQuery({
    queryKey: ["module-permissions-admin"],
    queryFn: fetchPermissions,
  });

  const [localMatrix, setLocalMatrix] = useState<PermMatrix | null>(null);
  const effective = localMatrix ?? matrix ?? {};

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const orgId = profile?.organization_id;
      if (!orgId) throw new Error("Organization not loaded.");

      const supabase = createClient();
      const rows: Omit<ModulePermission, "id">[] = [];

      for (const { key: role } of EDITABLE_ROLES) {
        for (const { key: module } of MODULES) {
          const p = effective[role]?.[module];
          if (!p) continue;
          rows.push({ organization_id: orgId, role, module, ...p });
        }
      }

      const { error } = await supabase
        .from("module_permissions")
        .upsert(rows, { onConflict: "organization_id,role,module" });
      if (error) throw error;
    },
    onSuccess: () => {
      setStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["module-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["module-permissions-admin"] });
      setTimeout(() => setStatus("idle"), 3000);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setStatus("error");
    },
  });

  function toggle(role: string, module: string, action: Action) {
    if (!isOwnerOrAdmin) return;
    setStatus("idle");
    setLocalMatrix(prev => {
      const base = prev ?? matrix ?? {};
      const roleData = { ...(base[role] ?? {}) };
      const modData = { ...(roleData[module] ?? { can_view: false, can_create: false, can_edit: false, can_delete: false, can_approve: false }) };

      const newVal = !modData[action];
      modData[action] = newVal;

      // Business rules: if turning off view, turn off everything
      if (action === "can_view" && !newVal) {
        (Object.keys(modData) as Action[]).forEach(k => { modData[k] = false; });
      }
      // If turning on anything other than view, also enable view
      if (action !== "can_view" && newVal) {
        modData.can_view = true;
      }

      return { ...base, [role]: { ...roleData, [module]: modData } };
    });
  }

  function getVal(role: string, module: string, action: Action): boolean {
    return effective[role]?.[module]?.[action] ?? false;
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Module Permissions"
        subtitle="Control what each role can do in every module"
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl space-y-4">

          {/* Info banner */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <strong>Owner</strong> and <strong>Admin</strong> always have full access and cannot be restricted.
              Changes here apply to Manager, Employee, and Viewer roles only.
            </span>
          </div>

          {isLoading ? (
            <Skeleton className="h-96 rounded-lg" />
          ) : (
            <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-40">
                      Module
                    </th>
                    {EDITABLE_ROLES.map(r => (
                      <th key={r.key} colSpan={5} className="px-2 py-3 text-center">
                        <Badge variant="outline" className={`text-xs ${r.color}`}>
                          {r.label}
                        </Badge>
                        <div className="flex justify-center gap-2 mt-1.5">
                          {ACTIONS.map(a => (
                            <span key={a.key} className="text-[10px] text-muted-foreground w-5 text-center font-medium">
                              {a.short}
                            </span>
                          ))}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((mod, i) => (
                    <tr
                      key={mod.key}
                      className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                    >
                      <td className="px-4 py-2.5 text-xs font-medium">{mod.label}</td>
                      {EDITABLE_ROLES.map(role => (
                        <td key={role.key} colSpan={5} className="px-2 py-2.5">
                          <div className="flex justify-center gap-2">
                            {ACTIONS.map(action => {
                              const val = getVal(role.key, mod.key, action.key as Action);
                              const isViewAction = action.key === "can_view";
                              return (
                                <button
                                  key={action.key}
                                  title={`${role.label}: ${action.label}`}
                                  disabled={!isOwnerOrAdmin}
                                  onClick={() => toggle(role.key, mod.key, action.key as Action)}
                                  className={`w-5 h-5 rounded border transition-all ${
                                    val
                                      ? isViewAction
                                        ? "bg-blue-500 border-blue-500 text-white"
                                        : "bg-primary border-primary text-primary-foreground"
                                      : "border-border bg-background hover:border-primary/50"
                                  } ${!isOwnerOrAdmin ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:scale-110"}`}
                                >
                                  {val && (
                                    <svg viewBox="0 0 12 12" fill="none" className="w-full h-full p-0.5">
                                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {ACTIONS.map(a => (
              <span key={a.key} className="flex items-center gap-1">
                <span className="font-medium text-foreground">{a.short}</span> = {a.label}
              </span>
            ))}
          </div>

          {/* Save bar */}
          {isOwnerOrAdmin && (
            <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur border-t shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-4 py-3 -mx-4 flex items-center gap-3">
              <Button
                onClick={() => { setStatus("saving"); saveMutation.mutate(); }}
                disabled={saveMutation.isPending || !localMatrix}
                className="min-w-[140px]"
              >
                {saveMutation.isPending
                  ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</>
                  : "Save Permissions"
                }
              </Button>
              {status === "saved" && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" />Saved successfully.
                </span>
              )}
              {status === "error" && (
                <span className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />{errorMsg}
                </span>
              )}
              {!localMatrix && status === "idle" && (
                <span className="text-xs text-muted-foreground">No unsaved changes.</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
