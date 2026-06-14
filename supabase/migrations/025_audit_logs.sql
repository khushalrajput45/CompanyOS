-- ── Audit Logs ───────────────────────────────────────────────────────────────
-- Permanent, append-only log of every important action in the ERP.
-- Never auto-deleted. Only owners and admins can read.
-- All writes go through the service role (/api/audit endpoint).

create table if not exists audit_logs (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  user_id         uuid        references auth.users(id) on delete set null,
  user_name       text        not null default 'System',
  user_email      text,
  user_ip         text,
  action          text        not null,  -- e.g. 'created', 'updated', 'deleted', 'login'
  module          text        not null,  -- e.g. 'invoices', 'products', 'authentication'
  record_id       text,                  -- ID of the affected record
  record_name     text,                  -- Human-readable name (invoice number, product name, etc.)
  metadata        jsonb,                 -- Extra context (old value, new value, etc.)
  created_at      timestamptz not null default now()
);

-- Fast queries: most-recent-first per org (primary access pattern)
create index if not exists audit_logs_org_time
  on audit_logs (organization_id, created_at desc);

-- Filter by module
create index if not exists audit_logs_org_module
  on audit_logs (organization_id, module, created_at desc);

-- Filter by user
create index if not exists audit_logs_org_user
  on audit_logs (organization_id, user_id, created_at desc);

-- Full-text search on record_name and action
create index if not exists audit_logs_search
  on audit_logs using gin (to_tsvector('english', coalesce(record_name, '') || ' ' || coalesce(action, '')));

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table audit_logs enable row level security;

-- Only owners and admins can view logs
create policy "Owners and admins can view audit logs"
  on audit_logs for select
  using (
    organization_id = auth_org_id()
    and exists (
      select 1 from profiles p
      where p.id        = auth.uid()
        and p.role      in ('owner', 'admin')
        and p.organization_id = auth_org_id()
    )
  );

-- No direct insert from client — service role bypasses RLS
-- All inserts go through /api/audit (server-side, uses SUPABASE_SERVICE_ROLE_KEY)
