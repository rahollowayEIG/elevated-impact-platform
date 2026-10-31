// Owner-only LIVE Build Lab planning records. NOT an agent, deployment,
// payment, registration or customer-data API.
// OFF by default and separate from read-only scanning permission.
// The caller never supplies an owner ID, table name, SQL or storage project.
const {authorizeBuildLabLiveReadOnlyOwner}=require('./eig-build-lab-live-readonly-access.cjs');
const {response}=require('./eig-build-lab-preview-access.cjs');

const KINDS=Object.freeze({scan_history:1800000,work_buckets:2400000,manager_blueprint:600000});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ACTIONS=new Set(['read','save']);
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

async function validateBuildLabDocument(kind,payload,owner){
 if(!Object.hasOwn(KINDS,kind)||!isRecord(payload)||!UUID.test(owner||''))
  throw Error('Invalid Build Lab document.');
 const bytes=Buffer.byteLength(JSON.stringify(payload),'utf8');
 if(bytes>KINDS[kind])throw Error('Build Lab document size limit exceeded.');
 if(kind==='scan_history'){
  const {readScanHistory,historyKey}=await import('../src/lib/buildLabScanHistory.mjs');
  const json=JSON.stringify(payload);
  const rows=readScanHistory({getItem:key=>key===historyKey(owner)?json:null},owner);
  if(rows.length!==payload.entries.length)throw Error('Invalid scan history.');
 }else if(kind==='work_buckets'){
  const {validateWorkLedger}=await import('../src/lib/buildLabWorkBuckets.mjs');
  validateWorkLedger(payload);
 }else{
  const {validateManagerBlueprint}=await import('../src/lib/buildLabManagerBlueprint.mjs');
  validateManagerBlueprint(payload);
 }
 return payload;
}

function createBuildLabDurableRecordsHandler({
 env,verifyUser,membershipsForUser,verifyLiveSession,store,now=Date.now,
 authorizeOwner=authorizeBuildLabLiveReadOnlyOwner,
 recordsFlag='EIG_BUILD_LAB_LIVE_RECORDS_ENABLED'
}={}){
 return async (req,res)=>{
  // Record writes are a distinct capability, never inferred from read-only grant.
  // Still require the entire production owner/session gate before any read/write.
  const grant=await authorizeOwner(req,{
   env,verifyUser,membershipsForUser,verifyLiveSession,now
  });
  if(!grant.allowed)return response(res,grant.status,{ok:false});
  if(typeof env!=='function'||env(recordsFlag)!=='true')
   return response(res,403,{ok:false});
  if(!store||typeof store.read!=='function'||typeof store.save!=='function')
   return response(res,503,{ok:false});

  const body=req?.body;
  if(!isRecord(body)||!VALID_ACTIONS.has(body.action)||!Object.hasOwn(KINDS,body.kind)||
     Object.keys(body).some(k=>!['action','kind','expectedRevision','payload'].includes(k)))
   return response(res,400,{ok:false,message:'Unsupported Build Lab record request.'});
  const owner=(env('EIG_BUILD_LAB_LIVE_OWNER_USER_ID')||'').trim().toLowerCase();
  if(!UUID.test(owner))return response(res,403,{ok:false});

  try{
   if(body.action==='read'){
    if(Object.hasOwn(body,'expectedRevision')||Object.hasOwn(body,'payload'))
     return response(res,400,{ok:false});
    const record=await store.read(owner,body.kind);
    if(!record)return response(res,200,{ok:true,found:false,revision:0});
    if(!Number.isSafeInteger(record.revision)||record.revision<1)
     throw Error('Stored revision is invalid.');
    await validateBuildLabDocument(body.kind,record.payload,owner);
    return response(res,200,{ok:true,found:true,revision:record.revision,
     updatedAt:record.updatedAt,payload:record.payload});
   }
   if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||
      body.expectedRevision>2147483646||!Object.hasOwn(body,'payload'))
    return response(res,400,{ok:false,message:'Expected current revision and document are required.'});
   try{await validateBuildLabDocument(body.kind,body.payload,owner);}
   catch{return response(res,400,{ok:false,message:'Build Lab document validation failed.'});}
   const result=await store.save(owner,body.kind,body.expectedRevision,body.payload);
   if(!result||result.saved!==true){
    return response(res,409,{ok:false,conflict:true,currentRevision:
     Number.isSafeInteger(result?.revision)?result.revision:null,
     message:'A newer saved revision exists. Refresh and compare before overwriting.'});
   }
   return response(res,200,{ok:true,saved:true,kind:body.kind,
    revision:result.revision,updatedAt:result.updatedAt});
  }catch{
   return response(res,503,{ok:false,message:'Build Lab records are unavailable. Existing local evidence remains unchanged.'});
  }
 };
}
module.exports={KINDS,validateBuildLabDocument,createBuildLabDurableRecordsHandler};
