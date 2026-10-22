import React,{useState} from 'react';
import {requestBuilderCandidate} from '../lib/buildLabBuilderClient.mjs';
export default function BuildLabBuilder({plan,supabaseClient}){
 const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[result,setResult]=useState(null),[error,setError]=useState('');
 const eligible=plan?.status==='reviewed_for_handoff'&&plan.proposals.length===1&&plan.pilot&&['builder','fixer'].includes(plan.proposals[0].assignedTo);
 async function generate(){if(busy)return;setBusy(true);setError('');setResult(null);try{setResult(await requestBuilderCandidate(supabaseClient,plan,consent));}catch(e){setError(e.message);}finally{setBusy(false);}}
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(result.bundle)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='build-lab-builder-candidate.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section aria-label="Bounded IA builder"><h3>4. Prepare an implementation candidate</h3>
 <p>The first builder supports one current IA finding assigned to Bob the Builder or Mr. Fixit. It proposes component/style edits; browser tests, server code, permissions and dependencies are outside its writable scope.</p>
 <p>Generation requires the preview builder to be enabled. No tests run here. A separate owner-started verification workflow returns a patch, screenshots and results for review.</p>
 {!eligible?<p>Approve a single current IA pilot finding and assign Bob the Builder or Mr. Fixit to use this step.</p>:<>
 <p><strong>Requirement to implement:</strong> {plan.proposals[0].revision||plan.proposals[0].detail}</p>
 <label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)} /> Send the four allowlisted IA source/test files, this requirement and proposed edits to OpenAI for generation and a separate source review (up to two requests).</label>
 <button type="button" className="platform-primary-button" disabled={!consent||busy} onClick={generate}>{busy?'Generating and reviewing candidate…':'Generate IA implementation candidate'}</button>
 </>}
 {error&&<p role="alert">{error}</p>}
 {result&&<div role="status"><strong>{result.status==='blocked'?'Needs investigation':'Candidate prepared · Source review passed · Not tested'}</strong><p>{result.summary}</p>{result.status==='unverified_candidate'&&<><p>{result.sourceReview.summary}</p><ul>{result.sourceReview.requirements.map((r,i)=><li key={i}><strong>{r.requirement}</strong>: {r.evidence}</li>)}</ul><p>Source review is AI-assisted and may miss defects. Build and browser verification are still required.</p><p>Files: {result.files.join(', ')}. Signed handoff expires at {new Date(result.expiresAt).toLocaleTimeString()}.</p><button type="button" className="platform-secondary-button" onClick={download}>Download candidate for verification</button><p>In the repository’s Actions, select “Build Lab bounded IA builder” on the Build Lab preview branch. Paste the downloaded JSON into its candidate input. Review the returned evidence before requesting a preview change.</p></>}</div>}
 </section>;
}
