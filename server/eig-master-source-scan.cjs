// ElevationPilot Master Scanner v1. Read-only, bounded first-party source evidence
// plus an explicitly dated, metadata-only Supabase schema snapshot.
// Never accepts arbitrary paths, URLs, SQL, source code or third-party targets.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const schemaSnapshot = require("./eig-master-schema-snapshot.json");

const FILE_PATHS = Object.freeze([
  "src/PlatformApp.jsx",
  "src/EieEventSetupSteps.jsx",
  "src/ElevationAirport.jsx",
  "src/SquawkCenter.jsx",
  "src/EieRosterMaintenance.jsx",
  "src/components/EventPacketStudio.jsx",
  "src/components/EventBudget.jsx",
  "src/components/InceptionApex.jsx",
  "src/components/SocialMediaApp.jsx",
  "src/components/EigBuildLab.jsx",
  "tests/event-builder-browser.cjs",
  "tests/team-payment-cart.test.mjs",
  "tests/roster-numbering.test.mjs",
  "tests/eig-build-lab-browser.cjs",
  "tests/inception-apex-browser.cjs",
  "tests/social-media-browser.cjs",
  "tests/recovery-session.test.mjs",
]);

// A matched file/line proves the code or test instruction exists, NOT that a
// flow ran successfully. Missing markers mean "not observed in this sample."
const MODULES = Object.freeze([
  {id:"event-builder",title:"Event Builder",priority:"high",
    source:[["src/EieEventSetupSteps.jsx","function EieEventSetupSteps"]],
    ui:[["src/PlatformApp.jsx","<EieEventSetupSteps"]],
    tests:[["tests/event-builder-browser.cjs","chromium.launch"]],
    tables:["event_offers","event_requests","event_builder_assets"],
    next:"Run an authorized Sandbox event-creation and save/reopen browser test; compare visible steps with stored fields."},
  {id:"registration",title:"Team Registration & Main Cabin",priority:"high",
    source:[["src/ElevationAirport.jsx","function MainCabinPage"]],
    ui:[["src/PlatformApp.jsx","<MainCabinPage"]],
    tests:[["tests/roster-numbering.test.mjs","test("]],
    tables:["golf_registration_teams","golf_registrations","golf_team_invitations"],
    next:"Test captain invites, claim/replacement, cancellations and numbering using fictional Sandbox golfers."},
  {id:"payments",title:"Team Payments & Split Payments",priority:"high",
    source:[["src/EieEventSetupSteps.jsx","golf_event_payment_settings"]],
    ui:[["src/PlatformApp.jsx","<EieEventSetupSteps"]],
    tests:[["tests/team-payment-cart.test.mjs","test("]],
    tables:["golf_team_payment_shares","golf_event_payment_settings"],
    next:"Verify split-payment states and clubhouse-payment instructions in Sandbox; never create live charges."},
  {id:"roster",title:"Roster & Team Maintenance",priority:"high",
    source:[["src/EieRosterMaintenance.jsx","function EieRosterMaintenance"]],
    ui:[["src/PlatformApp.jsx","<EieRosterMaintenance"]],
    tests:[["tests/roster-numbering.test.mjs","test("]],
    tables:["golf_registrations","golf_registration_teams"],
    next:"Exercise add, remove, replace, TBA, withdrawn teams and stable team numbers in Sandbox."},
  {id:"accounts",title:"Accounts & Permissions",priority:"high",
    source:[["src/PlatformApp.jsx","createSessionVerifier"]],
    ui:[["src/PlatformApp.jsx","<LoginScreen"]],
    tests:[["tests/recovery-session.test.mjs","test("]],
    tables:["profiles","organization_memberships","platform_invitations"],
    next:"Verify owner, Pilot, Co-Pilot, ATC and Passenger permissions with separate Sandbox accounts."},
  {id:"squawk",title:"Squawk Box Communications",priority:"high",
    source:[["src/SquawkCenter.jsx","squawk_messages"]],
    ui:[["src/PlatformApp.jsx","<SquawkProvider"]],
    tests:[],
    tables:["squawk_messages","squawk_threads","squawk_message_recipients"],
    next:"Add controlled delivery, recipient, notification and quiet-hours tests with no real Sandbox messages."},
  {id:"sponsors",title:"Sponsor Management",priority:"medium",
    source:[["src/EieEventSetupSteps.jsx","sponsors"]],
    ui:[["src/PlatformApp.jsx","sponsors"]],
    tests:[["tests/event-builder-browser.cjs","sponsors"]],
    tables:["sponsors","sponsorship_products","sponsor_purchases"],
    next:"Check sponsorship pricing, visible sponsor assets and whether changes flow through event registration."},
  {id:"event-packet",title:"Creative Event Packets",priority:"medium",
    source:[["src/components/EventPacketStudio.jsx","function EventPacketStudio"]],
    ui:[["src/PlatformApp.jsx","<EventPacketStudio"]],
    tests:[],
    tables:["event_builder_assets","event_builder_asset_audit"],
    next:"Test packet creation, saving, PDF/export and re-open without relying on source evidence alone."},
  {id:"event-budget",title:"Event Budget",priority:"medium",
    source:[["src/components/EventBudget.jsx","function EventBudget"]],
    ui:[["src/PlatformApp.jsx","<EventBudget"]],
    tests:[],
    tables:["eie_event_budgets","eie_event_budget_versions"],
    next:"Run a Sandbox budget save/reopen and arithmetic check; confirm links to Event Builder."},
  {id:"inception",title:"InceptionApex Creative Studio",priority:"medium",
    source:[["src/components/InceptionApex.jsx","function InceptionApex"]],
    ui:[["src/PlatformApp.jsx","<InceptionApex"]],
    tests:[["tests/inception-apex-browser.cjs","chromium.launch"]],
    tables:["inception_projects","inception_project_versions"],
    next:"Reuse the existing InceptionApex Source Inspector and verify actual Save, Approve, and Reopen UI flows."},
  {id:"social",title:"Social Media & Ads",priority:"medium",
    source:[["src/components/SocialMediaApp.jsx","function SocialMediaApp"]],
    ui:[["src/PlatformApp.jsx","<SocialMediaApp"]],
    tests:[["tests/social-media-browser.cjs","chromium.launch"]],
    tables:["social_campaigns","social_campaign_versions"],
    next:"Verify campaign draft persistence, creative links, target dates and authorized publication controls."},
  {id:"build-lab",title:"Build Lab",priority:"medium",
    source:[["src/components/EigBuildLab.jsx","function EigBuildLab"]],
    ui:[["src/PlatformApp.jsx","<EigBuildLab"]],
    tests:[["tests/eig-build-lab-browser.cjs","chromium.launch"]],
    tables:[],
    next:"Preserve owner-only access, local draft decisions and reproducible read-only scan reports."},
  {id:"maps",title:"Course Maps & Flyovers",priority:"medium",
    source:[["src/components/EventPacketStudio.jsx","map"]],
    ui:[["src/PlatformApp.jsx","<EventPacketStudio"]],
    tests:[],
    tables:["event_builder_assets"],
    next:"Check maps, yardage-book output and flyovers separately. A mention of maps does not establish a working GPS or 3D flyover."},
  {id:"invoices",title:"EIG Invoicing",priority:"high",
    source:[["src/PlatformApp.jsx","issueInvoice("]],
    ui:[["src/PlatformApp.jsx","<EigInvoice"]],
    tests:[],
    tables:["invoices","invoice_lines"],
    next:"Confirm invoice issuing is not already implemented elsewhere before planning EIG payee, invoice numbers, terms and payments."},
  {id:"contracts",title:"Event Contracts",priority:"medium",
    source:[["src/PlatformApp.jsx","contract"]],
    ui:[["src/PlatformApp.jsx","<EventContract"]],
    tests:[],
    tables:["contracts"],
    next:"Inspect Event Builder contract UI, agreement versioning and signature workflow before creating a new module."},
]);

function readAllowlistedMasterSource() {
  const sources = {};
  let total = 0;
  for (const relative of FILE_PATHS) {
    const contents = fs.readFileSync(path.resolve(__dirname,"..",relative),"utf8");
    if (!contents.trim() || contents.length > 400000)
      throw new Error("Master Scanner source file missing or exceeds bound: "+relative);
    total += contents.length;
    if (total > 1350000) throw new Error("Master Scanner source total exceeds bound");
    sources[relative] = contents;
  }
  return sources;
}

function evidenceFor(files, tuples, kind) {
  return tuples.map(([file,needle]) => {
    const src = files[file];
    if (typeof src !== "string") return null;
    const at = src.indexOf(needle);
    if (at === -1) return null;
    const line = src.slice(0,at).split("\n").length;
    const excerpt = src.split("\n")[line-1].trim().slice(0,160);
    return {kind,path:file,line,excerpt};
  }).filter(Boolean);
}

function scanMasterSource(sources,sourceVersion="local-unversioned",inspectedAt=new Date().toISOString(),moduleId=null) {
  if (!sources || typeof sources !== "object") throw new TypeError("Source map required");
  // Narrow the report to a catalogued module. The underlying source read
  // remains the same fixed allowlist. Never permit arbitrary paths or targets.
  if (moduleId !== null && !MODULES.some(rule=>rule.id===moduleId))
    throw new Error("Unsupported Master Scanner module.");
  if (!(sourceVersion==="local-unversioned" || /^[a-f0-9]{40}$/i.test(sourceVersion)))
    throw new Error("Invalid source version");
  if (schemaSnapshot.schemaVersion!==1 || !Array.isArray(schemaSnapshot.tables?.production) ||
      !Array.isArray(schemaSnapshot.tables?.sandbox)) throw new Error("Schema snapshot unavailable");
  const files = FILE_PATHS.map(p=>{
    const data=sources[p];
    if(typeof data!=="string" || !data.trim() || data.length>400000) throw new Error("Required source unavailable: "+p);
    return {path:p,lines:data.split("\n").length,kind:p.startsWith("tests/")?"test":"source"};
  });
  const fingerprint=createHash("sha256");
  for(const f of FILE_PATHS) fingerprint.update(f+"\0"+sources[f]+"\0");
  fingerprint.update(JSON.stringify(schemaSnapshot)+"\0");
  const prod=new Map(schemaSnapshot.tables.production.map(x=>[x.table,x]));
  const sandbox=new Map(schemaSnapshot.tables.sandbox.map(x=>[x.table,x]));
  const modules=MODULES.filter(rule=>moduleId===null||rule.id===moduleId).map(rule=>{
    const src=evidenceFor(sources,rule.source,"source");
    const ui=evidenceFor(sources,rule.ui,"ui");
    const tests=evidenceFor(sources,rule.tests,"test");
    const db=rule.tables.map(table=>({
      table,production:prod.has(table),sandbox:sandbox.has(table),
      provenance:"captured_database_metadata_snapshot"
    }));
    const status=(!src.length)?"not_observed_in_sample":
      (!ui.length||(!tests.length&&rule.tests.length)||db.some(x=>!x.production||!x.sandbox))
        ?"review_needed":"evidence_present";
    return {
      id:rule.id,title:rule.title,priority:rule.priority,status,
      sourceStatus:src.length?"source_marker_found":"not_observed_in_sample",
      uiStatus:ui.length?"ui_marker_found":"not_observed_in_sample",
      testStatus:!rule.tests.length?"not_sampled":tests.length?"test_code_found":"not_observed_in_sample",
      dbStatus:!rule.tables.length?"not_applicable":
        db.every(x=>x.production&&x.sandbox)?"tables_in_dated_snapshot":"snapshot_gap",
      evidence:[...src,...ui,...tests],tables:db,nextCheck:rule.next,
    };
  });
  const policyDifferences=[...prod.entries()].filter(([name,p])=>{
    const sb=sandbox.get(name);
    return sb&&(p.policies!==sb.policies||p.rls!==sb.rls);
  }).map(([table,p])=>({table,productionPolicies:p.policies,sandboxPolicies:sandbox.get(table).policies,
    productionRls:p.rls,sandboxRls:sandbox.get(table).rls}));
  const missingInSandbox=[...prod.keys()].filter(name=>!sandbox.has(name));
  const missingInProduction=[...sandbox.keys()].filter(name=>!prod.has(name));
  const rlsDisabled={production:[...prod.values()].filter(x=>!x.rls).map(x=>x.table),
    sandbox:[...sandbox.values()].filter(x=>!x.rls).map(x=>x.table)};
  return {
    schemaVersion:1,kind:"eig_build_lab_master_scan",target:"elevationpilot",
    scope:moduleId===null?"full":"module",selectedModule:moduleId,
    scannerVersion:"source-plus-dated-schema-v1",sourceVersion,inspectedAt,
    sourceFingerprint:fingerprint.digest("hex"),files,modules,
    summary:{
      modulesReviewed:modules.length,
      evidencePresent:modules.filter(x=>x.status==="evidence_present").length,
      reviewNeeded:modules.filter(x=>x.status==="review_needed").length,
      notObservedInSample:modules.filter(x=>x.status==="not_observed_in_sample").length,
    },
    database:{
      capturedOn:schemaSnapshot.capturedOn,freshLiveQuery:false,
      provenance:"read_only_supabase_metadata_snapshot",
      productionTables:prod.size,sandboxTables:sandbox.size,
      missingInSandbox,missingInProduction,rlsDisabled,policyDifferences,
    },
    limitations:[
      "Source patterns prove only that code, routes or tests are declared; they do not prove behavior, test success, or complete coverage.",
      "Database information is a point-in-time metadata snapshot, NOT a new Supabase query when this button is pressed.",
      "This scan does not crawl websites, visit authenticated Sandbox pages, execute payments, send messages or run an external AI model.",
      "A missing marker in these allowlisted files is not evidence the feature is absent from the full repository.",
    ],
    safety:{readOnly:true,liveChanges:false,autoApproved:false,autoDeployed:false,customerRowsRead:false},
  };
}
module.exports={FILE_PATHS,MODULES,readAllowlistedMasterSource,scanMasterSource};
