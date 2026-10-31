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


-- Backup/recovery contract: an explicit restore is a NEW revision, never
-- a destructive overwrite of prior history. All users/data are synthetic.
SET ROLE service_role;
DO $recovery$
DECLARE
 owner_id uuid := '11111111-1111-4111-8111-111111111111';
 other_id uuid := '22222222-2222-4222-8222-222222222222';
 original_payload jsonb;
 result_row record;
BEGIN
 SELECT payload INTO original_payload
 FROM public.eig_build_lab_document_revisions
 WHERE owner_user_id=owner_id AND document_key='work_buckets' AND revision=1;
 IF original_payload IS NULL THEN
  RAISE EXCEPTION 'Cannot recover absent revision 1';
 END IF;

 SELECT * INTO result_row FROM public.eig_build_lab_save_document(
  owner_id,'work_buckets',1,
  '{"kind":"eig_work_buckets","version":1,"jobs":[],"batches":[],"testMarker":"modified-before-restore"}'::jsonb);
 IF result_row.saved IS DISTINCT FROM true OR result_row.new_revision<>2 THEN
  RAISE EXCEPTION 'Cannot save changed document before recovery';
 END IF;

 -- Simulate selecting a known-good backup and restoring it as revision 3.
 SELECT * INTO result_row FROM public.eig_build_lab_save_document(
  owner_id,'work_buckets',2,original_payload);
 IF result_row.saved IS DISTINCT FROM true OR result_row.new_revision<>3 THEN
  RAISE EXCEPTION 'Explicit recovery did not create revision 3';
 END IF;
 IF (SELECT payload FROM public.eig_build_lab_documents
     WHERE owner_user_id=owner_id AND document_key='work_buckets')<>original_payload THEN
  RAISE EXCEPTION 'Recovered latest document does not match selected backup';
 END IF;
 IF (SELECT count(*) FROM public.eig_build_lab_document_revisions
     WHERE owner_user_id=owner_id AND document_key='work_buckets')<>3 THEN
  RAISE EXCEPTION 'Recovery lost a prior revision';
 END IF;
 IF (SELECT payload->>'testMarker' FROM public.eig_build_lab_document_revisions
     WHERE owner_user_id=owner_id AND document_key='work_buckets' AND revision=2)
     IS DISTINCT FROM 'modified-before-restore' THEN
  RAISE EXCEPTION 'Recovery overwrote revision 2 history';
 END IF;

 -- An isolated second owner with the same key must not alter the first owner.
 SELECT * INTO result_row FROM public.eig_build_lab_save_document(
  other_id,'work_buckets',0,
  '{"kind":"eig_work_buckets","version":1,"jobs":[],"batches":[]}'::jsonb);
 IF result_row.saved IS DISTINCT FROM true OR result_row.new_revision<>1 THEN
  RAISE EXCEPTION 'Separate synthetic owner could not start at revision 1';
 END IF;
 IF (SELECT revision FROM public.eig_build_lab_documents
     WHERE owner_user_id=owner_id AND document_key='work_buckets')<>3 THEN
  RAISE EXCEPTION 'Second synthetic owner changed the first owner revision';
 END IF;
END
$recovery$;
RESET ROLE;
