// Live unauthenticated read-only negative checks against an exact approved
// Build Lab PREVIEW deployment. Never sends owner tokens or performs writes.
// A 401/403 from deployment protection alone is not an application pass.
import assert from 'node:assert/strict';

const base='https://elevated-impact-platform-d7t1csm3h-rahollowayeigs-projects.vercel.app';
const endpoint=base+'/api/eig-build-lab-preview-records';
const cases=[
 {name:'No bearer token',expected:401,method:'POST',origin:base},
 {name:'Invalid bearer token',expected:403,method:'POST',origin:base,authorization:'Bearer clearly-invalid-preview-negative-test'},
 {name:'Wrong origin',expected:403,method:'POST',origin:'https://not-the-eig-preview.invalid'},
 {name:'Unsupported GET method',expected:405,method:'GET',origin:base}
];

for(const entry of cases){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 let response;
 try{
  response=await fetch(endpoint,{
   method:entry.method,
   headers:{
    Origin:entry.origin,
    ...(entry.method==='POST'?{'Content-Type':'application/json'}:{}),
    ...(entry.authorization?{Authorization:entry.authorization}:{})
   },
   ...(entry.method==='POST'?{body:JSON.stringify({action:'read',kind:'scan_history'})}:{}),
   redirect:'manual',
   signal:controller.signal
  });
 }finally{clearTimeout(timeout);}
 const contentType=response.headers.get('content-type')||'';
 const content=await response.text();
 console.log(entry.name+': HTTP '+response.status+', application JSON '+contentType.includes('application/json'));
 let outer;
 try{outer=JSON.parse(content);}catch{outer=null;}
 if(outer?.protection?.vercel_auth_enabled===true&&
    outer?.error?.message==='Protected deployment'&&response.status===401){
  assert.equal(entry.name,'No bearer token','Unexpected Vercel protection change during probe');
  console.log('VERCEL PERIMETER PASS: Vercel Authentication refused the anonymous request before Build Lab.');
  console.log('APPLICATION OWNER GATE INCONCLUSIVE: run signed vc curl from an authorized Vercel context.');
  break;
 }
 assert.equal(response.status,entry.expected,entry.name+' must fail with application-level rejection');
 assert.match(contentType,/application\/json/i,entry.name+' did not reach the protected Build Lab API');
 let json;
 try{json=JSON.parse(content);}catch{assert.fail(entry.name+' did not return a JSON API denial');}
 assert.deepEqual(json,{ok:false},entry.name+' should receive no records or internal details');
 assert.match(response.headers.get('cache-control')||'',/no-store/);
}
console.log('Live preview perimeter probe completed. No save/write request was issued.');
