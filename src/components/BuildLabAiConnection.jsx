import ScannerDirectionsDisclosure from "./ScannerDirectionsDisclosure.jsx";
import BuildLabScanDestination, {BuildLabReportBackup} from "./BuildLabScanDestination.jsx";
import {readScanHistory} from "../lib/buildLabScanHistory.mjs";
import useBuildLabScanHistory from "./useBuildLabScanHistory.jsx";
import ScannerToolsDisclosure from "./ScannerToolsDisclosure.jsx";
import React,{useState} from "react";
import {MASTER_SCAN_TARGETS} from "../lib/eigMasterScanTargets.mjs";
const MAX_ITEMS=4;
function validateReview(payload,moduleId){
 const r=payload?.review;
 if(payload?.ok!==true||r?.kind!=="eig_build_lab_ai_review"||
  r.moduleId!==moduleId||r.schemaVersion!==1||
  r.safety?.readOnly!==true||r.safety?.autoDeployed!==false||
  r.safety?.customerDataUploaded!==false||r.safety?.rawSourceUploaded!==false||
  !Array.isArray(r.recommendations)||r.recommendations.length>MAX_ITEMS||
  !r.recommendations.every(x=>x.status==="unverified_proposal"&&x.ownerReview==="pending"&&
   typeof x.title==="string"&&typeof x.nextAction==="string"&&
   Array.isArray(x.evidenceFiles)))throw Error("AI review failed safety validation.");
 return r;
}
function restoreAI(uid){
 try {return readScanHistory(window.localStorage,uid).filter(x=>x.type==="ai").map(x=>validateReview({ok:true,review:x.snapshot.review},x.scope));}catch{return [];}
}
export default function BuildLabAiConnection({supabaseClient,ownerUserId,onViewBuckets}) {
 const [saved]=useState(()=>restoreAI(ownerUserId));
 const [busy,setBusy]=useState(false),[result,setResult]=useState(null);
 const [error,setError]=useState("");
 const [reviewRunning,setReviewRunning]=useState(false);
 const [moduleId,setModuleId]=useState(()=>saved[0]?.moduleId||"invoices");
 const [review,setReview]=useState(()=>saved[0]||null);
 const history=useBuildLabScanHistory(ownerUserId,"ai",review?{review}:null,review?.moduleId||"invoices",review?.sourceVersion);
 const [reviewError,setReviewError]=useState("");
 async function ownerToken(){
  if(!supabaseClient)throw Error("Sign in to EIG before testing.");
  const {data,error:authError}=await supabaseClient.auth.getSession();
  const token=data?.session?.access_token;
  if(authError||!token)throw Error("Your session expired. Please sign in again.");
  return token;
 }
 async function testConnection(){
  if(busy)return;
  setBusy(true);setError("");setResult(null);
  try{
   const token=await ownerToken();
   const res=await fetch("/api/eig-build-lab-ai-probe",{
    method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
    body:"{}"
   });
   const payload=await res.json().catch(()=>({}));
   if(!res.ok||payload.ok!==true)throw Error(payload.message||"AI connection did not complete. Verify preview access and configuration.");
   setResult({model:payload.model,input:payload.usage?.input_tokens??0,output:payload.usage?.output_tokens??0});
  }catch(e){setError(e.message||"Connection unavailable.");}
  finally{setBusy(false);}
 }
 async function reviewScan(){
  if(reviewRunning)return;
  setReviewRunning(true);setReviewError("");
  try{
   const token=await ownerToken();
   const res=await fetch("/api/eig-build-lab-ai-review",{
    method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
    body:JSON.stringify({moduleId})
   });
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(data.message||"Review connection unavailable.");
   history.begin(moduleId);setReview(validateReview(data,moduleId));
  }catch(e){setReviewError(e.message||"AI review unavailable.");}
  finally{setReviewRunning(false);}
 }
 return <section className="platform-section-card" aria-labelledby="bl-ai-title">
   <div className="bl-scanner-title"><h2 id="bl-ai-title">OpenAI Connection &amp; Scanner Review</h2><ScannerToolsDisclosure kind="ai" completed={Boolean(review)} /></div>
   <p>Owner-only, protected-preview integration. A connection test sends fixed text. A selected scanner review sends only bounded first-party scanner metadata, never customer records or raw source code. These are proposals, not verified functionality or automatic code edits.</p>
  <ScannerDirectionsDisclosure kind="ai" moduleId={moduleId} />
   <details><summary>Connection diagnostics</summary>
   <button type="button" className="platform-secondary-button" disabled={busy} onClick={testConnection}>{busy?"Testing connection…":"Test OpenAI Connection"}</button>
   {error&&<p role="alert" className="platform-error">{error}</p>}
   {result&&<p role="status">Connected successfully · {result.model} · Input tokens: {result.input} · Output tokens: {result.output}. No application changes were made.</p>}
   </details>
   <div style={{borderTop:"1px solid #55728b",marginTop:18,paddingTop:14}}>
    <h3 style={{margin:"0 0 8px",color:"#fff"}}>AI analysis of Master Scanner findings</h3>
    <p>Select one module. AI will summarize read-only code/test/database snapshot findings and suggest improvements to review before implementation. No public-site or competitor scan is performed.</p>
    <label htmlFor="bl-ai-scope" style={{display:"grid",gap:7,fontSize:13,fontWeight:700,margin:"10px 0"}}>
     Which module should AI review?
     <select id="bl-ai-scope" value={moduleId} onChange={e=>{setModuleId(e.target.value);setReview(restoreAI(ownerUserId).find(x=>x.moduleId===e.target.value)||null);setReviewError("");}}
      disabled={reviewRunning} style={{minHeight:40,padding:8,borderRadius:7}}>
      {MASTER_SCAN_TARGETS.map(x=><option value={x.id} key={x.id}>{x.label}</option>)}
     </select>
    </label>
    <button type="button" className="platform-primary-button" onClick={reviewScan} disabled={reviewRunning}>
     {reviewRunning?"Requesting bounded AI review…":"Analyze this scanner module with AI"}
    </button>
    <p style={{fontSize:12,color:"#c2d9e7"}}>Each click makes one limited, potentially billable OpenAI API request. No continuous scanning or provider-independent usage budget is configured. Findings must be reviewed by the owner.</p>
    {history.error&&<p role="alert" className="platform-error">{history.error}</p>}
    {review&&<p className="bl-quiet">Saved AI result for this module. Scan History keeps earlier runs in this browser.</p>}
    {reviewError&&<p role="alert" className="platform-error">{reviewError}</p>}
    {review&&<div className="bl-ai-scan-results" aria-label="AI module review">
     <BuildLabScanDestination onViewBuckets={onViewBuckets} />
<BuildLabReportBackup>     <button type="button" className="platform-secondary-button" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(review,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="build-lab-ai-review.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Download AI review JSON</button></BuildLabReportBackup>
     <p><strong>AI proposal · Not verified:</strong> {review.summary}</p>
     <p style={{fontSize:12,color:"#c3d7e6"}}>Source version: {review.sourceVersion?.slice(0,12)||"unversioned"} · Model: {review.model} · Tokens in/out: {review.usage?.input_tokens}/{review.usage?.output_tokens}</p>
     {review.recommendations.length?review.recommendations.map(x=><article key={x.id}
      style={{border:"1px solid #567a91",borderRadius:9,padding:12,margin:"9px 0",background:"#1b3f55"}}>
      <strong>{x.title}</strong><p>{x.why}</p><p><b>Proposed next action:</b> {x.nextAction}</p>
      {x.evidenceFiles.length>0&&<p style={{fontSize:12}}>First-party evidence paths: {x.evidenceFiles.join(", ")}</p>}
      <small>Review in Work Buckets · No changes applied</small>
     </article>):<p>No evidence-supported recommendations were returned.</p>}
    </div>}
   </div>
 </section>;
}
