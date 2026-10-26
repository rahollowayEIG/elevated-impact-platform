const test=require("node:test");
const assert=require("node:assert/strict");
const {fetchComplete,analyzePeopleIntegrity,scanPeopleIntegrity}=require("../server/eig-people-reconciliation.cjs");
test("identity audit distinguishes unclaimed records, broken links, signed-in accounts, and TBA slots",()=>{
 const registrations=[
  {id:"1",event_key:"a",first_name:"A",last_name:"B",registration_status:"active",user_id:"u1",passenger_id:"p1",passenger_claim_status:"claimed"},
  {id:"2",event_key:"a",first_name:"C",last_name:"D",registration_status:"incomplete",user_id:null,passenger_id:null,passenger_claim_status:"unclaimed"},
  {id:"3",event_key:"a",first_name:"E",last_name:"F",registration_status:"active",user_id:"u2",passenger_id:null},
  {id:"4",event_key:"a",first_name:"TBA",last_name:"Reserved",registration_status:"active",custom_fields:{reserved_tba:true}},
  {id:"5",event_key:"a",first_name:"Old",last_name:"Golfer",registration_status:"cancelled"},
  {id:"6",event_key:"b",first_name:"G",last_name:"H",registration_status:"active",passenger_id:"missing"},
  {id:"7",event_key:"b",first_name:"I",last_name:"J",registration_status:"active",user_id:"u3",passenger_id:"p3"},
  {id:"8",event_key:"b",first_name:"",last_name:"",registration_status:"active"}
 ];
 const report=analyzePeopleIntegrity({
  registrations,passengers:[{id:"p1",auth_user_id:"u1",status:"claimed"},{id:"p3",auth_user_id:"wrong",status:"claimed"}],
  checkedAt:"2026-10-26T15:00:00.000Z"
 });
 assert.equal(report.totals.registrations,8);
 assert.equal(report.totals.activeNamed,5);
 assert.equal(report.totals.tba,1);
 assert.equal(report.totals.inactive,1);
 assert.equal(report.totals.nameless,1);
 assert.equal(report.totals.unclaimedWithoutPassenger,1);
 assert.equal(report.totals.accountWithoutPassenger,1);
 assert.equal(report.totals.linkedPassenger,2);
 assert.equal(report.totals.brokenPassengerReference,1);
 assert.equal(report.totals.accountPassengerMismatch,1);
 assert.equal(report.events.find(e=>e.eventKey==="a").unlinked,2);
 assert.equal(report.rawPeopleReturned,false);
 assert.equal(report.automaticRepair,false);
 assert.equal(JSON.stringify(report).includes("Old"),false);
});
function clientFromTables(tables,observed){
 return {from(table){
  observed.push(table);
  return {select(columns,opts){
   assert.equal(opts.count,"exact");
   return {order(field,order){
    assert.equal(field,"id");assert.equal(order.ascending,true);
    return {async range(start,end){
     return {data:(tables[table]||[]).slice(start,end+1),count:(tables[table]||[]).length,error:null};
    }};
   }};
  }};
 }};
}
test("bounded paginated RLS reads inspect all visible records and never issue writes",async()=>{
 const observed=[];
 const registrations=Array.from({length:261},(_,i)=>({id:String(i),event_key:"x",first_name:"Test",last_name:"User",registration_status:"active",user_id:null,passenger_id:null}));
 const client=clientFromTables({golf_registrations:registrations,passengers:[],profiles:[]},observed);
 const result=await scanPeopleIntegrity(client,{now:()=>"2026-10-26T15:00:00Z"});
 assert.equal(result.coverage.registrationRows,261);
 assert.equal(result.totals.unclaimedWithoutPassenger,261);
 assert.deepEqual(observed,["golf_registrations","passengers","golf_registrations"]);
 assert.equal(result.coverage.allPlatformApplicationsChecked,false);
});
test("refuses to certify partial source reads, inconsistent pagination or row limit",async()=>{
 const observed=[];
 const client=clientFromTables({golf_registrations:[{id:"1"},{id:"2"}]},observed);
 await assert.rejects(()=>fetchComplete(client,{table:"golf_registrations",select:"id"},1),/bounded read limit/);
 const broken={from(){return {select(){return {order(){return {async range(){return {data:[],count:3,error:null};}};}};}};}};
 await assert.rejects(()=>fetchComplete(broken,{table:"passengers",select:"id"}),/page missing/);
});
