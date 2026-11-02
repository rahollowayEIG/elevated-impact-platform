// Browser transport and strict shape check. Authorization is server-side.
const SHA=/^[a-f0-9]{64}$/i, ID=/^ai-\d+-[a-z0-9-]{2,80}$/;
const safePath=p=>typeof p==='string'&&p.length<=180&&!p.includes('..')&&
 /^(src|tests)\/[a-zA-Z0-9._/-]+$/.test(p);
const text=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
export function validateBuildLabAiReview(review){
 if(!review||review.kind!=='eig_build_lab_ai_review'||review.schemaVersion!==1||
  review.target!=='elevationpilot'||!SHA.test(review.sourceFingerprint||'')||
  !text(review.sourceVersion,80)||!text(review.model,80)||
  !Number.isFinite(Date.parse(review.reviewedAt))||
  review.provenance!=='ai_advice_based_on_bounded_scanner_metadata_only'||
  review.scope!=='all'||review.safety?.readOnly!==true||
  review.safety?.serverOnly!==true||review.safety?.aiCalled!==true||
  review.safety?.customerRowsSent!==false||review.safety?.autoApproved!==false||
  review.safety?.autoBuilt!==false||review.safety?.autoDeployed!==false||
  review.safety?.liveChanges!==false||
  !Array.isArray(review.limitations)||review.limitations.length!==3||
  review.limitations.some(x=>!text(x,400))||
  !Array.isArray(review.recommendations)||review.recommendations.length>5)
  throw Error('Unsupported AI review report.');
 const seen=new Set();
 for(const item of review.recommendations){
  if(!ID.test(item?.id||'')||seen.has(item.id)||
   !text(item.title,120)||!text(item.why,500)||!text(item.proposal,750)||
   !text(item.verify,750)||!text(item.moduleId,80)||
   !['critical','high','medium','low'].includes(item.priority)||
   item.findingType!=='improvement_idea'||item.ownerReview!=='pending'||
   !Array.isArray(item.evidence)||item.evidence.length>3||
   item.evidence.some(e=>!safePath(e?.path)||!Number.isInteger(e.line)||e.line<1||e.line>30000))
    throw Error('Invalid AI recommendation.');
  seen.add(item.id);
 }
 return review;
}
export async function requestBuildLabAiReview(client,http=fetch){
 if(!client?.auth?.getSession||typeof http!=='function')
  throw Error('An EIG owner session is required.');
 const {data,error}=await client.auth.getSession();
 const token=data?.session?.access_token;
 if(error||!token||typeof token!=='string')
  throw Error('Sign in again to verify owner access.');
 const res=await http('/api/eig-build-lab-ai-review',{method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({target:'master'}),cache:'no-store',credentials:'same-origin'});
 if(!res?.ok)throw Error('AI review unavailable (HTTP '+(res?.status||'unknown')+'). Verify owner access and AI configuration.');
 const payload=await res.json();
 if(payload?.ok!==true||!payload.review)throw Error('AI review returned no valid report.');
 return validateBuildLabAiReview(payload.review);
}
