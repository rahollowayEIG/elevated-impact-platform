import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {requestLiveBuildLabAccess,requestLiveBuildLabScan} from '../src/lib/eigBuildLabLiveClient.mjs';
const require=createRequire(import.meta.url);
const {MODULES}=require('../server/eig-master-source-scan.cjs');
const {buildEnvironmentAudit}=require('../server/eig-master-environment-compare.cjs');
const client={auth:{getSession:async()=>({data:{session:{access_token:'synthetic-token'}},error:null})}};
const master={
 schemaVersion:1,kind:'eig_build_lab_master_scan',target:'elevationpilot',
 scope:'full',selectedModule:null,
 safety:{readOnly:true,liveChanges:false,customerRowsRead:false,autoApproved:false,autoDeployed:false},
 sourceFingerprint:'a'.repeat(64),
 files:[{path:'src/PlatformApp.jsx',lines:200,kind:'source'}],
 modules:[{id:'event-builder',title:'Event Builder',status:'review_needed',
 nextCheck:'Verify configuration using synthetic tests.',
 evidence:[{kind:'ui',path:'src/PlatformApp.jsx',line:4,excerpt:'<EieEventSetupSteps'}],
 tables:[],priority:'high'}],
 database:{capturedOn:'2026-10-20',freshLiveQuery:false,productionTables:71,sandboxTables:71,
 missingInSandbox:[],missingInProduction:[],policyDifferences:[]},
 environmentAudit:buildEnvironmentAudit({mode:'live',moduleId:null,modules:MODULES}),
 limitations:['Static source reference, not runtime verification.']
};
const ia={schemaVersion:1,kind:'eig_build_lab_code_scan',target:'inception_apex',
 targetLabel:'InceptionApex',sourceVersion:'a'.repeat(40),sourceFingerprint:'b'.repeat(64),
 inspectedAt:'2026-10-28T14:00:00Z',scannerVersion:'inception-code-v1',
 files:[{path:'src/components/InceptionApex.jsx',lines:900}],
 findings:[{id:'ia-focus',category:'Interface',priority:'medium',title:'Verify focus',
 observation:'Focus markers found',recommendation:'Test actual keyboard focus.',
 provenance:'observed_in_first_party_source',review:'pending',
 evidence:[{path:'src/components/InceptionApex.jsx',line:30,excerpt:'tabIndex'}]}],
 safety:{readOnly:true,liveChanges:false,autoApproved:false}
};
function mock(result,pathCheck,bodyCheck){
 return async (url,options)=>{
  assert.equal(url,pathCheck);assert.equal(options.method,'POST');
  assert.equal(options.cache,'no-store');assert.equal(options.credentials,'same-origin');
  assert.equal(options.headers.Authorization,'Bearer synthetic-token');
  assert.deepEqual(JSON.parse(options.body),bodyCheck);
  return {ok:true,json:async()=>result};
 };
}
test('owner console access requires exact server grant',async()=>{
 const ok={allowed:true,scope:'read_only',access:'build_lab_live_readonly'};
 assert.equal(await requestLiveBuildLabAccess(client,mock(ok,'/api/eig-build-lab-live-access',{})),true);
 for(const grant of [{...ok,scope:'write'},{...ok,access:'build_lab_owner_only'},{allowed:true},{allowed:false}]){
  assert.equal(await requestLiveBuildLabAccess(client,mock(grant,'/api/eig-build-lab-live-access',{})),false);
 }
 assert.equal(await requestLiveBuildLabAccess(client,async()=>({ok:false,status:403})),false);
 assert.equal(await requestLiveBuildLabAccess(null),false);
});
test('Live Master Scanner calls only fixed read-only endpoint and validates report',async()=>{
 const r=await requestLiveBuildLabScan(client,'master',mock(
  {ok:true,report:master},'/api/eig-build-lab-live-master-scan',
  {target:'elevationpilot',environmentMode:'live'}));
 assert.equal(r.environmentAudit.selected,'live');
 assert.equal(r.safety.liveChanges,false);
});
test('Live IA Inspector calls fixed source endpoint and validates report',async()=>{
 const r=await requestLiveBuildLabScan(client,'inspector',mock(
  {ok:true,report:ia},'/api/eig-build-lab-live-scan',{target:'inception_apex'}));
 assert.equal(r.findings.length,1);
});
test('server rejection, forged evidence and builder requests cannot succeed',async()=>{
 await assert.rejects(()=>requestLiveBuildLabScan(client,'builder',async()=>{throw Error('must not call')}),/Unsupported/);
 await assert.rejects(()=>requestLiveBuildLabScan(client,'master',async()=>({ok:false,status:403})),/owner gate/);
 await assert.rejects(()=>requestLiveBuildLabScan(client,'inspector',async()=>({ok:true,json:async()=>({ok:true,report:{...ia,target:'payments'}})})),/report|unsupported/i);
 await assert.rejects(()=>requestLiveBuildLabScan(null,'master'),/Sign in/);
});
test('production owner workspace excludes preview-only development capabilities and is gated in command center',()=>{
 const path=new URL('../src/components/BuildLabLiveOwnerWorkspace.jsx',import.meta.url);
 const ui=fs.readFileSync(path,'utf8');
 assert.doesNotMatch(ui,/from ['"].*(BuildLabBuilder|BuildLabManager|EigBuildLab|EpInvoicePilot|BuildLabAiConnection)/);
 assert.match(ui,/requestLiveBuildLabScan/);
 assert.match(ui,/RECORDS_UI_ENABLED/);
 const app=fs.readFileSync(new URL('../src/PlatformApp.jsx',import.meta.url),'utf8');
 assert.match(app,/VITE_EIG_BUILD_LAB_LIVE_OWNER_UI_ENABLED/);
 assert.match(app,/requestLiveBuildLabAccess\(supabase\)/);
 assert.match(app,/adminView === 'build_lab_live' && liveBuildLabAllowed/);
 assert.match(app,/adminView === 'build_lab' && buildLabAllowed/);
 assert.match(app,/const EIG_BUILD_LAB_PREVIEW_ENABLED/);
});
