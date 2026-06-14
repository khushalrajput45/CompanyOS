import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logAdminEvent } from "@/lib/utils/logAdminEvent";
import { logAuditServer } from "@/lib/utils/logAuditServer";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function getCaller() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, organization_id, full_name")
    .eq("id", user.id)
    .single();
  return profile;
}

// PATCH /api/admin/users — update role or disabled status
export async function PATCH(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!["owner", "admin"].includes(caller.role)) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { user_id, action, value } = await request.json();
    if (!user_id || !action) {
      return NextResponse.json({ error: "user_id and action required." }, { status: 400 });
    }

    // Fetch target user
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, is_owner, organization_id")
      .eq("id", user_id)
      .single();

    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (target.organization_id !== caller.organization_id) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    // Protect owner from non-owner modifications
    if (target.is_owner && caller.role !== "owner") {
      return NextResponse.json({ error: "Cannot modify the organization owner." }, { status: 403 });
    }
    // Cannot modify yourself
    if (target.id === caller.id) {
      return NextResponse.json({ error: "Cannot modify your own account." }, { status: 400 });
    }

    if (action === "set_role") {
      const newRole = value as string;
      const allowed = caller.role === "owner"
        ? ["admin", "manager", "employee", "viewer"]
        : ["manager", "employee", "viewer"];
      if (!allowed.includes(newRole)) {
        return NextResponse.json({ error: "Invalid role." }, { status: 400 });
      }

      await supabaseAdmin.from("profiles").update({ role: newRole }).eq("id", user_id);

      logAdminEvent({
        organization_id: caller.organization_id,
        actor_id: caller.id,
        actor_name: caller.full_name ?? "Admin",
        event_type: "user_role_changed",
        target_id: target.id,
        target_name: target.full_name,
        target_email: target.email,
        metadata: { from_role: target.role, to_role: newRole },
      });
      logAuditServer({
        organization_id: caller.organization_id,
        user_id: caller.id,
        user_name: caller.full_name ?? "Admin",
        user_email: (caller as any).email ?? null,
        action: "role_changed",
        module: "user_management",
        record_id: target.id,
        record_name: target.full_name,
        metadata: { from_role: target.role, to_role: newRole },
      });
    } else if (action === "set_disabled") {
      const disable = value as boolean;
      await supabaseAdmin.from("profiles").update({ is_disabled: disable }).eq("id", user_id);

      logAdminEvent({
        organization_id: caller.organization_id,
        actor_id: caller.id,
        actor_name: caller.full_name ?? "Admin",
        event_type: disable ? "user_disabled" : "user_enabled",
        target_id: target.id,
        target_name: target.full_name,
        target_email: target.email,
      });
      logAuditServer({
        organization_id: caller.organization_id,
        user_id: caller.id,
        user_name: caller.full_name ?? "Admin",
        action: disable ? "user_disabled" : "user_enabled",
        module: "user_management",
        record_id: target.id,
        record_name: target.full_name,
        metadata: { email: target.email },
      });
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
