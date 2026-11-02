// Browser presentation of sanitized, owner-authorized read-only Hangar statuses.
// The server checks the owner identity, live session and EIG membership on
// every request; a browser button never grants tenant access.
const ENDPOINT='/api/eig-build-lab-hangar-connections';
export function validateHangarConnectionReport(report){
 if(!report||report.kind!=='eig_build_lab_hangar_connections'||
  report.schemaVersion!==1||report.readOnly!==true||
  !Array.isArray(report.hangars)||report.hangars.length>100||
  !report.summary||typeof report.summary.realHangars!=='number')
  throw Error('Hangar connection report is invalid.');
 const seen=new Set();
 for(const h of report.hangars){
  if(typeof h.id!=='string'||!h.id||seen.has(h.id)||
   typeof h.name!=='string'||h.name.length>160||
   !['hangar','hq'].includes(h.kind)||typeof h.isTest!=='boolean'||
   !Array.isArray(h.channels)||h.channels.length>500||
   typeof h.verifiedChannels!=='number'||typeof h.configuredChannels!=='number'||
   h.configuredChannels!==h.channels.length||
   typeof h.driveFolderMappings!=='number'||typeof h.savedCampaigns!=='number'||
   h.adoptionPercent!==null||h.socialPublishing?.implemented!==false)
   throw Error('Hangar connection evidence is incomplete.');
  seen.add(h.id);
 }
 return report;
}
export async function requestHangarConnections(client,http=fetch){
 if(!client?.auth?.getSession||typeof http!=='function')
  throw Error('Sign in with your authorized EIG owner account.');
 const {data,error}=await client.auth.getSession();
 const token=data?.session?.access_token;
 if(error||!token||typeof token!=='string')
  throw Error('Sign in again to verify owner access.');
 const res=await http(ENDPOINT,{method:'POST',cache:'no-store',credentials:'same-origin',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({target:'hangar_connections'})});
 if(!res?.ok)throw Error('Hangar connection inventory is unavailable (HTTP '+(res?.status||'unknown')+').');
 const value=await res.json();
 if(value?.ok!==true)throw Error('Hangar connection inventory was not verified.');
 return validateHangarConnectionReport(value.report);
}
