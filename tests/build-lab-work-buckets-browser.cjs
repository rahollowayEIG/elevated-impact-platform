const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const {createServer}=await import('vite');
 const server=await createServer({server:{host:'127.0.0.1',port:4199,strictPort:true}});await server.listen();let browser;
 try{
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  let providerCalls=0;await page.route('**/api/eig-build-lab-*',async route=>{providerCalls++;await route.fulfill({status:403,body:'No provider requests authorized by this test.'});});
  await page.addInitScript(()=>{
   const key='eig:scan-history:v1:11111111-1111-4111-8111-111111111111';if(localStorage.getItem(key))return;
   const entry=(id,savedAt)=>({id,type:'ai',scope:'invoices',source:'a'.repeat(40),savedAt,snapshot:{review:{recommendations:[{id:'save',title:'Repair broken invoice persistence',nextAction:'Reproduce failed save and implement persistent invoice drafts.',evidenceFiles:['src/lib/epInvoiceDraft.mjs']},{id:'dialog',title:'Improve invoice confirmation dialog',nextAction:'Use an accessible in-app confirmation dialog.',evidenceFiles:['src/components/EpInvoicePilot.jsx']}]}}});
   localStorage.setItem(key,JSON.stringify({version:1,entries:[entry('run1','2026-10-22T12:00:00Z'),entry('run2','2026-10-22T13:00:00Z')]}));
  });
  await page.goto('http://127.0.0.1:4199/tests/eig-build-lab.html');
  const choose=async name=>{await page.getByRole('navigation',{name:'Build Lab groups'}).getByRole('button',{name:'Planning',exact:true}).click();await page.getByRole('navigation',{name:'Build Lab tools'}).getByRole('button',{name,exact:true}).click();};
  await choose('Work Buckets');const panel=page.locator('#bl-panel-buckets');await panel.getByText('2 of 2 work items · 0 selected across filters',{exact:true}).waitFor();
  assert.equal(await panel.getByRole('row').count(),3,'Repeated scans must not duplicate jobs');
  await panel.getByRole('button',{name:'Work item',exact:true}).click();assert.equal(await panel.locator('th[aria-sort=ascending]').count(),1);
  await panel.getByLabel('Work type',{exact:true}).selectOption('repair');
  await panel.getByLabel('Select all visible open work items').check();await page.reload();await panel.getByText('2 of 2 work items · 1 selected across filters',{exact:true}).waitFor();
  await panel.getByLabel('Batch title',{exact:true}).fill('Invoice draft repair');await panel.getByRole('button',{name:'Prepare batch (1)',exact:true}).click();
  const batch=panel.locator('article').filter({has:page.getByRole('heading',{name:'Invoice draft repair',exact:true})});await batch.getByText('Awaiting scope review',{exact:false}).waitFor();
  await batch.getByText('Review batch scope',{exact:true}).click();assert.match(await batch.innerText(),/persistent invoice drafts/);
  await batch.getByRole('button',{name:'Approve batch scope',exact:true}).click();await batch.getByText('Scope approved · implementation pending',{exact:false}).waitFor();
  await batch.getByRole('button',{name:'Open implementation review',exact:true}).click();await page.locator('#bl-panel-manager').getByText(/Ready for handoff · Revision/).waitFor();
  assert.match(await page.locator('#bl-panel-manager').innerText(),/Agent execution not connected/);
  await choose('Work Buckets');await panel.getByText('Add a new-build goal',{exact:true}).click();await panel.getByLabel('Build goal',{exact:true}).fill('Shared product registry');await panel.getByLabel('Required capability',{exact:true}).fill('Reuse products across contracts and invoices.');await panel.getByLabel('Build completion criteria',{exact:true}).fill('Both apps use the same product identity.');await panel.getByLabel('Build affected apps, separated by commas',{exact:true}).fill('contracts, invoices');await panel.getByRole('button',{name:'Add build goal',exact:true}).click();
  await panel.getByText('3 of 3 work items · 0 selected across filters',{exact:true}).waitFor();
  await panel.getByLabel('Search work items',{exact:true}).fill('Shared product registry');const row=panel.getByRole('row').filter({hasText:'Shared product registry'});assert.match(await row.innerText(),/Needs manual fix/);await row.getByRole('button',{name:'Review work item',exact:true}).click();
  const editor=panel.getByRole('region',{name:'Review work item'});await editor.getByLabel('Work status',{exact:true}).selectOption('manual');await editor.getByLabel('Manual work or missing capability',{exact:true}).fill('Needs a database-capable implementation worker.');await editor.getByRole('button',{name:'Save work item',exact:true}).click();
  await page.reload();await panel.getByLabel('Search work items',{exact:true}).fill('Shared product registry');assert.match(await panel.getByRole('row').filter({hasText:'Shared product registry'}).innerText(),/database-capable/);
  await panel.getByLabel('Search work items',{exact:true}).fill('');await fs.mkdir('test-results/eig-build-lab',{recursive:true});await page.screenshot({path:'test-results/eig-build-lab/work-buckets-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'test-results/eig-build-lab/work-buckets-mobile.png',fullPage:true});
  await panel.getByText('Backup & advanced tools',{exact:true}).click();const wait=page.waitForEvent('download');await panel.getByRole('button',{name:'Download work buckets JSON',exact:true}).click();const file=await wait;const data=JSON.parse(await fs.readFile(await file.path(),'utf8'));assert.equal(data.jobs.length,3);assert.equal(data.batches[0].status,'approved');
  await page.evaluate(()=>window.buildLabHarness.setOwner('22222222-2222-4222-8222-222222222222'));await choose('Work Buckets');assert.equal(await panel.getByText('Shared product registry',{exact:true}).count(),0);await panel.getByText('0 of 0 work items · 0 selected across filters',{exact:true}).waitFor();
  assert.equal(providerCalls,0);assert.deepEqual(errors,[]);console.log('Work buckets browser flow passed: collection, selection persistence, batching, review handoff, builds, manual routing, backup, mobile and account separation.');
 }catch(error){if(browser){await fs.mkdir('test-results/eig-build-lab',{recursive:true});const last=browser.contexts()[0]?.pages()[0];if(last)await last.screenshot({path:'test-results/eig-build-lab/work-buckets-failure.png',fullPage:true}).catch(()=>{});}throw error;}finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
