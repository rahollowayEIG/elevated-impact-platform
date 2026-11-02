/**
 * Build Lab product-first hierarchy.
 *
 * The Master Scanner reports technical areas; those areas are not themselves
 * all top-level ElevationPilot apps. A parent app summarizes its components.
 *
 * This registry describes navigation and candidate coverage only. It is not
 * an owner-approved release scope, implementation verdict, or test receipt.
 * Unscanned parts are not presumed absent or broken.
 */
import {APP_STACK_CATALOG} from './buildLabAppStack.mjs';

export const APP_FAMILIES=Object.freeze([
 {id:'eie',name:'EIE | Elevated Impact Events',shortName:'EIE',group:'Events',
  description:'Events from first inquiry through setup, registration, payments, operations and follow-up.',
  components:['event-builder','registration','payments','roster','sponsors','event-packet','event-budget'],
  coverageCandidates:[
   'Event Directory & Outing Inquiries','Public Event Hub','ATC Event Operations',
   'Check-in & Attendance','Vendor & Volunteer Coordination','Donations, Raffles & Contests',
   'Team Invitations & Account Claims','Team Swaps & Captain Changes',
   'Golf Genius Export & Print Rosters','Event Communications & Reminders',
   'Event Materials & Print','Event Contracts & Insurance'
  ]},
 {id:'inception-apex',name:'InceptionApex',shortName:'InceptionApex',group:'Creative & Marketing',
  description:'Creative studio, design tools, reusable assets and marketing production.',
  components:['inception'],
  coverageCandidates:['Design Library & Templates','Creative Export & Publishing Workflows',
   'Canva & Adobe Creative Connections','Shared Creative Assets & Reuse']},
 {id:'social-marketing',name:'Social Media & Ads',shortName:'Social Media & Ads',group:'Creative & Marketing',
  description:'Campaign planning, social posting, ad placement and channel connections.',
  components:['social'],
  coverageCandidates:['Provider Login & Publishing','Hangar Social Channel Authorization',
   'Campaign Planning & Scheduling','Advertising Placement & Packages',
   'Campaign Performance & Attribution']},
 {id:'squawk-box',name:'Squawk Box',shortName:'Squawk Box',group:'Communications',
  description:'In-app and external communications with permissions and delivery controls.',
  components:['squawk'],
  coverageCandidates:['Cross-App Message Routing','Communication Provider Connections',
   'Delivery Tracking & Quiet Hours','Event Hub & Passenger Messaging']},
 {id:'commerce',name:'Commerce & Stores',shortName:'Commerce & Stores',group:'Commerce',
  description:'Products, invoices, contracts, catalog, inventory and business transactions.',
  components:['invoices','product-registry','contracts','pos-tax'],
  coverageCandidates:['Multi-Store & Direct B2B Sales','Product Deals & Fulfillment',
   'Gift & Business Registries','Offer & Deal Tracking',
   'Catering & Set the Table Links','Inventory Reconciliation & Duplicates']},
 {id:'platform',name:'EIG Platform & Accounts',shortName:'Platform & Accounts',group:'Platform',
  description:'Identity, organization permissions and the Hangar/Cockpit/Airport platform structure.',
  components:['accounts'],
  coverageCandidates:['Command Center & Hangar','Cockpit & Airport','Universal User Directory','Airspace',
   'Onboarding & Invitations','Temporary Roles & Delegated Access','Shared App Notifications']},
 {id:'golf',name:'EIG Golf Tools',shortName:'EIG Golf Tools',group:'Golf',
  description:'Course maps, flyovers and other golf-specific tools.',
  components:['maps'],
  coverageCandidates:['GPS & Yardage Research','Course Flyovers & Map Assets','Live Golf Scoring']},
 {id:'build-lab',name:'Build Lab',shortName:'Build Lab',group:'Platform',
  description:'Source scanning, work review, approved plans and quality checks.',
  components:['build-lab'],
  coverageCandidates:['Automatic Scanner Registration','Completion Evidence & Gauges',
   'Research & Innovation Scanner','Guided Work Buckets & Fix Plans',
   'Hangar Connection Adoption','Scan History & Recovery',
   'AI Review & Improvement Radar']}
]);

/**
 * Candidate source locations for inspecting proposed or known app parts.
 * A hint says where to LOOK, not that the feature works or is even built.
 * Keep this separate from production scanner allowlists and test receipts.
 */
export const APP_PART_SOURCE_HINTS=Object.freeze({
 'eie':{
  'Event Directory & Outing Inquiries':['src/PlatformApp.jsx'],
  'Public Event Hub':['src/PlatformApp.jsx'],
  'ATC Event Operations':['src/PlatformApp.jsx'],
  'Check-in & Attendance':['src/lib/checkInRoster.mjs','src/lib/checkInPrint.mjs'],
  'Team Invitations & Account Claims':['src/GolfTeamInvitation.jsx','src/EieTeamManagement.jsx'],
  'Team Swaps & Captain Changes':['src/EieTeamManagement.jsx'],
  'Golf Genius Export & Print Rosters':['src/EieRosterMaintenance.jsx'],
  'Event Communications & Reminders':['src/SquawkCenter.jsx'],
  'Event Materials & Print':['src/components/EventMaterials.jsx']
 },
 'inception-apex':{
  'Design Library & Templates':['src/components/DesignProductCatalog.jsx'],
  'Creative Export & Publishing Workflows':['src/lib/inceptionDrive.js'],
  'Shared Creative Assets & Reuse':['src/components/CreativeLinkControls.jsx']
 },
 'social-marketing':{
  'Campaign Planning & Scheduling':['src/components/CampaignPlanning.jsx'],
  'Advertising Placement & Packages':['src/lib/socialCampaign.mjs']
 },
 'squawk-box':{
  'Cross-App Message Routing':['src/SquawkCenter.jsx'],
  'Communication Provider Connections':['src/SquawkCenter.jsx']
 },
 'commerce':{
  'Inventory Reconciliation & Duplicates':['src/lib/epProductCapture.mjs']
 },
 'platform':{
  'Command Center & Hangar':['src/PlatformApp.jsx'],
  'Cockpit & Airport':['src/ElevationAirport.jsx'],
  'Universal User Directory':['src/lib/accountIdentity.mjs'],
  'Onboarding & Invitations':['src/PlatformApp.jsx'],
  'Temporary Roles & Delegated Access':['src/PlatformApp.jsx']
 },
 'build-lab':{
  'Completion Evidence & Gauges':['src/components/BuildLabAppStack.jsx'],
  'Guided Work Buckets & Fix Plans':['src/components/BuildLabWorkBuckets.jsx'],
  'Hangar Connection Adoption':['src/components/BuildLabHangarConnections.jsx'],
  'Scan History & Recovery':['src/components/BuildLabScanHistory.jsx'],
  'AI Review & Improvement Radar':['src/lib/eigBuildLabAiClient.mjs']
 }
});

export function candidateScopeEntries(app){
 if(!app||!Array.isArray(app.coverageCandidates))return [];
 const hints=APP_PART_SOURCE_HINTS[app.id]||{};
 return app.coverageCandidates.map((name,index)=>({
  id:app.id+'-scope-'+(index+1),
  name,
  sourceHints:Array.isArray(hints[name])?[...hints[name]]:[],
  scannerStatus:'Feature-specific scanner coverage to review',
  proofStatus:'No independent feature-level implementation or test verdict'
 }));
}

const isMeasured=v=>Number.isFinite(v)&&v>=0&&v<=100;
export function buildApplicationHierarchy(components=[]){
 const byId=new Map((Array.isArray(components)?components:[]).map(x=>[x.id,x]));
 const families=APP_FAMILIES.map(app=>{
  const parts=app.components.map(id=>byId.get(id)).filter(Boolean);
  const scannerCoverage=parts.filter(p=>p.scanned).length;
  // No percentage arithmetic unless ALL required approved feature checklists
  // and test receipts have been added in a later reviewed release.
  const measured=parts.length===app.components.length&&
   parts.length>0&&parts.every(p=>
    ['build','verified','integration','overall'].every(k=>isMeasured(p[k])));
  // Even if all parts individually have scores, a parent's weighted approved
  // release scope does not yet exist, so we must not fabricate a roll-up.
  const open=parts.reduce((n,p)=>n+(p.open||0),0);
  const hold=parts.reduce((n,p)=>n+(p.hold||0),0);
  const planned=parts.reduce((n,p)=>n+(p.planned||0),0);
  const needsReview=parts.filter(p=>p.stage==='Needs verification').length;
  const missingCoverage=app.coverageCandidates.length+
    (app.components.length-parts.length);
  return {
   ...app,parts,
   scopeEntries:candidateScopeEntries(app),
   componentCount:app.components.length,
   scannedCount:scannerCoverage,
   unscannedCount:app.components.length-scannerCoverage,
   coverageToScope:missingCoverage,
   open,hold,planned,needsReview,
   build:null,verified:null,integration:null,overall:null,
   measuredSourceReady:measured,
   stage:open?'Work awaiting review':
    needsReview?'Needs verification':
    scannerCoverage===0?'Awaiting scan':scannerCoverage<app.components.length?'Partial scan coverage':'Source evidence available',
   nextAction:open?'Open the app and review its flagged components.':
    missingCoverage?'Open the app and review its unscanned component scope.':
    'Open the app to inspect its verification evidence.'
  };
 });
 return {
  families,
  summary:{
   applications:families.length,
   components:APP_STACK_CATALOG.length,
   scannedComponents:families.reduce((n,x)=>n+x.scannedCount,0),
   open:families.reduce((n,x)=>n+x.open,0),
   hold:families.reduce((n,x)=>n+x.hold,0),
   planned:families.reduce((n,x)=>n+x.planned,0)
  }
 };
}
export function findAppFamily(id){
 return APP_FAMILIES.find(app=>app.id===id)||null;
}
