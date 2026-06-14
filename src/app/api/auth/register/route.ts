import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Called after client-side signUp succeeds.
// Creates org + profile using service role key (bypasses RLS).
export async function POST(request: Request) {
  try {
    const { user_id, company_name, full_name, email } = await request.json();

    if (!user_id || !company_name?.trim() || !full_name?.trim() || !email) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    // Check if profile already exists (idempotent)
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", user_id)
      .single();

    if (existingProfile) {
      return NextResponse.json({ success: true });
    }

    // Create organization
    const slug =
      company_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
      "-" +
      user_id.substring(0, 8);

    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({ name: company_name.trim(), slug, onboarding_completed: true })
      .select("id")
      .single();

    if (orgError) {
      return NextResponse.json({ error: "Failed to create organization.", detail: orgError.message, code: orgError.code }, { status: 500 });
    }

    // Create admin profile
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: user_id,
      organization_id: org.id,
      full_name: full_name.trim(),
      role: "owner",
      is_owner: true,
      email: email.trim().toLowerCase(),
    });

    if (profileError) {
      await supabaseAdmin.from("organizations").delete().eq("id", org.id);
      return NextResponse.json({ error: "Failed to create profile." }, { status: 500 });
    }

    // Create default company settings
    try {
      await supabaseAdmin
        .from("company_settings")
        .insert({ organization_id: org.id, company_name: company_name.trim() });
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
