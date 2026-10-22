const test=require("node:test");
const assert=require("node:assert/strict");
const {FILE_PATHS,MODULES,readAllowlistedMasterSource,scanMasterSource}=require("../server/eig-master-source-scan.cjs");
test("actually scans sampled committed source without reading customer data",()=>{
 const files=readAllowlistedMasterSource();
 assert.deepEqual(Object.keys(files),FILE_PATHS);
 const x=scanMasterSource(files,"a".repeat(40),"2026-10-20T22:00:00.000Z");
 assert.equal(x.kind,"eig_build_lab_master_scan");
 assert.equal(x.modules.length,MODULES.length);
 assert.equal(x.files.length,27);
 assert.match(x.sourceFingerprint,/^[a-f0-9]{64}$/);
 assert.deepEqual(x.database.missingInSandbox,[]);
 assert.deepEqual(x.database.missingInProduction,[]);
 assert.equal(x.database.productionTables,71);
 assert.equal(x.database.sandboxTables,71);
 assert.deepEqual(x.database.rlsDisabled,{production:[],sandbox:[]});
 assert.deepEqual(x.database.policyDifferences.map(y=>y.table),["events","sponsors"]);
 assert.equal(x.database.freshLiveQuery,false);
 assert.equal(x.safety.readOnly,true);
 assert.equal(x.safety.customerRowsRead,false);
 assert.equal(x.safety.autoDeployed,false);
 const largestReviews=Object.fromEntries(MODULES.map(m=>[m.id,{review:"revise",note:"x".repeat(1000)}]));
 assert.ok(JSON.stringify({report:x,reviews:largestReviews}).length<180000,"Full evidence plus every permitted review must fit local draft storage");
 assert.ok(x.modules.some(m=>m.id==="event-builder"&&m.sourceStatus==="source_marker_found"));
 const eventBuilder=x.modules.find(m=>m.id==="event-builder");
 assert.equal(eventBuilder.uiStatus,"ui_marker_found");
 assert.equal(eventBuilder.status,"review_needed");
 assert.equal(eventBuilder.testStatus,"not_observed_in_sample");
 assert.deepEqual(eventBuilder.tables.map(x=>x.table),[
   "events","golf_registration_events","event_offers","golf_event_payment_settings"
 ]);
 assert.match(eventBuilder.nextCheck,/Event Packet Studio/);
 const packets=x.modules.find(m=>m.id==="event-packet");
 assert.equal(packets.testStatus,"test_code_found");
 assert.ok(packets.evidence.some(e=>e.kind==="test"&&e.path==="tests/event-builder-browser.cjs"));

 assert.ok(x.modules.some(m=>m.id==="registration"&&m.uiStatus==="ui_marker_found"));
 const invoice=x.modules.find(m=>m.id==="invoices");
 assert.equal(invoice.title,"Universal Invoicing");
 assert.equal(invoice.sourceStatus,"source_marker_found");
 assert.equal(invoice.uiStatus,"ui_marker_found");
 assert.equal(invoice.testStatus,"test_code_found");
 assert.equal(invoice.dbStatus,"snapshot_gap");
 assert.equal(invoice.status,"review_needed");
 assert.deepEqual(invoice.tables.map(x=>x.table),["billing_accounts","eig_credit_ledger","invoices","invoice_lines"]);
 assert.equal(invoice.tables.find(x=>x.table==="invoices").production,false);
 assert.equal(invoice.tables.find(x=>x.table==="invoice_lines").sandbox,false);
 assert.match(invoice.nextCheck,/DEMO ONLY/);
 assert.match(invoice.nextCheck,/server-issued immutable numbering/);
 assert.ok(invoice.evidence.some(e=>e.path==="src/lib/epInvoiceDraft.mjs"));
 assert.ok(invoice.evidence.some(e=>e.path==="tests/eig-build-lab-browser.cjs"));
 const capture=x.modules.find(m=>m.id==="product-registry");
 assert.equal(capture.title,"Product Capture & Inventory Double Sync");
 assert.equal(capture.sourceStatus,"source_marker_found");
 assert.equal(capture.uiStatus,"ui_marker_found");
 assert.equal(capture.testStatus,"test_code_found");
 assert.equal(capture.status,"review_needed");
 assert.equal(capture.dbStatus,"snapshot_gap");
 assert.equal(capture.tables.find(t=>t.table==="inventory_movements").production,false);
 assert.match(capture.nextCheck,/fictional owner-only demo/);
 assert.ok(capture.evidence.some(e=>e.path==="tests/ep-product-capture.test.mjs"));
 const contracts=x.modules.find(m=>m.id==="contracts");
 assert.equal(contracts.title,"Agreements & DocuSign");
 assert.equal(contracts.sourceStatus,"source_marker_found");
 assert.equal(contracts.testStatus,"test_code_found");
 assert.equal(contracts.uiStatus,"not_observed_in_sample");
 assert.equal(contracts.dbStatus,"snapshot_gap");
 assert.match(contracts.nextCheck,/template status and approval must be checked independently/);
 const posTax=x.modules.find(m=>m.id==="pos-tax");
 assert.equal(posTax.sourceStatus,"source_marker_found");
 assert.equal(posTax.testStatus,"test_code_found");
 assert.equal(posTax.uiStatus,"not_sampled");
 assert.equal(posTax.dbStatus,"snapshot_gap");
 assert.match(posTax.nextCheck,/blueprint only/);
 assert.ok(x.limitations.some(z=>z.includes("NOT a new Supabase query")));
 for(const module of x.modules) for(const e of module.evidence) {
   assert.ok(FILE_PATHS.includes(e.path));
   assert.ok(e.line>0);
   assert.equal(e.excerpt,files[e.path].split("\n")[e.line-1].trim().slice(0,160));
 }
 assert.ok(!JSON.stringify(x).includes("supabase_service_role"));
});
test("fingerprint changes with actual code while false gaps stay explicitly unverified",()=>{
 const input=readAllowlistedMasterSource();
 const original=scanMasterSource(input);
 const mod={...input,"src/EieEventSetupSteps.jsx":input["src/EieEventSetupSteps.jsx"].replace("function EieEventSetupSteps","function DifferentSetupSteps")};
 const changed=scanMasterSource(mod);
 assert.notEqual(changed.sourceFingerprint,original.sourceFingerprint);
 assert.equal(changed.modules.find(x=>x.id==="event-builder").sourceStatus,"not_observed_in_sample");
 assert.throws(()=>scanMasterSource({...input,"src/PlatformApp.jsx":""}),/Required source/);
 assert.throws(()=>scanMasterSource(input,"fabricated sha"),/Invalid source version/);
 const fake=scanMasterSource({...input,"../../.env":"test-secret"});
 assert.ok(!JSON.stringify(fake).includes("test-secret"));
});

test("approved targeted scan returns only requested module, with full fixed source provenance",()=>{
 const input=readAllowlistedMasterSource();
 const full=scanMasterSource(input,"b".repeat(40),"2026-10-20T22:00:00.000Z");
 assert.equal(full.scope,"full");assert.equal(full.selectedModule,null);
 assert.equal(full.modules.length,MODULES.length);
 for(const id of ["inception","event-builder","registration","payments","build-lab","invoices","product-registry","contracts","pos-tax"]){
  const scoped=scanMasterSource(input,"b".repeat(40),"2026-10-20T22:00:00.000Z",id);
  assert.equal(scoped.scope,"module");assert.equal(scoped.selectedModule,id);
  assert.deepEqual(scoped.modules.map(m=>m.id),[id]);
  assert.equal(scoped.summary.modulesReviewed,1);
  assert.equal(scoped.files.length,FILE_PATHS.length);
  assert.notEqual(scoped.sourceFingerprint,full.sourceFingerprint);
  assert.equal(scoped.sourceFingerprint,scanMasterSource(input,"b".repeat(40),"2026-10-20T22:00:00.000Z",id).sourceFingerprint);
  assert.equal(scoped.database.productionTables,full.database.productionTables);
  assert.equal(scoped.database.freshLiveQuery,false);
  assert.equal(scoped.safety.autoDeployed,false);
 }
 for(const invalid of ["../secrets","strange-module","",42,{},["inception"]])
  assert.throws(()=>scanMasterSource(input,"b".repeat(40),undefined,invalid),/Unsupported Master Scanner module/);
});

test("launching a browser is not evidence that event creation and registration settings were saved",()=>{
 const source=readAllowlistedMasterSource();
 const original=scanMasterSource(source);
 assert.equal(original.modules.find(x=>x.id==="event-builder").testStatus,"not_observed_in_sample");
 const fake={...source,
  "tests/event-builder-browser.cjs":source["tests/event-builder-browser.cjs"]+
    '\n// A browser launch is not an actual Event Details or Registration save check.\n'};
 const inspected=scanMasterSource(fake);
 assert.equal(inspected.modules.find(x=>x.id==="event-builder").status,"review_needed");
 assert.equal(inspected.modules.find(x=>x.id==="event-builder").testStatus,"not_observed_in_sample");
 const verifiedSteps={...source,
  "tests/event-builder-browser.cjs":source["tests/event-builder-browser.cjs"]+
    '\nawait page.getByRole("button", { name: "Save Event Details" });'+
    '\nawait page.getByRole("button", { name: "Save Registration" });'+
    '\nawait page.getByLabel("Players per team");'};
 const withCoverage=scanMasterSource(verifiedSteps);
 assert.equal(withCoverage.modules.find(x=>x.id==="event-builder").testStatus,"test_code_found");
 assert.equal(withCoverage.modules.find(x=>x.id==="event-builder").status,"evidence_present");
});

test('source and UI badges distinguish one observed marker from the whole configured sample',()=>{
 const source=readAllowlistedMasterSource();
 source['src/lib/epInvoiceDraft.mjs']=source['src/lib/epInvoiceDraft.mjs'].replace('export function prepareDemoInvoice','export function renamedDemoInvoice')+'\n// export function prepareDemoInvoice\nconst documented = "export function prepareDemoInvoice";';
 source['src/components/EigBuildLab.jsx']=source['src/components/EigBuildLab.jsx'].replaceAll('<EpInvoicePilot','<DifferentInvoicePilot')+'\n// <EpInvoicePilot />\nconst illustration="<EpInvoicePilot />";';
 const report=scanMasterSource(source),invoice=report.modules.find(m=>m.id==='invoices');
 assert.equal(invoice.sourceStatus,'partial_source_markers');assert.equal(invoice.uiStatus,'partial_ui_markers');
 for(const kind of ['source','ui']){assert.equal(invoice.coverage[kind].observed,1);assert.equal(invoice.coverage[kind].expected,2);assert.equal(invoice.coverage[kind].checks.filter(c=>!c.observed).length,1);}
 assert.equal(invoice.status,'review_needed');assert.match(invoice.observation,/source 1\/2, UI 1\/2/);
});

test('JSX prose and regex examples do not hide real mounts or manufacture component links',()=>{
 const source=readAllowlistedMasterSource();
 const examples='const example="<EpInvoicePilot />";\nconst pattern=/<EpInvoicePilot/;\n// <EpInvoicePilot />\n';
 source['src/components/EigBuildLab.jsx']=examples+"const panel=<section>Customer's example <EpInvoicePilot /></section>;";
 const actual=scanMasterSource(source).modules.find(m=>m.id==='invoices');
 assert.equal(actual.uiStatus,'ui_marker_found');
 assert.match(actual.evidence.find(e=>e.kind==='ui'&&e.path==='src/components/EigBuildLab.jsx').excerpt,/const panel=/);
 source['src/components/EigBuildLab.jsx']=examples+'const panel=<p>Customer\'s example only</p>;';
 assert.equal(scanMasterSource(source).modules.find(m=>m.id==='invoices').uiStatus,'partial_ui_markers');
});

test('empty configuration means not sampled and cannot become a complete module claim',()=>{
 const report=scanMasterSource(readAllowlistedMasterSource());
 for(const id of ['squawk','event-budget','maps','sponsors']){
  const m=report.modules.find(m=>m.id===id);assert.equal(m.testStatus,'not_sampled');assert.equal(m.coverage.test.expected,0);assert.equal(m.status,'review_needed');
 }
 assert.equal(report.modules.find(m=>m.id==='pos-tax').uiStatus,'not_sampled');
 for(const m of report.modules){assert.ok(m.verify.length>80&&m.verify.length<1000);assert.ok(m.testScope);for(const [kind,c] of Object.entries(m.coverage)){assert.equal(c.runtimeVerified,false);assert.equal(c.expected,c.checks.length);assert.equal(c.observed,m.evidence.filter(e=>e.kind===kind).length);}}
});

test('test titles in notes or comments do not establish declarations, and launch calls do not cover IA workflows',()=>{
 const source=readAllowlistedMasterSource();
 source['tests/roster-numbering.test.mjs']=source['tests/roster-numbering.test.mjs'].replace('confirmed-only exports preserve original Team IDs','different test title')+'\n// confirmed-only exports preserve original Team IDs\nconst note="confirmed-only exports preserve original Team IDs";';
 const r=scanMasterSource(source);assert.equal(r.modules.find(m=>m.id==='registration').testStatus,'not_observed_in_sample');
 source['tests/inception-apex-browser.cjs']='const sample = "Save to My Designs; Save & approve design";\nchromium.launch();\nawait page.reload();';
 const ia=scanMasterSource(source).modules.find(m=>m.id==='inception');assert.equal(ia.testStatus,'partial_test_code');assert.equal(ia.coverage.test.observed,1);assert.equal(ia.coverage.test.expected,3);
});

test('invalid bundled syntax fails inspection instead of inventing missing evidence',()=>{
 const source=readAllowlistedMasterSource();source['src/PlatformApp.jsx']='const invalid = <Broken';
 assert.throws(()=>scanMasterSource(source),/syntax could not be inspected/);
});
