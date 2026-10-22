-- Read-only verification. Run once against live and once against sandbox.
-- No customer records, secrets, or table contents are selected.
with counts as (
 select 'tables' component, count(*)::bigint n from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='public' and c.relkind='r'
 union all select 'foreign_keys',count(*) from pg_constraint c join pg_namespace s on s.oid=c.connamespace where s.nspname='public' and c.contype='f'
 union all select 'rls_enabled_tables',count(*) from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='public' and c.relkind='r' and c.relrowsecurity
 union all select 'policies',count(*) from pg_policies where schemaname='public'
 union all select 'functions',count(*) from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public'
 union all select 'triggers',count(*) from information_schema.triggers where trigger_schema='public'
 union all select 'views',count(*) from pg_views where schemaname='public'
 union all select 'sequences',count(*) from pg_sequences where schemaname='public'
)
select component,n from counts order by component;
