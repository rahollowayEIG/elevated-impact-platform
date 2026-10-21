import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {chromium} from 'playwright';
import {prepareInvoiceDatabase,owner,sid} from './fixtures/ep-invoice-db.mjs';
import {prepareDemoInvoice} from '../src/lib/epInvoiceDraft.mjs';
const dir=await mkdtemp(join(tmpdir(),'ep-invoice-browser-'));
const db=new PGlite(dir);
let server,browser;
async function command(org,action,data={}){
 return db.transaction(async tx=>{
  await tx.exec('set local role authenticated');
  await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:owner,session_id:sid,iss:'https://publruuuyvpggogrrgwp.supabase.co/auth/v1'})]);
  return (await tx.query('select public.ep_sandbox_invoice_command($1,$2,$3::jsonb) as result',[org,action,JSON.stringify(data)])).rows[0].result;
 });
}
const org='30000000-0000-0000-0000-000000000001';
try{
 await prepareInvoiceDatabase(db);
 await db.query('update ep_sandbox_commerce.config set enabled=true,owner_id=$1',[owner]);
 process.env.VITE_SUPABASE_URL='https://invoice-fixture.supabase.co';
 process.env.VITE_SUPABASE_ANON_KEY='fictional-public-key';
 const {createServer}=await import('vite');
 server=await createServer({server:{host:'127.0.0.1',port:4198,strictPort:true}});await server.listen();
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const page=await browser.newPage();const errors=[];const actions=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://invoice-fixture.supabase.co/**',async route=>{
  const req=route.request();const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST,OPTIONS','content-type':'application/json'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  assert.ok(req.url().endsWith('/rest/v1/rpc/ep_sandbox_invoice_command'));
  const {p_org,p_action,p_data}=req.postDataJSON();actions.push(p_action);
  try{
   const result=await command(p_org,p_action,p_data);
   await route.fulfill({status:200,headers,body:JSON.stringify(result)});
  }catch(err){await route.fulfill({status:400,headers,body:JSON.stringify({code:err.code,message:err.message})});}
 });
 await page.goto('http://127.0.0.1:4198/tests/ep-invoice-persistence.html');
 await page.getByLabel('I confirm these details').check();
 await page.getByRole('button',{name:'Save fictional snapshot',exact:true}).click();
 await page.getByText('Unissued fictional snapshot saved.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Optional product review'}).first().click();
 await page.getByLabel('Product name',{exact:true}).fill('Fictional Tee Sponsor');
 await page.getByLabel('Classification',{exact:true}).selectOption('sponsorship');
 await page.getByRole('button',{name:'Save review details',exact:true}).click();
 await page.getByText('Proposal saved for explicit review.',{exact:false}).waitFor();
 assert.equal((await db.query('select count(*)::int as n from ep_sandbox_commerce.products')).rows[0].n,0);
 await page.getByLabel('Product name',{exact:true}).fill('Fictional Revised Sponsor');
 assert.equal(await page.getByRole('button',{name:'Approve catalog creation',exact:true}).count(),0);
 await page.getByRole('button',{name:'Save review details',exact:true}).click();
 await page.getByText('Saved proposal version 2.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Approve catalog creation',exact:true}).click();
 await page.getByText('Product approved in the shared Sandbox catalog.',{exact:false}).waitFor();
 assert.equal(await page.getByLabel('Product name',{exact:true}).isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:'Save review details',exact:true}).count(),0);
 assert.equal((await db.query('select count(*)::int as n from ep_sandbox_commerce.products')).rows[0].n,1);
 await page.reload();
 await page.getByRole('button',{name:'Load saved snapshots',exact:true}).click();
 await page.getByRole('button',{name:'Open snapshot for Fictional Browser Sponsor',exact:true}).click();
 await page.getByText('Fictional only',{exact:true}).waitFor();
 await page.getByText('2026-10-21',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Optional product review'}).first().click();
 assert.equal(await page.getByLabel('Product name',{exact:true}).isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:'Save review details',exact:true}).count(),0);
 await page.getByRole('button',{name:'Optional product review'}).nth(1).click();
 await page.getByLabel('Product name',{exact:true}).fill('fictional revised sponsor!');
 await page.getByRole('button',{name:'Save review details',exact:true}).click();
 await page.getByRole('button',{name:'Approve catalog creation',exact:true}).click();
 await page.getByRole('button',{name:'Confirm link to existing product',exact:true}).click();
 await page.getByText('Linked existing product.',{exact:false}).waitFor();
 assert.equal(await page.getByLabel('Product name',{exact:true}).isDisabled(),true);
 assert.equal((await db.query('select count(*)::int as n from ep_sandbox_commerce.products')).rows[0].n,1);
 const rows=(await db.query('select description from ep_sandbox_commerce.invoice_lines order by position')).rows;
 assert.deepEqual(rows.map(x=>x.description),['Fictional Sponsor Package','One-time fictional service']);
 // Several records prove numeric/text/date sorting and stable search together.
 for(const [customerName,unitCents,dueDate] of [['Alpha Fictional',900,'2026-10-30'],['zulu Fictional',10000,'2026-12-01']]){
  const invoice=prepareDemoInvoice({issuerId:'demo-eig',customerName,customerEmail:'',sourceType:'manual',reference:'Sorting sample',notes:'Fictional sort check',issueDate:'2026-10-21',dueDate,taxBasisPoints:0,lines:[{label:'Fictional service',quantity:1,unitCents}]});
  await command(org,'save',{id:crypto.randomUUID(),invoice,fictional_confirmed:true});
 }
 await page.getByRole('button',{name:'Load saved snapshots',exact:true}).click();
 await page.getByText('3 of 3 saved snapshots',{exact:true}).waitFor();
 const recipientOrder=()=>page.locator('tbody tr td:first-child').allTextContents();
 await page.getByRole('button',{name:'Total',exact:true}).click();
 assert.deepEqual(await recipientOrder(),['Alpha Fictional','zulu Fictional','Fictional Browser Sponsor']);
 assert.equal(await page.getByRole('columnheader',{name:/Total/}).getAttribute('aria-sort'),'ascending');
 await page.getByRole('button',{name:'Total ↑',exact:true}).click();
 assert.deepEqual(await recipientOrder(),['Fictional Browser Sponsor','zulu Fictional','Alpha Fictional']);
 await page.getByRole('button',{name:'Recipient',exact:true}).click();
 assert.deepEqual(await recipientOrder(),['Alpha Fictional','Fictional Browser Sponsor','zulu Fictional']);
 await page.getByRole('button',{name:'Due date',exact:true}).click();
 assert.deepEqual(await recipientOrder(),['Alpha Fictional','Fictional Browser Sponsor','zulu Fictional']);
 await page.getByLabel('Search saved invoices').fill('absent record');
 await page.getByText('No saved snapshots match your search.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Open snapshot for Fictional Browser Sponsor',exact:true}).count(),0);
 await page.getByLabel('Search saved invoices').fill('Browser Sponsor');
 await page.getByText('1 of 3 saved snapshots',{exact:true}).waitFor();
 await page.getByRole('button',{name:/Saved date/}).click();
 await page.setViewportSize({width:390,height:844});
 await mkdir('test-results',{recursive:true});
 await page.screenshot({path:'test-results/ep-invoice-persistence-mobile.png',fullPage:true});
 await db.exec('delete from auth.sessions');
 await page.getByRole('button',{name:'Load saved snapshots',exact:true}).click();
 await page.getByText('Sandbox owner access required',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);assert.ok(actions.includes('save')&&actions.includes('propose')&&actions.includes('approve')&&actions.includes('link'));
 console.log('PASS: browser → Supabase RPC client → real local Postgres → UI, refresh/reopen, edited review, duplicate link, search/sort and revoked session.');
}finally{await browser?.close();await server?.close();await db.close();await rm(dir,{recursive:true,force:true});}
