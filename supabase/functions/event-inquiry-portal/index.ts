// EIE Event Request Portal: sandbox-only staging backend.
// NEVER deploy to Live until anonymous DB policy hardening and the complete
// requester notification/outbox workflow are reviewed and tested.
// New-account OTP uses the existing golf-account-auth Edge Function.
import {createClient} from "npm:@supabase/supabase-js@2.57.4";

const allowedActions=new Set(["submit","list_mine","get_mine"]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL=/^\S+@\S+\.\S+$/;
const PUBLIC_SELECT="id,organization_id,status,group_name,event_type,preferred_date,confirmed_date,confirmed_start_type,confirmed_start_time,confirmed_capacity,confirmed_package,venue_response,hold_expires_at,contract_status,deposit_status,deposit_due_at,created_at,updated_at";
const WEB_HEADERS={"Content-Type":"application/json","Cache-Control":"private, no-store, max-age=0"};
function clean(v,max=256){return String(v??"").trim().slice(0,max);}
function normEmail(v){return clean(v,300).toLowerCase();}
function cors(origin){
  const list=(Deno.env.get("EIE_INQUIRY_PORTAL_ALLOWED_ORIGINS")||"").split(",").map(x=>x.trim()).filter(Boolean);
  const allowed=origin&&list.includes(origin);
  return {allowed,headers:{...WEB_HEADERS,
    ...(allowed?{"Access-Control-Allow-Origin":origin,"Vary":"Origin",
      "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods":"POST, OPTIONS"}:{})}};
}
function json(obj,status,headers){return new Response(JSON.stringify(obj),{status,headers});}
function validDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v||"")))return false;
  const d=new Date(v+"T12:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;
}
function optDate(v){return v&&validDate(v)?v:null;}
function safeResult(row){
  return Object.fromEntries(PUBLIC_SELECT.split(",").map(k=>[k,row?.[k]??null]));
}
function parseSubmission(input,user){
  if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Invalid inquiry details.");
  const email=normEmail(user.email);
  if(!EMAIL.test(email)||normEmail(input.contact_email)!==email)
    throw Error("Sign in with the verified contact email before submitting.");
  if(!clean(input.contact_full_name,170)||clean(input.contact_full_name,170).length>160)
    throw Error("Enter the request contact's full name.");
  if(!validDate(input.preferred_date))throw Error("Choose a valid first-choice event date.");
  for(const key of ["alternate_date","second_alternate_date"])
    if(input[key]&&!validDate(input[key]))throw Error("Check the alternate event dates.");
  const count=input.estimated_participants===null||input.estimated_participants===""||input.estimated_participants===undefined
    ?null:Number(input.estimated_participants);
  if(count!==null&&(!Number.isInteger(count)||count<1||count>20000))
    throw Error("Enter a valid participant count.");
  const fields={
    event_type:120,contact_full_name:160,group_name:180,contact_phone:45,
    unavailable_date_notes:1500,preferred_start_type:100,golf_format:120,
    special_requests:4000,
  };
  for(const [field,max] of Object.entries(fields))
    if(String(input[field]||"").length>max)throw Error("An event request field is too long.");
  return {
    status:"submitted",
    submitted_by_user_id:user.id,
    contact_email:email,
    event_type:clean(input.event_type||"Charity / Fundraiser",120),
    preferred_date:input.preferred_date,
    alternate_date:optDate(input.alternate_date),
    second_alternate_date:optDate(input.second_alternate_date),
    estimated_participants:count,
    contact_full_name:clean(input.contact_full_name,160),
    group_name:clean(input.group_name,180),
    contact_phone:clean(input.contact_phone,45),
    unavailable_date_notes:clean(input.unavailable_date_notes,1500),
    preferred_start_type:clean(input.preferred_start_type||"Not Sure",100),
    preferred_start_time:/^\d{2}:\d{2}$/.test(String(input.preferred_start_time||""))
      ?input.preferred_start_time:null,
    golf_format:clean(input.golf_format||"Not Sure",120),
    food_needed:input.food_needed===true?true:input.food_needed===false?false:null,
    special_requests:clean(input.special_requests,4000),
    requested_details:{
      source:"public_inquiry_account",
      first_choice_date:input.preferred_date,
      second_choice_date:optDate(input.alternate_date),
      third_choice_date:optDate(input.second_alternate_date),
      food_needed:input.food_needed===true?"Yes":input.food_needed===false?"No":"Not Sure",
    },
  };
}
Deno.serve(async req=>{
  const origin=req.headers.get("Origin")||"";
  const access=cors(origin);
  if(!access.allowed)return json({success:false,error:"Origin not allowed."},403,WEB_HEADERS);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:access.headers});
  if(req.method!=="POST")return json({success:false,error:"Method not allowed."},405,access.headers);
  // Intentional hard stop. Sandbox instance must explicitly enable and
  // document this function. It is not an automatic production feature.
  if(Deno.env.get("EIE_INQUIRY_PORTAL_ENVIRONMENT")!=="sandbox"||
     Deno.env.get("EIE_INQUIRY_PORTAL_SANDBOX_ENABLED")!=="true")
    return json({success:false,error:"Event request account tracking is not enabled."},503,access.headers);

  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url=Deno.env.get("SUPABASE_URL");
  if(!url||!key)return json({success:false,error:"Request service unavailable."},503,access.headers);
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return json({success:false,error:"Sign in before continuing."},401,access.headers);
  const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:identity,error:identityError}=await admin.auth.getUser(token);
  const user=identity?.user;
  if(identityError||!user?.id||!user?.email_confirmed_at)
    return json({success:false,error:"A verified account is required."},401,access.headers);
  let body;
  try{
    const raw=await req.text();
    if(raw.length>16000)throw Error("Request too large.");
    body=JSON.parse(raw);
  }catch{return json({success:false,error:"Invalid event request."},400,access.headers);}
  if(!body||typeof body!=="object"||Array.isArray(body)||!allowedActions.has(body.action))
    return json({success:false,error:"Unsupported request."},400,access.headers);

  if(body.action==="list_mine"){
    const {data,error}=await admin.from("event_requests").select(PUBLIC_SELECT)
      .eq("submitted_by_user_id",user.id).order("updated_at",{ascending:false}).limit(80);
    if(error)return json({success:false,error:"Unable to load your event requests."},500,access.headers);
    return json({success:true,requests:(data||[]).map(safeResult)},200,access.headers);
  }
  if(body.action==="get_mine"){
    if(!UUID.test(String(body.request_id||"")))
      return json({success:false,error:"Invalid request reference."},400,access.headers);
    const {data,error}=await admin.from("event_requests").select(PUBLIC_SELECT)
      .eq("id",body.request_id).eq("submitted_by_user_id",user.id).maybeSingle();
    if(error)return json({success:false,error:"Unable to look up the event request."},500,access.headers);
    if(!data)return json({success:false,error:"Request not found."},404,access.headers);
    return json({success:true,request:safeResult(data)},200,access.headers);
  }
  if(!UUID.test(String(body.request_id||""))||!UUID.test(String(body.organization_id||"")))
    return json({success:false,error:"Invalid event request reference."},400,access.headers);
  let candidate;
  try{candidate=parseSubmission(body.form,user);}
  catch(e){return json({success:false,error:e?.message||"Invalid inquiry."},400,access.headers);}
  // Only active fictional Sandbox Hangars are eligible for this pilot.
  const {data:org,error:orgError}=await admin.from("organizations")
    .select("id,status,is_test").eq("id",body.organization_id).eq("status","active")
    .eq("is_test",true).maybeSingle();
  if(orgError||!org)return json({success:false,error:"Sandbox practice Hangar not available."},404,access.headers);

  const {data:prior,error:lookupError}=await admin.from("event_requests")
    .select("id,status,submitted_by_user_id").eq("id",body.request_id).maybeSingle();
  if(lookupError)return json({success:false,error:"Unable to verify request receipt."},500,access.headers);
  if(prior)return prior.submitted_by_user_id===user.id&&prior.status==="submitted"
    ?json({success:true,request_id:prior.id,status:prior.status,idempotent:true},200,access.headers)
    :json({success:false,error:"Request cannot be claimed."},409,access.headers);
  // Basic per-account rate limit in the pilot. Production will need a
  // durable, stronger per-account + IP abuse/rate limit policy.
  const start=new Date(Date.now()-24*3600*1000).toISOString();
  const {data:recent,error:recentError}=await admin.from("event_requests").select("id")
    .eq("submitted_by_user_id",user.id).gte("created_at",start).limit(6);
  if(recentError)return json({success:false,error:"Unable to check request limits."},500,access.headers);
  if((recent||[]).length>=5)return json({success:false,error:"Too many event requests. Please contact the Hangar."},429,access.headers);
  const {error:saveError}=await admin.from("event_requests").insert({
    ...candidate,id:body.request_id,organization_id:org.id,
  });
  if(saveError){
    // UUID primary-key conflict can happen after a client retry. Check owner.
    if(saveError.code==="23505"){
      const {data:duplicate}=await admin.from("event_requests")
        .select("id,submitted_by_user_id,status").eq("id",body.request_id).maybeSingle();
      if(duplicate?.submitted_by_user_id===user.id&&duplicate?.status==="submitted")
        return json({success:true,request_id:duplicate.id,status:"submitted",idempotent:true},200,access.headers);
    }
    return json({success:false,error:"Could not save your event request. Please try again."},500,access.headers);
  }
  return json({success:true,request_id:body.request_id,status:"submitted"},201,access.headers);
});
