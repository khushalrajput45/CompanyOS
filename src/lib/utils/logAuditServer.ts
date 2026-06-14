import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface ServerAuditEntry {
  organization_id: string;
  user_id?: string | null;
  user_name: string;
  user_email?: string | null;
  user_ip?: string | null;
  action: string;
  module: string;
  record_id?: string | null;
  record_name?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Server-side fire-and-forget audit logger (for use inside API routes). */
export async function logAuditServer(entry: ServerAuditEntry): Promise<void> {
  try {
    await supabaseAdmin.from("audit_logs").insert(entry);
  } catch {
    // Non-fatal — never block the main operation
  }
}
