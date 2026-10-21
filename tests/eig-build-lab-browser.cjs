const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

(async () => {
  const { createServer } = await import("vite");
  const server = await createServer({ server: { host: "127.0.0.1", port: 4198, strictPort: true } });
  await server.listen();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 950 }, acceptDownloads: true });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await fs.mkdir("test-results/eig-build-lab", { recursive: true });
    await page.goto("http://127.0.0.1:4198/tests/eig-build-lab.html");
    const toolNav=page.getByRole("navigation",{name:"Build Lab tools"});
    const chooseTool=name=>toolNav.getByRole("button",{name,exact:true}).click();
    assert.equal(await page.locator(".bl-tool-panel:visible").count(),1);
    assert.equal(await toolNav.getByRole("button",{name:"Master Scanner",exact:true}).getAttribute("aria-pressed"),"true");
    for(const name of ["Upgrade Radar","AI Review","IA Inspector","Research","Impact Review","Discoveries","Invoices","Project Architect"]){
      await chooseTool(name);
      assert.equal(await page.locator(".bl-tool-panel:visible").count(),1);
      assert.equal(await toolNav.getByRole("button",{name,exact:true}).getAttribute("aria-pressed"),"true");
    }
    await chooseTool("AI Review");
    let aiCalls=0;
    // AI recommendations are owner-clicked, source-only proposals.
    // Mock the provider-backed endpoint: browser tests must never spend money.
    await page.route("**/api/eig-build-lab-ai-review",async route=>{
      aiCalls++;
      const request=route.request();
      assert.deepEqual(request.postDataJSON(),{moduleId:"invoices"});
      assert.ok((request.headers().authorization||"").startsWith("Bearer "));
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
       ok:true,review:{kind:"eig_build_lab_ai_review",schemaVersion:1,moduleId:"invoices",
       sourceVersion:"a".repeat(40),summary:"Invoice data and signature gates require owner review.",
       model:"gpt-4.1-mini",usage:{input_tokens:100,output_tokens:60},
       recommendations:[{id:"ai-review-invoices-1",title:"Keep invoice snapshots immutable",
        why:"Invoice line database records are not yet verified.",
        nextAction:"Test authorized order line snapshots in isolated Sandbox.",
        evidenceFiles:["src/lib/epInvoiceDraft.mjs"],
        status:"unverified_proposal",ownerReview:"pending"}],
       safety:{ownerOnly:true,previewOnly:true,customerDataUploaded:false,rawSourceUploaded:false,
        externalResearch:false,readOnly:true,autoBuilt:false,autoApproved:false,autoDeployed:false}
       }})});
    });
    const aiPanel=page.getByRole("heading",{name:"OpenAI Connection & Scanner Review"}).locator("..");
    await aiPanel.getByLabel("Which module should AI review?").selectOption("invoices");
    await aiPanel.getByRole("button",{name:"Analyze this scanner module with AI"}).click();
    await aiPanel.getByText("Keep invoice snapshots immutable").waitFor();
    assert.match(await aiPanel.innerText(),/Pending owner review/);
    assert.match(await aiPanel.innerText(),/No changes applied/);
    assert.equal(aiCalls,1);
    await chooseTool("Master Scanner");
    await chooseTool("AI Review");
    await aiPanel.getByText("Keep invoice snapshots immutable").waitFor();
    assert.equal(aiCalls,1);
    await page.screenshot({path:"test-results/eig-build-lab/tool-navigation-desktop.png",fullPage:true});
    await chooseTool("Discoveries");
    await page.getByRole("heading", { name: /Build Lab Scanners & Tools/ }).waitFor();
    // Shared commerce prototype runs without API calls or real profiles.
    const discover=page.locator(".epd-root");
    await discover.getByRole("heading",{name:/My Likes \+ Marketplace Pilot/}).waitFor();
    assert.match(await discover.locator(".epd-safety").innerText(),/All vendors, products and prices are invented/);
    await discover.locator(".epd-category-grid").getByRole("button",{name:/Golf/}).click();
    const personalize=discover.getByLabel(/Use My Likes to personalize/);
    await personalize.check();
    await discover.locator(".epd-monthly-grid").getByLabel(/Style Club/).check();
    await discover.getByLabel(/monthly personalized recommendations digest/).check();
    await discover.getByRole("button",{name:"Preview monthly picks"}).click();
    await discover.getByText(/Your monthly picks \(preview only\)/).waitFor();
    assert.match(await discover.locator(".epd-preview").innerText(),/No subscription, email or payment/);
    await discover.getByRole("tab",{name:/Discoveries/}).click();
    await discover.getByRole("heading",{name:"Your Discoveries"}).waitFor();
    await discover.getByLabel("Search products").fill("cap");
    assert.equal(await discover.locator(".epd-offer").count(),1);
    await discover.getByLabel("Search products").fill("");
    await discover.locator(".epd-offer").first().getByRole("button",{name:/Save/}).click();
    await discover.getByText(/Saved demo wish list/).waitFor();
    await discover.locator(".epd-offer").first().getByRole("button",{name:"Add to Registry"}).click();
    await discover.getByRole("heading",{name:/AI Registry Concierge/}).waitFor();
    await discover.getByRole("button",{name:"Generate registry draft"}).click();
    await discover.getByText(/draft pending organizer review/).waitFor();
    await discover.getByRole("button",{name:"Approve draft in demo"}).click();
    await discover.getByText(/approved in demo not published/).waitFor();
    const registryWait=page.waitForEvent("download");
    await discover.getByRole("button",{name:"Download registry concept"}).click();
    const registryFile=await registryWait;
    const registryData=JSON.parse(await fs.readFile(await registryFile.path(),"utf8"));
    assert.equal(registryData.shareEnabled,false);
    assert.equal(registryData.notificationsSent,false);
    assert.equal(registryData.status,"approved_in_demo_not_published");
    await discover.getByRole("tab",{name:/Event Concierge/}).click();
    await discover.getByRole("heading",{name:/Build an event from vendor offers/}).waitFor();
    await discover.getByLabel("Event type").selectOption("golf");
    await discover.getByRole("button",{name:"Build vendor proposal"}).click();
    await discover.getByText(/Over example budget/).waitFor();
    const eventWait=page.waitForEvent("download");
    await discover.getByRole("button",{name:"Download event proposal concept"}).click();
    const eventFile=await eventWait;
    const eventData=JSON.parse(await fs.readFile(await eventFile.path(),"utf8"));
    assert.equal(eventData.attendees,100);
    assert.equal(eventData.booked,false);
    assert.equal(eventData.charged,false);
    assert.equal(eventData.notificationsSent,false);
    // Connect My Store is a link-only, fictional browser preview. It must
    // never crawl or import the example merchant's catalog.
    await discover.getByRole("tab",{name:/Connect My Store/}).click();
    await discover.getByRole("heading",{name:/Connect My Store · Vendor Hub/}).waitFor();
    await discover.getByLabel("E-commerce platform").selectOption("shopify");
    await discover.getByLabel("Store display name").fill("Fictional Demo Shopify");
    await discover.getByLabel("Public HTTPS store or product URL")
      .fill("https://synthetic-catalog.myshopify.com/products/polo?private=untrusted");
    await discover.getByRole("button",{name:"Add storefront link draft"}).click();
    await discover.getByText(/Storefront link added to this demo only/).waitFor();
    await discover.locator(".ep-store-card").getByText("Fictional Demo Shopify").waitFor();
    assert.equal(await discover.locator(".ep-store-card").count(),1);
    assert.equal((await discover.locator(".ep-store-card").innerText()).includes("private=untrusted"),false);
    await discover.getByLabel("E-commerce platform").selectOption("etsy");
    await discover.getByLabel("Store display name").fill("Fictional Gift Vendor");
    await discover.getByLabel("Public HTTPS store or product URL").fill("https://www.etsy.com/shop/syntheticgifts");
    await discover.getByRole("button",{name:"Add storefront link draft"}).click();
    assert.equal(await discover.locator(".ep-store-card").count(),2);
    await discover.getByLabel("Search linked stores").fill("shopify");
    assert.equal(await discover.locator(".ep-store-card").count(),1);
    await discover.getByLabel("Search linked stores").fill("");
    await discover.getByLabel("Sort stores").selectOption("platform");
    const storesWait=page.waitForEvent("download");
    await discover.getByRole("button",{name:"Export store link drafts"}).click();
    const storesFile=await storesWait;
    const storesData=JSON.parse(await fs.readFile(await storesFile.path(),"utf8"));
    assert.equal(storesData.realConnections,false);
    assert.equal(storesData.paymentCollection,false);
    assert.equal(storesData.stores.length,2);
    assert.ok(storesData.stores.every(x=>x.ownerVerified===false&&x.apiConnected===false&&x.productsImported===0));
    // One commerce shell serves ordinary Hangar commerce, nonprofit, and event fundraising.
    // A beneficiary can be distinct from the proposed merchandise seller. No payments.
    await discover.getByRole("tab",{name:/Store Structures/}).click();
    await discover.getByRole("heading",{name:/Universal Stores · Hangars, Nonprofits & Fundraisers/}).waitFor();
    const stores=discover.locator(".epu-root");
    await stores.getByRole("button",{name:/Fundraiser Store/}).click();
    await stores.getByLabel("Store name").fill("Fictional Golf Benefit Store");
    await stores.getByLabel("Nonprofit beneficiary").selectOption("demo-education-fund");
    await stores.getByRole("button",{name:"Create store demo draft"}).click();
    await stores.locator(".epu-preview").getByText("Fictional Golf Benefit Store").waitFor();
    await stores.locator(".epu-preview").getByText("Bright Futures Fund (fictional demo)").waitFor();
    await stores.locator(".epu-preview").getByText("Not established").waitFor();
    await stores.locator(".epu-catalog-row").filter({hasText:"One-time Contribution Intent"})
      .getByRole("button",{name:"Add to store"}).click();
    await stores.locator(".epu-draft-list").getByText("One-time Contribution Intent").waitFor();
    await stores.locator(".epu-catalog-row").filter({hasText:"Embroidered Golf Cap"})
      .getByRole("button",{name:"Add to store"}).click();
    await stores.getByRole("button",{name:"Approve draft in demo"}).click();
    await stores.locator(".epu-preview").getByText("approved in demo not published").waitFor();
    const commonStoreDownload=page.waitForEvent("download");
    await stores.getByRole("button",{name:"Download store concept JSON"}).click();
    const unifiedStoreFile=await commonStoreDownload;
    const unifiedStore=JSON.parse(await fs.readFile(await unifiedStoreFile.path(),"utf8"));
    assert.equal(unifiedStore.demo.type,"fundraiser");
    assert.equal(unifiedStore.draft.ownerOrganizationId,"demo-fairway-hangar");
    assert.equal(unifiedStore.draft.beneficiaryOrganizationId,"demo-education-fund");
    assert.equal(unifiedStore.draft.items.length,2);
    assert.equal(unifiedStore.draft.customerFundsTransferred,false);
    assert.equal(unifiedStore.draft.liveCheckoutEnabled,false);
    assert.equal(unifiedStore.draft.taxReceiptsEnabled,false);
    assert.equal(unifiedStore.draft.moneyRules.settlementRecipientOrganizationId,null);
    await stores.getByRole("button",{name:/Nonprofit Store/}).click();
    await stores.getByRole("button",{name:"Create store demo draft"}).click();
    await stores.locator(".epu-preview").getByText("Nonprofit Store").waitFor();
    assert.equal(await stores.getByLabel("Organization / Hangar owner").inputValue(),"demo-community-cause");
    await stores.getByRole("button",{name:/Hangar Store/}).click();
    await stores.getByRole("button",{name:"Create store demo draft"}).click();
    await stores.locator(".epu-preview").getByText("ordinary Hangar commerce").waitFor();
    assert.equal(await stores.locator(".epu-catalog-row").filter({hasText:"One-time Contribution Intent"}).count(),0);
    // Product Capture reuses the seller's catalog identity. It never imports
    // copyrighted merchant data or uploads camera images or mutates live stock.
    await discover.getByRole("tab",{name:/Product Capture/}).click();
    const capture=discover.locator(".epc-root");
    await capture.getByRole("heading",{name:/Smart Product Capture/}).waitFor();
    await capture.getByRole("button",{name:"Find online / product link"}).click();
    await capture.getByLabel(/public HTTPS product listing link/)
      .fill("https://synthetic-store.example.org/products/cap?ref=secret-token");
    await capture.getByRole("button",{name:"Review product for duplicates"}).click();
    await capture.getByText(/Matching SKU found in this Hangar/).waitFor();
    const captureReview=capture.locator(".epc-capture-result");
    const productExportReady=page.waitForEvent("download");
    await capture.getByRole("button",{name:"Export product draft JSON"}).click();
    const captureDownload=await productExportReady;
    const captureData=JSON.parse(await fs.readFile(await captureDownload.path(),"utf8"));
    assert.equal(captureData.draft.externalUrl,"https://synthetic-store.example.org/products/cap");
    assert.equal(captureData.draft.catalogProductCreated,false);
    assert.equal(captureData.draft.inventoryPosted,false);
    assert.equal(captureData.photosIncluded,false);
    assert.deepEqual(captureData.match.exactSkuIds,["demo-product-golf-cap"]);
    await captureReview.getByRole("button",{name:/Link this existing item/}).click();
    await captureReview.getByText(/second catalog product was NOT created/).waitFor();
    await capture.getByRole("button",{name:"Photo / phone camera"}).click();
    const onePixel=Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/aZ9sAAAAASUVORK5CYII=",
      "base64");
    await capture.getByLabel("Choose product photos").setInputFiles([
      {name:"cap-from-phone.png",mimeType:"image/png",buffer:onePixel}
    ]);
    await capture.getByRole("button",{name:"Review product for duplicates"}).click();
    await capture.locator(".epc-capture-result").getByText(/1 local photo/).waitFor();
    const phoneExportWait=page.waitForEvent("download");
    await capture.getByRole("button",{name:"Export product draft JSON"}).click();
    const phoneFile=await phoneExportWait;
    const phoneExport=JSON.parse(await fs.readFile(await phoneFile.path(),"utf8"));
    assert.equal(phoneExport.draft.photoInfos[0].fileName,"cap-from-phone.png");
    assert.equal(phoneExport.draft.photoInfos[0].uploaded,false);
    assert.equal(phoneExport.photosIncluded,false);
    assert.equal(phoneExport.realInventoryChanged,false);
    // Double Sync: an already-accounted Shopify sale must never deduct again.
    const sync=capture.locator(".epc-double-sync");
    const syncRow=sync.locator(".epc-sale").filter({hasText:"invoice 107"});
    await syncRow.getByRole("button",{name:"Approve sample deduction"}).click();
    await sync.getByText(/Current illustrative on-hand/).waitFor();
    const doubleSyncWait=page.waitForEvent("download");
    await sync.getByRole("button",{name:"Export reconciliation preview"}).click();
    const syncFile=await doubleSyncWait;
    const syncData=JSON.parse(await fs.readFile(await syncFile.path(),"utf8"));
    assert.equal(syncData.stockActualChange,0);
    assert.equal(syncData.ledger.length,2);
    assert.equal(syncData.ledger.at(-1).delta,-2);
    assert.equal(syncData.preview.pendingCount,0);
    assert.equal(syncData.preview.proposals.find(x=>x.saleId==="demo-sale-shopify-209").decision,
      "already_accounted_no_double_deduction");
    assert.equal(syncData.preview.proposals.find(x=>x.saleId==="demo-sale-invoice-107").decision,
      "already_accounted_no_double_deduction");
    await capture.locator(".epc-sale").filter({hasText:"invoice 107"})
      .getByText("No new stock deduction").waitFor();
    await page.screenshot({path:"test-results/eig-build-lab/product-capture-desktop.png",fullPage:true});
    await discover.getByRole("tab",{name:/My Likes/}).click();
    await page.screenshot({path:"test-results/eig-build-lab/commerce-pilot-desktop.png",fullPage:true});

    // Manual Invoice Builder is a protected preview, not an issued invoice.
    // A realistic business invoice must still pass server-side numbering/RLS and delivery gates.
    await chooseTool("Invoices");
    const invoice=page.locator(".epi-root");
    await invoice.getByRole("heading",{name:/Manual Invoice Builder/}).waitFor();
    await invoice.getByLabel("Invoice issuer / Hangar").selectOption("demo-hangar");
    await invoice.getByLabel("Source / business activity").selectOption("sponsorship");
    await invoice.getByLabel("Customer / billed organization").fill("Fictional Golf Sponsor");
    await invoice.getByLabel("Reference / event").fill("Example Charity Golf Event");
    await invoice.getByLabel("Illustrative tax rate (%), not verified").fill("7");
    await invoice.getByRole("button",{name:/Add line/}).click();
    const second=invoice.locator(".epi-input-line").nth(1);
    await second.getByLabel(/description/).fill("Extra tee sign");
    await second.getByLabel("Quantity").fill("2");
    await second.getByLabel("Unit price ($)").fill("45.75");
    await invoice.getByRole("button",{name:"Create manual invoice preview"}).click();
    await invoice.locator(".epi-print-preview").getByText("Fictional Golf Sponsor").waitFor();
    await invoice.locator(".epi-grand").getByText("$231.66").waitFor();
    await invoice.getByRole("button",{name:"Copy sample email wording"}).click();
    assert.match(await invoice.locator(".epi-sharing textarea").inputValue(),/DEMO ONLY/);
    await invoice.getByRole("button",{name:"Copy sample text wording"}).click();
    await page.waitForFunction(() => document.querySelector(".epi-sharing textarea")?.value.includes("Not issued, payable or sent"));
    await invoice.getByRole("button",{name:"Approve preview in demo"}).click();
    await invoice.getByLabel(/Example payment amount/).fill("31.66");
    await invoice.getByRole("button",{name:"Simulate payment"}).click();
    await invoice.locator(".epi-print-preview").getByText("$200.00").waitFor();
    const invoiceWait=page.waitForEvent("download");
    await invoice.getByRole("button",{name:"Export draft JSON"}).click();
    const invoiceFile=await invoiceWait;
    const invoiceData=JSON.parse(await fs.readFile(await invoiceFile.path(),"utf8")).invoice;
    assert.equal(invoiceData.issuerId,"demo-hangar");
    assert.equal(invoiceData.status,"approved_in_demo_not_issued");
    assert.equal(invoiceData.totalCents,23166);
    assert.equal(invoiceData.simulatedPaymentCents,3166);
    assert.equal(invoiceData.balanceExampleCents,20000);
    assert.equal(invoiceData.actualInvoiceIssued,false);
    assert.equal(invoiceData.realCustomerContacted,false);
    assert.equal(invoiceData.publicPaymentUrl,null);
    assert.equal(invoiceData.verifiedPaidCents,0);
    await page.screenshot({path:"test-results/eig-build-lab/invoice-pilot-desktop.png",fullPage:true});
    await chooseTool("AI Review");
    await chooseTool("Invoices");
    assert.equal(await invoice.getByLabel("Customer / billed organization").inputValue(),"Fictional Golf Sponsor");
    await invoice.locator(".epi-print-preview").getByText("$200.00").waitFor();
    await chooseTool("Master Scanner");
    // Master Scanner gets its own owner-authenticated, read-only client path.
    // This fixture checks UI/search/review persistence. Separate unit tests
    // read the committed source, compare actual dated database metadata and
    // test server-side authorization before any files are read.
    const demoLive={
      label:"ElevationPilot Live",vercelProject:"elevated-impact-platform",
      gitRef:"main",deployedCommit:"a".repeat(40),
      deploymentHost:"elevated-impact-platform-preview.vercel.app",
      tables:71,functions:38,rlsDisabled:[],
      relevantTables:[{table:"events",columns:26,policies:4,indexes:3,rlsEnabled:true}],
      missingRelevantTables:[],
    };
    const demoSandbox={...demoLive,label:"ElevationPilot Sandbox",
      vercelProject:"elevationpilot-sandbox",gitRef:"feature/sandbox-readonly-live-ui-20261019",
      deployedCommit:"b".repeat(40),deploymentHost:"elevationpilot-sandbox-preview.vercel.app",
      functions:42,relevantTables:[{table:"events",columns:26,policies:5,indexes:3,rlsEnabled:true}],
    };
    function demoAudit(mode,selected){
      const full=mode==="compare";
      return {version:1,selected:mode,scope:selected?"event-builder":"all",capturedOn:"2026-10-20",
        freshDatabaseQuery:false,freshDeploymentQuery:false,sourceInspection:"preview_reference_only",
        live:mode==="sandbox"?null:demoLive,sandbox:mode==="live"?null:demoSandbox,
        compare:full?{
          source:{githubStatus:"ahead",commitsAhead:161,commitsBehind:0,totalChangedFiles:78,
            relevantChangedFiles:[{path:"src/EieEventSetupSteps.jsx",status:"modified",additions:160,deletions:0}]},
          database:{totalDifferentTables:2,totalDifferentFunctions:4,
            selectedDifferentTables:[{table:"events",kind:"structure_diff",
              liveColumnCount:26,sandboxColumnCount:26,liveOnlyColumns:[],
              sandboxOnlyColumns:[],changedColumns:[],rlsDifferent:false,
              liveRls:true,sandboxRls:true,policyDifferent:true,livePolicyCount:4,
              sandboxPolicyCount:5,indexDifferent:false,liveIndexCount:3,sandboxIndexCount:3}],
            functionDifferences:[{signature:"sandbox_practice_role_status()",status:"sandbox_only"}]},
        }:null,
        functionalTests:{live:"not_run",sandbox:"not_run"},
        safety:{readOnly:true,liveModified:false,sandboxModified:false,
          paymentsAttempted:false,automaticRepairsEnabled:false},
        notes:["These are dated snapshots, not live browser tests.",
          "Review code differs by deployed commit; reference source is preview only."],
      };
    }
    function demoUpgrade(selected){
      const suggestion={
        id:"identity-for-actions",title:"Account-first for every trackable action",
        lane:"essential",scope:["*"],priority:"critical",impact:"high",effort:"medium",
        why:"Every trackable action needs a verified account.",proposal:"Use one account gateway for requests and forms.",
        verify:"Verify ownership and account continuation in an isolated Sandbox.",
        dependencies:["Verified accounts"],standard:"owasp-asvs",
        status:"partial_preview_signals",signalCount:1,signalsChecked:2,
        evidence:[{path:"src/PlatformApp.jsx",line:4,excerpt:"EventInquiryAccountPrompt"}],
        claim:"product_upgrade_candidate_not_verified",ownerReview:"pending",
      };
      return {
        kind:"eig_build_lab_improvement_radar",schemaVersion:1,
        scope:selected?"event-builder":"all",sourceVersion:"a".repeat(40),
        origin:"protected_preview_source_heuristics",
        benchmark:"Static product quality rubric, not a live external comparison.",
        references:[{id:"owasp-asvs",name:"OWASP ASVS",url:"https://asvs.owasp.org/"}],
        suggestions:[suggestion],
        summary:{essential:1,wow:0,signalsFound:0,partial:1,notObserved:0},
        safety:{readOnly:true,externalsVisited:false,aiCalled:false,
          autoBuilt:false,liveChanges:false,approvalRequired:true},
        limitations:["Upgrade candidates, not confirmed missing features.",
          "Preview source markers are not runtime tests.",
          "No AI and no external websites accessed."],
      };
    }
    const masterFixture = {
      schemaVersion: 1, kind: "eig_build_lab_master_scan", target: "elevationpilot",
      scannerVersion: "source-plus-dated-schema-v1", sourceVersion: "a".repeat(40),
      inspectedAt: "2026-10-20T22:00:00.000Z",
      sourceFingerprint: "d".repeat(64),
      files: [{ path: "src/PlatformApp.jsx", lines: 1000, kind: "source" }],
      modules: [
        { id: "event-builder", title: "Event Builder", priority: "high",
          status: "review_needed", sourceStatus: "source_marker_found",
          uiStatus: "ui_marker_found", testStatus: "not_observed_in_sample", dbStatus: "tables_in_dated_snapshot",
          evidence: [{ kind: "ui", path: "src/PlatformApp.jsx", line: 8, excerpt: "<EieEventSetupSteps" }],
          tables: [{ table: "events", production: true, sandbox: true }],
          nextCheck: "Run an authorized Sandbox event-creation and save/reopen browser test." },
        { id: "invoices", title: "EIG Invoicing", priority: "high",
          status: "not_observed_in_sample", sourceStatus: "not_observed_in_sample",
          uiStatus: "not_observed_in_sample", testStatus: "not_sampled", dbStatus: "snapshot_gap",
          evidence: [], tables: [{ table: "invoices", production: false, sandbox: false }],
          nextCheck: "Check full repository before designing an invoice issuer." },
      ],
      summary: { modulesReviewed: 2, evidencePresent: 0, reviewNeeded: 1, notObservedInSample: 1 },
      database: {
        capturedOn: "2026-10-20", freshLiveQuery: false, productionTables: 71, sandboxTables: 71,
        missingInSandbox: [], missingInProduction: [],
        policyDifferences: [{ table: "events", productionPolicies: 4, sandboxPolicies: 5,
          productionRls: true, sandboxRls: true }],
        rlsDisabled: { production: [], sandbox: [] },
      },
      limitations: ["Static source inspection only.", "Dated schema metadata snapshot only."],
      safety: { readOnly: true, liveChanges: false, customerRowsRead: false,
        autoApproved: false, autoDeployed: false },
    };
    await page.route("**/api/eig-build-lab-master-scan", async (route) => {
      assert.equal(route.request().method(), "POST");
      const request = route.request().postDataJSON();
      assert.equal(request.target, "elevationpilot");
      assert.ok(["live","sandbox","compare"].includes(request.environmentMode));
      assert.ok(!request.moduleId || request.moduleId === "event-builder");
      assert.match(route.request().headers().authorization || "", /Bearer synthetic-browser-test-token/);
      const selected = request.moduleId === "event-builder";
      const responseReport = { ...masterFixture,
        scope: selected ? "module" : "full", selectedModule: selected ? "event-builder" : null,
        modules: selected ? [masterFixture.modules[0]] : masterFixture.modules,
        summary: selected ? { modulesReviewed: 1, evidencePresent: 0, reviewNeeded: 1, notObservedInSample: 0 } : masterFixture.summary,
        environmentAudit:demoAudit(request.environmentMode,selected),
        improvementAudit:demoUpgrade(selected),
      };
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, report: responseReport }) });
    });
    await page.getByRole("button", { name: /Scan Entire Platform/ }).click();
    await page.locator(".blm-table").getByText("Event Builder", { exact: true }).waitFor();
    await page.locator(".blm-upgrade-teaser").getByText("What should we improve next?").waitFor();
    await page.locator(".blm-upgrade-teaser").getByText("Account-first for every trackable action").waitFor();
    await page.getByRole("heading", { name: /Environment Evidence: Compare Live/ }).waitFor();
    await page.locator(".blm-env-delta").getByText(/Database differences for all public tables/).waitFor();
    await page.locator(".blm-env-delta").getByText(/Database differences for all public tables/).click();
    await page.locator(".blm-env-delta").getByText(/security policies differ/i).first().waitFor();
    assert.equal(await page.locator(".blm-table tbody tr").count(), 2);
    await page.getByLabel("Search Master Scanner modules").fill("invoice");
    assert.equal(await page.locator(".blm-table tbody tr").count(), 1);
    await page.getByLabel("Search Master Scanner modules").fill("");
    const masterRow = page.locator(".blm-table tbody tr").filter({ hasText: "Event Builder" });
    await masterRow.locator("summary").click();
    await masterRow.getByRole("button", { name: "Accept for follow-up" }).click();
    await page.waitForFunction(() => {
      const data = window.localStorage.getItem("eig:master-scan:v1:11111111-1111-4111-8111-111111111111");
      return data && JSON.parse(data).reviews["event-builder"]?.review === "accept";
    });
    await page.reload();
    const masterRestored = page.locator(".blm-table tbody tr").filter({ hasText: "Event Builder" });
    await masterRestored.locator("summary").click();
    assert.match(await masterRestored.innerText(), /Review: accept/);
    assert.equal(await page.locator(".blm-root").getByRole("button", { name: "Export JSON" }).count(), 1);
    // The original IA-only Source Inspector remains separate. Master Scanner
    // supports a real server-scoped review for any approved module target.
    await page.getByLabel("What should Build Lab scan?").selectOption("event-builder");
    await page.getByRole("button", { name: /Scan Selected Module/ }).click();
    await page.locator(".blm-report-scope").getByText(/Event Builder/).waitFor();
    assert.equal(await page.locator(".blm-table tbody tr").count(), 1);
    await page.locator(".blm-table tbody tr").getByText("Needs verification").waitFor();
    // Live and Sandbox selectors affect the actual authenticated request,
    // the rendered environment identity, and the report scope.
    await page.getByLabel("Which environment?").selectOption("live");
    await page.getByRole("button", { name: /Scan Selected Module/ }).click();
    await page.getByRole("heading", { name: /Environment Evidence: Live \(read-only\)/ }).waitFor();
    assert.equal(await page.locator(".blm-env-project").count(), 1);
    await page.getByLabel("Which environment?").selectOption("sandbox");
    await page.getByRole("button", { name: /Scan Selected Module/ }).click();
    await page.getByRole("heading", { name: /Environment Evidence: Sandbox \(read-only\)/ }).waitFor();
    assert.equal(await page.locator(".blm-env-project").count(), 1);
    await page.getByLabel("Which environment?").selectOption("compare");
    await page.getByRole("button", { name: /Scan Selected Module/ }).click();
    await page.getByRole("heading", { name: /Environment Evidence: Compare Live \+ Sandbox/ }).waitFor();
    assert.equal(await page.locator(".blm-env-project").count(), 2);
    await page.getByLabel("What should Build Lab scan?").selectOption("all");
    await page.getByRole("button", { name: /Scan Entire Platform/ }).click();
    await page.locator(".blm-report-scope").getByText(/Entire ElevationPilot platform/).waitFor();
    assert.equal(await page.locator(".blm-table tbody tr").count(), 2);


    // The scanner is mocked here to exercise authenticated UI and local
    // review persistence; separate server tests read actual first-party files.
    const scanFixture = {
      schemaVersion: 1, kind: "eig_build_lab_code_scan",
      target: "inception_apex", targetLabel: "InceptionApex",
      sourceVersion: "a".repeat(40), sourceFingerprint: "b".repeat(64),
      inspectedAt: "2026-10-15T14:00:00.000Z", scannerVersion: "inception-code-v1",
      files: [
        { path: "src/components/InceptionApex.jsx", lines: 1361 },
        { path: "src/components/inception-apex.css", lines: 623 },
      ],
      findings: [
        {
          id: "ia-native-confirm", category: "Workflow", priority: "medium",
          title: "Review native confirmation dialogs",
          observation: "First-party source calls window.confirm during navigation.",
          recommendation: "Consider a reusable confirmation component.",
          provenance: "observed_in_first_party_source", review: "pending",
          evidence: [{ path: "src/components/InceptionApex.jsx", line: 232, excerpt: "window.confirm(" }],
        },
        {
          id: "ia-form-focus", category: "Accessibility", priority: "low",
          title: "Check field focus indicators",
          observation: "Stylesheet defines focus-visible on buttons.",
          recommendation: "Inspect field focus on mobile and keyboard.",
          provenance: "observed_in_first_party_source", review: "pending",
          evidence: [{ path: "src/components/inception-apex.css", line: 393, excerpt: ".ia-app button:focus-visible {" }],
        },
      ],
      limitations: "Static source inspection only, not a runtime UI test.",
      safety: { readOnly: true, liveChanges: false, autoApproved: false },
    };
    await page.route("**/api/eig-build-lab-scan", async (route) => {
      assert.equal(route.request().method(), "POST");
      assert.equal(route.request().postDataJSON().target, "inception_apex");
      assert.match(route.request().headers().authorization || "", /Bearer synthetic-browser-test-token/);
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, report: scanFixture }) });
    });
    await chooseTool("IA Inspector");
    await page.getByRole("button", { name: /Inspect InceptionApex source/ }).click();
    await page.getByText("Review native confirmation dialogs").waitFor();
    await page.getByRole("button", { name: "Download source report JSON" }).waitFor();
    const firstScanFinding = page.locator(".bl-scan-finding").filter({ hasText: "Review native confirmation dialogs" });
    await firstScanFinding.locator("summary").click();
    await firstScanFinding.getByText(/src\/components\/InceptionApex.jsx:232/).waitFor();
    await firstScanFinding.getByRole("button", { name: "Accept" }).click();
    assert.equal(await firstScanFinding.locator(".state-accept").count(), 1);
    await page.getByRole("button", { name: /EIG Command Center/ }).click();
    await page.getByRole("button", { name: "Return to Build Lab" }).click();
    await page.getByText("Review native confirmation dialogs").waitFor();
    assert.equal(await page.locator(".bl-scan-finding .state-accept").count(), 1);
    await page.reload();
    await page.getByText("Review native confirmation dialogs").waitFor();
    assert.equal(await page.locator(".bl-scan-finding .state-accept").count(), 1);
    assert.equal(await page.getByRole("button", { name: "Download reusable JSON" }).count(), 0);
    await chooseTool("Project Architect");
    await page.getByRole("button", { name: "Load InceptionApex pilot" }).click();
    assert.equal(await page.getByLabel("What are we doing?").inputValue(), "ui_review");
    await page.getByRole("button", { name: /Create draft blueprint/ }).click();
    await page.getByText("Evaluate a reusable tool first").waitFor();
    await page.locator(".bl-chip").filter({ hasText: "InceptionApex creative studio" }).waitFor();
    const proposals = page.locator(".bl-suggestion");
    assert.equal(await proposals.count(), 6);
    await proposals.first().getByRole("button", { name: /Accept/ }).click();
    assert.match(await page.locator(".bl-suggestions").innerText(), /1 accepted or edited/);
    const ui = proposals.filter({ hasText: "Run a cosmetic and interaction audit" });
    assert.match(await ui.innerText(), /InceptionApex UI & Workflow Improvement/);
    await ui.getByRole("button", { name: "Revise" }).click();
    const suggestedCopy = await ui.getByLabel("Revised requirement").inputValue();
    assert.match(suggestedCopy, /form-label contrast/);
    assert.match(suggestedCopy, /InceptionApex/);
    await ui.getByText(/Auto-filled from your project goal/).waitFor();
    await ui.getByLabel("Revised requirement").fill("Standardize flyer button hierarchy and mobile previews.");
    await ui.getByRole("button", { name: "Save revision" }).click();
    assert.equal(await ui.locator(".state-edit").count(), 1);
    const prototype = proposals.filter({ hasText: "Build one end-to-end example" });
    await prototype.getByRole("button", { name: /Reject/ }).click();
    assert.equal(await prototype.locator(".state-reject").count(), 1);
    await page.getByText(/Your project and review decisions save automatically/).waitFor();
    await page.waitForFunction(() => window.buildLabHarness.dirty === false);
    // Navigating away must no longer destroy the working blueprint or reviews.
    await page.getByRole("button", { name: /EIG Command Center/ }).click();
    await page.getByRole("button", { name: "Return to Build Lab" }).click();
    await page.getByText("Draft blueprint · version 1").waitFor();
    assert.equal(await page.locator(".bl-suggestions .state-accept").count(), 1);
    assert.equal(await page.locator(".bl-suggestions .state-edit").count(), 1);
    assert.equal(await page.locator(".bl-suggestions .state-reject").count(), 1);
    // Editing a revision without saving must also survive exit/reentry.
    await ui.getByRole("button", { name: "Revise" }).click();
    await ui.getByLabel("Revised requirement").fill("Halfway through revising this proposal.");
    await page.getByRole("button", { name: /EIG Command Center/ }).click();
    await page.getByRole("button", { name: "Return to Build Lab" }).click();
    await page.getByText("Draft blueprint · version 1").waitFor();
    assert.equal(await ui.getByLabel("Revised requirement").inputValue(), "Halfway through revising this proposal.");
    await ui.getByRole("button", { name: "Cancel" }).click();
    // A browser reload should restore the current owner draft as well.
    await page.reload();
    await page.getByText("Draft blueprint · version 1").waitFor();
    assert.equal(await page.locator(".bl-suggestions .state-accept").count(), 1);
    assert.equal(await page.locator(".bl-suggestions .state-edit").count(), 1);
    assert.equal(await page.locator(".bl-suggestions .state-reject").count(), 1);
    await page.screenshot({ path: "test-results/eig-build-lab/review-desktop.png", fullPage: true });

    const mdWait = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download readable blueprint" }).click();
    const md = await mdWait;
    assert.match(await fs.readFile(await md.path(), "utf8"), /Standardize flyer button hierarchy/);
    assert.equal(await page.evaluate(() => window.buildLabHarness.dirty), false);

    const jsonWait = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download reusable JSON" }).click();
    const jsonFile = await jsonWait;
    const jsonData = JSON.parse(await fs.readFile(await jsonFile.path(), "utf8"));
    assert.equal(jsonData.status, "draft_requires_review");
    assert.equal(jsonData.suggestions.find((x) => x.id === "ui").review, "edit");
    assert.equal(await page.evaluate(() => window.buildLabHarness.dirty), false);

    await page.getByLabel("Goal and definition of success").fill("Make the design editor simpler on mobile and desktop.");
    await page.getByRole("button", { name: /Regenerate as next draft version/ }).click();
    await page.getByText("Draft blueprint · version 2").waitFor();
    assert.match(await page.locator(".bl-suggestions").innerText(), /6 awaiting review/);

    await page.getByLabel("Import Build Lab JSON").setInputFiles({
      name: "original-eig-blueprint.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(jsonData)),
    });
    await page.getByText(/Blueprint reopened\. It will now be saved automatically/).waitFor();
    await page.getByText("Draft blueprint · version 1").waitFor();
    assert.equal(await page.locator(".bl-suggestions .state-edit").count(), 1);
    assert.equal(await page.locator(".bl-suggestions .state-reject").count(), 1);
    // The same browser cannot restore a different owner's saved work.
    await page.evaluate(() => window.buildLabHarness.setOwner("22222222-2222-4222-8222-222222222222"));
    await chooseTool("Project Architect");
    await page.getByText("Your blueprint appears here").waitFor();
    assert.equal(await page.getByLabel("Project name").inputValue(), "");
    await page.evaluate(() => window.buildLabHarness.setOwner("11111111-1111-4111-8111-111111111111"));
    await page.getByText("Draft blueprint · version 1").waitFor();
    assert.equal(await page.locator(".bl-suggestions .state-edit").count(), 1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/eig-build-lab/review-mobile.png", fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    // Also preserve a partially typed mission before Generate is clicked.
    const partial = await browser.newPage({ viewport: { width: 950, height: 850 } });
    await partial.goto("http://127.0.0.1:4198/tests/eig-build-lab.html");
    await partial.getByRole("navigation",{name:"Build Lab tools"}).getByRole("button",{name:"Project Architect",exact:true}).click();
    await partial.getByLabel("Project name").fill("Draft without a blueprint");
    await partial.getByLabel("Goal and definition of success").fill("Save this unfinished idea too.");
    await partial.getByRole("button", { name: /EIG Command Center/ }).click();
    await partial.getByRole("button", { name: "Return to Build Lab" }).click();
    assert.equal(await partial.getByLabel("Project name").inputValue(), "Draft without a blueprint");
    assert.equal(await partial.getByLabel("Goal and definition of success").inputValue(), "Save this unfinished idea too.");
    await partial.reload();
    assert.equal(await partial.getByLabel("Project name").inputValue(), "Draft without a blueprint");
    assert.equal(await partial.getByRole("button", { name: "Download reusable JSON" }).count(), 0);
    await partial.close();
    assert.deepEqual(errors, []);
    console.log("Build Lab browser pilot passed.");
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
