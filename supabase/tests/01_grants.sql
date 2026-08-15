-- Grants, which can only run once the migration has created the tables.
-- Supabase applies the equivalent through its own role setup; here they are
-- explicit so the test roles can reach the tables at all and RLS is the only
-- thing deciding what they see.
grant usage on schema public, auth to anon, authenticated;
-- `all tables` covers views too, which is what lets the aggregate views in
-- 0002 be read at all. They are still bounded by RLS, because each is declared
-- with security_invoker = true.
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;
grant usage on all sequences in schema public to authenticated;
