import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {prepareDemoInvoice} from '../src/lib/epInvoiceDraft.mjs';
import {invoiceSandboxEnabled,invoiceSandboxStore,INVOICE_SANDBOX_URL} from '../src/lib/epInvoicePersistence.mjs';
import {owner,other,sid,org,org2,eig,prepareInvoiceDatabase} from './fixtures/ep-invoice-db.mjs';
const sample=()=>prepareDemoInvoice({issuerId:'demo-eig',customerName:'Fictional Sponsor',customerEmail:'',sourceType:'sponsorship',reference:'Sandbox only',notes:'Fictional',issueDate:'2026-10-21',dueDate:'2026-11-20',taxBasisPoints:700,lines:[{label:'Cap custom description',quantity:2,unitCents:1234},{label:'One time setup service',quantity:1,unitCents:100}]});
const details=(changes={})=>({name:'Fictional Cap',sku:' CAP-001 ',description:'Editable catalog description',kind:'physical_merchandise',track_inventory:true,unit_cents:1500,...changes});
test('client defaults closed and never sends preview payments or contacts',async()=>{
 assert.equal(invoiceSandboxEnabled(),false);
 assert.equal(invoiceSandboxEnabled({VITE_EP_INVOICE_SANDBOX_ENABLED:'true',VITE_SUPABASE_URL:'https://live.supabase.co'}),false);
 assert.equal(invoiceSandboxEnabled({VITE_EP_INVOICE_SANDBOX_ENABLED:'true',VITE_SUPABASE_URL:INVOICE_SANDBOX_URL}),true);
 const calls=[];const store=invoiceSandboxStore({rpc:async(...args)=>{calls.push(args);return {data:{ok:true}};}},org);
 assert.throws(()=>store.save(sample(),false),/fictional/);
 const contact=sample();contact.customerEmail='example@example.com';assert.throws(()=>store.save(contact,true),/email/);
 await store.save(sample(),true);assert.equal(calls.length,1);assert.equal(calls[0][1].p_action,'save');
 await assert.rejects(()=>invoiceSandboxStore({rpc:async()=>({error:{message:'Denied'}})},org).list(),/Denied/);
});
test('real Postgres snapshots, review transitions, isolation, duplicate barriers and disk reopen',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'ep-invoice-'));
 let db=new PGlite(dir);
 const claims={sub:owner,session_id:sid,iss:INVOICE_SANDBOX_URL+'/auth/v1'};
 async function call(action,data={},organization=org,override={},role='authenticated'){
  return db.transaction(async tx=>{
   await tx.exec(`set local role ${role}`);
   await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({...claims,...override})]);
   const r=await tx.query('select public.ep_sandbox_invoice_command($1,$2,$3::jsonb) as result',[organization,action,JSON.stringify(data)]);
   return r.rows[0].result;
  });
 }
 try{
  await prepareInvoiceDatabase(db);
  await assert.rejects(()=>call('list'),/owner access/);
  await db.query('update ep_sandbox_commerce.config set enabled=true,owner_id=$1',[owner]);
  await t.test('permissions fail closed for nonowner, anonymous, revoked session, wrong project and real org',async()=>{
   await assert.rejects(()=>call('list',{},org,{sub:other}),/owner access/);
   await assert.rejects(()=>call('list',{},org,{},'anon'),/permission denied/);
   await assert.rejects(()=>call('list',{},org,{session_id:crypto.randomUUID()}),/owner access/);
   await assert.rejects(()=>call('list',{},org,{iss:'https://live.supabase.co/auth/v1'}),/owner access/);
   await assert.rejects(()=>call('list',{},eig),/owner access/);
   await db.exec("update public.organization_memberships set status='inactive'");
   await assert.rejects(()=>call('list'),/owner access/);
   await db.exec("update public.organization_memberships set status='active',access_ends_at=now()-interval '1 minute'");
   await assert.rejects(()=>call('list'),/owner access/);
   await db.exec('update public.organization_memberships set access_ends_at=null');
   await db.exec("update auth.sessions set not_after=now()-interval '1 minute'");
   await assert.rejects(()=>call('list'),/owner access/);
   await db.exec('delete from auth.sessions');
   await assert.rejects(()=>call('list'),/owner access/);
   await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid,owner]);
   await db.exec("update public.profiles set account_status='disabled'");
   await assert.rejects(()=>call('list'),/owner access/);
   await db.exec("update public.profiles set account_status='active'");
   await db.exec("update public.organizations set is_test=false where slug='fictional-a'");
   await assert.rejects(()=>call('list'),/owner access/);
   await db.exec("update public.organizations set is_test=true where slug='fictional-a'");
  });
  const invoice=sample(),id=crypto.randomUUID();let saved,read;
  await t.test('snapshot and each line persist without products; idempotent retry does not duplicate',async()=>{
   saved=await call('save',{id,invoice,fictional_confirmed:true});
   const retry=await call('save',{id:crypto.randomUUID(),invoice,fictional_confirmed:true});
   assert.equal(retry.id,saved.id);
   read=await call('read',{id});assert.equal(read.lines.length,2);assert.deepEqual(read.invoice.snapshot,invoice);
   const list=await call('list');assert.equal(list.invoices.length,1);assert.equal(list.products.length,0);assert.equal(list.reviews.length,0);
   await assert.rejects(()=>call('save',{id,invoice:{...invoice,notes:'Changed'},fictional_confirmed:true}),/immutable/);
   for(const bad of [{totalCents:1},{simulatedPaymentCents:2},{customerEmail:'x@example.com'},{actualInvoiceIssued:true},{invoiceNumber:'INV-1'},{unexpected:'field'},{lines:[]},{taxBasisPoints:9999},{recipient:{name:'Malformed'}},{taxBasisPoints:'700'},{lines:[{...invoice.lines[0],quantity:'2'}]},{lines:[invoice.lines[0],invoice.lines[0]]}])
    await assert.rejects(()=>call('save',{id:crypto.randomUUID(),invoice:{...invoice,...bad},fictional_confirmed:true}));
   await assert.rejects(()=>call('save',{id:crypto.randomUUID(),invoice}),/fictional/);
   await assert.rejects(()=>call('read',{id},org2),/unavailable/);
   assert.equal((await call('list',{},org2)).invoices.length,0);
  });
  let proposal;
  await t.test('editable pending proposal does not create catalog products; classification and stale review enforced',async()=>{
   const line=read.lines[0];
   await assert.rejects(()=>call('propose',{line_id:line.id,version:0,details:details()},org2),/unavailable/);
   await assert.rejects(()=>call('propose',{line_id:line.id,version:0,details:details({kind:'sponsorship',track_inventory:true})}),/valid product/);
   proposal=await call('propose',{line_id:line.id,version:0,details:details()});
   assert.equal((await call('list')).products.length,0);
   proposal=await call('propose',{line_id:line.id,version:proposal.version,details:details({unit_cents:1700})});
   await assert.rejects(()=>call('approve',{id:proposal.id,version:1}),/changed/);
   assert.equal(proposal.details.unit_cents,1700);assert.equal(proposal.version,2);
  });
  let product;
  await t.test('explicit approval creates one product, preserves history and creates no inventory movement',async()=>{
   const approved=await call('approve',{id:proposal.id,version:proposal.version});
   assert.equal(approved.status,'approved');
   product=(await call('list')).products[0];assert.equal(product.unit_cents,1700);assert.equal(product.track_inventory,true);
   await assert.rejects(()=>call('approve',{id:proposal.id,version:proposal.version}),/changed/);
   await db.query("update ep_sandbox_commerce.products set name='Fictional catalog edit',unit_cents=9999 where id=$1",[product.id]);
   assert.deepEqual((await call('read',{id})),read);
   const tables=await db.query("select table_name from information_schema.tables where table_schema='ep_sandbox_commerce'");
   assert.ok(!tables.rows.some(x=>/stock|movement|payment|delivery/.test(x.table_name)));
   assert.equal((await call('list')).products[0].on_hand,undefined);
  });
  await t.test('normalized SKU/name duplicates are blocked at approval and explicitly link to existing product',async()=>{
   const next=sample();const nextId=crypto.randomUUID();await call('save',{id:nextId,invoice:next,fictional_confirmed:true});
   const lines=(await call('read',{id:nextId})).lines;
   const r=await call('propose',{line_id:lines[0].id,version:0,details:details({name:'Different title',sku:'cap-001'})});
   const blocked=await call('approve',{id:r.id,version:r.version});assert.equal(blocked.duplicate_candidates[0].id,product.id);
   assert.equal((await call('list')).products.length,1);
   await assert.rejects(()=>call('link',{id:r.id,version:r.version,product_id:crypto.randomUUID()}),/Same-organization/);
   const foreignProduct=(await db.query("insert into ep_sandbox_commerce.products(organization_id,name,sku,kind,track_inventory,unit_cents,created_by) values($1,'Fictional other tenant','OTHER','noninventory_service',false,100,$2) returning id",[org2,owner])).rows[0];
   await assert.rejects(()=>call('link',{id:r.id,version:r.version,product_id:foreignProduct.id}),/Same-organization/);
   const linked=await call('link',{id:r.id,version:r.version,product_id:product.id});assert.equal(linked.status,'linked');
   const nameMatch=await call('propose',{line_id:lines[1].id,version:0,details:details({name:'fictional CATALOG edit!',sku:'',track_inventory:false})});
   assert.equal((await call('approve',{id:nameMatch.id,version:nameMatch.version})).duplicate_candidates.length,1);
   await call('dismiss',{id:nameMatch.id,version:nameMatch.version});
   assert.equal((await call('read',{id:nextId})).lines.length,2);
  });
  await t.test('separate pending reviews recheck duplicates on queued approvals',async()=>{
   const inv=sample(),iid=crypto.randomUUID();await call('save',{id:iid,invoice:inv,fictional_confirmed:true});
   const lines=(await call('read',{id:iid})).lines;
   const a=await call('propose',{line_id:lines[0].id,version:0,details:details({name:'Fictional service',sku:'SERVICE-1',kind:'noninventory_service',track_inventory:false})});
   const b=await call('propose',{line_id:lines[1].id,version:0,details:details({name:'fictional service',sku:'service-1',kind:'noninventory_service',track_inventory:false})});
   const results=await Promise.all([call('approve',{id:a.id,version:1}),call('approve',{id:b.id,version:1})]);
   assert.equal(results.filter(x=>x.status==='approved').length,1);assert.equal(results.filter(x=>x.duplicate_candidates).length,1);
   assert.equal((await call('list')).products.find(p=>p.kind==='noninventory_service').track_inventory,false);
  });
  await t.test('direct table writes and forged audit/config updates are forbidden',async()=>{
   for(const table of ['config','organizations','invoices','invoice_lines','products','reviews','audit']){
    await assert.rejects(()=>db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.exec(`delete from ep_sandbox_commerce.${table}`);}),/permission denied/);
   }
   const audit=await db.query('select action,actor_id from ep_sandbox_commerce.audit');assert.ok(audit.rows.length>5);assert.ok(audit.rows.every(x=>x.actor_id===owner));
   await assert.rejects(()=>call('issue'),/Unsupported/);await assert.rejects(()=>call('pay'),/Unsupported/);await assert.rejects(()=>call('email'),/Unsupported/);
  });
  await db.close();db=new PGlite(dir);
  await t.test('database restart reopens identical invoice and line history',async()=>{
   assert.deepEqual(await call('read',{id}),read);assert.equal((await call('list')).products.length,2);
  });
 }finally{await db.close();await rm(dir,{recursive:true,force:true});}
});
