// ElevationPilot Master Scanner v1. Read-only, bounded first-party source evidence
// plus an explicitly dated, metadata-only Supabase schema snapshot.
// Never accepts arbitrary paths, URLs, SQL, source code or third-party targets.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const {sourceViews,SOURCE_RECOGNIZER_VERSION}=require("./build-lab-source-patterns.cjs");
const schemaSnapshot = require("./eig-master-schema-snapshot.json");
const {buildEnvironmentAudit}=require("./eig-master-environment-compare.cjs");
const {runImprovementRadar,RADAR_RULES}=require("./eig-essential-wow-scan.cjs");

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
  "src/lib/epInvoiceDraft.mjs",
  "src/components/EpInvoicePilot.jsx",
  "src/components/SponsorBuilder.jsx",
  "tests/ep-invoice-draft.test.mjs",
  "src/lib/epProductCapture.mjs",
  "src/components/EpProductCapturePilot.jsx",
  "src/components/EpDiscoveryPilot.jsx",
  "tests/ep-product-capture.test.mjs",
  "src/lib/epCommerceContractReadiness.mjs",
  "tests/ep-commerce-contract-readiness.test.mjs",
]);

// A matched file/line proves the code or test instruction exists, NOT that a
// flow ran successfully. Missing markers mean "not observed in this sample."
const MODULES = Object.freeze([
  {id:"event-builder",title:"Event Builder",priority:"high",
    source:[["src/EieEventSetupSteps.jsx","function EieEventSetupSteps"]],
    ui:[["src/PlatformApp.jsx","<EieEventSetupSteps"]],
    // A browser launching proves nothing about Step 1/2 persistence. Require
    // explicit saved Event Details, Registration, and reopening test actions.
    tests:[
      ["tests/event-builder-browser.cjs",'"Save Event Details"',"getByRole"],
      ["tests/event-builder-browser.cjs",'"Save Registration"',"getByRole"],
      ["tests/event-builder-browser.cjs",'"Players per team"',"getByLabel"],
    ],
    tables:["events","golf_registration_events","event_offers","golf_event_payment_settings"],
    next:"Inspect Event Details and Registration save/reopen assertions independently of Event Packet Studio. Locate equivalent existing coverage before adding synthetic event creation and field-persistence tests; matching locators alone do not verify the setup wizard."},
  {id:"registration",title:"Team Registration & Main Cabin",priority:"high",
    source:[["src/ElevationAirport.jsx","function MainCabinPage"]],
    ui:[["src/PlatformApp.jsx","<MainCabinPage"]],
    tests:[["tests/roster-numbering.test.mjs","confirmed-only exports preserve original Team IDs","test"]] ,
    tables:["golf_registration_teams","golf_registrations","golf_team_invitations"],
    next:"Test captain invites, claim/replacement, cancellations and numbering using fictional Sandbox golfers."},
  {id:"payments",title:"Team Payments & Split Payments",priority:"high",
    source:[["src/EieEventSetupSteps.jsx","golf_event_payment_settings"]],
    ui:[["src/PlatformApp.jsx","<EieEventSetupSteps"]],
    tests:[["tests/team-payment-cart.test.mjs","partial payment shows remaining due","test"],["tests/team-payment-cart.test.mjs","refund reopens unpaid share","test"]],
    tables:["golf_team_payment_shares","golf_event_payment_settings"],
    next:"Verify split-payment states and clubhouse-payment instructions in Sandbox; never create live charges."},
  {id:"roster",title:"Roster & Team Maintenance",priority:"high",
    source:[["src/EieRosterMaintenance.jsx","function EieRosterMaintenance"]],
    ui:[["src/PlatformApp.jsx","<EieRosterMaintenance"]],
    tests:[["tests/roster-numbering.test.mjs","moving a golfer updates the derived number","test"],["tests/roster-numbering.test.mjs","invalid team IDs or overfull rosters","test"]],
    tables:["golf_registrations","golf_registration_teams"],
    next:"Exercise add, remove, replace, TBA, withdrawn teams and stable team numbers in Sandbox."},
  {id:"accounts",title:"Accounts & Permissions",priority:"high",
    source:[["src/PlatformApp.jsx","createSessionVerifier"]],
    ui:[["src/PlatformApp.jsx","<LoginScreen"]],
    tests:[["tests/recovery-session.test.mjs","recovery hint alone cannot authorize","test"],["tests/recovery-session.test.mjs","cross-account reset only uses","test"]],
    tables:["profiles","organization_memberships","platform_invitations"],
    next:"Verify owner, Pilot, Co-Pilot, ATC and Passenger permissions with separate Sandbox accounts."},
  {id:"squawk",title:"Squawk Box Communications",priority:"high",
    source:[["src/SquawkCenter.jsx","squawk_messages"]],
    ui:[["src/PlatformApp.jsx","<SquawkProvider"]],
    tests:[],
    tables:["squawk_messages","squawk_threads","squawk_message_recipients"],
    next:"Add controlled delivery, recipient, notification and quiet-hours tests with no real Sandbox messages."},
  {id:"sponsors",title:"Sponsor Management",priority:"medium",
    source:[["src/EieEventSetupSteps.jsx",'value="sponsorship"',"code"]],
    ui:[["src/PlatformApp.jsx","setupSponsors.map","code"]],
    tests:[],
    tables:["sponsors","sponsorship_products","sponsor_purchases"],
    next:"Check sponsorship pricing, visible sponsor assets and whether changes flow through event registration."},
  {id:"event-packet",title:"Creative Event Packets",priority:"medium",
    source:[["src/components/EventPacketStudio.jsx","function EventPacketStudio"]],
    ui:[["src/PlatformApp.jsx","<EventPacketStudio"]],
    tests:[
      ["tests/event-builder-browser.cjs",'"Save event packet"',"getByRole"],
      ["tests/event-builder-browser.cjs","await page.reload()"],
    ],
    tables:["event_builder_assets","event_builder_asset_audit"],
    next:"Inspect packet save/reopen and export assertions and the exact-commit run result. Verify the authorized Sandbox flow with isolated assets when needed; matching source references alone do not establish persistence."},
  {id:"event-budget",title:"Event Budget",priority:"medium",
    source:[["src/components/EventBudget.jsx","function EventBudget"]],
    ui:[["src/PlatformApp.jsx","<EventBudget"]],
    tests:[],
    tables:["eie_event_budgets","eie_event_budget_versions"],
    next:"Run a Sandbox budget save/reopen and arithmetic check; confirm links to Event Builder."},
  {id:"inception",title:"InceptionApex Creative Studio",priority:"medium",
    source:[["src/components/InceptionApex.jsx","function InceptionApex"]],
    ui:[["src/PlatformApp.jsx","<InceptionApex"]],
    tests:[["tests/inception-apex-browser.cjs",'"Save to My Designs"',"getByRole"],["tests/inception-apex-browser.cjs",'"Save & approve design"',"getByRole"],["tests/inception-apex-browser.cjs","page.reload("]],
    tables:["inception_projects","inception_project_versions"],
    next:"Reuse the existing InceptionApex Source Inspector and verify actual Save, Approve, and Reopen UI flows."},
  {id:"social",title:"Social Media & Ads",priority:"medium",
    source:[["src/components/SocialMediaApp.jsx","function SocialMediaApp"]],
    ui:[["src/PlatformApp.jsx","<SocialMediaApp"]],
    tests:[["tests/social-media-browser.cjs",'"Save draft"',"getByRole"],["tests/social-media-browser.cjs","page.reload("]],
    tables:["social_campaigns","social_campaign_versions"],
    next:"Verify campaign draft persistence, creative links, target dates and authorized publication controls."},
  {id:"build-lab",title:"Build Lab",priority:"medium",
    source:[["src/components/EigBuildLab.jsx","function EigBuildLab"]],
    ui:[["src/PlatformApp.jsx","<EigBuildLab"]],
    tests:[["tests/eig-build-lab-browser.cjs",'"Return to Build Lab"',"getByRole"],["tests/eig-build-lab-browser.cjs",'"Download reusable JSON"',"getByRole"]],
    tables:[],
    next:"Preserve owner-only access, local draft decisions and reproducible read-only scan reports."},
  {id:"maps",title:"Course Maps & Flyovers",priority:"medium",
    source:[["src/components/EventPacketStudio.jsx",'className="course-map-canvas"'],["src/components/EventPacketStudio.jsx","<CourseMap"]],
    ui:[["src/PlatformApp.jsx","<EventPacketStudio"]],
    tests:[],
    tables:["event_builder_assets"],
    next:"Check maps, yardage-book output and flyovers separately. A mention of maps does not establish a working GPS or 3D flyover."},
  {id:"invoices",title:"Universal Invoicing",priority:"high",
    // Proof the *demo* exists, not proof a real invoice was issued.
    source:[
      ["src/lib/epInvoiceDraft.mjs","export function prepareDemoInvoice"],
      ["src/components/SponsorBuilder.jsx","invoice_sent"],
    ],
    ui:[
      ["src/components/EpInvoicePilot.jsx","function EpInvoicePilot"],
      ["src/components/EigBuildLab.jsx","<EpInvoicePilot"],
    ],
    tests:[
      ["tests/ep-invoice-draft.test.mjs","simulated partial payments","test"],
      ["tests/eig-build-lab-browser.cjs",'"Manual Invoice Builder"',"getByRole"],
    ],
    tables:["billing_accounts","eig_credit_ledger","invoices","invoice_lines"],
    next:"The sampled manual invoice builder provides DEMO ONLY evidence. Check for an existing shared invoice ledger before adding one, and independently verify persistence, approved issuer, server-issued immutable numbering and line snapshots. Test save/reopen, PDF, simulated receipts/payments and Hangar boundaries. Snapshot gaps and delivery/tax readiness require separate evidence."},
  {id:"product-registry",title:"Product Capture & Inventory Double Sync",priority:"high",
    source:[
      ["src/lib/epProductCapture.mjs","export function checkExistingProducts"],
      ["src/lib/epProductCapture.mjs","export function previewDoubleSync"],
    ],
    ui:[
      ["src/components/EpProductCapturePilot.jsx","function EpProductCapturePilot"],
      ["src/components/EpDiscoveryPilot.jsx","<EpProductCapturePilot"],
    ],
    tests:[
      ["tests/ep-product-capture.test.mjs","approve fictional missing invoice sale exactly once","test"],
      ["tests/eig-build-lab-browser.cjs",'"Export reconciliation preview"',"getByRole"],
    ],
    tables:["catalog_items","inventory_movements","invoice_lines"],
    next:"Product Capture has fictional owner-only demo evidence in this sample. Verify whether real imports, image analysis, invoice links or stock movements exist elsewhere before planning them. Check product identity versus platform entitlements, variant/location balances, per-source order-line keys, external inventory authority and cross-Hangar reconciliation using isolated tests."},
  {id:"contracts",title:"Agreements & DocuSign",priority:"high",
    source:[["src/lib/epCommerceContractReadiness.mjs","export function agreementRequirementsForSale"]],
    ui:[["src/PlatformApp.jsx","<EventContract"]],
    tests:[["tests/ep-commerce-contract-readiness.test.mjs","venue rental, vendor and sale-level contract policies"]],
    tables:["contracts","agreement_template_versions","agreement_line_links","signature_envelopes"],
    next:"Inspect agreement-obligation planning separately from agreement UI, approved templates and a signed-envelope lifecycle. Verify existing tenant-owned versions, sale-line joins, permissions and mocked webhook handling before building duplicates. Provider template status and approval must be checked independently; source markers establish neither."},
  {id:"pos-tax",title:"POS, Catalog & Tax Hierarchy",priority:"high",
    source:[
      ["src/lib/epCommerceContractReadiness.mjs","export function taxReadiness"],
      ["src/lib/epCommerceContractReadiness.mjs","export function validateCatalogHierarchy"],
    ],
    ui:[],
    tests:[
      ["tests/ep-commerce-contract-readiness.test.mjs","tax hierarchy inheritance is scoped","test"],
      ["tests/ep-commerce-contract-readiness.test.mjs","verified customer exemption still needs certificate","test"],
    ],
    tables:["catalog_items","catalog_categories","tax_profiles","order_lines","inventory_movements"],
    next:"Sampled POS/tax-readiness planning is blueprint only evidence. Investigate any existing catalog, tax rules, POS posting and inventory authority before proposing new implementation. Research current build/reuse options separately; exercise fictional mixed-category sales and rejected missing rules without declaring tax correctness or posting real transactions."},
]);

// These are verification obligations, never claims that the sampled tests cover
// every workflow or that an external service, template or schema is current.
const VERIFICATION=Object.freeze({
 'event-builder':{scope:'Event Details / Registration locator markers only; Event Packet Studio is a separate flow.',criteria:'Locate equivalent event-creation tests first. With isolated events, save and reopen Event Details and Registration settings; assert changed field values and team-size settings persist. Record expected versus actual behavior and exact-commit test results before proposing a fix.'},
 registration:{scope:'Roster-numbering unit-test declarations only; invitations and account claims are not exercised by this scan.',criteria:'Use fictional golfers and mocked delivery to verify captain invites, slot claims, replacement, cancellation and stable team IDs. Assert each actor reaches only the permitted team/slot and that reopening preserves the reviewed state; attach exact-commit results.'},
 payments:{scope:'Payment-cart calculation test declarations only; no processor, settlement or live charge verification.',criteria:'Use simulated payments to check split shares, captain-paid/TBA slots, partial payments, refunds and cent totals. Verify clubhouse instructions and reopened balances without live charges; attach exact-commit tests and reconcile expected versus actual amounts.'},
 roster:{scope:'Roster-numbering unit-test declarations only; maintenance UI coverage must be located separately.',criteria:'With isolated teams, verify add/remove/replace/TBA/withdraw behavior, stable IDs and derived numbering. Reopen the roster and verify affected payment/registration states. Locate equivalent existing tests first and attach exact-commit results.'},
 accounts:{scope:'Recovery-session unit-test declarations only; this does not verify the complete role/permission matrix.',criteria:'Use separate isolated accounts to test allowed and denied actions for owner, Pilot, Co-Pilot, ATC and Passenger. Check active-session and membership changes, recovery and cross-account denial at the server boundary; attach exact-commit results without broadening permissions.'},
 squawk:{scope:'No communication-test markers configured in this source sample.',criteria:'Locate communication tests first. With mocked delivery, verify recipient authorization, context, duplicate delivery handling, unread state and quiet hours. Assert forbidden recipients receive nothing; attach exact-commit results without sending real messages.'},
 sponsors:{scope:'No sponsorship pricing or purchase-flow test markers configured; packet artwork references are insufficient.',criteria:'Locate sponsorship tests first. Use fictional packages and simulated purchases to verify pricing, sponsor assets and registration links across save/reopen. Confirm the owning event and organization remain correct; attach exact-commit results without charges or publication.'},
 'event-packet':{scope:'Packet-save locator and reload markers only; persistence/export assertions and execution require independent review.',criteria:'Verify synthetic packet content survives save/reopen, export uses the reviewed version and event/product links stay correct. Confirm relevant assertions and the latest exact-commit test result; use isolated data for any authorized Sandbox walkthrough.'},
 'event-budget':{scope:'No budget-test markers configured here; tests elsewhere may already cover the workflow.',criteria:'Locate budget tests first. Save and reopen an isolated budget, assert quantities/totals and rounding, and verify the Event Builder link resolves to the same event. Attach exact-commit tests and expected versus actual arithmetic.'},
 inception:{scope:'Save/approval locator and reload markers only; use IA Inspector for its specific source questions.',criteria:'Verify Save, Reopen, version state and Approve with synthetic designs and assert the saved content. Reuse IA Inspector evidence and relevant browser regressions; attach exact-commit results rather than interpreting a browser launch as workflow verification.'},
 social:{scope:'Save-draft locator and reload markers only; external publication is not verified.',criteria:'With isolated campaign drafts, assert content, dates and creative links survive save/reopen. Verify publication controls enforce authorization and fail safely when disconnected, using mocked publication only; attach exact-commit results.'},
 'build-lab':{scope:'Synthetic navigation/draft-backup locator markers only; server owner authorization requires independent tests.',criteria:'Verify the exact owner can scan and retain drafts, decisions and bucket plans after reload. Assert nonowners and revoked sessions are denied at each privileged endpoint, and confirm exported reports retain source identity; attach exact-commit unit/browser evidence.'},
 maps:{scope:'No GPS, flyover or yardage-test markers configured; a course-map UI marker establishes none of those capabilities.',criteria:'Verify course-map upload and pin positions using isolated assets. Check yardage-book output, GPS and 3D flyovers as separate capabilities against current source and authorized runtime evidence; record unsupported areas before any build/reuse decision.'},
 invoices:{scope:'Fictional invoice calculation and preview-locator markers only; no issued invoice or persistent ledger is verified.',criteria:'Check current shared invoice/product capabilities before planning work. Using fictional issuers and simulated payments, verify save/reopen, immutable numbering, line snapshots and Hangar boundaries. Identify any real issuance/delivery/payment paths separately and attach exact-commit evidence without invoking them.'},
 'product-registry':{scope:'Fictional inventory-preview unit/locator markers only; imports and real stock movements are not verified.',criteria:'Check existing product identity, variants, stock locations and external inventory authority first. Simulate duplicate imports, repeated invoice lines, reversals and cross-Hangar attempts; assert one eligible sale creates at most one proposed deduction and attach exact-commit evidence before authorizing real stock writes.'},
 contracts:{scope:'Agreement-obligation planner unit-test markers only; signatures, provider templates and webhooks are unverified.',criteria:'Inspect current agreement UI, versioned templates and sale-line links before adding a module. Verify tenant boundaries, required approvals and a mocked envelope/webhook lifecycle. Check provider template status independently and attach exact-commit evidence without sending a real envelope.'},
 'pos-tax':{scope:'Catalog/tax-readiness planner unit-test markers only; no valid legal tax calculation or live POS posting is established.',criteria:'Check shared catalog hierarchy, inventory authority and verified tax-rule provenance. Use fictional mixed-category sales, exemptions and returns to test scoped readiness and rejection of missing rules. Research build/reuse options separately; attach exact-commit evidence without posting sales or declaring tax correctness.'},
});

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

function evidenceFor(files, tuples, kind,views) {
  const checks=tuples.map(([file,needle,method]) => {
    const src = files[file];
    const {text,code}=views[file];
    let at=-1;
    if(kind==='test'&&(method||file.endsWith('.test.mjs'))){
      const name=method||'test',expected=needle.replace(/^["']|["']$/g,'');
      const call=views[file].calls.find(c=>c.method===name&&(name==='test'?c.firstString?.includes(expected):c.values.some(v=>v.includes(expected))));
      at=call?.start??-1;
    }else{
      at=text.indexOf(needle);
      const codeAnchor=method==='code'||needle.startsWith('<')||/^(?:export |function |className=|await |page\.)/.test(needle);
      const needsBoundary=needle.startsWith('<')||/^(?:export )?function /.test(needle);
      while(at>=0&&((codeAnchor&&code[at]===' ')||(needsBoundary&&/[\w$.-]/.test(text[at+needle.length]||''))))at=text.indexOf(needle,at+needle.length);
    }
    const check={path:file,marker:needle,observed:at>=0};
    if(at<0)return {check,evidence:null};
    const line = src.slice(0,at).split("\n").length;
    const excerpt = src.split("\n")[line-1].trim().slice(0,160);
    return {check,evidence:{kind,path:file,line,excerpt}};
  });
  return {evidence:checks.map(c=>c.evidence).filter(Boolean),coverage:{expected:checks.length,observed:checks.filter(c=>c.check.observed).length,checks:checks.map(c=>c.check),runtimeVerified:false}};
}

function scanMasterSource(sources,sourceVersion="local-unversioned",inspectedAt=new Date().toISOString(),moduleId=null,environmentMode="compare") {
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
  // The rulebook is part of report identity. Changed coverage requirements
  // must reset prior owner decisions even if application source is unchanged.
  fingerprint.update(JSON.stringify(MODULES)+"\0");
  fingerprint.update(JSON.stringify(VERIFICATION)+'\0master-evidence-v3\0'+SOURCE_RECOGNIZER_VERSION+'\0');
  const environmentAudit=buildEnvironmentAudit({mode:environmentMode,moduleId,modules:MODULES});
  fingerprint.update(JSON.stringify(environmentAudit)+"\0");
  const improvementAudit=runImprovementRadar(sources,{moduleId,allowedFiles:FILE_PATHS,moduleIds:MODULES.map(rule=>rule.id),sourceVersion});
  fingerprint.update(JSON.stringify(RADAR_RULES)+"\0");
  const prod=new Map(schemaSnapshot.tables.production.map(x=>[x.table,x]));
  const sandbox=new Map(schemaSnapshot.tables.sandbox.map(x=>[x.table,x]));
  const views=Object.fromEntries(FILE_PATHS.map(file=>[file,sourceViews(sources[file])]));
  const modules=MODULES.filter(rule=>moduleId===null||rule.id===moduleId).map(rule=>{
    const source=evidenceFor(sources,rule.source,"source",views);
    const linked=evidenceFor(sources,rule.ui,"ui",views);
    const tested=evidenceFor(sources,rule.tests,"test",views);
    const src=source.evidence,ui=linked.evidence,tests=tested.evidence;
    const verification=VERIFICATION[rule.id];if(!verification)throw Error('Missing module verification contract.');
    const db=rule.tables.map(table=>({
      table,production:prod.has(table),sandbox:sandbox.has(table),
      provenance:"captured_database_metadata_snapshot"
    }));
    const sourceComplete=src.length===rule.source.length;
    const uiComplete=ui.length===rule.ui.length;
    const testComplete=!rule.tests.length||tests.length===rule.tests.length;
    const status=(!src.length)?"not_observed_in_sample":
      (!sourceComplete||!rule.ui.length||!uiComplete||!rule.tests.length||!testComplete||db.some(x=>!x.production||!x.sandbox))
        ?"review_needed":"evidence_present";
    return {
      id:rule.id,title:rule.title,priority:rule.priority,status,
      sourceStatus:!rule.source.length?'not_sampled':sourceComplete?'source_marker_found':src.length?'partial_source_markers':'not_observed_in_sample',
      uiStatus:!rule.ui.length?'not_sampled':uiComplete?'ui_marker_found':ui.length?'partial_ui_markers':'not_observed_in_sample',
      testStatus:!rule.tests.length?"not_sampled":
        tests.length===rule.tests.length?"test_code_found":
        tests.length?"partial_test_code":"not_observed_in_sample",
      dbStatus:!rule.tables.length?"not_applicable":
        db.every(x=>x.production&&x.sandbox)?"tables_in_dated_snapshot":"snapshot_gap",
      evidence:[...src,...ui,...tests],tables:db,nextCheck:rule.next,
      coverage:{source:source.coverage,ui:linked.coverage,test:tested.coverage},testScope:verification.scope,verify:verification.criteria,
      observation:`Preview sample markers: source ${src.length}/${rule.source.length}, UI ${ui.length}/${rule.ui.length}, tests ${tests.length}/${rule.tests.length}. Counts describe configured markers, not feature completeness or passing tests. Database evidence is dated ${schemaSnapshot.capturedOn}; no live workflow was executed.`,
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
    scannerVersion:"source-plus-deployed-environment-v3",sourceVersion,inspectedAt,
    sourceFingerprint:fingerprint.digest("hex"),files,modules,environmentAudit,improvementAudit,
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
      "Source patterns and matched/expected counts describe configured markers only, not feature completeness, behavior or test success. Bounded recognizers can miss equivalent syntax and tests elsewhere.",
      "Database information is a point-in-time metadata snapshot, NOT a new Supabase query when this button is pressed.",
      "This scan does not crawl websites, visit authenticated Sandbox pages, execute payments, send messages or run an external AI model.",
      "A missing marker in these allowlisted files is not evidence the feature is absent from the full repository.",
      "Live/Sandbox database schemas and deployed commit files are compared from dated verified metadata, not by visiting the running applications.",
      "Source/UI/test markers refer to the Build Lab preview code. Their presence does not verify either production deployment.",
      "Essentials & Wow upgrades are heuristic suggestions, not confirmed gaps. They are not AI or external competitor research.",
    ],
    safety:{readOnly:true,liveChanges:false,autoApproved:false,autoDeployed:false,customerRowsRead:false},
  };
}
module.exports={FILE_PATHS,MODULES,readAllowlistedMasterSource,scanMasterSource};
