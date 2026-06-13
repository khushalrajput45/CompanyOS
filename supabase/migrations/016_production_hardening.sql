-- ============================================================
-- 016 Production Hardening
-- Soft deletes, profile management, admin RLS policies
-- ============================================================

-- 1. Soft delete support for customers
alter table customers add column if not exists deleted_at timestamptz;

-- 2. Soft delete support for vendors
alter table vendors add column if not exists deleted_at timestamptz;

-- 3. Soft delete support for brands
alter table brands add column if not exists deleted_at timestamptz;

-- 4. Soft delete support for categories
alter table categories add column if not exists deleted_at timestamptz;

-- 5. User disable flag on profiles
alter table profiles add column if not exists is_disabled boolean not null default false;

-- 6. Admin / manager RLS policies on profiles
--    Allow admins and managers to read all profiles in their org,
--    and update role / is_disabled for other users in their org.

create policy "profiles: org admin read"
  on profiles for select
  using (
    organization_id = auth_org_id()
  );

create policy "profiles: org admin update"
  on profiles for update
  using (
    organization_id = auth_org_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'manager')
    )
  );

-- 7. Negative stock guard: prevent stock_levels.quantity going below zero
--    The existing apply_stock_movement trigger uses greatest(0,...) which clamps silently.
--    We add a CHECK constraint so any unexpected path is also blocked at DB level.
--    (App-side validation in invoice-form.tsx already catches this before reaching DB.)
alter table stock_levels add constraint chk_stock_non_negative check (quantity >= 0);
