import ScannerDirectionsDisclosure from "./ScannerDirectionsDisclosure.jsx";
import BuildLabScanDestination, {BuildLabReportBackup} from "./BuildLabScanDestination.jsx";
import useBuildLabScanHistory from "./useBuildLabScanHistory.jsx";
import React, { useEffect, useState } from 'react';
import { scanBuildChangeImpact } from '../lib/buildChangeImpact.mjs';

const REPO = 'rahollowayEIG/elevated-impact-platform';
const KEY_PREFIX = 'eig:build-impact-review:v1:';
const validUid = /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i;
function safeKey(ownerUserId) {
  if (!validUid.test(ownerUserId || '')) return null;
  return KEY_PREFIX + ownerUserId.toLowerCase();
}
export default function BuildImpactReview({ ownerUserId, legacyReview=false, onViewBuckets }) {
  const [saved]=useState(()=>{
    try {
      const raw=localStorage.getItem(safeKey(ownerUserId));
      if(!raw||raw.length>150000)return null;
      const value=JSON.parse(raw);
      if(value?.version!==1||typeof value.baseRef!=="string"||typeof value.headRef!=="string"||!Array.isArray(value.files))return null;
      // Reconstruct a saved report through the same pure validator; no network request.
      const report=value.report?scanBuildChangeImpact({repository:REPO,baseRef:value.baseRef,headRef:value.headRef,files:value.files.map(path=>({path,status:"modified"}))}):null;
      return {...value,report};
    }catch{return null;}
  });
  const [baseRef,setBaseRef]=useState(saved?.baseRef||'main');
  const [headRef,setHeadRef]=useState(saved?.headRef||'feature/build-intelligence-impact-20261017');
  const [fileText,setFileText]=useState(saved?.files.join('\n')||'src/lib/buildChangeImpact.mjs\ntests/build-change-impact.test.mjs');
  const [report,setReport]=useState(saved?.report||null);
  const [decisions,setDecisions]=useState(saved?.decisions||{});
  const [error,setError]=useState('');
  const [saveError,setSaveError]=useState('');
  const history=useBuildLabScanHistory(ownerUserId,"impact",report?{report,reviews:decisions}:null,"proposed-change",report?.headRef||headRef);
  function run() {
    try {
      const files=fileText.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(path=>({path,status:'modified'}));
      const next=scanBuildChangeImpact({repository:REPO,baseRef,headRef,files});
      history.begin();setReport(next);setError('');
      setDecisions({}); // a new scan invalidates prior approvals
    } catch(e) {setError(e.message||'Unable to assess changes');setReport(null);}
  }
  useEffect(()=>{
    const key=safeKey(ownerUserId);
    if(!key)return;
    try {
      localStorage.setItem(key,JSON.stringify({version:1,baseRef,headRef,files:fileText.split(/\r?\n/).filter(Boolean),decisions,report:report&&{saved:true}}));
      setSaveError('');
    } catch {setSaveError('Local save unavailable; export your report before leaving.');}
  },[ownerUserId,baseRef,headRef,fileText,decisions,report]);
  function exportReport() {
    if(!report)return;
    const blob=new Blob([JSON.stringify({...report,reviewDecisions:decisions},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download='eig-change-impact-review.json';a.click();URL.revokeObjectURL(url);
  }
  return <section className="platform-section-card" aria-labelledby="build-impact-title">
    <h2 id="build-impact-title">Live System Change Impact</h2>
    <p>Owner-only planning tool. Paste reviewed paths from a proposed GitHub diff. No GitHub fetch, production access, deployment, or database write occurs. File names alone cannot prove safety.</p>
  <ScannerDirectionsDisclosure kind="impact" />
    <div className="bl-input-pair">
      <label>Base ref<input value={baseRef} maxLength={120} onChange={e=>{setBaseRef(e.target.value);setReport(null);}}/></label>
      <label>Proposed ref<input value={headRef} maxLength={120} onChange={e=>{setHeadRef(e.target.value);setReport(null);}}/></label>
    </div>
    <label>Changed file paths, one per line<textarea aria-label="Changed file paths, one per line" rows={5} value={fileText} onChange={e=>{setFileText(e.target.value);setReport(null);}}/></label>
    <div className="bl-review-actions">
      <button type="button" className="platform-primary-button" onClick={run}>Assess change risk</button>
      {report&&<BuildLabReportBackup legacyReview={legacyReview}><button type="button" className="platform-secondary-button" onClick={exportReport}>Download review JSON</button></BuildLabReportBackup>}
    </div>
    {history.error&&<p role="alert" className="platform-error">{history.error}</p>}
    {error&&<p role="alert" className="platform-error">{error}</p>}
    {saveError&&<p role="alert">{saveError}</p>}
    {report&&<div aria-live="polite">
      <BuildLabScanDestination onViewBuckets={onViewBuckets} />
      <p><strong>Risk: {report.riskLevel.toUpperCase()}</strong> · {report.fileCount} files · {report.findings.length} flagged impacts</p>
      <p><strong>Deployment BLOCKED pending owner review and independent checks.</strong> Reviewing findings here never authorizes release.</p>
      {report.findings.map(item=><article className="bl-scan-finding" key={item.id}>
        <h3>{item.category} · {item.severity}</h3>
        <p><code>{item.path}</code> · {item.reason}</p>
        {legacyReview&&<label>Owner decision
          <select aria-label="Owner decision" value={decisions[item.id]||'pending'} onChange={e=>setDecisions(current=>({...current,[item.id]:e.target.value}))}>
            <option value="pending">Needs review</option>
            <option value="accept">Accept finding</option>
            <option value="revise">Revise / investigate</option>
            <option value="reject">Reject finding</option>
          </select>
        </label>}
      </article>)}
      <h3>Release checks</h3>
      <ul>{report.requiredChecks.map(check=><li key={check}>{check}</li>)}</ul>
      <p className="bl-quiet">{report.limitations.join(' ')}</p>
    </div>}
  </section>;
}
