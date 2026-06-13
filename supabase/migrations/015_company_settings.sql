-- Company Settings: one record per organization
create table company_settings (
  id                     uuid        primary key default uuid_generate_v4(),
  organization_id        uuid        not null unique references organizations(id) on delete cascade,

  -- Business Information
  company_name           text,
  legal_business_name    text,
  gst_number             text,
  pan_number             text,

  -- Contact Information
  phone                  text,
  email                  text,
  website                text,

  -- Business Address
  address_line_1         text,
  address_line_2         text,
  city                   text,
  state                  text,
  country                text        not null default 'India',
  pincode                text,

  -- Banking Details
  bank_name              text,
  account_holder_name    text,
  account_number         text,
  ifsc_code              text,
  branch_name            text,

  -- UPI
  upi_id                 text,

  -- Branding
  logo_url               text,

  -- Document Numbering Prefixes
  invoice_prefix         text        not null default 'INV',
  quotation_prefix       text        not null default 'QTN',
  purchase_order_prefix  text        not null default 'PO',
  grn_prefix             text        not null default 'GRN',

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Row-level security
alter table company_settings enable row level security;

create policy "org access: company_settings"
  on company_settings for all
  using (organization_id = auth_org_id());

-- Auto-fill organization_id on insert (same pattern as all other tables)
create trigger company_settings_set_org_id
  before insert on company_settings
  for each row execute function set_org_id();

-- Keep updated_at current
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger company_settings_updated_at
  before update on company_settings
  for each row execute function set_updated_at();

-- Storage bucket for company logos
insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do nothing;

create policy "authenticated users can upload logos"
  on storage.objects for insert
  with check (bucket_id = 'company-logos' and auth.role() = 'authenticated');

create policy "public read logos"
  on storage.objects for select
  using (bucket_id = 'company-logos');

create policy "authenticated users can update logos"
  on storage.objects for update
  using (bucket_id = 'company-logos' and auth.role() = 'authenticated');

create policy "authenticated users can delete logos"
  on storage.objects for delete
  using (bucket_id = 'company-logos' and auth.role() = 'authenticated');
