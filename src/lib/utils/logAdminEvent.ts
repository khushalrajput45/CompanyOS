import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface AdminEventPayload {
  organization_id: string;
  actor_id: string | null;
  actor_name: string;
  event_type: string;
  target_id?: string | null;
  target_name?: string | null;
  target_email?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Fire-and-forget admin event logger. Never throws — logs silently on error. */
export async function logAdminEvent(payload: AdminEventPayload): Promise<void> {
  try {
    await supabaseAdmin.from("admin_events").insert(payload);
  } catch {
    // Non-fatal — never block the main operation
  }
}
