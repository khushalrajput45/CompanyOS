-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Organizations
create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- Profiles
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  full_name text,
  role text not null default 'employee' check (role in ('admin', 'manager', 'employee')),
  email text,
  created_at timestamptz not null default now()
);

-- Brands
create table if not exists brands (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Categories
create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  parent_id uuid references categories(id),
  created_at timestamptz not null default now()
);

-- Vendors
create table if not exists vendors (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  gstin text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Locations
create table if not exists locations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  type text not null default 'warehouse' check (type in ('warehouse', 'store', 'transit')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Products
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  sku text not null,
  name text not null,
  description text,
  brand_id uuid references brands(id),
  category_id uuid references categories(id),
  unit text not null default 'pcs',
  cost_price numeric(12,2),
  selling_price numeric(12,2) not null default 0,
  mrp numeric(12,2),
  reorder_point integer not null default 0,
  reorder_qty integer not null default 0,
  warranty_months integer,
  hsn_code text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, sku)
);

-- Stock Levels
create table if not exists stock_levels (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(product_id, location_id)
);

-- Stock Movements
create table if not exists stock_movements (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  movement_type text not null check (movement_type in ('receipt','sale','transfer_in','transfer_out','adjustment','return','damage')),
  quantity integer not null,
  reference_no text,
  vendor_id uuid references vendors(id),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Price History
create table if not exists price_history (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  old_selling_price numeric(12,2),
  new_selling_price numeric(12,2) not null,
  old_cost_price numeric(12,2),
  new_cost_price numeric(12,2),
  reason text,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Import Logs
create table if not exists import_logs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  file_name text not null,
  import_type text not null,
  total_rows integer not null default 0,
  success_rows integer not null default 0,
  error_rows integer not null default 0,
  errors jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Audit Logs
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('insert','update','delete')),
  old_data jsonb,
  new_data jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Product Images
create table if not exists product_images (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  url text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

-- Product Vendors
create table if not exists product_vendors (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  vendor_sku text,
  cost_price numeric(12,2),
  lead_time_days integer,
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  unique(product_id, vendor_id)
);

-- Product Serials
create table if not exists product_serials (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  serial_no text not null,
  location_id uuid references locations(id),
  status text not null default 'in_stock' check (status in ('in_stock','sold','returned','damaged')),
  warranty_expiry date,
  created_at timestamptz not null default now(),
  unique(product_id, serial_no)
);

-- Stock Take Sessions
create table if not exists stock_take_sessions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  location_id uuid references locations(id),
  status text not null default 'draft' check (status in ('draft','in_progress','completed','cancelled')),
  notes text,
  created_by uuid references auth.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Stock Take Items
create table if not exists stock_take_items (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references stock_take_sessions(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  expected_qty integer not null default 0,
  actual_qty integer,
  variance integer,
  notes text,
  created_at timestamptz not null default now()
);

-- Trigger: update products.updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger products_updated_at
  before update on products
  for each row execute function update_updated_at();

-- Trigger: update stock_levels when movement recorded
create or replace function apply_stock_movement()
returns trigger as $$
begin
  if new.movement_type in ('receipt', 'transfer_in', 'return', 'adjustment') then
    insert into stock_levels (product_id, location_id, quantity)
    values (new.product_id, new.location_id, new.quantity)
    on conflict (product_id, location_id)
    do update set quantity = stock_levels.quantity + new.quantity, updated_at = now();
  elsif new.movement_type in ('sale', 'transfer_out', 'damage') then
    insert into stock_levels (product_id, location_id, quantity)
    values (new.product_id, new.location_id, -new.quantity)
    on conflict (product_id, location_id)
    do update set quantity = greatest(0, stock_levels.quantity - new.quantity), updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger stock_movement_apply
  after insert on stock_movements
  for each row execute function apply_stock_movement();

-- Row Level Security
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table brands enable row level security;
alter table categories enable row level security;
alter table vendors enable row level security;
alter table locations enable row level security;
alter table products enable row level security;
alter table stock_levels enable row level security;
alter table stock_movements enable row level security;
alter table price_history enable row level security;
alter table import_logs enable row level security;
alter table audit_logs enable row level security;
alter table product_images enable row level security;
alter table product_vendors enable row level security;
alter table product_serials enable row level security;
alter table stock_take_sessions enable row level security;
alter table stock_take_items enable row level security;

-- RLS: profiles can see/update their own org
create policy "profiles: self" on profiles
  for all using (id = auth.uid());

-- RLS helper function
create or replace function auth_org_id() returns uuid as $$
  select organization_id from profiles where id = auth.uid()
$$ language sql security definer stable;

-- RLS policies for org-scoped tables
create policy "org access: brands" on brands for all using (organization_id = auth_org_id());
create policy "org access: categories" on categories for all using (organization_id = auth_org_id());
create policy "org access: vendors" on vendors for all using (organization_id = auth_org_id());
create policy "org access: locations" on locations for all using (organization_id = auth_org_id());
create policy "org access: products" on products for all using (organization_id = auth_org_id());
create policy "org access: stock_movements" on stock_movements for all using (organization_id = auth_org_id());
create policy "org access: import_logs" on import_logs for all using (organization_id = auth_org_id());
create policy "org access: audit_logs" on audit_logs for all using (organization_id = auth_org_id());
create policy "org access: stock_take_sessions" on stock_take_sessions for all using (organization_id = auth_org_id());
create policy "org access: organizations" on organizations for select using (id = auth_org_id());

-- RLS for join tables (via product org)
create policy "org access: stock_levels" on stock_levels for all
  using (product_id in (select id from products where organization_id = auth_org_id()));

create policy "org access: price_history" on price_history for all
  using (product_id in (select id from products where organization_id = auth_org_id()));

create policy "org access: product_images" on product_images for all
  using (product_id in (select id from products where organization_id = auth_org_id()));

create policy "org access: product_vendors" on product_vendors for all
  using (product_id in (select id from products where organization_id = auth_org_id()));

create policy "org access: product_serials" on product_serials for all
  using (product_id in (select id from products where organization_id = auth_org_id()));

create policy "org access: stock_take_items" on stock_take_items for all
  using (session_id in (select id from stock_take_sessions where organization_id = auth_org_id()));
