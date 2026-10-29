import test from "node:test";
import assert from "node:assert/strict";
import {INQUIRY_STATES,normalizedInquiryEmail,isVerifiedInquiryAccount,
 validateInquirySubmission,authorizedInquiryPayload,publicInquiryView,
 requesterVisibleChanges,inquiryNotificationDecision,inquiryAccountStep} from "../src/lib/eventInquiryLifecycle.mjs";
const UUID="11111111-1111-4111-8111-111111111111";
const ORG="22222222-2222-4222-8222-222222222222";
const user={id:UUID,email:"eventhost@example.test",email_confirmed_at:"2026-10-20T12:00:00Z"};
const form={contact_full_name:"Sample Event Host",contact_email:"EventHost@Example.test",
 preferred_date:"2027-05-01",group_name:"Demo Charity Scramble",estimated_participants:"72",
 event_type:"Charity / Fundraiser",food_needed:"Yes",special_requests:"Practice event only"};
test("request entry waits for real account ownership after submit is clicked",()=>{
 assert.equal(inquiryAccountStep({attemptedSubmit:false}),"editing");
 assert.equal(inquiryAccountStep({attemptedSubmit:true,contactEmail:form.contact_email}),"authenticate");
 assert.equal(inquiryAccountStep({attemptedSubmit:true,sessionUser:user,contactEmail:form.contact_email}),"ready_to_finalize");
 assert.equal(inquiryAccountStep({attemptedSubmit:true,sessionUser:user,contactEmail:"other@example.test"}),"identity_mismatch");
 assert.equal(inquiryAccountStep({attemptedSubmit:true,sessionUser:{...user,email_confirmed_at:null},contactEmail:form.contact_email}),"identity_mismatch");
});
test("only a verified matching account can submit an account-owned event inquiry",()=>{
 assert.equal(normalizedInquiryEmail("  A@EXAMPLE.COM "),"a@example.com");
 assert.equal(isVerifiedInquiryAccount(user,form.contact_email),true);
 assert.equal(isVerifiedInquiryAccount({...user,email_confirmed_at:null},form.contact_email),false);
 assert.equal(isVerifiedInquiryAccount({...user,id:"not-a-uuid"},form.contact_email),false);
 assert.equal(isVerifiedInquiryAccount(user,"other@example.test"),false);
 assert.throws(()=>authorizedInquiryPayload(form,{...user,email:"another@example.test"},ORG),/verify the email/);
 assert.throws(()=>authorizedInquiryPayload(form,user,"bad-org"),/active Hangar/);
});
test("approved inquiry payload excludes private staff and financial fields",()=>{
 const p=authorizedInquiryPayload({...form,submitted_by_user_id:"evil",status:"confirmed",
  venue_internal_notes:"do not share",stripe_payment_intent_id:"stripe_secret",
  requester_role:"organization_admin"},user,ORG);
 assert.equal(p.submitted_by_user_id,UUID);
 assert.equal(p.organization_id,ORG);
 assert.equal(p.status,"submitted");
 assert.equal(p.contact_email,"eventhost@example.test");
 assert.equal(p.estimated_participants,72);
 assert.equal(p.food_needed,true);
 assert.equal(p.requested_details.source,"public_inquiry_account");
 assert.equal("venue_internal_notes" in p,false);
 assert.equal("stripe_payment_intent_id" in p,false);
 assert.equal("requester_role" in p,false);
 assert.equal("date_of_birth" in p,false);
 assert.equal("gender" in p,false);
});
test("rejects malformed requests without permitting arbitrary large payloads",()=>{
 for(const bad of [{...form,contact_email:"bad"},{...form,contact_full_name:""},
  {...form,estimated_participants:-1},{...form,estimated_participants:25000},
  {...form,preferred_date:"maybe"},{...form,special_requests:"a".repeat(4001)}]){
   assert.ok(validateInquirySubmission(bad));
   assert.throws(()=>authorizedInquiryPayload(bad,user,ORG));
 }
 assert.equal(validateInquirySubmission(form),null);
});
test("status dashboard projection never leaks private venue notes or payment identifiers",()=>{
 const projected=publicInquiryView({
  id:"req-1",status:"hold",group_name:"Demo",confirmed_date:"2027-05-01",
  hold_expires_at:"2027-04-01T00:00:00Z",
  venue_internal_notes:"Keep this private",stripe_checkout_session_id:"cs_test_secret",
  contact_email:"private@example.test",requested_details:{phone:"private"}
 });
 assert.equal(projected.status_label,"Date on Hold");
 assert.equal(projected.hold_expires_at,"2027-04-01T00:00:00Z");
 assert.equal("venue_internal_notes" in projected,false);
 assert.equal("stripe_checkout_session_id" in projected,false);
 assert.equal("contact_email" in projected,false);
 assert.equal("requested_details" in projected,false);
 assert.equal(Object.keys(INQUIRY_STATES).length,10);
});
test("Hangar status, holds, payment and contract changes notify, private notes never do",()=>{
 const before={status:"submitted",venue_internal_notes:"Private",venue_response:null,
  contract_status:"not_sent",deposit_status:"not_required",hold_expires_at:null};
 const internal={...before,venue_internal_notes:"New staff instructions",
  venue_reviewed_by:"staff-user",venue_reviewed_at:"2026-10-20T22:00:00Z"};
 assert.deepEqual(requesterVisibleChanges(before,internal),[]);
 assert.equal(inquiryNotificationDecision(before,internal).notify,false);
 for(const change of [
  {status:"tentative"},{status:"needs_response"},
  {hold_expires_at:"2027-04-01T00:00:00Z"},{venue_response:"Can you confirm the date?"},
  {contract_status:"sent"},{deposit_status:"paid"},{confirmed_date:"2027-05-02"}
 ]){
  const out=inquiryNotificationDecision(before,{...before,...change});
  assert.equal(out.notify,true);
  assert.ok(out.subject.startsWith("Your event request"));
  assert.ok(!out.body.includes("Private"));
  assert.ok(out.changes.length>=1);
 }
});
