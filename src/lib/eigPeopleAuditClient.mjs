// Validated read-only People audit addendum to Master Scanner.
// The source scanner's dated snapshots remain separate from this live authorized-row check.
const MAX=15000;
const TOTAL_FIELDS=[
 "registrations","activeNamed","inactive","tba","nameless",
 "unclaimedWithoutPassenger","accountWithoutPassenger","linkedPassenger",
 "brokenPassengerReference","accountPassengerMismatch","claimedWithoutAccount",
 "mergedPassengerReference"
];
function validNumber(n){return Number.isSafeInteger(n)&&n>=0&&n<=MAX;}
export function validatePeopleIntegrityAudit(a){
 if(!a||a.kind!=="eig_people_integrity_audit"||a.schemaVersion!==1||
  a.environment!=="live"||a.scope!=="eie_golf_registrations"||
  a.assessment!=="review_required"||a.sourceCoverage!=="golf_registration_only"||
  a.readOnly!==true||a.rawPeopleReturned!==false||a.automaticRepair!==false||
  typeof a.checkedAt!=="string"||!Number.isFinite(Date.parse(a.checkedAt))||
  !a.totals||!TOTAL_FIELDS.every(k=>validNumber(a.totals[k]))||
  !validNumber(a.flaggedChecks)||!a.coverage||
  a.coverage.allAuthorizedRowsFetched!==true||a.coverage.allPlatformApplicationsChecked!==false||
  !["registrationRows","passengerRows"].every(k=>validNumber(a.coverage[k]))||
  a.totals.registrations!==a.coverage.registrationRows||
  a.totals.registrations!==a.totals.activeNamed+a.totals.inactive+a.totals.tba+a.totals.nameless||
  !Array.isArray(a.events)||a.events.length>100||typeof a.eventsTruncated!=="boolean"||
  a.events.some(e=>typeof e.eventKey!=="string"||e.eventKey.length<1||e.eventKey.length>160||
   !["registrations","activeNamed","unlinked","linked"].every(k=>validNumber(e[k])))||
  !Array.isArray(a.limitations)||a.limitations.length<2||a.limitations.length>6||
  a.limitations.some(s=>typeof s!=="string"||s.length>400))
  throw Error("Invalid People integrity audit.");
 return a;
}
export async function requestPeopleIntegrityAudit(supabase,http=fetch){
 if(!supabase?.auth?.getSession||typeof http!=="function")throw Error("Owner sign-in required.");
 const {data,error}=await supabase.auth.getSession();
 const token=data?.session?.access_token;
 if(error||!token)throw Error("Sign in again before auditing People.");
 const res=await http("/api/eig-build-lab-people-audit",{
  method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
  body:JSON.stringify({scope:"eie_golf_registrations"}),
  cache:"no-store",credentials:"same-origin"
 });
 if(!res.ok)throw Error("Live People reconciliation could not be completed. No clean result is claimed.");
 const payload=await res.json();
 return validatePeopleIntegrityAudit(payload?.audit);
}
