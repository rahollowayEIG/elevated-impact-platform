// Isolated browser test: synthetic auth and synthetic cloud, no provider calls.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 process.env.VITE_EIG_BUILD_LAB_CLOUD_RECORDS_UI_ENABLED='true';
 const {createServer}=await import('vite');
 const server=await createServer({server:{host:'127.0.0.1',port:4201,strictPort:true}});
 await server.listen();
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',dialog=>dialog.accept());
  const cloud=new Map(),requests=[];
  await page.route('**/api/eig-build-lab-live-records',async route=>{
   const req=route.request(),payload=req.postDataJSON();
   assert.equal(req.method(),'POST');
   assert.equal(req.headers()['authorization'],'Bearer synthetic-browser-test-token');
   assert.deepEqual(Object.keys(payload).filter(k=>!['action','kind','expectedRevision','payload'].includes(k)),[]);
   requests.push(payload);
   const prior=cloud.get(payload.kind);
   let status=200,result;
   if(payload.action==='read'){
    result=prior?{ok:true,found:true,revision:prior.revision,payload:prior.payload,updatedAt:'2026-10-28T20:00:00Z'}:
      {ok:true,found:false,revision:0};
   }else if(payload.action==='save'){
    if((prior?.revision||0)!==payload.expectedRevision){
     status=409;result={ok:false,currentRevision:prior.revision};
    }else{
     const revision=payload.expectedRevision+1;
     cloud.set(payload.kind,{revision,payload:payload.payload});
     result={ok:true,saved:true,kind:payload.kind,revision,updatedAt:'2026-10-28T20:00:00Z'};
    }
   }else{status=400;result={ok:false};}
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.addInitScript(()=>{
   const owner='11111111-1111-4111-8111-111111111111';
   const key='eig:scan-history:v1:'+owner;
   if(localStorage.getItem(key))return;
   // Only initialize on first navigation; never refill after clearing storage.
   if(sessionStorage.getItem('cloud-browser-fixture'))return;
   sessionStorage.setItem('cloud-browser-fixture','1');
   localStorage.setItem(key,JSON.stringify({version:1,entries:[{
    id:'seed-scan',type:'inspector',scope:'inception-apex',
    source:'a'.repeat(40),savedAt:'2026-10-28T20:00:00.000Z',
    snapshot:{report:{findings:[{id:'focus',title:'Keyboard focus',recommendation:'Verify keyboard navigation'}]}}
   }]}));
   localStorage.setItem('eig:work-buckets:v1:'+owner,JSON.stringify({
    kind:'eig_work_buckets',version:1,jobs:[],batches:[]
   }));
  });
  await page.goto('http://127.0.0.1:4201/tests/eig-build-lab.html');
  const groups=page.getByRole('navigation',{name:'Build Lab groups'});
  await groups.getByRole('button',{name:'History',exact:true}).click();
  const nav=page.getByRole('navigation',{name:'Build Lab tools'});
  await nav.getByRole('button',{name:'Scan History',exact:true}).click();
  const panel=page.getByRole('region',{name:'Scan History'});
  const cloudSection=panel.getByRole('region',{name:'Build Lab Cloud Backup & Recovery'});
  await cloudSection.getByRole('button',{name:'Inspect cloud and browser records'}).click();
  await cloudSection.getByText('Cloud and browser records inspected.',{exact:false}).waitFor();
  assert.equal(await cloudSection.getByText('Not backed up').count(),2);
  const scanRow=cloudSection.getByRole('row',{name:/Scan history/});
  await scanRow.getByRole('button',{name:'Save browser version to cloud'}).click();
  await cloudSection.getByText(/Saved Scan history to cloud revision 1/).waitFor();
  assert.equal(cloud.get('scan_history').payload.entries[0].id,'seed-scan');
  const workRow=cloudSection.getByRole('row',{name:/Work Buckets/});
  await workRow.getByRole('button',{name:'Save browser version to cloud'}).click();
  await cloudSection.getByText(/Saved Work Buckets to cloud revision 1/).waitFor();
  assert.equal(cloud.get('work_buckets').payload.kind,'eig_work_buckets');
  assert.equal(cloud.size,2,'No Manager plan was invented.');
  const writes=requests.filter(x=>x.action==='save');
  assert.deepEqual(writes.map(x=>x.kind),['scan_history','work_buckets']);

  // Simulate an entirely new browser. Remote cloud remains; local drafts do not.
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  const next=page.getByRole('region',{name:'Scan History'}).getByRole('region',{name:'Build Lab Cloud Backup & Recovery'});
  await next.getByRole('button',{name:'Inspect cloud and browser records'}).click();
  await next.getByText('Cloud and browser records inspected.',{exact:false}).waitFor();
  assert.match(await next.innerText(),/Different/);
  const downloadPromise=page.waitForEvent('download');
  await next.getByRole('button',{name:'Download browser backup before restore'}).click();
  const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/eig-build-lab-before-cloud-restore.*\.json/);
  await next.getByRole('checkbox',{name:/I located my downloaded browser backup/}).check();
  const reloadCompleted=page.waitForEvent('load');
  await next.getByRole('button',{name:'Restore cloud records to this browser'}).click();
  await reloadCompleted;
  await page.waitForFunction(()=>{
   const raw=localStorage.getItem('eig:scan-history:v1:11111111-1111-4111-8111-111111111111');
   try{return JSON.parse(raw).entries[0].id==='seed-scan';}catch{return false;}
  });
  const restored=await page.evaluate(()=>{
   const owner='11111111-1111-4111-8111-111111111111';
   return {
    history:JSON.parse(localStorage.getItem('eig:scan-history:v1:'+owner)),
    work:JSON.parse(localStorage.getItem('eig:work-buckets:v1:'+owner))
   };
  });
  assert.equal(restored.history.entries.length,1);
  assert.equal(restored.work.kind,'eig_work_buckets');
  assert.deepEqual(restored.work.jobs.map(x=>x.id),cloud.get('work_buckets').payload.jobs.map(x=>x.id),
   'Restored Work Buckets retain the exact scan-linked job IDs; no duplicates or losses.');
  assert.deepEqual(errors,[],'Browser emitted unexpected JavaScript exceptions');
  console.log('Build Lab cloud recovery browser: compare, 2 cloud saves, download, explicit restore and local recovery passed.');
 }finally{
  if(browser)await browser.close();
  await server.close();
  delete process.env.VITE_EIG_BUILD_LAB_CLOUD_RECORDS_UI_ENABLED;
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
