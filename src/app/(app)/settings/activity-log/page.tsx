"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserPlus, UserX, UserCheck, KeyRound, Settings, RefreshCw, XCircle, Shield,
} from "lucide-react";
import type { AdminEvent } from "@/lib/types";

// ── Event config ──────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  detail: (e: AdminEvent) => string;
}> = {
  user_invited: {
    label: "User Invited",
    icon: UserPlus,
    color: "text-blue-600 bg-blue-50",
    detail: e => `Invited ${e.target_name ?? e.target_email ?? "user"} as ${(e.metadata as any)?.role ?? ""}`,
  },
  invite_resent: {
    label: "Invite Resent",
    icon: RefreshCw,
    color: "text-blue-500 bg-blue-50",
    detail: e => `Resent invitation to ${e.target_email ?? e.target_name ?? "user"}`,
  },
  invite_cancelled: {
    label: "Invite Cancelled",
    icon: XCircle,
    color: "text-red-600 bg-red-50",
    detail: e => `Cancelled invitation for ${e.target_name ?? e.target_email ?? "user"}`,
  },
  user_role_changed: {
    label: "Role Changed",
    icon: Shield,
    color: "text-purple-600 bg-purple-50",
    detail: e => {
      const m = e.metadata as any;
      return `Changed ${e.target_name ?? "user"} from ${m?.from_role ?? "?"} → ${m?.to_role ?? "?"}`;
    },
  },
  user_disabled: {
    label: "User Disabled",
    icon: UserX,
    color: "text-red-600 bg-red-50",
    detail: e => `Disabled account of ${e.target_name ?? e.target_email ?? "user"}`,
  },
  user_enabled: {
    label: "User Enabled",
    icon: UserCheck,
    color: "text-green-600 bg-green-50",
    detail: e => `Re-enabled account of ${e.target_name ?? e.target_email ?? "user"}`,
  },
  company_profile_updated: {
    label: "Profile Updated",
    icon: Settings,
    color: "text-amber-600 bg-amber-50",
    detail: () => "Company profile settings were updated",
  },
  user_password_reset: {
    label: "Password Reset",
    icon: KeyRound,
    color: "text-gray-600 bg-gray-100",
    detail: e => `Sent password reset to ${e.target_email ?? e.target_name ?? "user"}`,
  },
};

const DEFAULT_EVENT = {
  label: "Event",
  icon: Settings,
  color: "text-muted-foreground bg-muted",
  detail: (e: AdminEvent) => e.event_type.replace(/_/g, " "),
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatTime(iso);
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchEvents(): Promise<AdminEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("admin_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ActivityLogPage() {
  const { data: events = [], isLoading, isError } = useQuery({
    queryKey: ["admin-events"],
    queryFn: fetchEvents,
    refetchInterval: 30_000,
  });

  return (
    <div className="flex flex-col h-full">
      <Header title="Activity Log" subtitle="Administration actions for this organization" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl space-y-4">

          {isError ? (
            <div className="rounded-lg border bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
              Failed to load activity log. Run migration 024 if you haven&apos;t already.
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-72" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-lg border bg-muted/20 py-16 text-center">
              <Settings className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No activity yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Admin actions like inviting users and updating company profile will appear here.
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

              <div className="space-y-0">
                {events.map(event => {
                  const cfg = EVENT_CONFIG[event.event_type] ?? DEFAULT_EVENT;
                  const Icon = cfg.icon;
                  return (
                    <div key={event.id} className="flex gap-4 pb-6 relative">
                      {/* Icon bubble */}
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-background ${cfg.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>
                                {cfg.label}
                              </Badge>
                              <span className="text-xs font-medium">{event.actor_name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {cfg.detail(event)}
                            </p>
                          </div>
                          <span
                            className="text-[10px] text-muted-foreground shrink-0 mt-0.5"
                            title={formatTime(event.created_at)}
                          >
                            {formatRelative(event.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {events.length > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Showing last {events.length} events. Auto-refreshes every 30 seconds.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
