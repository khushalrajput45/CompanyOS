-- Add authorized signature image URL to company_settings
alter table company_settings add column if not exists signature_url text;
