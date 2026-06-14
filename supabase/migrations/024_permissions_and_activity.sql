-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 024: Module Permissions + Admin Activity Log + TAN Number
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. TAN Number for TDS compliance ─────────────────────────────────────────

alter table company_settings
  add column if not exists tan_number text;   -- Tax Deduction Account Number (TDS)

-- ── 2. Admin Activity Log ─────────────────────────────────────────────────────
-- Human-readable event log for administration actions

create table if not exists admin_events (
  id              uuid        primary key default uuid_generate_v4(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  actor_id        uuid        references profiles(id) on delete set null,
  actor_name      text        not null,
  event_type      text        not null,
  -- event_type values:
  --   user_invited, invite_resent, invite_cancelled,
  --   user_role_changed, user_disabled, user_enabled,
  --   company_profile_updated, user_deleted
  target_id       uuid,
  target_name     text,
  target_email    text,
  metadata        jsonb,      -- e.g. { from_role: "employee", to_role: "manager" }
  created_at      timestamptz not null default now()
);

alter table admin_events enable row level security;

-- All org members can read events; only owner/admin can write
create policy "admin_events: org read"
  on admin_events for select
  using (organization_id = auth_org_id());

create policy "admin_events: admin write"
  on admin_events for insert
  with check (
    organization_id = auth_org_id()
    and exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

grant all on admin_events to authenticated;

-- ── 3. Module Permissions ─────────────────────────────────────────────────────

create table if not exists module_permissions (
  id              uuid    primary key default uuid_generate_v4(),
  organization_id uuid    not null references organizations(id) on delete cascade,
  role            text    not null check (role in ('owner','admin','manager','employee','viewer')),
  module          text    not null,
  can_view        boolean not null default true,
  can_create      boolean not null default false,
  can_edit        boolean not null default false,
  can_delete      boolean not null default false,
  can_approve     boolean not null default false,
  unique (organization_id, role, module)
);

alter table module_permissions enable row level security;

create policy "module_permissions: org read"
  on module_permissions for select
  using (organization_id = auth_org_id());

create policy "module_permissions: admin write"
  on module_permissions for all
  using (
    organization_id = auth_org_id()
    and exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

grant all on module_permissions to authenticated;

-- ── 4. Seed default permissions for existing organizations ────────────────────
-- Run once to populate defaults for every existing org

do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from organizations loop

    insert into module_permissions
      (organization_id, role, module, can_view, can_create, can_edit, can_delete, can_approve)
    values
      -- ── owner: full access ────────────────────────────────────────────────
      (v_org_id,'owner','customers',  true,true,true,true,true),
      (v_org_id,'owner','quotations', true,true,true,true,true),
      (v_org_id,'owner','invoices',   true,true,true,true,true),
      (v_org_id,'owner','products',   true,true,true,true,true),
      (v_org_id,'owner','inventory',  true,true,true,true,true),
      (v_org_id,'owner','vendors',    true,true,true,true,true),
      (v_org_id,'owner','purchase_orders',true,true,true,true,true),
      (v_org_id,'owner','grn',        true,true,true,true,true),
      (v_org_id,'owner','vendor_payments',true,true,true,true,true),
      (v_org_id,'owner','reports',    true,true,true,true,true),
      (v_org_id,'owner','import',     true,true,true,true,true),

      -- ── admin: full access ────────────────────────────────────────────────
      (v_org_id,'admin','customers',  true,true,true,true,true),
      (v_org_id,'admin','quotations', true,true,true,true,true),
      (v_org_id,'admin','invoices',   true,true,true,true,true),
      (v_org_id,'admin','products',   true,true,true,true,true),
      (v_org_id,'admin','inventory',  true,true,true,true,true),
      (v_org_id,'admin','vendors',    true,true,true,true,true),
      (v_org_id,'admin','purchase_orders',true,true,true,true,true),
      (v_org_id,'admin','grn',        true,true,true,true,true),
      (v_org_id,'admin','vendor_payments',true,true,true,true,true),
      (v_org_id,'admin','reports',    true,true,true,true,true),
      (v_org_id,'admin','import',     true,true,true,true,true),

      -- ── manager: create/edit/approve, no delete ──────────────────────────
      (v_org_id,'manager','customers',  true,true,true,false,true),
      (v_org_id,'manager','quotations', true,true,true,false,true),
      (v_org_id,'manager','invoices',   true,true,true,false,true),
      (v_org_id,'manager','products',   true,true,true,false,false),
      (v_org_id,'manager','inventory',  true,true,true,false,false),
      (v_org_id,'manager','vendors',    true,true,true,false,false),
      (v_org_id,'manager','purchase_orders',true,true,true,false,true),
      (v_org_id,'manager','grn',        true,true,true,false,false),
      (v_org_id,'manager','vendor_payments',true,true,false,false,true),
      (v_org_id,'manager','reports',    true,false,false,false,false),
      (v_org_id,'manager','import',     false,false,false,false,false),

      -- ── employee: create only, no edit/delete/approve ────────────────────
      (v_org_id,'employee','customers',  true,true,false,false,false),
      (v_org_id,'employee','quotations', true,true,false,false,false),
      (v_org_id,'employee','invoices',   true,true,false,false,false),
      (v_org_id,'employee','products',   true,false,false,false,false),
      (v_org_id,'employee','inventory',  true,false,false,false,false),
      (v_org_id,'employee','vendors',    true,false,false,false,false),
      (v_org_id,'employee','purchase_orders',true,true,false,false,false),
      (v_org_id,'employee','grn',        true,true,false,false,false),
      (v_org_id,'employee','vendor_payments',true,false,false,false,false),
      (v_org_id,'employee','reports',    false,false,false,false,false),
      (v_org_id,'employee','import',     false,false,false,false,false),

      -- ── viewer: read-only ─────────────────────────────────────────────────
      (v_org_id,'viewer','customers',  true,false,false,false,false),
      (v_org_id,'viewer','quotations', true,false,false,false,false),
      (v_org_id,'viewer','invoices',   true,false,false,false,false),
      (v_org_id,'viewer','products',   true,false,false,false,false),
      (v_org_id,'viewer','inventory',  true,false,false,false,false),
      (v_org_id,'viewer','vendors',    true,false,false,false,false),
      (v_org_id,'viewer','purchase_orders',true,false,false,false,false),
      (v_org_id,'viewer','grn',        true,false,false,false,false),
      (v_org_id,'viewer','vendor_payments',true,false,false,false,false),
      (v_org_id,'viewer','reports',    false,false,false,false,false),
      (v_org_id,'viewer','import',     false,false,false,false,false)

    on conflict (organization_id, role, module) do nothing;

  end loop;
end;
$$;
