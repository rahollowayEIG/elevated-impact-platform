import React,{useState} from 'react';
import {requestLiveBuildLabScan} from '../lib/eigBuildLabLiveClient.mjs';
import BuildLabCloudBackup from './BuildLabCloudBackup.jsx';

// Production-only EIG owner surface. Does NOT import EigBuildLab, AI, builder,
// agents, invoices, deployment controls or other preview-only features.
// The backend verifies the owner and active session again on every request.
const RECORDS_UI_ENABLED=import.meta.env.VITE_EIG_BUILD_LAB_CLOUD_RECORDS_UI_ENABLED==='true';
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
 const [reports,setReports]=useState({});
 const [error,setError]=useState('');
 async function scan(kind){
  if(working)return;
  setWorking(kind);setError('');
  try{
   const report=await requestLiveBuildLabScan(supabaseClient,kind);
   setReports(previous=>({...previous,[kind]:report}));
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
  {error&&<p role="alert" className="platform-error">{error}</p>}
  <section className="platform-section-card">
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
  </section>
  {RECORDS_UI_ENABLED
   ?<BuildLabCloudBackup key={ownerUserId} ownerUserId={ownerUserId} supabaseClient={supabaseClient}/>
   :<section className="platform-section-card"><h2>Permanent records</h2><p>Cloud records will be shown here only after their database migration, access controls, and recovery workflow have passed the release gate. Browser data remains separate until explicitly reviewed.</p></section>}
 </main>;
}
