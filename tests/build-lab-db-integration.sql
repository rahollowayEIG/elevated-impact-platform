-- Build Lab database contract against an EPHEMERAL PostgreSQL CI service only.
-- Run after the proposed schema file, never against production or pink Sandbox.
\set ON_ERROR_STOP on
DO $security$
BEGIN
 IF EXISTS (
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN
   ('eig_build_lab_documents','eig_build_lab_document_revisions')
  AND NOT c.relrowsecurity
 ) THEN RAISE EXCEPTION 'Build Lab tables must have RLS'; END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN
      ('eig_build_lab_documents','eig_build_lab_document_revisions'))<>2
 THEN RAISE EXCEPTION 'Build Lab tables missing'; END IF;
 IF has_table_privilege('anon','public.eig_build_lab_documents','SELECT')
 OR has_table_privilege('authenticated','public.eig_build_lab_documents','INSERT')
 OR has_table_privilege('anon','public.eig_build_lab_document_revisions','SELECT')
 OR has_table_privilege('authenticated','public.eig_build_lab_document_revisions','UPDATE')
 THEN RAISE EXCEPTION 'Browser roles have table privileges'; END IF;
 IF has_function_privilege('anon',
   'public.eig_build_lab_save_document(uuid,text,integer,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated',
   'public.eig_build_lab_save_document(uuid,text,integer,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'Browser roles can execute Build Lab save RPC'; END IF;
 IF NOT has_function_privilege('service_role',
   'public.eig_build_lab_save_document(uuid,text,integer,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'Service role cannot execute Build Lab save RPC'; END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND
  tablename IN ('eig_build_lab_documents','eig_build_lab_document_revisions'))
 THEN RAISE EXCEPTION 'Unexpected exposed Build Lab policy'; END IF;
END
$security$;

SET ROLE service_role;
DO $contract$
DECLARE
 owner_id uuid := '11111111-1111-4111-8111-111111111111';
 result_row record;
BEGIN
 SELECT * INTO result_row FROM public.eig_build_lab_save_document(
  owner_id,'scan_history',0,'{"version":1,"entries":[]}'::jsonb);
 IF result_row.saved IS DISTINCT FROM true OR result_row.new_revision<>1
 THEN RAISE EXCEPTION 'Create revision 1 failed'; END IF;

 SELECT * INTO result_row FROM public.eig_build_lab_save_document(
  owner_id,'scan_history',1,'{"version":1,"entries":[{"id":"synthetic"}]}'::jsonb);
 IF result_row.saved IS DISTINCT FROM true OR result_row.new_revision<>2
 THEN RAISE EXCEPTION 'Save revision 2 failed'; END IF;

 SELECT * INTO result_row FROM public.eig_build_lab_save_document(
  owner_id,'scan_history',1,'{"version":1,"entries":[]}'::jsonb);
 IF result_row.saved IS DISTINCT FROM false OR result_row.new_revision<>2
 THEN RAISE EXCEPTION 'Stale revision must conflict'; END IF;

 IF (SELECT count(*) FROM public.eig_build_lab_document_revisions
      WHERE owner_user_id=owner_id AND document_key='scan_history')<>2
 THEN RAISE EXCEPTION 'Conflict must not create a history revision'; END IF;

 SELECT * INTO result_row FROM public.eig_build_lab_save_document(
  owner_id,'work_buckets',0,'{"kind":"eig_work_buckets","version":1,"jobs":[],"batches":[]}'::jsonb);
 IF result_row.saved IS DISTINCT FROM true OR result_row.new_revision<>1
 THEN RAISE EXCEPTION 'Independent document key failed'; END IF;

 IF (SELECT count(*) FROM public.eig_build_lab_documents WHERE owner_user_id=owner_id)<>2
 THEN RAISE EXCEPTION 'Independent documents missing'; END IF;

 BEGIN
  PERFORM * FROM public.eig_build_lab_save_document(owner_id,'users',0,'{}'::jsonb);
  RAISE EXCEPTION 'Invalid document key was accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
 END;
END
$contract$;
RESET ROLE;
