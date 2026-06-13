-- Add onboarding tracking to organizations
alter table organizations
  add column if not exists onboarding_completed boolean not null default false;

-- ── Trigger: auto-create org + admin profile on self-signup ──────────────────
-- Fires when a new auth.users row is inserted.
-- Only runs when raw_user_meta_data contains 'company_name' (self-signup path).
-- Users added via admin invite do NOT have company_name → no org is created.

create or replace function handle_new_user_signup()
returns trigger as $$
declare
  v_org_id       uuid;
  v_company_name text;
  v_full_name    text;
  v_slug         text;
begin
  v_company_name := new.raw_user_meta_data->>'company_name';
  v_full_name    := coalesce(new.raw_user_meta_data->>'full_name', '');

  -- Skip if not a self-signup
  if v_company_name is null or trim(v_company_name) = '' then
    return new;
  end if;

  -- Build a unique slug: lowercase-hyphenated name + first 8 chars of user UUID
  v_slug := lower(regexp_replace(trim(v_company_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  v_slug := v_slug || '-' || substr(new.id::text, 1, 8);

  -- Create organization
  insert into organizations (name, slug, onboarding_completed)
  values (trim(v_company_name), v_slug, false)
  returning id into v_org_id;

  -- Create admin profile
  insert into profiles (id, organization_id, full_name, role, email)
  values (new.id, v_org_id, trim(v_full_name), 'admin', new.email);

  return new;
end;
$$ language plpgsql security definer;

-- Drop if already exists, then recreate
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user_signup();

-- ── RLS: allow org admin to mark onboarding complete ─────────────────────────
-- (SELECT policy "org access: organizations" already exists from migration 001)
-- Add UPDATE so authenticated org members can update their own org row.

drop policy if exists "organizations: admin update" on organizations;

create policy "organizations: admin update" on organizations
  for update
  using  (id = auth_org_id())
  with check (id = auth_org_id());
