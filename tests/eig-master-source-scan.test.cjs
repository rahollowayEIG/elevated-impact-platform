const test=require("node:test");
const assert=require("node:assert/strict");
const {FILE_PATHS,MODULES,readAllowlistedMasterSource,scanMasterSource}=require("../server/eig-master-source-scan.cjs");
test("actually scans sampled committed source without reading customer data",()=>{
 const files=readAllowlistedMasterSource();
 assert.deepEqual(Object.keys(files),FILE_PATHS);
 const x=scanMasterSource(files,"a".repeat(40),"2026-10-20T22:00:00.000Z");
 assert.equal(x.kind,"eig_build_lab_master_scan");
 assert.equal(x.modules.length,MODULES.length);
 assert.equal(x.files.length,25);
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
 for(const id of ["inception","event-builder","registration","payments","build-lab","invoices","product-registry"]){
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
    '\ngetByRole("button", { name: "Save Event Details" });'+
    '\ngetByRole("button", { name: "Save Registration" });'+
    '\ngetByLabel("Players per team");'};
 const withCoverage=scanMasterSource(verifiedSteps);
 assert.equal(withCoverage.modules.find(x=>x.id==="event-builder").testStatus,"test_code_found");
 assert.equal(withCoverage.modules.find(x=>x.id==="event-builder").status,"evidence_present");
});
