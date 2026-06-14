import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logAdminEvent } from "@/lib/utils/logAdminEvent";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { data: caller } = await supabase
      .from("profiles")
      .select("id, role, organization_id, full_name")
      .eq("id", user.id)
      .single();

    if (!caller || !["owner", "admin"].includes(caller.role)) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { invitation_id } = await request.json();
    if (!invitation_id) {
      return NextResponse.json({ error: "Invitation ID required." }, { status: 400 });
    }

    // Fetch the invitation
    const { data: invite } = await supabaseAdmin
      .from("invitations")
      .select("id, user_id, organization_id, email, full_name, accepted_at, cancelled_at")
      .eq("id", invitation_id)
      .single();

    if (!invite) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    if (invite.organization_id !== caller.organization_id) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }
    if (invite.accepted_at) return NextResponse.json({ error: "Cannot cancel an accepted invitation." }, { status: 400 });
    if (invite.cancelled_at) return NextResponse.json({ error: "Already cancelled." }, { status: 400 });

    // Mark cancelled
    await supabaseAdmin
      .from("invitations")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", invitation_id);

    // Delete the auth user (and their profile via cascade)
    if (invite.user_id) {
      await supabaseAdmin.auth.admin.deleteUser(invite.user_id);
    }

    logAdminEvent({
      organization_id: caller.organization_id,
      actor_id: caller.id,
      actor_name: (caller as any).full_name ?? "Admin",
      event_type: "invite_cancelled",
      target_name: (invite as any).full_name ?? null,
      target_email: (invite as any).email ?? null,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
