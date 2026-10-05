-- Uses synthetic rows and rolls every mutation back. No real sessions are touched.
begin;
do $test$
declare
 actor uuid:=gen_random_uuid(); target uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid();
 actor_session uuid:=gen_random_uuid(); target_session uuid:=gen_random_uuid(); other_session uuid:=gen_random_uuid();
 request_key uuid:=gen_random_uuid(); new_session uuid:=gen_random_uuid(); result jsonb; org uuid; membership uuid:=gen_random_uuid();
begin
 insert into auth.users(id,aud,role,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
 values (actor,'authenticated','authenticated',actor||'@example.test',now(),'{}','{}'),(target,'authenticated','authenticated',target||'@example.test',now(),'{}','{}'),(other_user,'authenticated','authenticated',other_user||'@example.test',now(),'{}','{}');
 insert into public.profiles(id,role,account_status) values(actor,'super_admin','active'),(target,'user','active'),(other_user,'user','active')
 on conflict(id) do update set role=excluded.role,account_status=excluded.account_status;
 insert into auth.sessions(id,user_id,created_at,updated_at) values(actor_session,actor,now(),now()),(target_session,target,now(),now()),(other_session,other_user,now(),now());
 insert into auth.refresh_tokens(token,user_id,revoked,session_id) values(gen_random_uuid()::text,target::text,false,target_session);
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 perform set_config('request.headers',jsonb_build_object('x-eig-actor-id',actor)::text,true);
 if has_function_privilege('authenticated','public.platform_revoke_account_sessions(uuid,uuid,uuid,uuid,text)','EXECUTE') or has_function_privilege('anon','public.platform_revoke_account_sessions(uuid,uuid,uuid,uuid,text)','EXECUTE') then raise exception 'Client RPC access leaked'; end if;
 if has_table_privilege('authenticated','public.platform_account_audit','SELECT') then raise exception 'Client history access leaked'; end if;
 begin perform public.platform_revoke_account_sessions(actor,actor_session,actor,gen_random_uuid(),'self'); raise exception 'Self target accepted'; exception when insufficient_privilege then null; end;
 begin perform public.platform_revoke_account_sessions(other_user,other_session,target,gen_random_uuid(),'non admin'); raise exception 'Non admin accepted'; exception when insufficient_privilege then null; end;
 begin perform public.platform_revoke_account_sessions(actor,gen_random_uuid(),target,gen_random_uuid(),'missing session'); raise exception 'Missing session accepted'; exception when insufficient_privilege then null; end;
 begin perform public.platform_revoke_account_sessions(actor,actor_session,target,gen_random_uuid(),' '); raise exception 'Empty reason accepted'; exception when invalid_parameter_value then null; end;
 result:=public.platform_revoke_account_sessions(actor,actor_session,target,request_key,'Synthetic rollback test');
 if (result->>'sessions_revoked')::int<>1 then raise exception 'Wrong revoked count'; end if;
 if exists(select 1 from auth.sessions where user_id=target) or exists(select 1 from auth.refresh_tokens where user_id=target::text) then raise exception 'Target tokens survived'; end if;
 if not exists(select 1 from auth.sessions where id=other_session) or not exists(select 1 from auth.sessions where id=actor_session) then raise exception 'Unrelated session revoked'; end if;
 if not exists(select 1 from public.platform_account_audit where request_id=request_key and actor_user_id=actor and target_user_id=target) then raise exception 'Missing attributed audit'; end if;
 insert into auth.sessions(id,user_id,created_at,updated_at) values(new_session,target,now(),now());
 perform public.platform_revoke_account_sessions(actor,actor_session,target,request_key,'Synthetic rollback test');
 if not exists(select 1 from auth.sessions where id=new_session) then raise exception 'Retry revoked a later sign-in'; end if;
 update public.profiles set account_status='deactivated' where id=target;
 if not exists(select 1 from public.platform_account_audit where target_user_id=target and actor_user_id=actor and action='account_status_changed') then raise exception 'Missing profile audit'; end if;
 select id into org from public.organizations limit 1;
 insert into public.organization_memberships(id,organization_id,user_id,role,status) values(membership,org,target,'organization_staff','active');
 update public.organization_memberships set role='organization_admin' where id=membership;
 if not exists(select 1 from public.platform_account_audit where target_user_id=target and actor_user_id=actor and action='organization_memberships_changed') then raise exception 'Missing role audit'; end if;
end $test$;
rollback;
select 'PASS: authorization, exact target, refresh revocation, actor audit, idempotency, profile and role history; synthetic changes rolled back' as verification;
