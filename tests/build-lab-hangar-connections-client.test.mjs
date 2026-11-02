import test from 'node:test';
import assert from 'node:assert/strict';
import {requestHangarConnections,validateHangarConnectionReport} from '../src/lib/buildLabHangarConnectionsClient.mjs';
const ownerId='11111111-1111-4111-8111-111111111111';
const example={
 kind:'eig_build_lab_hangar_connections',schemaVersion:1,readOnly:true,
 summary:{realHangars:1,testHangars:0,hqOrganizations:0,verifiedChannels:1,configuredChannels:2,channelCoverage:50},
 hangars:[{
  id:ownerId,name:'Demo Business',kind:'hangar',isTest:false,
  channels:[{channel:'email',provider:'resend',status:'connected',verified:true},
   {channel:'sms',provider:'twilio',status:'setup_required',verified:false}],
  configuredChannels:2,verifiedChannels:1,driveFolderMappings:0,savedCampaigns:0,
  adoptionPercent:null,socialPublishing:{implemented:false,connectedCount:null}
 }]
};
test('browser accepts only sanitized owner Hangar report shape',()=>{
 assert.equal(validateHangarConnectionReport(example).hangars.length,1);
 assert.throws(()=>validateHangarConnectionReport({...example,readOnly:false}));
 assert.throws(()=>validateHangarConnectionReport({...example,hangars:[{...example.hangars[0],adoptionPercent:100}]}));
 assert.throws(()=>validateHangarConnectionReport({...example,hangars:[{...example.hangars[0],channels:[{}]}]}));
 assert.throws(()=>validateHangarConnectionReport({...example,hangars:[{...example.hangars[0],socialPublishing:{implemented:true}}]}));
});
test('client uses session bearer, POST to owner endpoint, no cache and fixed read target',async()=>{
 let called=0;
 const client={auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})}};
 const result=await requestHangarConnections(client,async(url,opts)=>{
  called++;
  assert.equal(url,'/api/eig-build-lab-hangar-connections');
  assert.equal(opts.method,'POST');
  assert.equal(opts.cache,'no-store');
  assert.equal(opts.credentials,'same-origin');
  assert.equal(opts.headers.Authorization,'Bearer synthetic');
  assert.deepEqual(JSON.parse(opts.body),{target:'hangar_connections'});
  return {ok:true,json:async()=>({ok:true,report:example})};
 });
 assert.equal(result.summary.verifiedChannels,1);
 assert.equal(called,1);
});
test('client fails closed before fetch without an active owner session',async()=>{
 let calls=0;
 await assert.rejects(()=>requestHangarConnections({auth:{getSession:async()=>({data:{session:null}})}},async()=>{calls++;}));
 assert.equal(calls,0);
});
test('client rejects denied or malformed server report without trusting status text',async()=>{
 const client={auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})}};
 await assert.rejects(()=>requestHangarConnections(client,async()=>({ok:false,status:403})),/403/);
 await assert.rejects(()=>requestHangarConnections(client,async()=>({ok:true,json:async()=>({ok:true,report:{kind:'other'}})})),/invalid/);
});
