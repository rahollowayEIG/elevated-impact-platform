'use strict';
// Owner-only summary of Hangar adoption. No customer records, OAuth tokens,
// third-party secrets, credential exchange, writes or auto-connection attempts.
const {response}=require('./eig-build-lab-preview-access.cjs');
const SOCIAL_PROVIDER_COUNT=6;
const LIMITS=Object.freeze({organizations:100,related:500});
const trim=(s,n=160)=>typeof s==='string'?s.trim().slice(0,n):'';
const validDate=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const percent=(numerator,denominator)=>denominator?Math.round(numerator*100/denominator):null;
const knownStatus=new Set(['connected','setup_required','disconnected','pending','inactive','error','disabled']);
function summarizeHangarConnections({organizations=[],channels=[],driveMappings=[],campaigns=[]},now=new Date().toISOString()){
 if(!Array.isArray(organizations)||organizations.length>LIMITS.organizations||
    !Array.isArray(channels)||channels.length>LIMITS.related||
    !Array.isArray(driveMappings)||driveMappings.length>LIMITS.related||
    !Array.isArray(campaigns)||campaigns.length>LIMITS.related)throw Error('Incomplete Hangar connection inventory.');
 const ids=new Set();
 const hangars=organizations.map(org=>{
  if(!org||typeof org.id!=='string'||!org.id||ids.has(org.id))throw Error('Invalid organization inventory.');
  ids.add(org.id);
  const related=channels.filter(x=>x?.organization_id===org.id);
  const normalized=related.map(x=>{
   const state=knownStatus.has(x.connection_status)?x.connection_status:'unknown';
   const verifiedAt=validDate(x.last_verified_at)?x.last_verified_at:null;
   return {
    channel:trim(x.channel,40)||'other',provider:trim(x.provider,50)||'unspecified',
    status:state,compliance:trim(x.compliance_status,60)||'not_recorded',
    verifiedAt,verified:state==='connected'&&Boolean(verifiedAt)
   };
  });
  const connected=normalized.filter(x=>x.verified).length;
  const unverified=normalized.filter(x=>!x.verified).length;
  const mapped=driveMappings.filter(x=>x?.organization_id===org.id).length;
  const savedCampaigns=campaigns.filter(x=>x?.organization_id===org.id).length;
  return {
   id:org.id,name:trim(org.name)||'Unnamed organization',
   slug:trim(org.slug,150),kind:org.organization_type==='provider'?'hq':'hangar',
   isTest:org.is_test===true,status:trim(org.status,40)||'unknown',
   channels:normalized,
   channelCoverage:percent(connected,normalized.length),
   verifiedChannels:connected,configuredChannels:normalized.length,
   channelsNeedingAttention:unverified,
   driveFolderMappings:mapped,savedCampaigns,
   socialPublishing:{implemented:false,connectedCount:null,possiblePlatforms:SOCIAL_PROVIDER_COUNT,
    message:'External social publishing sign-in is not implemented yet. Do not count this as a Hangar setup failure.'},
   adoptionPercent:null,
   adoptionReason:'A Hangar-specific approved connector checklist and verified evidence are required before scoring overall adoption.',
   nextAction:normalized.some(x=>x.status==='setup_required')?
    'Finish setup for the listed communication channel, then verify an authorized test delivery.':
    normalized.some(x=>x.status==='connected'&&!x.verifiedAt)?
    'Reverify the configured communication channel and record the verification result.':
    !normalized.length?
    'Review available connections and approve which this Hangar should use.':
    'Review approved integrations and check which available features this Hangar would benefit from.'
  };
 });
 const real=hangars.filter(h=>h.kind==='hangar'&&!h.isTest);
 const demos=hangars.filter(h=>h.kind==='hangar'&&h.isTest);
 return {kind:'eig_build_lab_hangar_connections',schemaVersion:1,
  generatedAt:validDate(now)?now:new Date().toISOString(),
  provenance:'server_readonly_organization_connection_status',
  readOnly:true,
  limitations:[
   'Only stored Squawk channel status and verification timestamp are measured.',
   'Google Drive folder mappings are not proof of OAuth connection health.',
   'Saved social campaigns are activity records, not confirmed published content.',
   'External social publishing connections and overall Hangar adoption are not measured yet.'
  ],
  summary:{realHangars:real.length,testHangars:demos.length,
   hqOrganizations:hangars.filter(h=>h.kind==='hq').length,
   verifiedChannels:real.reduce((total,h)=>total+h.verifiedChannels,0),
   configuredChannels:real.reduce((total,h)=>total+h.configuredChannels,0),
   channelCoverage:percent(real.reduce((n,h)=>n+h.verifiedChannels,0),
    real.reduce((n,h)=>n+h.configuredChannels,0))},
  hangars};
}
function createBuildLabHangarConnectionsHandler({env,authorize,verifyUser,membershipsForUser,
 verifyLiveSession,loadSnapshot,now=Date.now}={}){
 return async(req,res)=>{
  res.setHeader?.('Cache-Control','no-store, private');
  const grant=await authorize(req,{env,verifyUser,membershipsForUser,verifyLiveSession,now});
  if(!grant?.allowed)return response(res,grant?.status||403,{ok:false});
  if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||
     Object.keys(req.body).length!==1||req.body.target!=='hangar_connections')
   return response(res,400,{ok:false,message:'Unsupported read-only connection request.'});
  if(typeof loadSnapshot!=='function')return response(res,503,{ok:false});
  try{
   const snapshot=await loadSnapshot();
   const report=summarizeHangarConnections(snapshot,new Date(now()).toISOString());
   return response(res,200,{ok:true,report});
  }catch(e){
   console.error('Build Lab Hangar connection summary unavailable:',e?.name||'Error');
   return response(res,503,{ok:false,message:'Connection status unavailable. No data was changed.'});
  }
 };
}
module.exports={LIMITS,summarizeHangarConnections,createBuildLabHangarConnectionsHandler};
