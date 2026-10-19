-- READ-ONLY sandbox inventory and isolation report. Do not use as an import process.
SELECT 'public_tables' metric, COUNT(*)::bigint value
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'
UNION ALL SELECT 'rls_tables', COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
UNION ALL SELECT 'public_indexes', COUNT(*) FROM pg_indexes WHERE schemaname='public'
UNION ALL SELECT 'public_constraints', COUNT(*) FROM pg_constraint WHERE connamespace='public'::regnamespace
UNION ALL SELECT 'public_policies', COUNT(*) FROM pg_policies WHERE schemaname='public'
UNION ALL SELECT 'public_trigger_events', COUNT(*) FROM information_schema.triggers WHERE trigger_schema='public'
UNION ALL SELECT 'public_functions', COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
UNION ALL SELECT 'eig_private_functions', COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='eig_private'
UNION ALL SELECT 'app_private_functions', COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app_private'
UNION ALL SELECT 'public_views', COUNT(*) FROM pg_views WHERE schemaname='public'
UNION ALL SELECT 'public_sequences', COUNT(*) FROM pg_sequences WHERE schemaname='public'
UNION ALL SELECT 'client_table_grants', COUNT(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated')
UNION ALL SELECT 'client_function_exec_grants', COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','eig_private','app_private','private') AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))
UNION ALL SELECT 'auth_users', COUNT(*) FROM auth.users
UNION ALL SELECT 'stored_objects', COUNT(*) FROM storage.objects
ORDER BY metric;
