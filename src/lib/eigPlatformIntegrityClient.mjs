// Client contract. The protected server remains the access-control boundary.
const sha=/^[a-f0-9]{64}$/i;
const version=/^[0-9]{14}$/;
const safePath=p=>typeof p==='string'&&p.length<=180&&!p.startsWith('/')&&!p.includes('..')&&/^[a-zA-Z0-9/_.-]+$/.test(p);
const text=(x,max)=>typeof x==='string'&&x.length>0&&x.length<=max;
export function validatePlatformIntegrityReport(report){
 if(!report||report.kind!=='eig_build_lab_platform_integrity'||report.schemaVersion!==1||
    report.target!=='elevationpilot'||report.scannerVersion!=='platform-integrity-v1'||
    !Number.isFinite(Date.parse(report.inspectedAt))||!text(report.sourceVersion,150)||
    !sha.test(report.sourceFingerprint||'')||report.safety?.readOnly!==true||
    report.safety?.serverOnly!==true||report.safety?.liveChanges!==false||
    report.safety?.databaseQueried!==false||report.safety?.deletedItems!==0||
    report.safety?.autoDeleted!==false||report.safety?.autoApproved!==false||
    report.safety?.autoDeployed!==false)
  throw Error('Unsupported integrity report.');
 const inv=report.inventory;
 if(!inv||!Array.isArray(inv.sampledFiles)||inv.sampledFiles.length<2||inv.sampledFiles.length>10||
   inv.sampledFiles.some(p=>!safePath(p))||
   !Number.isInteger(inv.sourceMigrationCount)||inv.sourceMigrationCount<0||inv.sourceMigrationCount>300||
   !Number.isInteger(inv.baselineMigrationCount)||inv.baselineMigrationCount<0||inv.baselineMigrationCount>300||
   !Number.isFinite(Date.parse(inv.baselineCapturedOn))||
   !Array.isArray(inv.sourceOnlyVersions)||!Array.isArray(inv.baselineOnlyVersions)||
   inv.sourceOnlyVersions.length>300||inv.baselineOnlyVersions.length>300||
   [...inv.sourceOnlyVersions,...inv.baselineOnlyVersions].some(v=>!version.test(v)))
  throw Error('Invalid integrity inventory.');
 if(!Array.isArray(report.findings)||report.findings.length>30||
    !Array.isArray(report.limitations)||report.limitations.length<3||report.limitations.length>8||
    report.limitations.some(x=>!text(x,350)))
  throw Error('Invalid integrity findings.');
 const found=new Set();
 for(const f of report.findings){
  if(!text(f?.id,100)||found.has(f.id)||!text(f.title,200)||
     !['critical','high','medium','low'].includes(f.priority)||
     !text(f.observation,850)||!text(f.recommendation,1000)||!text(f.verify,1000)||
     f.findingType!=='verification_needed'||f.review!=='pending'||
     !Array.isArray(f.evidence)||!f.evidence.length||f.evidence.length>6||
     f.evidence.some(e=>!safePath(e?.path)||!Number.isInteger(e.line)||e.line<1||e.line>30000))
    throw Error('Invalid integrity finding.');
  found.add(f.id);
 }
 return report;
}
