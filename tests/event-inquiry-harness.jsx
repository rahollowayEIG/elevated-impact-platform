import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import EventInquiryAccountPrompt from "../src/components/EventInquiryAccountPrompt.jsx";
import EventInquiryDashboard from "../src/components/EventInquiryDashboard.jsx";
import {sendVerifiedEventInquiry} from "../src/lib/eventInquiryPortalClient.mjs";
import "../src/styles.css";

const USER_ID="11111111-1111-4111-8111-111111111111";
const ORG_ID="22222222-2222-4222-8222-222222222222";
const REQUEST_ID="33333333-3333-4333-8333-333333333333";
const contactEmail="demo@example.test";
const form={contact_full_name:"Demo Requester",contact_email:contactEmail,
  preferred_date:"2027-05-01",group_name:"Sample Fundraiser",estimated_participants:"72",
  event_type:"Charity / Fundraiser",food_needed:"Yes"};
let authEnabled=false;
let rows=[];
const stats={calls:[],anonymousTableCalls:0,signupCodes:0,verified:0,submissions:0};
window.inquiryHarness={stats,reset:()=>{rows=[];authEnabled=false;stats.calls=[];stats.submissions=0;}};
const client={
  from(){stats.anonymousTableCalls++;throw Error("No raw Supabase DB calls are permitted in this account portal.");},
  functions:{async invoke(name,{body}={}){
    stats.calls.push({name,action:body?.action});
    if(name==="golf-account-auth"){
      if(body.action==="request_signup_code"){stats.signupCodes++;return {data:{success:true,expires_in_seconds:600}};}
      if(body.action==="verify_signup_code"){
        if(body.code!=="123456")return {data:{error:"That code is not correct."}};
        stats.verified++;return {data:{success:true,user_id:USER_ID}};
      }
      if(body.action==="sign_in")return {data:{access_token:"fake-test-token",refresh_token:"fake-refresh-token"}};
      return {data:{error:"Unsupported fake account action."}};
    }
    if(name==="event-inquiry-portal"){
      if(body.action==="submit"){
        if(!authEnabled) return {data:{error:"Verified user required."}};
        if(body.form.contact_email!==contactEmail)return {data:{error:"Email mismatch."}};
        stats.submissions++;
        rows=[{id:body.request_id,organization_id:ORG_ID,organization_name:"Demo Hangar",
          status:"submitted",group_name:body.form.group_name,preferred_date:body.form.preferred_date,
          event_type:body.form.event_type,created_at:"2026-10-20T18:00:00Z",
          updated_at:"2026-10-20T18:00:00Z"}];
        return {data:{success:true,request_id:body.request_id,status:"submitted"}};
      }
      if(body.action==="list_mine")return {data:{success:true,requests:rows}};
      return {data:{error:"Unknown portal operation."}};
    }
    throw Error("Unexpected fake Edge function: "+name);
  }},
  auth:{
    async setSession({access_token}){authEnabled=access_token==="fake-test-token";return {error:null};},
    async getUser(){return {data:{user:authEnabled?
      {id:USER_ID,email:contactEmail,email_confirmed_at:"2026-10-20T12:00:00Z"}:null},error:null};},
  },
};
function TestHarness(){
  const [open,setOpen]=useState(false),[submitted,setSubmitted]=useState(false);
  const [error,setError]=useState("");
  async function onAuthenticated(user){
    try{
      await sendVerifiedEventInquiry(client,{form,verifiedUser:user,organizationId:ORG_ID,requestId:REQUEST_ID});
      setOpen(false);setSubmitted(true);setError("");
    }catch(e){setError(e.message);throw e;}
  }
  window.inquiryHarness.resetView=()=>{setOpen(false);setSubmitted(false);setError("");};
  return <main style={{maxWidth:900,margin:"25px auto",padding:16}}>
    <h1>EIE Event Request Account Pilot</h1>
    <p>Fictional data, no live API or email. Click Submit to continue to account verification.</p>
    {submitted
      ?<EventInquiryDashboard supabaseClient={client} onNewRequest={()=>{setSubmitted(false);setOpen(false);}}/>
      :<div><p>Contact: {contactEmail} | Request: Sample Fundraiser</p>
        <button type="button" className="platform-primary-button" onClick={()=>setOpen(true)}>
          Submit Mock Event Request
        </button></div>}
    {error&&<div role="alert">{error}</div>}
    {open&&<EventInquiryAccountPrompt contactEmail={contactEmail} contactFullName="Demo Requester"
      supabaseClient={client} onAuthenticated={onAuthenticated} onCancel={()=>setOpen(false)}/>}
  </main>;
}
createRoot(document.getElementById("root")).render(<TestHarness/>);
