const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
(async()=>{
 const {createServer}=await import("vite");
 const server=await createServer({server:{host:"127.0.0.1",port:4201,strictPort:true}});
 await server.listen();
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1220,height:900},acceptDownloads:true});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await fs.mkdir("test-results/eig-improvement-radar",{recursive:true});
  await page.goto("http://127.0.0.1:4201/tests/eig-improvement-radar.html");
  await page.getByRole("heading",{name:"Essentials & Wow Radar"}).waitFor();
  await page.getByRole("button",{name:/Scan for Essentials & Upgrades/}).click();
  await page.getByRole("heading",{name:"Account-first for every trackable action"}).waitFor();
  await page.getByRole("heading",{name:"Smart next-action companion"}).waitFor();
  assert.equal(await page.locator(".blr-card").count(),2);
  assert.equal(await page.evaluate(()=>window.radarHarness.stats.calls[0]),"all");
  await page.getByLabel("Filter improvement categories").selectOption("wow");
  assert.equal(await page.locator(".blr-card").count(),1);
  await page.getByLabel("Filter improvement categories").selectOption("essential");
  assert.equal(await page.locator(".blr-card").count(),1);
  const card=page.locator(".blr-card").filter({hasText:"Account-first for every trackable action"});
  await card.getByRole("button",{name:"Accept for blueprint"}).click();
  await card.locator(".blr-meta").getByText(/Review\s+accept/).waitFor();
  await page.getByRole("button",{name:"Export Upgrade Backlog JSON"}).waitFor();
  const [download]=await Promise.all([
   page.waitForEvent("download"),
   card.getByRole("button",{name:"Download Upgrade Brief"}).click(),
  ]);
  assert.match(download.suggestedFilename(),/eig-upgrade-identity-for-actions\.json/);
  const doc=JSON.parse(await fs.readFile(await download.path(),"utf8"));
  assert.equal(doc.kind,"eig_upgrade_blueprint_brief");
  assert.equal(doc.review,"accept");
  assert.equal(doc.safety.autoDeployed,false);
  assert.equal(doc.claim,"product_upgrade_candidate_not_verified");
  await page.reload();
  await page.getByRole("heading",{name:"Essentials & Wow Radar"}).waitFor();
  const restored=page.locator(".blr-card").filter({hasText:"Account-first for every trackable action"});
  await restored.locator(".blr-meta").getByText(/Review\s+accept/).waitFor();
  await page.getByLabel("Filter improvement categories").selectOption("all");
  await page.getByLabel("Search opportunities").fill("next-action");
  assert.equal(await page.locator(".blr-card").count(),1);
  await page.getByLabel("Search opportunities").fill("");
  await page.getByLabel("Sort product improvements").selectOption("effort");
  await page.getByLabel("Scan product opportunities for").selectOption("event-builder");
  await page.getByRole("button",{name:/Scan for Essentials & Upgrades/}).click();
  await page.getByText("New source or rubric evidence").first().waitFor();
  assert.equal(await page.evaluate(()=>window.radarHarness.stats.calls.at(-1)),"event-builder");
  await page.locator(".blr-card").first().locator(".blr-meta").getByText(/Review\s+pending/).waitFor();
  await page.screenshot({path:"test-results/eig-improvement-radar/radar.png",fullPage:true});
  const mobile=await browser.newPage({viewport:{width:390,height:844}});
  mobile.on("pageerror",e=>errors.push(e.message));
  await mobile.goto("http://127.0.0.1:4201/tests/eig-improvement-radar.html");
  await mobile.getByRole("heading",{name:"Essentials & Wow Radar"}).waitFor();
  await mobile.getByRole("button",{name:/Scan for Essentials & Upgrades/}).click();
  await mobile.locator(".blr-card").first().waitFor();
  const width=await mobile.evaluate(()=>({
   outer:document.documentElement.scrollWidth,inner:document.documentElement.clientWidth,
  }));
  assert.ok(width.outer<=width.inner+2,"Mobile radar horizontal overflow: "+JSON.stringify(width));
  assert.deepEqual(errors,[],errors.join("\n"));
  console.log("Essentials & Wow Radar browser test passed: categories, review persistence, upgrade briefs, scope reset, mobile.");
 }finally{await browser?.close();await server.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
