// The server is the only party allowed to inspect bundled source.
// This client verifies the shape, not the permissions (server handles those).
const SHA=/^[a-f0-9]{64}$/i;
const ID=/^[a-z0-9-]{3,80}$/;
const SOURCES=new Set(["source","ui","test"]);
const STATES=new Set(["evidence_present","review_needed","not_observed_in_sample"]);
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
      !Array.isArray(item.evidence)||item.evidence.length>6||
      !Array.isArray(item.tables)||item.tables.length>8)
      throw Error("Invalid Master Scanner module.");
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
export async function requestMasterScan(supabase,http=fetch,moduleId=null){
  if(!supabase?.auth?.getSession||typeof http!=="function")
    throw Error("Sign in to your owner Build Lab account before scanning.");
  const {data,error}=await supabase.auth.getSession();
  const token=data?.session?.access_token;
  if(error||typeof token!=="string"||!token)
    throw Error("Sign in again before starting a Master Scan.");
  if(moduleId!==null && !ID.test(moduleId)) throw Error("Unsupported Master Scanner module.");
  const res=await http("/api/eig-build-lab-master-scan",{
    method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify(moduleId===null?{target:"elevationpilot"}:{target:"elevationpilot",moduleId}),cache:"no-store",credentials:"same-origin",
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
  return report;
}
