export async function requestBuilderCandidate(client,blueprint,shareSourceWithOpenAI,http=fetch){
 if(shareSourceWithOpenAI!==true)throw Error('Confirm source sharing before generating a candidate.');
 const {data,error}=await client?.auth?.getSession?.()||{};
 const token=data?.session?.access_token;
 if(error||!token)throw Error('Sign in again before starting the builder.');
 const res=await http('/api/eig-build-lab-builder',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify({blueprint,shareSourceWithOpenAI:true})});
 const body=await res.json();
 if(!res.ok||body?.ok!==true)throw Error(typeof body?.message==='string'?body.message:'Builder request failed.');
 const result=body.result;
 if(!result||!['blocked','unverified_candidate'].includes(result.status)||typeof result.summary!=='string'||result.summary.length>1000)throw Error('Invalid builder result.');
 if(result.status==='unverified_candidate'&&(result.testsRun!==false||result.sourceReview?.verdict!=='pass'||typeof result.sourceReview.summary!=='string'||result.sourceReview.summary.length>1000||!Array.isArray(result.sourceReview.requirements)||!result.sourceReview.requirements.length||result.sourceReview.requirements.length>12||result.sourceReview.requirements.some(r=>r?.met!==true||typeof r.requirement!=='string'||!r.requirement.trim()||r.requirement.length>500||typeof r.evidence!=='string'||!r.evidence.trim()||r.evidence.length>1000)||!Array.isArray(result.sourceReview.unresolved)||result.sourceReview.unresolved.length||typeof result.bundle?.payload!=='string'||result.bundle.payload.length>55000||!/^[a-f0-9]{64}$/.test(result.bundle?.signature||'')||!Array.isArray(result.files)||result.files.some(p=>!['src/components/InceptionApex.jsx','src/components/FlyerEditor.jsx','src/components/inception-apex.css'].includes(p))||!Number.isSafeInteger(result.expiresAt)))throw Error('Invalid candidate handoff.');
 return result;
}
