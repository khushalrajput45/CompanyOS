-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 023: Company Profile Redesign
-- Adds missing fields for Indian business compliance and IT hardware distributors
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Business identity fields ───────────────────────────────────────────────

alter table company_settings
  add column if not exists business_type       text,       -- Proprietorship / Pvt Ltd / LLP / etc.
  add column if not exists cin_number          text,       -- Company Identification Number (Pvt Ltd / LLP)
  add column if not exists msme_registration   text;       -- MSME Udyam Registration Number

-- ── 2. Extended contact fields ────────────────────────────────────────────────

alter table company_settings
  add column if not exists alternate_phone     text,
  add column if not exists support_email       text;       -- separate from business email

-- ── 3. Financial defaults ─────────────────────────────────────────────────────

alter table company_settings
  add column if not exists default_currency        text        not null default 'INR',
  add column if not exists default_tax_rate        numeric(5,2) not null default 18,
  add column if not exists financial_year_start    integer      not null default 4; -- 4 = April (Indian standard)

-- ── 4. Document settings ──────────────────────────────────────────────────────

alter table company_settings
  add column if not exists vendor_payment_prefix   text        not null default 'VP',
  add column if not exists terms_and_conditions    text,       -- default T&C for invoices/quotations
  add column if not exists payment_terms           text,       -- e.g. "Net 30", "50% advance"
  add column if not exists default_notes           text;       -- default notes on all documents

-- ── 5. Constraints ────────────────────────────────────────────────────────────

alter table company_settings
  add constraint company_settings_financial_year_start_check
    check (financial_year_start in (1, 4));   -- January or April

alter table company_settings
  add constraint company_settings_default_tax_rate_check
    check (default_tax_rate in (0, 5, 12, 18, 28));

alter table company_settings
  add constraint company_settings_currency_check
    check (default_currency in ('INR', 'USD', 'EUR', 'GBP', 'AED'));
