interface AuditEntry {
  action: string;
  module: string;
  record_id?: string | null;
  record_name?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Client-side fire-and-forget audit logger.
 * Calls /api/audit — the server extracts user identity and IP.
 * Never throws, never blocks the calling mutation.
 */
export function logAudit(entry: AuditEntry): void {
  fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  }).catch(() => {});
}
