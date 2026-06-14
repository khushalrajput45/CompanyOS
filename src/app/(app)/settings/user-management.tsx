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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  UserPlus, UserX, UserCheck, KeyRound, RefreshCw, XCircle, Shield,
} from "lucide-react";
import { useProfile } from "@/lib/hooks/useProfile";
import type { Profile, Invitation, UserRole } from "@/lib/types";

// ── helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
  viewer: "Viewer",
};

const ROLE_COLORS: Record<UserRole, string> = {
  owner: "bg-amber-100 text-amber-800",
  admin: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  employee: "bg-gray-100 text-gray-700",
  viewer: "bg-slate-100 text-slate-600",
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatRelative(iso: string | null | undefined) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

function isExpired(iso: string) {
  return new Date(iso) < new Date();
}

// ── data fetching ─────────────────────────────────────────────────────────────

async function fetchOrgUsers(): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}

async function fetchPendingInvitations(): Promise<Invitation[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("*, inviter:invited_by(full_name)")
    .is("accepted_at", null)
    .is("cancelled_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── invite modal ──────────────────────────────────────────────────────────────

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
}

function InviteModal({ open, onClose, onSuccess }: InviteModalProps) {
  const [form, setForm] = useState({ email: "", full_name: "", role: "employee" as UserRole });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setForm({ email: "", full_name: "", role: "employee" });
    setError(null);
  }

  async function handleSend() {
    if (!form.email.trim() || !form.full_name.trim()) {
      setError("Email and name are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to send invitation.");
        return;
      }
      onSuccess(form.email);
      reset();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            An email with a secure setup link will be sent to them.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Full Name</label>
            <Input
              placeholder="Rahul Sharma"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Work Email</label>
            <Input
              type="email"
              placeholder="rahul@company.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Role</label>
            <Select
              value={form.role}
              onValueChange={v => setForm(f => ({ ...f, role: v as UserRole }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin — full access, can invite users</SelectItem>
                <SelectItem value="manager">Manager — create & approve transactions</SelectItem>
                <SelectItem value="employee">Employee — create transactions, no approvals</SelectItem>
                <SelectItem value="viewer">Viewer — read-only access</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={handleSend} disabled={loading}>
            {loading ? "Sending…" : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export function UserManagement() {
  const queryClient = useQueryClient();
  const { data: currentProfile } = useProfile();
  const canManage = currentProfile?.role === "owner" || currentProfile?.role === "admin";
  const isOwner = currentProfile?.role === "owner";

  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  function notify(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  }

  // ── queries ──────────────────────────────────────────────────────────────

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["org-users"],
    queryFn: fetchOrgUsers,
  });

  const { data: invitations = [], isLoading: invitesLoading } = useQuery({
    queryKey: ["org-invitations"],
    queryFn: fetchPendingInvitations,
    enabled: canManage,
  });

  // ── mutations ─────────────────────────────────────────────────────────────

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id, action: "set_role", value: role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update role.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-users"] });
    },
    onError: (err: Error) => notify("error", err.message),
  });

  const toggleDisableMutation = useMutation({
    mutationFn: async ({ id, disable }: { id: string; disable: boolean }) => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id, action: "set_disabled", value: disable }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update status.");
      return disable;
    },
    onSuccess: (disable) => {
      notify("success", disable ? "User disabled." : "User re-enabled.");
      queryClient.invalidateQueries({ queryKey: ["org-users"] });
    },
    onError: (err: Error) => notify("error", err.message),
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
    onSuccess: (email) => notify("success", `Password reset email sent to ${email}.`),
    onError: (err: Error) => notify("error", err.message),
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (invitation_id: string) => {
      const res = await fetch("/api/auth/invite/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to resend.");
    },
    onSuccess: () => {
      notify("success", "Invitation resent — link valid for 7 more days.");
      queryClient.invalidateQueries({ queryKey: ["org-invitations"] });
    },
    onError: (err: Error) => notify("error", err.message),
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (invitation_id: string) => {
      const res = await fetch("/api/auth/invite/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to cancel.");
    },
    onSuccess: () => {
      notify("success", "Invitation cancelled.");
      queryClient.invalidateQueries({ queryKey: ["org-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["org-users"] });
    },
    onError: (err: Error) => notify("error", err.message),
  });

  // ── render ────────────────────────────────────────────────────────────────

  const pendingCount = invitations.filter(i => !isExpired(i.expires_at)).length;

  return (
    <TooltipProvider>
      <div className="space-y-4 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Team Management</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {users.length} member{users.length !== 1 ? "s" : ""}
              {pendingCount > 0 ? ` · ${pendingCount} pending invite${pendingCount !== 1 ? "s" : ""}` : ""}
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setShowInviteModal(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Invite Member
            </Button>
          )}
        </div>

        {/* Feedback toast */}
        {toast && (
          <div className={`rounded-md px-4 py-2 text-sm flex items-center justify-between ${
            toast.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-destructive/10 text-destructive"
          }`}>
            <span>{toast.msg}</span>
            <button onClick={() => setToast(null)} className="ml-4 opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">
              Team Members
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                {users.length}
              </span>
            </TabsTrigger>
            {canManage && (
              <TabsTrigger value="invitations">
                Pending Invites
                {pendingCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-medium">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── Team Members Tab ── */}
          <TabsContent value="members" className="mt-3">
            <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">Last Login</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Joined</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                        No team members found
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map(member => {
                      const isSelf = member.id === currentProfile?.id;
                      const isProtectedOwner = member.is_owner;
                      const canEditThis = canManage && !isSelf && (!isProtectedOwner || isOwner);
                      const editableRoles: UserRole[] = isOwner
                        ? ["admin", "manager", "employee", "viewer"]
                        : ["manager", "employee", "viewer"];

                      return (
                        <TableRow key={member.id} className={member.is_disabled ? "opacity-60" : ""}>
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-[11px] font-semibold text-primary">
                                  {member.full_name.trim().split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-sm leading-none">{member.full_name}</p>
                                {isProtectedOwner && (
                                  <div className="flex items-center gap-0.5 mt-0.5">
                                    <Shield className="h-2.5 w-2.5 text-amber-600" />
                                    <span className="text-[10px] text-amber-700">Protected</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-sm text-muted-foreground">
                            {member.email}
                          </TableCell>
                          <TableCell className="py-2.5">
                            {canEditThis && !isProtectedOwner ? (
                              <Select
                                value={member.role}
                                onValueChange={v => updateRoleMutation.mutate({ id: member.id, role: v as UserRole })}
                              >
                                <SelectTrigger className={`h-7 text-xs w-28 font-medium border-0 shadow-none ${ROLE_COLORS[member.role]}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {editableRoles.map(r => (
                                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge className={`text-xs ${ROLE_COLORS[member.role]}`} variant="secondary">
                                {ROLE_LABELS[member.role]}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-1.5">
                              {member.is_disabled
                                ? <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">Disabled</Badge>
                                : <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Active</Badge>
                              }
                              {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                            {formatRelative(member.last_login_at)}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                            {formatDate(member.created_at)}
                          </TableCell>
                          <TableCell className="py-2.5">
                            {canEditThis && (
                              <div className="flex gap-1 justify-end">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm" variant="ghost" className="h-7 w-7 p-0"
                                      onClick={() => resetPasswordMutation.mutate(member.email)}
                                    >
                                      <KeyRound className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Send password reset</TooltipContent>
                                </Tooltip>
                                {member.is_disabled ? (
                                  <Button
                                    size="sm" variant="ghost"
                                    className="h-7 gap-1 px-2 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
                                    onClick={() => toggleDisableMutation.mutate({ id: member.id, disable: false })}
                                  >
                                    <UserCheck className="h-3 w-3" />Enable
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm" variant="ghost"
                                    className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      if (confirm(`Disable ${member.full_name}? They will be signed out and cannot log in.`)) {
                                        toggleDisableMutation.mutate({ id: member.id, disable: true });
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
            <p className="text-xs text-muted-foreground mt-2">
              Owners are protected and cannot be modified by admins. Disabled users are signed out and cannot log in.
            </p>
          </TabsContent>

          {/* ── Pending Invitations Tab ── */}
          {canManage && (
            <TabsContent value="invitations" className="mt-3">
              <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invited</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expires</TableHead>
                      <TableHead className="w-36" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitesLoading ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : invitations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                          No pending invitations
                        </TableCell>
                      </TableRow>
                    ) : (
                      invitations.map(inv => {
                        const expired = isExpired(inv.expires_at);
                        return (
                          <TableRow key={inv.id} className={expired ? "opacity-60" : ""}>
                            <TableCell className="py-2.5 font-medium text-sm">{inv.full_name}</TableCell>
                            <TableCell className="py-2.5 text-sm text-muted-foreground">{inv.email}</TableCell>
                            <TableCell className="py-2.5">
                              <Badge className={`text-xs ${ROLE_COLORS[inv.role as UserRole]}`} variant="secondary">
                                {ROLE_LABELS[inv.role as UserRole]}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 text-xs text-muted-foreground">
                              {formatRelative(inv.created_at)}
                              {inv.resent_count > 0 && (
                                <span className="block text-[10px] text-blue-600">
                                  Resent {inv.resent_count}×
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5 text-xs">
                              {expired
                                ? <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">Expired</Badge>
                                : <span className="text-muted-foreground">{formatDate(inv.expires_at)}</span>
                              }
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="flex gap-1 justify-end">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm" variant="ghost" className="h-7 w-7 p-0"
                                      disabled={resendInviteMutation.isPending}
                                      onClick={() => resendInviteMutation.mutate(inv.id)}
                                    >
                                      <RefreshCw className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Resend invitation</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm" variant="ghost"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      disabled={cancelInviteMutation.isPending}
                                      onClick={() => {
                                        if (confirm(`Cancel invitation for ${inv.full_name}? Their account will be deleted.`)) {
                                          cancelInviteMutation.mutate(inv.id);
                                        }
                                      }}
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Cancel invitation</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Invitations expire after 7 days. Cancelling removes the pending account entirely.
              </p>
            </TabsContent>
          )}
        </Tabs>

        {/* Invite Modal */}
        <InviteModal
          open={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onSuccess={email => notify("success", `Invitation sent to ${email}. They have 7 days to accept.`)}
        />
      </div>
    </TooltipProvider>
  );
}
