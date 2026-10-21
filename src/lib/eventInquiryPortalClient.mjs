import {authorizedInquiryPayload,publicInquiryView} from "./eventInquiryLifecycle.mjs";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function portalCall(supabaseClient,body) {
  if(!supabaseClient?.functions?.invoke)throw Error("The event-request service is unavailable.");
  // This is a new dedicated account-owned endpoint, NOT direct anon table writes.
  const {data,error}=await supabaseClient.functions.invoke("event-inquiry-portal",{body});
  if(error||data?.error||data?.success!==true)
    throw Error(data?.error||error?.message||"The event-request service is not yet available. Your form has not been submitted.");
  return data;
}
export async function sendVerifiedEventInquiry(supabaseClient,{
  form,verifiedUser,organizationId,requestId,
}) {
  if(!UUID.test(String(requestId||"")))throw Error("An idempotent request ID is required.");
  const payload=authorizedInquiryPayload(form,verifiedUser,organizationId);
  const result=await portalCall(supabaseClient,{
    action:"submit",request_id:requestId,organization_id:organizationId,
    form:payload,
  });
  if(!UUID.test(String(result.request_id||""))||result.request_id!==requestId||
    result.status!=="submitted")throw Error("The request service returned an invalid confirmation.");
  return {id:result.request_id,status:result.status};
}
export async function loadMyEventInquiries(supabaseClient){
  const result=await portalCall(supabaseClient,{action:"list_mine"});
  if(!Array.isArray(result.requests)||result.requests.length>100)
    throw Error("The request service returned an invalid list.");
  return result.requests.map(row=>publicInquiryView(row)).filter(Boolean);
}
export async function loadMyEventInquiry(supabaseClient,requestId){
  if(!UUID.test(String(requestId||"")))throw Error("Invalid event request reference.");
  const result=await portalCall(supabaseClient,{action:"get_mine",request_id:requestId});
  if(!result.request||result.request.id!==requestId)
    throw Error("Event request not found in your account.");
  return publicInquiryView(result.request);
}
