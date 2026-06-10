-- Auto-fill organization_id on inserts so frontend doesn't need to pass it
create or replace function set_org_id()
returns trigger as $$
begin
  if new.organization_id is null then
    new.organization_id := (select organization_id from profiles where id = auth.uid());
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger products_set_org_id
  before insert on products
  for each row execute function set_org_id();

create trigger stock_movements_set_org_id
  before insert on stock_movements
  for each row execute function set_org_id();

create trigger import_logs_set_org_id
  before insert on import_logs
  for each row execute function set_org_id();

create trigger brands_set_org_id
  before insert on brands
  for each row execute function set_org_id();

create trigger categories_set_org_id
  before insert on categories
  for each row execute function set_org_id();

create trigger vendors_set_org_id
  before insert on vendors
  for each row execute function set_org_id();

create trigger locations_set_org_id
  before insert on locations
  for each row execute function set_org_id();

create trigger audit_logs_set_org_id
  before insert on audit_logs
  for each row execute function set_org_id();

create trigger stock_take_sessions_set_org_id
  before insert on stock_take_sessions
  for each row execute function set_org_id();
