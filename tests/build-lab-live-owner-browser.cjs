const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
 const {createServer}=await import('vite');
 const server=await createServer({server:{host:'127.0.0.1',port:4211,strictPort:true}});
 await server.listen();
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1390,height:970}});
  const errors=[],calls=[];
  page.on('pageerror',e=>errors.push(e.message));
  const ia={
   schemaVersion:1,kind:'eig_build_lab_code_scan',target:'inception_apex',targetLabel:'InceptionApex',
   sourceVersion:'a'.repeat(40),sourceFingerprint:'b'.repeat(64),
   inspectedAt:'2026-10-28T20:00:00Z',scannerVersion:'inception-code-v1',
   files:[{path:'src/components/InceptionApex.jsx',lines:900}],
   findings:[{
    id:'ia-focus',category:'Interface',priority:'medium',title:'Verify focus',
    observation:'Focus marker found',recommendation:'Test keyboard focus with synthetic design.',
    evidence:[{path:'src/components/InceptionApex.jsx',line:30,excerpt:'tabIndex'}],
    provenance:'observed_in_first_party_source',review:'pending'
   }],
   safety:{readOnly:true,liveChanges:false,autoApproved:false},limitations:'Source inspection only.'
  };
  await page.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url());
   calls.push(url.pathname);
   assert.equal(request.headers()['authorization'],'Bearer synthetic-only-owner-token');
   assert.equal(request.method(),'POST');
   if(url.pathname!=='/api/eig-build-lab-live-scan')throw Error('Unexpected Build Lab API '+url.pathname);
   assert.deepEqual(request.postDataJSON(),{target:'inception_apex'});
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,report:ia})});
  });
  await page.goto('http://127.0.0.1:4211/tests/build-lab-live-owner.html');
  const nav=page.getByRole('navigation',{name:'Build Lab V1 owner workflow'});
  await nav.getByRole('button',{name:'1. Scan'}).waitFor();
  assert.equal(await page.getByText('Run IA Inspector (read-only)').count(),1);
  assert.equal(await page.getByRole('button',{name:/Bob the Builder|AI Review|Execute|Deploy|Issue Invoice/}).count(),0);

  await page.getByRole('button',{name:'Run IA Inspector (read-only)'}).click();
  await page.getByText('Source report saved to owner-local Scan History.',{exact:false}).waitFor();
  assert.deepEqual(calls,['/api/eig-build-lab-live-scan']);
  const saved=await page.evaluate(()=>{
    const raw=localStorage.getItem('eig:scan-history:v1:11111111-1111-4111-8111-111111111111');
    return raw?JSON.parse(raw):null;
  });
  assert.equal(saved?.entries?.[0]?.type,'inspector');
  assert.equal(saved?.entries?.[0]?.snapshot?.report?.findings[0]?.title,'Verify focus');
  await nav.getByRole('button',{name:'2. History'}).click();
  await page.getByText('View saved scan (1 items)',{exact:false}).first().click();
  await page.getByText('Verify focus',{exact:false}).first().waitFor();
  await nav.getByRole('button',{name:'3. Work Buckets'}).click();
  await page.getByText('Verify focus',{exact:false}).first().waitFor();
  const jobs=await page.evaluate(()=>{
   const raw=localStorage.getItem('eig:work-buckets:v1:11111111-1111-4111-8111-111111111111');
   return raw?JSON.parse(raw).jobs:[];
  });
  assert.ok(jobs.some(j=>j.title==='Verify focus'),'Scanner finding entered the owner Work Bucket ledger');

  // Prepare a review plan via the same data adapter used in the bucket handoff.
  await page.evaluate(async()=>{
   const {stackScanBlueprint,managerStorageKey}=await import('/src/lib/buildLabManagerBlueprint.mjs');
   const owner='11111111-1111-4111-8111-111111111111';
   const scans=JSON.parse(localStorage.getItem('eig:scan-history:v1:'+owner)).entries;
   const plan=stackScanBlueprint(scans,{title:'Live owner review only'});
   localStorage.setItem(managerStorageKey(owner),JSON.stringify(plan));
  });
  await nav.getByRole('button',{name:'4. Review & Fix Plan'}).click();
  await page.getByText('Live owner review only',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Accept'}).first().click();
  await page.getByText('Decision saved in this browser.',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Approve reviewed plan (planning only)'}).click();
  await page.getByText('Plan reviewed and saved locally.',{exact:false}).waitFor();
  const plan=await page.evaluate(()=>{
   const raw=localStorage.getItem('eig:manager-blueprint:v1:11111111-1111-4111-8111-111111111111');
   return raw?JSON.parse(raw):null;
  });
  assert.equal(plan?.safety?.autoDeployed,false);
  assert.equal(plan?.execution,'not_connected');
  assert.deepEqual(errors,[]);
  console.log('PASS: owner V1 UI scans to History, Work Buckets and reviewed fix plan without build/deploy or external provider calls.');
 }finally{
  if(browser)await browser.close();
  await server.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
