"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { UserPlus, UserX, UserCheck, KeyRound, ChevronDown } from "lucide-react";
import { useProfile } from "@/lib/hooks/useProfile";
import type { Profile, UserRole } from "@/lib/types";

async function fetchOrgUsers(): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  employee: "bg-gray-100 text-gray-700",
};

interface AddUserForm {
  email: string;
  full_name: string;
  role: UserRole;
}

export function UserManagement() {
  const queryClient = useQueryClient();
  const { data: currentProfile } = useProfile();
  const isAdmin = currentProfile?.role === "admin";

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddUserForm>({ email: "", full_name: "", role: "employee" });
  const [resetEmailSent, setResetEmailSent] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["org-users"],
    queryFn: fetchOrgUsers,
    staleTime: 30000,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["org-users"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const toggleDisableMutation = useMutation({
    mutationFn: async ({ id, disable }: { id: string; disable: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ is_disabled: disable })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      setActionError(null);
      setActionSuccess(vars.disable ? "User disabled." : "User re-enabled.");
      setTimeout(() => setActionSuccess(null), 3000);
      queryClient.invalidateQueries({ queryKey: ["org-users"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      return email;
    },
    onSuccess: (email) => {
      setActionError(null);
      setResetEmailSent(email);
      setTimeout(() => setResetEmailSent(null), 5000);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const addUserMutation = useMutation({
    mutationFn: async (form: AddUserForm) => {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(`Could not send invitation: ${error.message}`);
    },
    onSuccess: () => {
      setActionError(null);
      setActionSuccess(`Invitation sent to ${addForm.email}. They must be added via the Supabase dashboard.`);
      setAddForm({ email: "", full_name: "", role: "employee" });
      setShowAddForm(false);
      setTimeout(() => setActionSuccess(null), 8000);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Team Members</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{users.length} user{users.length !== 1 ? "s" : ""} in this organization</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowAddForm(v => !v)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Add User
            <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showAddForm ? "rotate-180" : ""}`} />
          </Button>
        )}
      </div>

      {/* Add user form */}
      {showAddForm && isAdmin && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">Invite New User</p>
          <p className="text-xs text-muted-foreground">
            Note: New user accounts must be created in Supabase Auth. Use this form to send a password-reset email so they can set their password.
            The user profile must exist in the database with the correct organization_id.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <Input
                type="email"
                placeholder="user@company.com"
                value={addForm.email}
                onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Full Name</label>
              <Input
                placeholder="Full name"
                value={addForm.full_name}
                onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Role</label>
              <Select value={addForm.role} onValueChange={(v) => setAddForm(f => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!addForm.email || addUserMutation.isPending}
              onClick={() => addUserMutation.mutate(addForm)}>
              Send Password Setup Email
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Feedback messages */}
      {actionError && (
        <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-4">✕</button>
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
          {actionSuccess}
        </div>
      )}
      {resetEmailSent && (
        <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700">
          Password reset email sent to <strong>{resetEmailSent}</strong>.
        </div>
      )}

      {/* User table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
              <TableHead className="w-36" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map(user => {
                const isSelf = user.id === currentProfile?.id;
                return (
                  <TableRow key={user.id} className={user.is_disabled ? "opacity-60" : ""}>
                    <TableCell className="py-2.5">
                      <p className="font-medium text-sm">{user.full_name}</p>
                    </TableCell>
                    <TableCell className="py-2.5 text-sm text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {isAdmin && !isSelf ? (
                        <Select
                          value={user.role}
                          onValueChange={(v) => updateRoleMutation.mutate({ id: user.id, role: v as UserRole })}
                        >
                          <SelectTrigger className={`h-7 text-xs w-28 font-medium border-0 shadow-none ${ROLE_COLORS[user.role]}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employee">Employee</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={`text-xs ${ROLE_COLORS[user.role]}`} variant="secondary">
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {user.is_disabled
                        ? <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">Disabled</Badge>
                        : <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Active</Badge>
                      }
                      {isSelf && <span className="text-xs text-muted-foreground ml-2">(you)</span>}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {isAdmin && !isSelf && (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="Send password reset email"
                            onClick={() => resetPasswordMutation.mutate(user.email)}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                          {user.is_disabled ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1.5 px-2 text-xs text-green-700"
                              title="Re-enable user"
                              onClick={() => toggleDisableMutation.mutate({ id: user.id, disable: false })}
                            >
                              <UserCheck className="h-3 w-3" />Enable
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1.5 px-2 text-xs text-destructive"
                              title="Disable user login"
                              onClick={() => {
                                if (confirm(`Disable ${user.full_name}? They will not be able to log in.`)) {
                                  toggleDisableMutation.mutate({ id: user.id, disable: true });
                                }
                              }}
                            >
                              <UserX className="h-3 w-3" />Disable
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Disabled users cannot log in but their data is preserved. Role changes take effect immediately.
      </p>
    </div>
  );
}
