-- Grant table permissions to authenticated users (required for RLS to work correctly)
grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated, anon;

-- Ensure future tables also get these grants
alter default privileges in schema public
  grant all on tables to authenticated;

alter default privileges in schema public
  grant all on sequences to authenticated;
