-- ================================================================
-- Migration 019: Security hardening
--   1. Admin-only UPDATE policy on company_settings
--   2. Org-scoped storage policies for company-logos bucket
--   3. Index on products.organization_id for RLS performance
--   4. Overpayment guard on invoice_payments
-- ================================================================

-- ── 1. Admin-only UPDATE on company_settings ─────────────────────────────────
-- Current policy allows any org member to update company settings.
-- Replace with: SELECT for all, INSERT/UPDATE/DELETE for admin only.

drop policy if exists "org access: company_settings" on company_settings;

create policy "company_settings: org read"
  on company_settings for select
  using (organization_id = auth_org_id());

create policy "company_settings: admin write"
  on company_settings for insert
  with check (
    organization_id = auth_org_id()
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = auth_org_id()
        and profiles.role = 'admin'
    )
  );

create policy "company_settings: admin update"
  on company_settings for update
  using (
    organization_id = auth_org_id()
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = auth_org_id()
        and profiles.role = 'admin'
    )
  );

-- ── 2. Org-scoped storage policies for company-logos ─────────────────────────
-- Old policies allow ANY authenticated user to upload/update/delete any object.
-- New policies scope each object to the uploading org's folder: {org_id}/...

drop policy if exists "authenticated users can upload logos"  on storage.objects;
drop policy if exists "authenticated users can update logos"  on storage.objects;
drop policy if exists "authenticated users can delete logos"  on storage.objects;

-- Helper: extract org_id from storage path (first path segment)
-- Objects must be stored as: {org_id}/{filename}

create policy "org members can upload logos"
  on storage.objects for insert
  with check (
    bucket_id = 'company-logos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = (
      select organization_id::text from profiles where id = auth.uid()
    )
  );

create policy "org members can update logos"
  on storage.objects for update
  using (
    bucket_id = 'company-logos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = (
      select organization_id::text from profiles where id = auth.uid()
    )
  );

create policy "org members can delete logos"
  on storage.objects for delete
  using (
    bucket_id = 'company-logos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = (
      select organization_id::text from profiles where id = auth.uid()
    )
  );

-- ── 3. Index on products.organization_id ─────────────────────────────────────
-- Speeds up the RLS subquery join on stock_levels, price_history, product_images, etc.

create index if not exists idx_products_org_id on products (organization_id);
create index if not exists idx_profiles_org_id  on profiles  (organization_id);

-- ── 4. Overpayment guard on invoice_payments ─────────────────────────────────
-- Prevent inserting a payment that exceeds the invoice's remaining balance.

create or replace function check_invoice_payment_amount()
returns trigger language plpgsql security definer as $$
declare
  v_total  numeric;
  v_paid   numeric;
begin
  select total_amount into v_total
  from invoices where id = new.invoice_id;

  select coalesce(sum(amount), 0) into v_paid
  from invoice_payments
  where invoice_id = new.invoice_id;

  -- v_paid already includes NEW.amount because this is a BEFORE trigger
  -- (row not yet inserted), so we add it explicitly
  if (v_paid + new.amount) > (v_total * 1.001) then
    raise exception 'Payment of % exceeds remaining balance of %',
      new.amount, (v_total - v_paid);
  end if;

  return new;
end;
$$;

drop trigger if exists invoice_payment_amount_check on invoice_payments;
create trigger invoice_payment_amount_check
  before insert on invoice_payments
  for each row execute function check_invoice_payment_amount();
