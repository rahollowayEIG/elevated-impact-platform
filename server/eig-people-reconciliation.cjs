"use strict";
// Owner-only, read-only runtime reconciliation. Never repairs or returns personal records.
// A person may be unclaimed, and a registration is not an Auth user.
const PAGE_SIZE=250;
const MAX_ROWS=15000;
const SPECS=[
 {table:"golf_registrations",select:"id,event_id,event_key,first_name,last_name,custom_fields,registration_status,user_id,passenger_id,passenger_claim_status"},
 {table:"passengers",select:"id,auth_user_id,status,merged_into_passenger_id"},
 {table:"profiles",select:"id"}
];
async function fetchComplete(client,{table,select},limit=MAX_ROWS){
 const rows=[];let expected=null;
 for(let offset=0;offset<=limit;offset+=PAGE_SIZE){
  const {data,error,count}=await client.from(table).select(select,{count:"exact"}).order("id",{ascending:true}).range(offset,offset+PAGE_SIZE-1);
  if(error||!Array.isArray(data)||!Number.isSafeInteger(count)||count<0)
   throw Error("Identity audit read incomplete");
  if(expected!==null&&expected!==count)throw Error("Identity audit source changed during paging");
  expected=count;
  if(count>limit)throw Error("Identity audit exceeded bounded read limit");
  rows.push(...data);
  if(rows.length===count)return {rows,count};
  if(!data.length||rows.length>count)throw Error("Identity audit page missing or inconsistent");
 }
 throw Error("Identity audit read limit reached");
}
function isTba(row){
 const fields=row.custom_fields||{};
 const first=String(row.first_name||"").trim().toUpperCase();
 const last=String(row.last_name||"").trim().toUpperCase();
 return fields.reserved_tba===true||fields.reserved_tba==="true"||
  first==="TBA"||first==="TO BE ANNOUNCED"||
  (first==="RESERVED"&&last==="TBA");
}
function isInactive(row){
 return ["cancelled","canceled","withdrawn","removed"].includes(String(row.registration_status||"").toLowerCase());
}
function analyzePeopleIntegrity({registrations,passengers,profiles,checkedAt=new Date().toISOString()}){
 const byPassenger=new Map(passengers.map(p=>[p.id,p]));
 const profileIds=new Set(profiles.map(p=>p.id));
 const totals={
  registrations:registrations.length,activeNamed:0,inactive:0,tba:0,nameless:0,
  unclaimedWithoutPassenger:0,accountWithoutPassenger:0,linkedPassenger:0,
  brokenPassengerReference:0,accountPassengerMismatch:0,
  claimedWithoutAccount:0,authWithoutProfile:0,mergedPassengerReference:0
 };
 const perEvent=new Map();
 for(const row of registrations){
  const eventKey=String(row.event_key||row.event_id||"event-unspecified").slice(0,160);
  if(!perEvent.has(eventKey))perEvent.set(eventKey,{eventKey,registrations:0,activeNamed:0,unlinked:0,linked:0});
  const event=perEvent.get(eventKey);event.registrations++;
  if(isInactive(row)){totals.inactive++;continue;}
  if(isTba(row)){totals.tba++;continue;}
  if(!String(row.first_name||"").trim()&&!String(row.last_name||"").trim()){totals.nameless++;continue;}
  totals.activeNamed++;event.activeNamed++;
  const p=row.passenger_id?byPassenger.get(row.passenger_id):null;
  if(!row.passenger_id){
   event.unlinked++;
   if(row.user_id)totals.accountWithoutPassenger++;
   else totals.unclaimedWithoutPassenger++;
  }else if(!p){
   totals.brokenPassengerReference++;event.unlinked++;
  }else{
   totals.linkedPassenger++;event.linked++;
   if(p.status==="merged"||p.merged_into_passenger_id)totals.mergedPassengerReference++;
   if(row.user_id&&p.auth_user_id&&row.user_id!==p.auth_user_id)totals.accountPassengerMismatch++;
  }
  if(row.user_id&&!profileIds.has(row.user_id))totals.authWithoutProfile++;
  if(row.passenger_claim_status==="claimed"&&!row.user_id)totals.claimedWithoutAccount++;
 }
 const events=[...perEvent.values()].sort((a,b)=>b.unlinked-a.unlinked||a.eventKey.localeCompare(b.eventKey));
 const flagged=totals.unclaimedWithoutPassenger+totals.accountWithoutPassenger+
  totals.brokenPassengerReference+totals.accountPassengerMismatch+
  totals.mergedPassengerReference+totals.authWithoutProfile+totals.claimedWithoutAccount;
 return {
  kind:"eig_people_integrity_audit",schemaVersion:1,
  checkedAt,environment:"live",scope:"eie_golf_registrations",
  assessment:"review_required",sourceCoverage:"golf_registration_only",
  readOnly:true,rawPeopleReturned:false,automaticRepair:false,
  coverage:{registrationRows:registrations.length,passengerRows:passengers.length,profileRows:profiles.length,
   allAuthorizedRowsFetched:true,allPlatformApplicationsChecked:false},
  totals,flaggedChecks:flagged,events:events.slice(0,100),
  eventsTruncated:events.length>100,
  limitations:[
   "Live read of authorized EIE golf registration, Passenger and profile records only; other apps are not checked.",
   "Unlinked registrations require identity review; do not infer a missing person or merge by email.",
   "RLS applies to all reads. Pagination confirms visible-row completeness, not independent database-wide visibility.",
   "This report neither creates accounts nor changes, merges or deletes customer records."
  ]
 };
}
async function scanPeopleIntegrity(client,{limit=MAX_ROWS,now=()=>new Date().toISOString()}={}){
 if(!client?.from)throw Error("Identity audit database access unavailable");
 // Sequential bounded reads avoid concurrent snapshots being misinterpreted as one atomic transaction.
 const [registrations,passengers,profiles]=await Promise.all(SPECS.map(spec=>fetchComplete(client,spec,limit)));
 const audit=analyzePeopleIntegrity({registrations:registrations.rows,passengers:passengers.rows,profiles:profiles.rows,checkedAt:now()});
 audit.coverage.registrationRows=registrations.count;
 audit.coverage.passengerRows=passengers.count;
 audit.coverage.profileRows=profiles.count;
 return audit;
}
module.exports={PAGE_SIZE,MAX_ROWS,fetchComplete,isTba,analyzePeopleIntegrity,scanPeopleIntegrity};
