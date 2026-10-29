// Shared candidate contract. No provider calls or command execution.
const {createHash,createHmac,timingSafeEqual}=require('node:crypto');
const {FILE_PATHS,scanInceptionSource}=require('./eig-inception-source-scan.cjs');
const WRITABLE=FILE_PATHS.filter(p=>p.startsWith('src/components/'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const keys=(x,wanted)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===[...wanted].sort().join(',');
function applyEdits(sources,edits){
 if(!Array.isArray(edits)||!edits.length||edits.length>12)throw Error('Expected one to twelve edits.');
 const result={...sources};
 for(const e of edits){
  if(!keys(e,['path','before','after'])||!WRITABLE.includes(e.path)||typeof e.before!=='string'||typeof e.after!=='string')throw Error('Unsupported candidate edit.');
  if(!e.before.trim())throw Error('Empty candidate search text.');
  if(e.before.length>12000||e.after.length>12000)throw Error('Oversized candidate replacement.');
  if(e.before===e.after)throw Error('Unchanged candidate replacement.');
  const original=result[e.path];
  const at=original.indexOf(e.before);
  if(at<0||original.indexOf(e.before,at+1)>=0)throw Error('Edit must match exactly once.');
  result[e.path]=original.slice(0,at)+e.after+original.slice(at+e.before.length);
  if(!result[e.path].trim()||result[e.path].length>100000)throw Error('Invalid resulting source.');
 }
 return result;
}
function candidateFor({proposal,sources,sourceVersion,findingId,instruction,now=Date.now()}){
 if(!keys(proposal,['status','summary','edits'])||!['candidate','blocked'].includes(proposal.status)||typeof proposal.summary!=='string'||proposal.summary.length<5||proposal.summary.length>1000||!Array.isArray(proposal.edits))throw Error('Invalid builder response.');
 if(proposal.status==='blocked'){
  if(proposal.edits.length)throw Error('Blocked response cannot contain edits.');
  return {status:'blocked',summary:proposal.summary};
 }
 if(!/^[a-f0-9]{40}$/.test(sourceVersion))throw Error('Versioned source required.');
 const report=scanInceptionSource(sources,sourceVersion);
 const finding=report.findings.find(f=>f.id===findingId&&f.findingType!=='preserve_existing');
 if(!finding)throw Error('Finding is no longer eligible.');
 const patched=applyEdits(sources,proposal.edits);
 // Conservative source checks, not a substitute for semantic review or browser tests.
 const placeholders=/\b(?:stub|TODO|FIXME|placeholder (?:implementation|code|only)|implement (?:this|here|later)|fallback to native confirm)\b/gi;
 if(proposal.edits.some(e=>(e.after.match(placeholders)||[]).length>(e.before.match(placeholders)||[]).length))return {status:'blocked',summary:'Candidate rejected: the proposed edits introduce unfinished placeholders. No candidate was signed.'};
 if(findingId==='ia-native-confirm'&&/\bwindow\s*\.\s*confirm\s*\(/.test(patched['src/components/InceptionApex.jsx']))return {status:'blocked',summary:'Candidate rejected: the native confirmation call remains. The requested in-app replacement is incomplete. No candidate was signed.'};
 return {kind:'eig_ia_builder_candidate',schemaVersion:2,status:'unverified_candidate',
  sourceVersion,sourceFingerprint:report.sourceFingerprint,findingId,instruction,summary:proposal.summary,
  sourceHashes:Object.fromEntries(FILE_PATHS.map(p=>[p,sha(sources[p])])),edits:proposal.edits,
  createdAt:now,expiresAt:now+30*60*1000,
  safety:{testsRun:false,autoMerged:false,autoDeployed:false}};
}
function validReview(review){
 return keys(review,['verdict','summary','requirements','unresolved'])&&['pass','reject'].includes(review.verdict)&&typeof review.summary==='string'&&review.summary.trim().length>=5&&review.summary.length<=1000&&Array.isArray(review.requirements)&&review.requirements.length>=1&&review.requirements.length<=12&&review.requirements.every(r=>keys(r,['requirement','evidence','met'])&&typeof r.requirement==='string'&&r.requirement.trim().length>0&&r.requirement.length<=500&&typeof r.evidence==='string'&&r.evidence.trim().length>0&&r.evidence.length<=1000&&typeof r.met==='boolean')&&Array.isArray(review.unresolved)&&review.unresolved.length<=12&&review.unresolved.every(x=>typeof x==='string'&&x.trim().length>0&&x.length<=500);
}
function reviewPassed(review){return validReview(review)&&review.verdict==='pass'&&review.requirements.every(r=>r.met)&&!review.unresolved.length;}
function attachSourceReview(candidate,review){
 if(!validReview(review))throw Error('Invalid source review.');
 if(!reviewPassed(review))return {status:'blocked',summary:'Source review rejected the candidate: '+review.summary.slice(0,950)};
 return {...candidate,sourceReview:review};
}
function sealCandidate(candidate,key){
 if(candidate.schemaVersion!==2||!reviewPassed(candidate.sourceReview))throw Error('A passing source review is required before signing.');
 if(typeof key!=='string'||Buffer.byteLength(key)<32)throw Error('Signing key unavailable.');
 const payload=JSON.stringify(candidate);
 if(Buffer.byteLength(payload)>55000)throw Error('Candidate exceeds handoff limit.');
 const bundle={payload,signature:createHmac('sha256',key).update(payload).digest('hex')};
 if(Buffer.byteLength(JSON.stringify(bundle))>60000)throw Error('Signed handoff exceeds workflow input limit.');
 return bundle;
}
function openCandidate(bundle,key,now=Date.now()){
 if(!keys(bundle,['payload','signature'])||typeof bundle.payload!=='string'||Buffer.byteLength(bundle.payload)>55000||!/^[a-f0-9]{64}$/.test(bundle.signature||'')||typeof key!=='string'||Buffer.byteLength(key)<32)throw Error('Invalid signed candidate.');
 const expected=createHmac('sha256',key).update(bundle.payload).digest();
 if(!timingSafeEqual(expected,Buffer.from(bundle.signature,'hex')))throw Error('Candidate signature does not match.');
 const c=JSON.parse(bundle.payload);
 if(c.kind!=='eig_ia_builder_candidate'||c.schemaVersion!==2||!reviewPassed(c.sourceReview)||c.status!=='unverified_candidate'||!Number.isSafeInteger(c.createdAt)||!Number.isSafeInteger(c.expiresAt)||c.createdAt>now+30000||c.expiresAt<=now||c.expiresAt-c.createdAt!==1800000||!/^[a-f0-9]{40}$/.test(c.sourceVersion)||!keys(c.sourceHashes,FILE_PATHS)||FILE_PATHS.some(p=>!/^[a-f0-9]{64}$/.test(c.sourceHashes[p])))throw Error('Candidate is expired or invalid.');
 return c;
}
function verifySources(candidate,sources,version){
 if(version!==candidate.sourceVersion||FILE_PATHS.some(p=>sha(sources[p])!==candidate.sourceHashes[p]))throw Error('Source changed. Rescan and review a new blueprint.');
 const report=scanInceptionSource(sources,version);
 if(report.sourceFingerprint!==candidate.sourceFingerprint||!report.findings.some(f=>f.id===candidate.findingId&&f.findingType!=='preserve_existing'))throw Error('Source finding changed.');
 return applyEdits(sources,candidate.edits);
}
module.exports={WRITABLE,sha,applyEdits,candidateFor,attachSourceReview,sealCandidate,openCandidate,verifySources};
