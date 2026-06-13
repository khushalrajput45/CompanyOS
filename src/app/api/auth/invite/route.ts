import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  try {
    // Verify the caller is an admin
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { data: callerProfile } = await supabase
      .from("profiles").select("role, organization_id").eq("id", user.id).single();

    if (callerProfile?.role !== "admin") {
      return NextResponse.json({ error: "Only admins can invite users." }, { status: 403 });
    }

    const { email, full_name, role } = await request.json();
    if (!email || !full_name || !role) {
      return NextResponse.json({ error: "Email, name and role are required." }, { status: 400 });
    }

    // Check if user already exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles").select("id").eq("email", email.trim().toLowerCase()).single();

    if (existingProfile) {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 400 });
    }

    // Create the auth user (auto-confirmed, temporary password)
    const tempPassword = Math.random().toString(36).slice(-12) + "A1!";
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.toLowerCase().includes("already")) {
        return NextResponse.json({ error: "A user with this email already exists." }, { status: 400 });
      }
      // Fallback: try to just create the profile and send reset email
      return NextResponse.json({ error: "Failed to create user. Please try again." }, { status: 500 });
    }

    const userId = authData.user.id;

    // Create profile in the same org as the admin
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      organization_id: callerProfile.organization_id,
      full_name: full_name.trim(),
      role,
      email: email.trim().toLowerCase(),
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Failed to create user profile." }, { status: 500 });
    }

    // Send password reset so they can set their own password
    await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email.trim().toLowerCase(),
      options: { redirectTo: `${new URL(request.url).origin}/reset-password` },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
