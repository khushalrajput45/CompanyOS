import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const { company_name, full_name, email, password } = await request.json();

    if (!company_name?.trim() || !full_name?.trim() || !email || !password) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    // Create auth user (auto-confirmed, no email verification)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.toLowerCase().includes("already registered") || authError.message.toLowerCase().includes("already been registered")) {
        return NextResponse.json({ error: "This email already has an account. Please sign in." }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to create account. Please try again." }, { status: 500 });
    }

    const userId = authData.user.id;

    // Create organization
    const slug =
      company_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
      "-" +
      userId.substring(0, 8);

    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({ name: company_name.trim(), slug, onboarding_completed: true })
      .select("id")
      .single();

    if (orgError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Failed to create organization. Please try again." }, { status: 500 });
    }

    // Create admin profile
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      organization_id: org.id,
      full_name: full_name.trim(),
      role: "admin",
      email: email.trim().toLowerCase(),
    });

    if (profileError) {
      await supabaseAdmin.from("organizations").delete().eq("id", org.id);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Failed to create profile. Please try again." }, { status: 500 });
    }

    // Create default company settings (non-critical)
    try {
      await supabaseAdmin
        .from("company_settings")
        .insert({ organization_id: org.id, company_name: company_name.trim() });
    } catch { /* ignore */ }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred. Please try again." }, { status: 500 });
  }
}
