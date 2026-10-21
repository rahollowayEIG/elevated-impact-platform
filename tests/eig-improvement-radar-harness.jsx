import React from "react";
import {createRoot} from "react-dom/client";
import BuildLabImprovementRadar from "../src/components/BuildLabImprovementRadar.jsx";
import "../src/styles.css";

const OWNER="11111111-1111-4111-8111-111111111111";
const SHA="a".repeat(40);
const safe={readOnly:true,externalsVisited:false,aiCalled:false,autoBuilt:false,liveChanges:false,approvalRequired:true};
function suggestion(id,lane,scope){
 const base={
  id,title:id==="identity-for-actions"?"Account-first for every trackable action":"Smart next-action companion",
  lane,priority:id==="identity-for-actions"?"critical":"high",impact:"high",effort:"medium",
  scope,why:id==="identity-for-actions"?"Track every form to one verified account.":"Help users find their next task.",
  proposal:id==="identity-for-actions"?"Use one common account gateway to preserve every submitted request.":"Suggest the next practical action for a user's role.",
  verify:"Use synthetic accounts to verify access and user-friendly completion paths.",
  dependencies:["Verified identity"],standard:"owasp-asvs",
  claim:"product_upgrade_candidate_not_verified",ownerReview:"pending",
 };
 if(id==="identity-for-actions")return {...base,status:"partial_preview_signals",signalCount:1,signalsChecked:2,
  evidence:[{path:"src/PlatformApp.jsx",line:2,excerpt:"EVENT_INQUIRY_PORTAL_ENABLED"}]};
 return {...base,status:"not_observed_in_sample",signalCount:0,signalsChecked:2,evidence:[]};
}
function radar(scope){
 const suggestions=[suggestion("identity-for-actions","essential",["*"]),suggestion("smart-next-steps","wow",["*"])];
 return {
  kind:"eig_build_lab_improvement_radar",schemaVersion:1,scope,
  sourceVersion:SHA,origin:"protected_preview_source_heuristics",
  benchmark:"Static product quality rubric; no sites crawled or AI invoked.",
  references:[{id:"owasp-asvs",name:"OWASP ASVS",url:"https://asvs.owasp.org/"}],
  suggestions,
  summary:{essential:1,wow:1,signalsFound:0,partial:1,notObserved:1},
  safety:safe,limitations:["Candidates need verification.","No runtime tests were run.",
   "No external product comparisons were performed."],
 };
}
const stats={calls:[],liveChanges:0,unauthorizedCalls:0};
window.radarHarness={stats};
async function fakeScan(_supabase,_fetch,moduleId){
 const target=moduleId||"all";
 stats.calls.push(target);
 return {radar:radar(target),fingerprint:(target==="all"?"a":"b").repeat(64),
  inspectedAt:"2026-10-20T22:00:00.000Z"};
}
const APP_AUTH={auth:{getSession:async()=>({data:{session:{access_token:"fake-token"}},error:null})}};
createRoot(document.getElementById("root")).render(
 <main style={{padding:12,maxWidth:1200,margin:"auto"}}>
  <BuildLabImprovementRadar ownerUserId={OWNER} supabaseClient={APP_AUTH} runScanner={fakeScan}/>
 </main>
);
