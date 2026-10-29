// The server is the only party allowed to inspect bundled source.
// This client verifies the shape, not the permissions (server handles those).
const SHA=/^[a-f0-9]{64}$/i;
const ID=/^[a-z0-9-]{3,80}$/;
const SOURCES=new Set(["source","ui","test"]);
const STATES=new Set(["evidence_present","review_needed","not_observed_in_sample"]);
const ENV_MODES=new Set(["live","sandbox","compare"]);
const CODE_DIFF_STATUSES=new Set(["added","modified","removed","renamed","copied","changed"]);
const DB_DIFF_TYPES=new Set(["table_missing","structure_diff"]);
function safeName(s){return typeof s==="string"&&/^[a-zA-Z_][a-zA-Z0-9_]{0,90}$/.test(s);}
function safePath(s){return typeof s==="string"&&s.length<=180&&/^[a-zA-Z0-9./_-]+$/.test(s)&&!s.includes("..");}
function assertEnvironmentAudit(a,report){
 if(!a||a.version!==1||!ENV_MODES.has(a.selected)||
    a.scope!==(report.scope==="module"?report.selectedModule:"all")||
    a.freshDatabaseQuery!==false||a.freshDeploymentQuery!==false||
    a.sourceInspection!=="preview_reference_only"||
    !/^\d{4}-\d{2}-\d{2}$/.test(a.capturedOn||"")||
    a.functionalTests?.live!=="not_run"||a.functionalTests?.sandbox!=="not_run"||
    a.safety?.readOnly!==true||a.safety?.liveModified!==false||
    a.safety?.sandboxModified!==false||a.safety?.paymentsAttempted!==false||
    a.safety?.automaticRepairsEnabled!==false||
    !Array.isArray(a.notes)||a.notes.length<2||a.notes.length>8)throw Error("Invalid environment audit.");
 function checkEnvironment(p){
  if(!p||typeof p.label!=="string"||p.label.length>90||
     typeof p.vercelProject!=="string"||!SHA.test((p.deployedCommit||"").padEnd(64,"0"))||
     !/^[a-f0-9]{40}$/i.test(p.deployedCommit||"")||
     typeof p.gitRef!=="string"||p.gitRef.length>140||
     typeof p.deploymentHost!=="string"||p.deploymentHost.length>200||
     !p.deploymentHost.endsWith(".vercel.app")||
     !Number.isInteger(p.tables)||p.tables<0||p.tables>500||
     !Number.isInteger(p.functions)||p.functions<0||p.functions>1000||
     !Array.isArray(p.rlsDisabled)||p.rlsDisabled.length>500||
     !Array.isArray(p.relevantTables)||p.relevantTables.length>500||
     !Array.isArray(p.missingRelevantTables)||p.missingRelevantTables.length>500)
    throw Error("Invalid environment identity.");
  for(const t of p.relevantTables)if(!safeName(t?.table)||
   !Number.isInteger(t.columns)||!Number.isInteger(t.policies)||!Number.isInteger(t.indexes)||
   typeof t.rlsEnabled!=="boolean")throw Error("Invalid environment table evidence.");
 }
 if(a.selected==="live"){
  checkEnvironment(a.live);
  if(a.sandbox!==null||a.compare!==null)throw Error("Unrequested environment data.");
 }else if(a.selected==="sandbox"){
  checkEnvironment(a.sandbox);
  if(a.live!==null||a.compare!==null)throw Error("Unrequested environment data.");
 }else{
  checkEnvironment(a.live);checkEnvironment(a.sandbox);
  const c=a.compare;
  if(!c||!c.source||!c.database||
   !Number.isInteger(c.source.totalChangedFiles)||c.source.totalChangedFiles>400||
   !Array.isArray(c.source.relevantChangedFiles)||c.source.relevantChangedFiles.length>400||
   !Array.isArray(c.database.selectedDifferentTables)||c.database.selectedDifferentTables.length>500||
   !Array.isArray(c.database.functionDifferences)||c.database.functionDifferences.length>1000||
   !Number.isInteger(c.database.totalDifferentTables)||
   !Number.isInteger(c.database.totalDifferentFunctions))
   throw Error("Invalid compare evidence.");
  for(const f of c.source.relevantChangedFiles)
    if(!safePath(f?.path)||!CODE_DIFF_STATUSES.has(f.status)||
       !Number.isInteger(f.additions)||!Number.isInteger(f.deletions))
       throw Error("Invalid deployed source delta.");
  for(const t of c.database.selectedDifferentTables)
    if(!safeName(t?.table)||!DB_DIFF_TYPES.has(t.kind))throw Error("Invalid schema comparison.");
  for(const x of c.database.functionDifferences)
    if(typeof x?.signature!=="string"||x.signature.length>320||
       !["live_only","sandbox_only","different_definition"].includes(x.status))
       throw Error("Invalid function comparison.");
 }
}
const RADAR_LANES=new Set(["essential","wow"]);
const RADAR_STATUSES=new Set(["preview_signals_found","partial_preview_signals","not_observed_in_sample"]);
const RADAR_PRIORITIES=new Set(["critical","high","medium","low"]);
const RADAR_SIZES=new Set(["high","medium","low"]);
function validString(value,limit){return typeof value==="string"&&value.length>0&&value.length<=limit;}
export function validateImprovementRadar(radar,files,sourceVersion,selectedScope){
 if(!radar||radar.kind!=="eig_build_lab_improvement_radar"||radar.schemaVersion!==1||
    radar.scope!==selectedScope||radar.sourceVersion!==sourceVersion||
    radar.origin!=="protected_preview_source_heuristics"||
    !validString(radar.benchmark,450)||
    !Array.isArray(radar.references)||radar.references.length<1||radar.references.length>8||
    !Array.isArray(radar.suggestions)||radar.suggestions.length<1||radar.suggestions.length>35||
    !Array.isArray(radar.limitations)||radar.limitations.length<3||radar.limitations.length>8||
    radar.safety?.readOnly!==true||radar.safety?.externalsVisited!==false||
    radar.safety?.aiCalled!==false||radar.safety?.autoBuilt!==false||
    radar.safety?.liveChanges!==false||radar.safety?.approvalRequired!==true)
    throw Error("Invalid Upgrade Radar report.");
 const allowed=new Set(files);
 for(const ref of radar.references)
   if(!validString(ref?.id,70)||!validString(ref?.name,140)||
      !/^https:\/\/(?:www\.w3\.org|www\.nngroup\.com|asvs\.owasp\.org|web\.dev)\/[a-zA-Z0-9/._-]*$/.test(ref.url||""))
     throw Error("Invalid Upgrade Radar benchmark reference.");
 const seen=new Set();
 for(const item of radar.suggestions){
   if(!ID.test(item?.id||"")||seen.has(item.id)||
      !RADAR_LANES.has(item.lane)||!RADAR_PRIORITIES.has(item.priority)||
      !RADAR_SIZES.has(item.impact)||!RADAR_SIZES.has(item.effort)||
      !RADAR_STATUSES.has(item.status)||item.claim!=="product_upgrade_candidate_not_verified"||
      item.ownerReview!=="pending"||
      !validString(item.title,140)||!validString(item.why,650)||
      !validString(item.proposal,950)||!validString(item.verify,950)||
      !Array.isArray(item.scope)||item.scope.length<1||item.scope.length>18||
      item.scope.some(x=>x!=="*"&&!ID.test(x))||
      !Array.isArray(item.dependencies)||item.dependencies.length>9||
      item.dependencies.some(x=>!validString(x,140))||
      !Array.isArray(item.evidence)||item.evidence.length>8||
      !Number.isInteger(item.signalsChecked)||item.signalsChecked<1||item.signalsChecked>8||
      item.signalCount!==item.evidence.length||item.signalCount>item.signalsChecked||
      (item.status==="preview_signals_found"&&item.signalCount!==item.signalsChecked)||
      (item.status==="partial_preview_signals"&&(item.signalCount===0||item.signalCount===item.signalsChecked))||
      (item.status==="not_observed_in_sample"&&item.signalCount!==0)||
      !radar.references.some(x=>x.id===item.standard))
     throw Error("Invalid Upgrade Radar opportunity.");
   seen.add(item.id);
   for(const ev of item.evidence)
     if(!allowed.has(ev?.path)||!Number.isInteger(ev?.line)||ev.line<1||ev.line>25000||
       !validString(ev.excerpt,150))throw Error("Invalid Upgrade Radar source evidence.");
 }
 const summary=radar.summary;
 if(!summary||summary.essential!==radar.suggestions.filter(x=>x.lane==="essential").length||
    summary.wow!==radar.suggestions.filter(x=>x.lane==="wow").length||
    summary.signalsFound!==radar.suggestions.filter(x=>x.status==="preview_signals_found").length||
    summary.partial!==radar.suggestions.filter(x=>x.status==="partial_preview_signals").length||
    summary.notObserved!==radar.suggestions.filter(x=>x.status==="not_observed_in_sample").length)
   throw Error("Invalid Upgrade Radar counts.");
 return radar;
}

export function validateMasterScanReport(report) {
  if(!report||typeof report!=="object"||report.kind!=="eig_build_lab_master_scan"||
    report.schemaVersion!==1||report.target!=="elevationpilot"||
    report.safety?.readOnly!==true||report.safety?.liveChanges!==false||
    report.safety?.customerRowsRead!==false||report.safety?.autoDeployed!==false||
    !SHA.test(report.sourceFingerprint||"")||
    !Array.isArray(report.files)||report.files.length<1||report.files.length>35||
    !Array.isArray(report.modules)||report.modules.length<1||report.modules.length>30)
    throw Error("Unsupported Master Scanner report.");
  // Reports saved before target selection remain valid as full-platform scans.
  const scope=report.scope||"full";
  if(!["full","module"].includes(scope)||
    (scope==="module"&&(!ID.test(report.selectedModule||"")||
      report.modules.length!==1||report.modules[0].id!==report.selectedModule))||
    (scope==="full"&&report.selectedModule!==undefined&&report.selectedModule!==null))
    throw Error("Invalid Master Scanner scope.");
  const files=new Set(report.files.map(f=>f.path));
  if(files.size!==report.files.length||[...files].some(p=>typeof p!=="string"||
    !/^(src|tests)\/[a-zA-Z0-9_.\/-]+$/.test(p)||p.includes("..")))throw Error("Invalid source list.");
  for(const item of report.modules) {
    if(!ID.test(item.id||"")||typeof item.title!=="string"||item.title.length>110||
      !STATES.has(item.status)||typeof item.nextCheck!=="string"||item.nextCheck.length>650||
      !Array.isArray(item.evidence)||item.evidence.length>12||
      !Array.isArray(item.tables)||item.tables.length>8)
      throw Error("Invalid Master Scanner module.");
    for(const [field,limit] of [['verify',1000],['observation',1000],['testScope',400]])if(item[field]!==undefined&&!validString(item[field],limit))throw Error('Invalid Master Scanner verification context.');
    if(item.coverage!==undefined){
      if(!item.coverage||Object.keys(item.coverage).sort().join(',')!=='source,test,ui')throw Error('Invalid Master Scanner coverage categories.');
      const states={source:['source_marker_found','partial_source_markers'],ui:['ui_marker_found','partial_ui_markers'],test:['test_code_found','partial_test_code']};
      for(const [kind,[complete,partial]] of Object.entries(states)){
        const c=item.coverage?.[kind];
        if(!c||!Number.isInteger(c.expected)||c.expected<0||c.expected>6||!Number.isInteger(c.observed)||c.observed<0||c.observed>c.expected||
          c.runtimeVerified!==false||!Array.isArray(c.checks)||c.checks.length!==c.expected||
          c.checks.some(x=>!files.has(x?.path)||!validString(x.marker,200)||typeof x.observed!=='boolean')||
          c.checks.filter(x=>x.observed).length!==c.observed||item.evidence.filter(e=>e.kind===kind).length!==c.observed)throw Error('Invalid Master Scanner coverage counts.');
        const expectedStatus=!c.expected?'not_sampled':!c.observed?'not_observed_in_sample':c.observed===c.expected?complete:partial;
        if(item[kind==='test'?'testStatus':kind+'Status']!==expectedStatus)throw Error('Invalid Master Scanner coverage status.');
      }
      if(item.status==='evidence_present'&&Object.values(item.coverage).some(c=>!c.expected||c.observed!==c.expected))throw Error('Invalid complete sample claim.');
    }
    for(const e of item.evidence) {
      if(!SOURCES.has(e?.kind)||!files.has(e?.path)||!Number.isInteger(e?.line)||
        e.line<1||e.line>25000||typeof e.excerpt!=="string"||e.excerpt.length>160)
        throw Error("Invalid Master Scanner evidence.");
    }
    for(const t of item.tables) {
      if(!/^[a-z0-9_]{1,80}$/.test(t?.table||"")||
        typeof t.production!=="boolean"||typeof t.sandbox!=="boolean")
        throw Error("Invalid schema metadata.");
    }
  }
  assertEnvironmentAudit(report.environmentAudit,report);
  if(report.improvementAudit!==undefined)
    validateImprovementRadar(report.improvementAudit,files,report.sourceVersion,scope==="full"?"all":report.selectedModule);
  const db=report.database;
  if(!db||db.freshLiveQuery!==false||typeof db.capturedOn!=="string"||
    !/^\d{4}-\d{2}-\d{2}$/.test(db.capturedOn)||
    !Number.isInteger(db.productionTables)||!Number.isInteger(db.sandboxTables)||
    db.productionTables<0||db.sandboxTables<0||
    !Array.isArray(db.missingInSandbox)||!Array.isArray(db.missingInProduction)||
    !Array.isArray(db.policyDifferences)||db.policyDifferences.length>75||
    !Array.isArray(report.limitations)||report.limitations.length<2||report.limitations.length>8)
    throw Error("Invalid database snapshot in Master Scanner report.");
  return report;
}
export async function requestMasterScan(supabase,http=fetch,moduleId=null,environmentMode="compare"){
  if(!supabase?.auth?.getSession||typeof http!=="function")
    throw Error("Sign in to your owner Build Lab account before scanning.");
  const {data,error}=await supabase.auth.getSession();
  const token=data?.session?.access_token;
  if(error||typeof token!=="string"||!token)
    throw Error("Sign in again before starting a Master Scan.");
  if(moduleId!==null && !ID.test(moduleId)) throw Error("Unsupported Master Scanner module.");
  if(!ENV_MODES.has(environmentMode)) throw Error("Unsupported Master Scanner environment.");
  const res=await http("/api/eig-build-lab-master-scan",{
    method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify(moduleId===null?{target:"elevationpilot",environmentMode}:{target:"elevationpilot",moduleId,environmentMode}),cache:"no-store",credentials:"same-origin",
  });
  if(!res.ok)throw Error([401,403].includes(res.status)
    ?"Your owner authorization or Build Lab preview access needs verification."
    :"Master Scanner could not complete. Check the protected preview and try again.");
  const payload=await res.json();
  const report=validateMasterScanReport(payload?.report);
  if(moduleId!==null && (report.scope!=="module"||report.selectedModule!==moduleId))
    throw Error("Master Scanner returned a different module than requested.");
  if(moduleId===null && report.scope==="module")
    throw Error("Master Scanner returned a targeted report for a full scan.");
  if(report.environmentAudit.selected!==environmentMode)
    throw Error("Master Scanner returned evidence for a different environment.");
  return report;
}

export async function requestImprovementRadar(supabase,http=fetch,moduleId=null){
 const report=await requestMasterScan(supabase,http,moduleId,"compare");
 if(!report.improvementAudit)
   throw Error("Upgrade Radar is not included in this preview yet. Refresh Build Lab and try again.");
 return {radar:validateImprovementRadar(report.improvementAudit,
   report.files.map(f=>f.path),report.sourceVersion,report.scope==="module"?report.selectedModule:"all"),
   fingerprint:report.sourceFingerprint,inspectedAt:report.inspectedAt};
}
