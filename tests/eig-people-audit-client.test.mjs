import test from "node:test";
import assert from "node:assert/strict";
import {validatePeopleIntegrityAudit,requestPeopleIntegrityAudit} from "../src/lib/eigPeopleAuditClient.mjs";
const sample={
 kind:"eig_people_integrity_audit",schemaVersion:1,
 checkedAt:"2026-10-26T15:00:00Z",environment:"live",scope:"eie_golf_registrations",
 assessment:"review_required",sourceCoverage:"golf_registration_only",
 readOnly:true,rawPeopleReturned:false,automaticRepair:false,
 coverage:{registrationRows:1,passengerRows:0,allAuthorizedRowsFetched:true,allPlatformApplicationsChecked:false},
 totals:{registrations:1,activeNamed:1,inactive:0,tba:0,nameless:0,
 unclaimedWithoutPassenger:1,accountWithoutPassenger:0,linkedPassenger:0,
 brokenPassengerReference:0,accountPassengerMismatch:0,claimedWithoutAccount:0,
 mergedPassengerReference:0},
 flaggedChecks:1,events:[{eventKey:"golf",registrations:1,activeNamed:1,unlinked:1,linked:0}],eventsTruncated:false,
 limitations:["Read only data","Unclaimed identity needs review"]
};
test("validates runtime evidence without identity data",()=>{
 assert.equal(validatePeopleIntegrityAudit(sample),sample);
 assert.throws(()=>validatePeopleIntegrityAudit({...sample,coverage:{...sample.coverage,allAuthorizedRowsFetched:false}}));
 assert.throws(()=>validatePeopleIntegrityAudit({...sample,totals:{...sample.totals,registrations:0}}));
});
test("uses signed-in token and rejects incomplete responses",async()=>{
 const supabase={auth:{getSession:async()=>({data:{session:{access_token:"test-token"}}})}};
 const audit=await requestPeopleIntegrityAudit(supabase,async(url,options)=>{
  assert.equal(url,"/api/eig-build-lab-people-audit");
  assert.equal(options.headers.Authorization,"Bearer test-token");
  assert.deepEqual(JSON.parse(options.body),{scope:"eie_golf_registrations"});
  return {ok:true,json:async()=>({audit:sample})};
 });
 assert.equal(audit.totals.activeNamed,1);
 await assert.rejects(()=>requestPeopleIntegrityAudit(supabase,async()=>({ok:false,status:503})),/could not be completed/);
});
