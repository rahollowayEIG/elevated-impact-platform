import React,{useState} from 'react';
import {HISTORY_EVENT,saveScanHistory} from '../lib/buildLabScanHistory.mjs';
import BuildLabScanHistory from './BuildLabScanHistory.jsx';
import BuildLabWorkBuckets from './BuildLabWorkBuckets.jsx';
import BuildLabLivePlanReview from './BuildLabLivePlanReview.jsx';
import {requestLiveBuildLabScan} from '../lib/eigBuildLabLiveClient.mjs';
import BuildLabCloudBackup from './BuildLabCloudBackup.jsx';

// Production-only EIG owner surface. Does NOT import EigBuildLab, AI, builder,
// agents, invoices, deployment controls or other preview-only features.
// The backend verifies the owner and active session again on every request.
const RECORDS_UI_ENABLED=import.meta.env.VITE_EIG_BUILD_LAB_CLOUD_RECORDS_UI_ENABLED==='true'||
 import.meta.env.VITE_EIG_BUILD_LAB_PREVIEW_CLOUD_RECORDS_UI_ENABLED==='true';
function downloadReport(report,kind){
 const file=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(file);
 const link=document.createElement('a');
 link.href=url;link.download='eig-build-lab-live-'+kind+'-'+new Date().toISOString().slice(0,10)+'.json';
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function BuildLabLiveOwnerWorkspace({ownerUserId,supabaseClient,onBack}){
 const [working,setWorking]=useState('');
 const [activeTool,setActiveTool]=useState('scanners');
 const [recordNotice,setRecordNotice]=useState('');
 const [reports,setReports]=useState({});
 const [error,setError]=useState('');
 async function scan(kind){
  if(working)return;
  setWorking(kind);setError('');setRecordNotice('');
  try{
   const report=await requestLiveBuildLabScan(supabaseClient,kind);
   setReports(previous=>({...previous,[kind]:report}));
   try{
    const stamp=report.inspectedAt||new Date().toISOString();
    const entry={id:crypto.randomUUID(),type:kind==='master'?'master':'inspector',
     scope:kind==='master'?'all':'inception-apex',
     source:report.sourceVersion||report.sourceFingerprint||'unknown',
     savedAt:Number.isFinite(Date.parse(stamp))?stamp:new Date().toISOString(),
     snapshot:{report}};
    if(saveScanHistory(localStorage,ownerUserId,entry))window.dispatchEvent(new Event(HISTORY_EVENT));
    setRecordNotice('Source report saved to owner-local Scan History. Open Work Buckets to review findings.');
   }catch{setRecordNotice('Scan succeeded, but browser history could not be saved. Download the JSON report before leaving.');}
  }catch(e){setError(e?.message||'Read-only scanner unavailable.');}
  finally{setWorking('');}
 }
 return <main className="platform-page" aria-label="EIG Build Lab production owner workspace">
  <section className="platform-hero organization">
   <div><p className="platform-eyebrow">EIG / BUILD LAB</p>
    <h1>Owner Console: Read-only Scanning &amp; Evidence</h1>
    <p>This restricted production surface inspects allowlisted first-party source evidence. Reports do not prove real-world application behavior. No AI generation, automatic fixes, customer queries, writes to events, or deployments are available here.</p>
   </div>
   <button type="button" className="platform-secondary-button" onClick={onBack}>Back to Command Center</button>
  </section>
  <nav className="platform-section-card" aria-label="Build Lab V1 owner workflow">
   {[
    ['scanners','1. Scan'],['history','2. History'],['buckets','3. Work Buckets'],['plans','4. Review & Fix Plan']
   ].map(([id,label])=><button type="button" key={id}
    className={activeTool===id?'platform-primary-button':'platform-secondary-button'}
    aria-pressed={activeTool===id} onClick={()=>setActiveTool(id)}>{label}</button>)}
  </nav>
  {error&&<p role="alert" className="platform-error">{error}</p>}
  {recordNotice&&<p role="status">{recordNotice}</p>}
  {activeTool==='scanners'&&<section className="platform-section-card">
   <h2>Read-only source scanners</h2>
   <p>Every scan rechecks the owner session on the server. If the server is not enabled for Live, access is denied.</p>
   {[
    ['master','Master Scanner','Allowlisted ElevationPilot source and dated reference snapshots'],
    ['inspector','IA Inspector','Allowlisted InceptionApex source and UI evidence']
   ].map(([kind,title,description])=><section key={kind} aria-label={title}>
    <h3>{title}</h3><p>{description}</p>
    <button className="platform-primary-button" type="button" disabled={!!working} onClick={()=>scan(kind)}>
     {working===kind?'Scanning…':'Run '+title+' (read-only)'}
    </button>
    {reports[kind]&&<>
     <p role="status">Report returned and passed client-side shape validation. Review evidence before taking action.</p>
     <button type="button" className="platform-secondary-button" onClick={()=>downloadReport(reports[kind],kind)}>Download source report JSON</button>
     <details><summary>View report evidence</summary><pre style={{maxHeight:450,overflow:'auto',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(reports[kind],null,2)}</pre></details>
    </>}
   </section>)}
  </section>}
  {activeTool==='history'&&<BuildLabScanHistory key={ownerUserId} ownerUserId={ownerUserId} supabaseClient={supabaseClient}/>}
  {activeTool==='buckets'&&<BuildLabWorkBuckets key={ownerUserId} ownerUserId={ownerUserId} onOpenManager={()=>setActiveTool('plans')}/>}
  {activeTool==='plans'&&<BuildLabLivePlanReview key={ownerUserId} ownerUserId={ownerUserId}/>}
  {RECORDS_UI_ENABLED
   ?<BuildLabCloudBackup key={ownerUserId} ownerUserId={ownerUserId} supabaseClient={supabaseClient}/>
   :<section className="platform-section-card"><h2>Permanent records</h2><p>Cloud records will be shown here only after their database migration, access controls, and recovery workflow have passed the release gate. Browser data remains separate until explicitly reviewed.</p></section>}
 </main>;
}
