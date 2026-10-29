// Narrow Live Build Lab browser client. Presentation is NOT an authorization boundary.
// Every request is verified independently by its own production-only Vercel handler.
import {validateMasterScanReport} from './eigMasterScanClient.mjs';
import {validateInceptionSourceReport} from './eigBuildLabScanClient.mjs';
const ENDPOINTS=Object.freeze({
 access:'/api/eig-build-lab-live-access',
 master:'/api/eig-build-lab-live-master-scan',
 inspector:'/api/eig-build-lab-live-scan'
});
const VALID_SCANS=new Set(['master','inspector']);
async function livePost(client,path,body,http=fetch){
 if(!client?.auth?.getSession||typeof http!=='function')throw Error('Sign in to an authorized EIG owner account.');
 const {data,error}=await client.auth.getSession();
 const token=data?.session?.access_token;
 if(error||typeof token!=='string'||!token)throw Error('Sign in again to verify owner access.');
 const res=await http(path,{method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(body),cache:'no-store',credentials:'same-origin'
 });
 if(!res?.ok)throw Error('Build Lab scanner request failed (HTTP '+(res?.status||'unknown')+'). Check the preview server logs for the reason.');
 return res.json();
}
export async function requestLiveBuildLabAccess(client,http=fetch){
 try{
  const grant=await livePost(client,ENDPOINTS.access,{},http);
  return grant?.allowed===true&&grant?.access==='build_lab_live_readonly'&&grant?.scope==='read_only';
 }catch{return false;}
}
export async function requestLiveBuildLabScan(client,kind,http=fetch){
 if(!VALID_SCANS.has(kind))throw Error('Unsupported production read-only scan.');
 const body=kind==='master'?{target:'elevationpilot',environmentMode:'live'}:{target:'inception_apex'};
 const result=await livePost(client,ENDPOINTS[kind],body,http);
 if(result?.ok!==true||!result.report)throw Error('The scanner did not return a verifiable report.');
 return kind==='master'
  ?validateMasterScanReport(result.report)
  :validateInceptionSourceReport(result.report);
}
