// Offline, read-only scanner modes. Inputs come from permissioned adapters and
// must carry references; this code does not crawl websites or invoke AI.
const ID=/^[a-z0-9][a-z0-9_-]{0,79}$/;
function check(condition,message){if(!condition)throw Error(message)}
function base(kind,findings){return {kind,version:1,readOnly:true,findings,requiresReview:true}}
const finding=(id,title,priority,evidence=[],detail='')=>({id,title,priority,evidence,detail,status:'review_required'});
export function scanCourseResearch(sources){
 check(Array.isArray(sources)&&sources.length>0&&sources.length<=80,'Provide research sources');
 const claims=new Map(),findings=[];
 for(const s of sources){
  check(typeof s?.url==='string'&&/^https:\/\//.test(s.url)&&Array.isArray(s.claims),'Invalid attributed source');
  for(const claim of s.claims){
   check(ID.test(claim?.key||'')&&typeof claim?.value==='string'&&claim.value.trim(),'Invalid claim');
   const list=claims.get(claim.key)||[];list.push({value:claim.value.trim(),url:s.url});claims.set(claim.key,list);
  }
 }
 for(const [key,items] of claims){
  if(new Set(items.map(x=>x.value.toLowerCase())).size>1)
   findings.push(finding('conflict-'+key,'Conflicting course claim: '+key,'high',items,'Manual reconciliation required'));
 }
 for(const key of ['course_name','hole_count','tees','pars','yardages','handicaps'])
  if(!claims.has(key))findings.push(finding('missing-'+key,'Missing course data: '+key,'high'));
 return {...base('course_research',findings),claims:Object.fromEntries(claims)};
}
export function scanPhotoAssets(assets){
 check(Array.isArray(assets)&&assets.length<=100,'Invalid photos');
 return base('photo_quality',assets.flatMap((a,i)=>{
  check(ID.test(a?.id||'')&&Number.isInteger(a.width)&&Number.isInteger(a.height)&&
   a.width>0&&a.height>0&&typeof a.source==='string','Invalid photo metadata');
  const e=[{source:a.source,locator:a.id}],f=[];
  if(a.rightsApproved!==true)f.push(finding('rights-'+a.id,'Photo license needs approval','critical',e));
  if(Math.min(a.width,a.height)<1500)f.push(finding('resolution-'+a.id,'Check print image resolution','medium',e,'Size alone does not determine final DPI'));
  if(a.hole&&(!Number.isInteger(a.hole)||a.hole<1||a.hole>18))f.push(finding('hole-'+a.id,'Invalid hole association','high',e));
  return f;
 }));
}
export function scanPrinterQuotes(quotes,quantity){
 check(Number.isInteger(quantity)&&quantity>0&&Array.isArray(quotes)&&quotes.length<=100,'Invalid print job');
 const normalized=quotes.map(q=>{
  check(ID.test(q?.id||'')&&typeof q.vendor==='string'&&Number.isInteger(q.minQty)&&q.minQty>=0&&
   [q.unitPrice,q.setup,q.shipping,q.tax].every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0),'Invalid print quote');
  return {id:q.id,vendor:q.vendor,eligible:quantity>=q.minQty,landed:quantity*q.unitPrice+q.setup+q.shipping+q.tax,
   scope:q.specification||null,verified:q.verified===true,quoteSource:q.source||null};
 });
 const scopes=new Set(normalized.map(q=>q.scope).filter(Boolean));
 const findings=[];
 if(scopes.size>1||normalized.some(q=>!q.scope))
  findings.push(finding('noncomparable-quotes','Confirm identical size, stock, print faces and finishing','high'));
 if(normalized.some(q=>!q.verified))findings.push(finding('unverified-quotes','Some prices are unverified estimates','high'));
 return {...base('print_quotes',findings),quantity,quotes:normalized.sort((a,b)=>a.landed-b.landed)};
}
export function scanScannerHealth(catalog){
 check(Array.isArray(catalog)&&catalog.length<=100,'Invalid scanner catalog');
 const findings=[],seen=new Set();
 for(const m of catalog){
  check(ID.test(m?.id||'')&&typeof m.owner==='string','Invalid scanner metadata');
  if(seen.has(m.id))findings.push(finding('duplicate-'+m.id,'Duplicate scanner module ID','high'));
  seen.add(m.id);
  if(!m.testsPassed)findings.push(finding('tests-'+m.id,'Scanner tests not confirmed passing','critical'));
  if(!m.evidenceValidation)findings.push(finding('evidence-'+m.id,'Scanner lacks evidence validation','critical'));
  if(!m.permissionBoundary)findings.push(finding('auth-'+m.id,'Scanner permission boundary not verified','critical'));
  if(m.writesWithoutApproval)findings.push(finding('unsafe-'+m.id,'Scanner may write without approval','critical'));
 }
 return base('scanner_health',findings);
}
