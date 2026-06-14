import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? null;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    // Use authenticated client for profile (same as POST handler — works with RLS)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "Profile not found.", detail: profileError?.message }, { status: 403 });
    if (!["owner", "admin"].includes((profile as any).role)) {
      return NextResponse.json({ error: "Permission denied. Role: " + (profile as any).role }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("audit_logs")
      .select("id, user_name, user_email, user_ip, action, module, record_id, record_name, metadata, created_at")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, organization_id")
      .eq("id", user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

    const body = await request.json();
    const { action, module, record_id, record_name, metadata } = body;

    if (!action || !module) {
      return NextResponse.json({ error: "action and module are required." }, { status: 400 });
    }

    await supabaseAdmin.from("audit_logs").insert({
      organization_id: profile.organization_id,
      user_id:         user.id,
      user_name:       (profile as any).full_name ?? "Unknown",
      user_email:      (profile as any).email ?? null,
      user_ip:         getClientIp(request),
      action,
      module,
      record_id:   record_id   ?? null,
      record_name: record_name ?? null,
      metadata:    metadata    ?? null,
    });

    return NextResponse.json({ success: true });
  } catch {
    // Never surface errors to the client — audit failures must be silent
    return NextResponse.json({ success: true });
  }
}
