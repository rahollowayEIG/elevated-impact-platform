import React,{useState} from 'react';
import {
 CLOUD_RECORD_KINDS,readBuildLabBrowserSnapshot,inspectBuildLabCloudSnapshot,
 saveOneBuildLabCloudDocument,restoreBuildLabCloudSnapshot
} from '../lib/buildLabCloudBackup.mjs';
import {createBuildLabEvidencePackage} from '../lib/buildLabEvidencePackage.mjs';

// Explicit owner actions only. Preview/Live server gates independently deny
// inaccessible environments regardless of whether these controls are visible.
export default function BuildLabCloudBackup({ownerUserId,supabaseClient,temporary=false}){
 const [inspection,setInspection]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [backupRequested,setBackupRequested]=useState(false);
 const [confirmed,setConfirmed]=useState(false);
 async function inspect(){
  setBusy(true);setError('');setNotice('');setBackupRequested(false);setConfirmed(false);
  try{
   setInspection(await inspectBuildLabCloudSnapshot(supabaseClient,localStorage,ownerUserId));
   setNotice('Cloud and browser records inspected. Nothing has been saved or restored.');
  }catch(e){setInspection(null);setError(e.message||'Cloud records could not be read.');}
  finally{setBusy(false);}
 }
 function downloadBrowserBackup(){
  try{
   const report=createBuildLabEvidencePackage(localStorage,ownerUserId);
   const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
   const a=document.createElement('a');a.href=url;
   a.download='eig-build-lab-before-cloud-restore-'+report.generatedAt.slice(0,10)+'.json';
   a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setBackupRequested(true);setError('');
   setNotice('Browser backup download requested. Confirm you can locate the JSON file before restoring.');
  }catch(e){setBackupRequested(false);setError(e.message||'Could not prepare the browser backup.');}
 }
 async function save(kind){
  if(!inspection)return;
  setBusy(true);setError('');setNotice('');
  try{
   const result=await saveOneBuildLabCloudDocument(supabaseClient,localStorage,ownerUserId,inspection,kind);
   const latest=await inspectBuildLabCloudSnapshot(supabaseClient,localStorage,ownerUserId);
   setInspection(latest);setBackupRequested(false);setConfirmed(false);
   setNotice('Saved '+CLOUD_RECORD_KINDS.find(([id])=>id===kind)?.[1]+' to cloud revision '+result.revision+'. Other record types were not changed.');
  }catch(e){
   setInspection(null);setError(e.message||'Cloud save failed. Check browser records and re-inspect.');
  }finally{setBusy(false);}
 }
 async function restore(){
  if(!inspection||!backupRequested||!confirmed)return;
  setBusy(true);setError('');setNotice('');
  try{
   const latest=await inspectBuildLabCloudSnapshot(supabaseClient,localStorage,ownerUserId);
   const revisionChanged=CLOUD_RECORD_KINDS.some(([kind])=>
    latest.remote[kind].revision!==inspection.remote[kind].revision);
   const browserChanged=JSON.stringify(readBuildLabBrowserSnapshot(localStorage,ownerUserId).documents)!==
     JSON.stringify(inspection.local.documents);
   if(revisionChanged||browserChanged){
    setInspection(null);setConfirmed(false);setBackupRequested(false);
    throw Error('Browser or cloud records changed since inspection. Inspect again before restoring.');
   }
   if(!latest.remote.scan_history.found||!latest.remote.work_buckets.found)
    throw Error('Save both Scan History and Work Buckets in the cloud before using full recovery.');
   const ok=window.confirm('Replace saved Build Lab work in THIS browser with the inspected cloud snapshot? This restores Scan History, Work Buckets and the Manager plan. Your downloaded backup is your way back. There is no undo, and no agent or deployment will run.');
   if(!ok){setNotice('Cloud restore cancelled. Browser records were not changed.');return;}
   restoreBuildLabCloudSnapshot(localStorage,ownerUserId,latest,{allowReplace:true});
   // Other mounted Build Lab panels may hold old state and autosave. Reload
   // immediately rather than allowing stale Manager autosave to undo recovery.
   window.location.reload();
  }catch(e){setError(e.message||'Cloud restore failed. Existing records were preserved when possible.');}
  finally{setBusy(false);}
 }
 const labels={identical:'Same',different:'Different',cloud_empty:'Not backed up',both_empty:'Both empty'};
 return <section className="platform-section-card" aria-label="Build Lab Cloud Backup & Recovery">
  <h3>{temporary?'Temporary Cloud Storage Test':'Cloud Backup & Recovery'}</h3>
  {temporary&&<p role="status"><strong>Isolated test environment.</strong> Records here may be deleted when testing ends. Keep your local JSON backups; this is not permanent production storage.</p>}
  <p>Owner-controlled, versioned storage. Nothing syncs automatically. Cloud writes are made one record type at a time; a saved scan does not mean Work Buckets or the Manager plan were saved.</p>
  <p><button type="button" className="platform-secondary-button" disabled={busy} onClick={inspect}>{busy?'Checking records…':'Inspect cloud and browser records'}</button></p>
  {error&&<p role="alert" className="platform-error">{error}</p>}
  {notice&&<p role="status" className="bl-notice">{notice}</p>}
  {inspection&&<>
   <div className="bl-history-table"><table>
    <thead><tr><th>Record type</th><th>Cloud revision</th><th>Comparison</th><th>Owner action</th></tr></thead>
    <tbody>{CLOUD_RECORD_KINDS.map(([kind,label])=><tr key={kind}>
     <td>{label}</td>
     <td>{inspection.remote[kind].found?inspection.remote[kind].revision:'Not saved'}</td>
     <td>{labels[inspection.compare[kind]]}</td>
     <td><button type="button" className="platform-secondary-button" disabled={busy||inspection.local.documents[kind]===null||inspection.compare[kind]==='identical'}
      onClick={()=>save(kind)}>Save browser version to cloud</button></td>
    </tr>)}</tbody>
   </table></div>
   <p role="status">Browser: {inspection.summary.localScans} scans, {inspection.summary.localWorkItems} work items, {inspection.summary.localBatches} batches. Cloud: {inspection.summary.cloudScans} scans, {inspection.summary.cloudWorkItems} work items, {inspection.summary.cloudBatches} batches.</p>
   <h4>Restore the complete cloud snapshot into this browser</h4>
   <p>Restoring replaces local Scan History, Work Buckets and Manager plan. Cloud must contain both Scan History and Work Buckets. Download a local backup first, verify the file, then confirm replacement. No cloud records are deleted.</p>
   <p><button type="button" className="platform-secondary-button" onClick={downloadBrowserBackup} disabled={busy}>Download browser backup before restore</button></p>
   <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={!backupRequested||busy} /> I located my downloaded browser backup and approve replacing local work.</label>
   <p><button type="button" className="platform-primary-button" disabled={busy||!backupRequested||!confirmed||!inspection.remote.scan_history.found||!inspection.remote.work_buckets.found} onClick={restore}>Restore cloud records to this browser</button></p>
  </>}
 </section>;
}
