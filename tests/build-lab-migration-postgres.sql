\set ON_ERROR_STOP on
-- Disposable PG17 test cluster. No customer or production data.
do $check$
declare
 current_rls boolean;
 revisions_rls boolean;
 revoke_ok boolean;
begin
 select relrowsecurity into current_rls from pg_class where oid='public.eig_build_lab_documents'::regclass;
 select relrowsecurity into revisions_rls from pg_class where oid='public.eig_build_lab_document_revisions'::regclass;
 if not current_rls or not revisions_rls then raise exception 'RLS not enabled on both Build Lab tables';end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename like 'eig_build_lab_%')
 then raise exception 'Unexpected Build Lab browser policy'; end if;
 if has_table_privilege('anon','public.eig_build_lab_documents','SELECT')
   or has_table_privilege('authenticated','public.eig_build_lab_documents','INSERT')
   or has_table_privilege('authenticated','public.eig_build_lab_document_revisions','SELECT')
   or has_table_privilege('service_role','public.eig_build_lab_documents','DELETE')
   or has_table_privilege('service_role','public.eig_build_lab_document_revisions','UPDATE')
   or has_table_privilege('service_role','public.eig_build_lab_document_revisions','DELETE') then
  raise exception 'Table permissions violated';
 end if;
 if not has_table_privilege('service_role','public.eig_build_lab_documents','SELECT')
  or not has_table_privilege('service_role','public.eig_build_lab_documents','INSERT')
  or not has_table_privilege('service_role','public.eig_build_lab_documents','UPDATE')
  or not has_table_privilege('service_role','public.eig_build_lab_document_revisions','INSERT') then
  raise exception 'Service role missing required permissions';
 end if;
 if has_function_privilege('anon','public.eig_build_lab_save_document(uuid,text,integer,jsonb)','EXECUTE')
  or has_function_privilege('authenticated','public.eig_build_lab_save_document(uuid,text,integer,jsonb)','EXECUTE')
  or not has_function_privilege('service_role','public.eig_build_lab_save_document(uuid,text,integer,jsonb)','EXECUTE')
 then raise exception 'Function execute permissions violated';end if;
 if (select prosecdef from pg_proc where oid='public.eig_build_lab_save_document(uuid,text,integer,jsonb)'::regprocedure)
 then raise exception 'Security definer is forbidden'; end if;
end
$check$;

set role service_role;
do $check$
declare
 outcome record;
 rejected boolean;
 owner_id uuid := '11111111-1111-4111-8111-111111111111';
 wrong_id uuid := '22222222-2222-4222-8222-222222222222';
begin
 select * into outcome from public.eig_build_lab_save_document(owner_id,'scan_history',0,'{"version":1,"entries":[]}'::jsonb);
 if outcome.saved is distinct from true or outcome.new_revision<>1 then
  raise exception 'Expected insert at revision 1';
 end if;
 select * into outcome from public.eig_build_lab_save_document(owner_id,'scan_history',0,'{"version":1,"entries":[]}'::jsonb);
 if outcome.saved is distinct from false or outcome.new_revision<>1 then
  raise exception 'Duplicate revision 0 should conflict';
 end if;
 select * into outcome from public.eig_build_lab_save_document(owner_id,'scan_history',1,'{"version":1,"entries":[{"id":"updated"}]}'::jsonb);
 if outcome.saved is distinct from true or outcome.new_revision<>2 then
  raise exception 'Expected CAS update at revision 2';
 end if;
 select * into outcome from public.eig_build_lab_save_document(owner_id,'scan_history',1,'{}'::jsonb);
 if outcome.saved is distinct from false or outcome.new_revision<>2 then
  raise exception 'Stale revision must return conflict';
 end if;
 if (select count(*) from public.eig_build_lab_document_revisions where owner_user_id=owner_id and document_key='scan_history')<>2
 then raise exception 'History must preserve both versions'; end if;
 if (select payload->'entries'->0->>'id' from public.eig_build_lab_document_revisions
  where owner_user_id=owner_id and document_key='scan_history' and revision=2)<>'updated'
 then raise exception 'Revision 2 payload not preserved';end if;
 if (select payload->'entries' from public.eig_build_lab_document_revisions
  where owner_user_id=owner_id and document_key='scan_history' and revision=1)<>'[]'::jsonb
 then raise exception 'Revision 1 overwritten';end if;

 -- Independent owner scope: same key, separate revision 1 and no cross-owner updates.
 select * into outcome from public.eig_build_lab_save_document(wrong_id,'scan_history',0,'{"version":1,"entries":[]}'::jsonb);
 if outcome.saved is distinct from true or outcome.new_revision<>1 then raise exception 'Second synthetic owner failed';end if;
 if (select revision from public.eig_build_lab_documents where owner_user_id=owner_id and document_key='scan_history')<>2
 then raise exception 'Second owner unexpectedly modified first owner revision';end if;

 rejected:=false;
 begin
  perform public.eig_build_lab_save_document(owner_id,'payments',0,'{}'::jsonb);
 exception when sqlstate '22023' then rejected:=true;
 end;
 if not rejected then raise exception 'Invalid document kind was not rejected'; end if;

 rejected:=false;
 begin
  perform public.eig_build_lab_save_document(owner_id,'scan_history',-1,'{}'::jsonb);
 exception when sqlstate '22023' then rejected:=true;
 end;
 if not rejected then raise exception 'Negative revision was not rejected'; end if;

 rejected:=false;
 begin
  perform public.eig_build_lab_save_document(owner_id,'manager_blueprint',0,'[]'::jsonb);
 exception when sqlstate '22023' then rejected:=true;
 end;
 if not rejected then raise exception 'Non-object payload was not rejected'; end if;

 rejected:=false;
 begin
  perform public.eig_build_lab_save_document(owner_id,'manager_blueprint',0,jsonb_build_object('content',repeat('x',600001)));
 exception when sqlstate '22023' then rejected:=true;
 end;
 if not rejected then raise exception 'Oversize Manager plan was not rejected'; end if;

 -- Missing owner ID must never create an orphaned record.
 rejected:=false;
 begin
  perform public.eig_build_lab_save_document(null,'scan_history',0,'{}'::jsonb);
 exception when sqlstate '22023' then rejected:=true;
 end;
 if not rejected then raise exception 'Null owner ID was not rejected';end if;

 -- Null document key must follow the same input-validation error contract.
 rejected:=false;
 begin
  perform public.eig_build_lab_save_document(owner_id,null,0,'{}'::jsonb);
 exception when sqlstate '22023' then rejected:=true;
 end;
 if not rejected then raise exception 'Null document key was not rejected correctly';end if;
end
$check$;
reset role;
