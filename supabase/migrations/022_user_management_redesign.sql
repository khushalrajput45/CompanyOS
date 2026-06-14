-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 022: Production User Management Redesign
-- Adds: owner/viewer roles, is_owner protection, invitations table,
--       last_login_at tracking, and updated signup trigger
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable pgcrypto for secure token generation
create extension if not exists "pgcrypto";

-- ── 1. Update role constraint to include owner + viewer ──────────────────────

alter table profiles
  drop constraint if exists profiles_role_check;

alter table profiles
  add constraint profiles_role_check
  check (role in ('owner', 'admin', 'manager', 'employee', 'viewer'));

-- ── 2. Add owner protection and login tracking columns ──────────────────────

alter table profiles
  add column if not exists is_owner     boolean     not null default false;

alter table profiles
  add column if not exists last_login_at timestamptz;

-- ── 3. Migrate existing first admin in each org to owner ────────────────────
-- Safe: uses DISTINCT ON to find the earliest admin per org

with first_admins as (
  select distinct on (organization_id) id
  from   profiles
  where  role = 'admin'
  order  by organization_id, created_at asc
)
update profiles
set    role = 'owner', is_owner = true
where  id in (select id from first_admins);

-- ── 4. Invitations table ─────────────────────────────────────────────────────

create table if not exists invitations (
  id              uuid        primary key default uuid_generate_v4(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  email           text        not null,
  full_name       text        not null,
  role            text        not null
    check (role in ('admin', 'manager', 'employee', 'viewer')),
  token           text        not null unique
    default encode(gen_random_bytes(32), 'hex'),
  invited_by      uuid        references profiles(id) on delete set null,
  user_id         uuid,                    -- set when invitation is accepted
  expires_at      timestamptz not null
    default (now() + interval '7 days'),
  accepted_at     timestamptz,
  cancelled_at    timestamptz,
  resent_at       timestamptz,
  resent_count    integer     not null default 0,
  created_at      timestamptz not null default now()
);

-- Status is derived: pending / accepted / cancelled / expired
-- (not stored — computed in queries to avoid drift)

alter table invitations enable row level security;

-- Org members can read invitations (to know who is pending)
create policy "invitations: org read"
  on invitations for select
  using (organization_id = auth_org_id());

-- Only owner/admin can insert/update/delete
create policy "invitations: admin write"
  on invitations for all
  using (
    organization_id = auth_org_id()
    and exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

-- ── 5. Grant table access ────────────────────────────────────────────────────

grant all on invitations to authenticated;

-- ── 6. Add RLS policies for profiles: protect owner ─────────────────────────

-- Drop old over-permissive update policy if it exists
drop policy if exists "profiles: org admin update" on profiles;

-- New policy: admins can update non-owners; only owners can update owners
create policy "profiles: org admin update"
  on profiles for update
  using (
    organization_id = auth_org_id()
    and exists (
      select 1 from profiles caller
      where caller.id = auth.uid()
        and caller.organization_id = auth_org_id()
        and caller.role in ('owner', 'admin')
        -- Admin cannot demote/modify owner
        and (profiles.is_owner = false or caller.role = 'owner')
    )
  );

-- ── 7. Update signup trigger: set role=owner, is_owner=true ─────────────────

create or replace function handle_new_user_signup()
returns trigger as $$
declare
  v_org_id       uuid;
  v_company_name text;
  v_full_name    text;
  v_slug         text;
begin
  v_company_name := new.raw_user_meta_data->>'company_name';
  v_full_name    := coalesce(trim(new.raw_user_meta_data->>'full_name'), '');

  -- Skip if not a self-signup (invited users have no company_name)
  if v_company_name is null or trim(v_company_name) = '' then
    return new;
  end if;

  -- Build unique org slug
  v_slug := lower(regexp_replace(trim(v_company_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  v_slug := v_slug || '-' || substr(new.id::text, 1, 8);

  -- Create organization
  insert into organizations (name, slug, onboarding_completed)
  values (trim(v_company_name), v_slug, false)
  returning id into v_org_id;

  -- Create OWNER profile (is_owner = true, role = owner)
  insert into profiles (id, organization_id, full_name, role, email, is_owner)
  values (new.id, v_org_id, v_full_name, 'owner', new.email, true);

  return new;
end;
$$ language plpgsql security definer;

-- Re-create trigger (function body updated above)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user_signup();
