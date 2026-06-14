import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sendResendInviteEmail } from "@/lib/email/sendInvite";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function getCompanyName(orgId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("company_settings")
    .select("company_name")
    .eq("organization_id", orgId)
    .single();
  return (data as any)?.company_name ?? "Your Company";
}

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
      .select("id, role, organization_id")
      .eq("id", user.id)
      .single();

    if (!caller || !["owner", "admin"].includes(caller.role)) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const { invitation_id } = await request.json();
    if (!invitation_id) {
      return NextResponse.json({ error: "Invitation ID required." }, { status: 400 });
    }

    const { data: invite } = await supabaseAdmin
      .from("invitations")
      .select("id, email, full_name, role, token, organization_id, accepted_at, cancelled_at, resent_count")
      .eq("id", invitation_id)
      .single();

    if (!invite) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    if (invite.organization_id !== caller.organization_id) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }
    if (invite.accepted_at) return NextResponse.json({ error: "Invitation already accepted." }, { status: 400 });
    if (invite.cancelled_at) return NextResponse.json({ error: "Invitation has been cancelled." }, { status: 400 });

    // Extend expiry and bump count
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("invitations")
      .update({
        resent_at: new Date().toISOString(),
        resent_count: (invite as any).resent_count + 1,
        expires_at: newExpiry,
      })
      .eq("id", invitation_id);

    // Generate a fresh recovery link
    const origin = new URL(request.url).origin;
    const redirectTo = `${origin}/reset-password?invite=${invite.token}`;

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: invite.email,
      options: { redirectTo },
    });

    if (linkError || !linkData?.properties?.action_link) {
      // Fallback to Supabase generic email
      await supabaseAdmin.auth.resetPasswordForEmail(invite.email, { redirectTo });
    } else {
      const companyName = await getCompanyName(caller.organization_id);
      await sendResendInviteEmail({
        to: invite.email,
        recipientName: (invite as any).full_name ?? invite.email,
        companyName,
        role: (invite as any).role,
        inviteUrl: linkData.properties.action_link,
        resentCount: (invite as any).resent_count + 1,
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
