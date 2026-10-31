// Explicit owner-initiated cloud backup transport for Build Lab planning records.
// Never runs automatically, never assumes a client-side success grants authority.
// The production server separately verifies one owner and active admin session.
const KINDS=new Set(['scan_history','work_buckets','manager_blueprint']);
// The preview UI can only call the separately authorized TEST records endpoint.
// Node unit tests have no import.meta.env; production stays on its existing route.
const PREVIEW_TEST_UI=import.meta.env?.VITE_EIG_BUILD_LAB_PREVIEW_CLOUD_RECORDS_UI_ENABLED==='true';
const ENDPOINT=PREVIEW_TEST_UI?'/api/eig-build-lab-preview-records':'/api/eig-build-lab-live-records';

async function postRecord(client,request,http=fetch){
 if(!KINDS.has(request?.kind)||typeof http!=='function'||!client?.auth?.getSession)
  throw Error('A verified Build Lab owner account is required.');
 const {data,error}=await client.auth.getSession();
 const token=data?.session?.access_token;
 if(error||typeof token!=='string'||!token)throw Error('Sign in again before accessing cloud records.');
 const res=await http(ENDPOINT,{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(request),cache:'no-store',credentials:'same-origin'
 });
 if(res.status===401||res.status===403)throw Error('Cloud records are unavailable for this account or environment.');
 if(res.status===409){
  const conflict=await res.json().catch(()=>({}));
  const err=new Error('A newer cloud revision exists. Review cloud and browser records before replacing either.');
  err.code='build_lab_revision_conflict';
  err.currentRevision=Number.isSafeInteger(conflict.currentRevision)?conflict.currentRevision:null;
  throw err;
 }
 if(!res.ok)throw Error('Cloud records could not be saved or retrieved. Keep your local JSON backup.');
 const result=await res.json();
 if(result?.ok!==true)throw Error('Cloud records returned an invalid response.');
 return result;
}

export async function readBuildLabCloudRecord(client,kind,http=fetch){
 if(!KINDS.has(kind))throw Error('Unsupported Build Lab cloud record type.');
 const res=await postRecord(client,{action:'read',kind},http);
 if(!Number.isSafeInteger(res.revision)||res.revision<0||typeof res.found!=='boolean'||
   (res.found&&(!res.payload||typeof res.payload!=='object'||res.revision<1)))
  throw Error('Cloud record response is not valid.');
 return {found:res.found,revision:res.revision,payload:res.found?res.payload:null,
  updatedAt:res.found?res.updatedAt:null};
}

export async function saveBuildLabCloudRecord(client,kind,expectedRevision,payload,http=fetch){
 if(!KINDS.has(kind)||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>2147483646||
    !payload||typeof payload!=='object'||Array.isArray(payload))
  throw Error('Invalid cloud record revision or payload.');
 const res=await postRecord(client,{action:'save',kind,expectedRevision,payload},http);
 if(res.saved!==true||res.kind!==kind||!Number.isSafeInteger(res.revision)||
    res.revision!==expectedRevision+1)
  throw Error('Cloud save could not be verified. Keep the local backup.');
 return {revision:res.revision,updatedAt:res.updatedAt};
}
