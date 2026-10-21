import test from "node:test";
import assert from "node:assert/strict";
import {sendVerifiedEventInquiry,loadMyEventInquiries,loadMyEventInquiry} from "../src/lib/eventInquiryPortalClient.mjs";
const id="11111111-1111-4111-8111-111111111111";
const org="22222222-2222-4222-8222-222222222222";
const req="33333333-3333-4333-8333-333333333333";
const user={id,email:"organizer@example.test",email_confirmed_at:"2026-10-20T12:00:00Z"};
const form={contact_full_name:"Sample Organizer",contact_email:"Organizer@Example.test",preferred_date:"2027-05-01",group_name:"Sample Golf Outing",estimated_participants:"72"};
function mock(fn){return {functions:{invoke:fn},from:()=>{throw Error("Never directly write/read event_requests from the browser.");}}}
test("auth-verified inquiry calls dedicated function with no anonymous table writes",async()=>{
 let calls=0;
 const client=mock(async(name,{body})=>{
  calls++;assert.equal(name,"event-inquiry-portal");
  assert.equal(body.action,"submit");assert.equal(body.request_id,req);
  assert.equal(body.organization_id,org);assert.equal(body.form.submitted_by_user_id,id);
  assert.equal(body.form.status,"submitted");
  assert.equal(body.form.contact_email,"organizer@example.test");
  assert.equal("venue_internal_notes" in body.form,false);
  assert.equal("stripe_checkout_session_id" in body.form,false);
  return {data:{success:true,request_id:req,status:"submitted"},error:null};
 });
 const result=await sendVerifiedEventInquiry(client,{form,verifiedUser:user,organizationId:org,requestId:req});
 assert.deepEqual(result,{id:req,status:"submitted"});assert.equal(calls,1);
});
test("client refuses missing verification and mismatched requester before invoking endpoint",async()=>{
 let calls=0;const client=mock(async()=>{calls++;return{};});
 for(const invalidUser of [{...user,email_confirmed_at:null},{...user,email:"wrong@example.test"}])
  await assert.rejects(sendVerifiedEventInquiry(client,{form,verifiedUser:invalidUser,organizationId:org,requestId:req}));
 await assert.rejects(sendVerifiedEventInquiry(client,{form,verifiedUser:user,organizationId:org,requestId:"not-uuid"}));
 assert.equal(calls,0);
});
test("submit fails closed if server endpoint not available; never claims a request was submitted",async()=>{
 const client=mock(async()=>({error:{message:"not deployed"},data:null}));
 await assert.rejects(sendVerifiedEventInquiry(client,{form,verifiedUser:user,organizationId:org,requestId:req}),/not deployed/);
 const fakeOk=mock(async()=>({data:{success:true,request_id:"other",status:"submitted"}}));
 await assert.rejects(sendVerifiedEventInquiry(fakeOk,{form,verifiedUser:user,organizationId:org,requestId:req}),/invalid confirmation/);
});
test("request dashboard uses only authenticated function result and strips private fields",async()=>{
 const client=mock(async(name,{body})=>{
  assert.equal(name,"event-inquiry-portal");
  if(body.action==="list_mine")return {data:{success:true,requests:[
   {id:req,status:"hold",group_name:"Golf Charity",venue_internal_notes:"Staff-only",
    stripe_payment_intent_id:"pi_secret",hold_expires_at:"2027-05-01T15:00:00Z"},
  ]}};
  if(body.action==="get_mine")return {data:{success:true,request:{id:req,status:"tentative",
   venue_internal_notes:"Staff-only",group_name:"Golf Charity"}}};
  throw Error("Unknown action");
 });
 const rows=await loadMyEventInquiries(client);
 assert.equal(rows.length,1);assert.equal(rows[0].status_label,"Date on Hold");
 assert.equal("venue_internal_notes" in rows[0],false);
 assert.equal("stripe_payment_intent_id" in rows[0],false);
 const one=await loadMyEventInquiry(client,req);
 assert.equal(one.status_label,"Tentative");
 await assert.rejects(loadMyEventInquiry(client,"bad"),/Invalid event request reference/);
});
