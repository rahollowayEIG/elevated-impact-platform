const test=require("node:test");
const assert=require("node:assert/strict");
const {FILE_PATHS,MODULES,readAllowlistedMasterSource,scanMasterSource}=require("../server/eig-master-source-scan.cjs");
const {RADAR_RULES,RADAR_REFERENCES,runImprovementRadar}=require("../server/eig-essential-wow-scan.cjs");
const SHA="a".repeat(40);
test("standards-based product rubric offers essentials and standout ideas without asserting missing features",()=>{
 const ids=RADAR_RULES.map(x=>x.id);
 assert.ok(ids.length>=23&&ids.length<=35);
 assert.equal(new Set(ids).size,ids.length);
 assert.ok(RADAR_RULES.some(x=>x.id==="identity-for-actions"&&x.lane==="essential"&&x.priority==="critical"));
 assert.ok(RADAR_RULES.some(x=>x.id==="least-privilege"&&x.lane==="essential"&&x.priority==="critical"));
 assert.ok(RADAR_RULES.some(x=>x.id==="my-activity"));
 assert.ok(RADAR_RULES.some(x=>x.id==="self-healing-build-lab"&&x.lane==="wow"));
 assert.ok(RADAR_RULES.some(x=>x.id==="customization-studio"&&x.lane==="wow"));
 assert.ok(RADAR_RULES.some(x=>x.id==="verified-vendor-catalog"&&x.lane==="essential"));
 assert.ok(RADAR_RULES.some(x=>x.id==="likes-to-registry"&&x.lane==="wow"));
 assert.equal(new Set(RADAR_REFERENCES.map(x=>x.id)).size,RADAR_REFERENCES.length);
 for(const r of RADAR_RULES){
  assert.ok(["essential","wow"].includes(r.lane));
  assert.ok(["critical","high","medium","low"].includes(r.priority));
  assert.ok(r.scope.every(x=>x==="*"||MODULES.some(m=>m.id===x)));
  assert.ok(r.signals.length>0&&r.signals.every(x=>FILE_PATHS.includes(x[0])));
 }
});
test("read-only capability scan uses exact Master Scanner approved sources and explicit limitations",()=>{
 const audit=runImprovementRadar(readAllowlistedMasterSource(),{allowedFiles:FILE_PATHS,sourceVersion:SHA});
 assert.equal(audit.kind,"eig_build_lab_improvement_radar");
 assert.equal(audit.scope,"all");
 assert.equal(audit.sourceVersion,SHA);
 assert.equal(audit.summary.essential+audit.summary.wow,RADAR_RULES.length);
 assert.equal(audit.summary.signalsFound+audit.summary.partial+audit.summary.notObserved,RADAR_RULES.length);
 assert.deepEqual(audit.safety,{readOnly:true,externalsVisited:false,aiCalled:false,autoBuilt:false,liveChanges:false,approvalRequired:true});
 assert.ok(audit.limitations.some(x=>x.includes("not confirmed missing")));
 assert.ok(audit.suggestions.every(x=>x.claim==="product_upgrade_candidate_not_verified"));
 const discovery=audit.suggestions.find(x=>x.id==="likes-to-registry");
 assert.ok(discovery&&discovery.evidence.some(x=>x.path==="src/components/EigBuildLab.jsx"));
 assert.match(discovery.verify,/fictional Build Lab demo/);
 assert.ok(audit.suggestions.every(x=>x.ownerReview==="pending"));
 assert.ok(audit.suggestions.every(x=>x.signalCount===x.evidence.length));
 assert.ok(audit.suggestions.every(x=>x.evidence.every(e=>FILE_PATHS.includes(e.path)&&e.line>0)));
 const identity=audit.suggestions.find(x=>x.id==="identity-for-actions");
 assert.ok(identity.signalCount>=2,"Account-first preview wiring should be observed as evidence");
 assert.equal(identity.status==="not_observed_in_sample",false);
 assert.match(identity.verify,/Inventory every submit/);
});
test("the Master Scan includes Upgrade Radar but does not grant any build, email, payment, or deployment actions",()=>{
 const report=scanMasterSource(readAllowlistedMasterSource(),SHA,"2026-10-20T21:45:00.000Z");
 assert.equal(report.improvementAudit.kind,"eig_build_lab_improvement_radar");
 assert.equal(report.improvementAudit.scope,"all");
 assert.ok(report.improvementAudit.suggestions.some(x=>x.id==="reliable-notifications"));
 assert.equal(report.safety.autoDeployed,false);
 assert.equal(report.improvementAudit.safety.autoBuilt,false);
 assert.equal(report.improvementAudit.safety.externalsVisited,false);
 assert.equal(report.environmentAudit.functionalTests.live,"not_run");
});
test("module-specific radar only shows universal and relevant ideas, not another module's features",()=>{
 const src=readAllowlistedMasterSource();
 const event=scanMasterSource(src,SHA,undefined,"event-builder");
 const lab=scanMasterSource(src,SHA,undefined,"build-lab");
 assert.equal(event.improvementAudit.scope,"event-builder");
 assert.ok(event.improvementAudit.suggestions.some(x=>x.id==="request-to-event"));
 assert.ok(!event.improvementAudit.suggestions.some(x=>x.id==="self-healing-build-lab"));
 assert.ok(lab.improvementAudit.suggestions.some(x=>x.id==="self-healing-build-lab"));
 assert.ok(!lab.improvementAudit.suggestions.some(x=>x.id==="request-to-event"));
 assert.notEqual(event.sourceFingerprint,lab.sourceFingerprint);
 assert.equal(event.improvementAudit.safety.liveChanges,false);
});
test("no marker found is 'not observed', not an invented verdict that the feature is absent",()=>{
 const sources=Object.fromEntries(FILE_PATHS.map(p=>[p,"const placeholder=1;"]));
 const audit=runImprovementRadar(sources,{allowedFiles:FILE_PATHS,sourceVersion:SHA});
 assert.equal(audit.summary.signalsFound,0);
 assert.equal(audit.summary.notObserved,RADAR_RULES.length);
 assert.ok(audit.suggestions.every(x=>x.status==="not_observed_in_sample"));
 assert.ok(audit.suggestions.every(x=>x.claim==="product_upgrade_candidate_not_verified"));
});
test("reader rejects arbitrary unapproved code paths and invalid module inputs",()=>{
 const src=readAllowlistedMasterSource();
 for(const bad of ["../.env",3,{},[]])
  assert.throws(()=>runImprovementRadar(src,{moduleId:bad,allowedFiles:FILE_PATHS}),/Unsupported improvement scope/);
 assert.throws(()=>runImprovementRadar(src,{allowedFiles:["../../.env"]}),/Approved source catalog/);
 assert.throws(()=>runImprovementRadar(src,{allowedFiles:FILE_PATHS.slice(0,3)}),/unapproved source/);
});
