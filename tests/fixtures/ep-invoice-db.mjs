import {readFile} from 'node:fs/promises';
export const owner='10000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002';
export const sid='20000000-0000-0000-0000-000000000001',org='30000000-0000-0000-0000-000000000001',org2='30000000-0000-0000-0000-000000000002',eig='30000000-0000-0000-0000-000000000003';
const file=p=>readFile(new URL(p,import.meta.url),'utf8');
export async function prepareInvoiceDatabase(db){
  await db.exec(await file('./event-builder-base.sql'));
  await db.exec('alter table public.organizations add column is_test boolean default false; create schema eig_private;');
  const migration=await file('../../supabase/migrations/20261007040350_inception_creative_foundation.sql');
  await db.exec(migration.slice(migration.indexOf('create function eig_private.active_builder_session()'),migration.indexOf('create table public.event_builder_assets')));
  await db.exec(await file('../../supabase/sandbox/invoice-product-foundation.sql'));
  await db.query('insert into auth.users(id,email_confirmed_at) values($1,now()),($2,now())',[owner,other]);
  await db.query('insert into public.profiles(id) values($1),($2)',[owner,other]);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid,owner]);
  await db.query("insert into public.organizations(id,slug,is_test) values($1,'fictional-a',true),($2,'fictional-b',true),($3,'elevated-impact-group',false)",[org,org2,eig]);
  await db.query("insert into public.organization_memberships(user_id,organization_id,role) values($1,$2,'eig_admin')",[owner,eig]);
  await db.query('insert into ep_sandbox_commerce.organizations values($1),($2)',[org,org2]);
}
