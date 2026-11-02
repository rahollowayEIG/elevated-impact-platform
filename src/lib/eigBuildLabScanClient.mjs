// Unprivileged browser scanner client. The Vercel server independently
// verifies current owner, active session, scoped EIG membership and branch.
const ALLOWED_PATHS=new Set(["src/components/InceptionApex.jsx","src/components/FlyerEditor.jsx","src/components/inception-apex.css","tests/inception-apex-browser.cjs"]);
const SHA = /^[a-f0-9]{64}$/i;
export function validateInceptionSourceReport(value) {
  if (!value || typeof value !== "object" ||
      value.kind !== "eig_build_lab_code_scan" || value.schemaVersion !== 1 ||
      value.target !== "inception_apex" || value.safety?.readOnly !== true ||
      value.safety?.liveChanges !== false || !SHA.test(value.sourceFingerprint || "") ||
      !Array.isArray(value.files) || value.files.length < 1 || value.files.length > 12 ||
      !Array.isArray(value.findings) || value.findings.length > 25)
    throw new Error("The source scanner returned an unsupported report.");
  const sourcePaths = new Set(value.files.map((file) => file.path));
  if(sourcePaths.size!==value.files.length||value.files.some(f=>!ALLOWED_PATHS.has(f.path)||!Number.isInteger(f.lines)||f.lines<1))throw Error("Invalid source file list.");
  const validEvidence=evidence=>sourcePaths.has(evidence?.path)&&Number.isInteger(evidence.line)&&evidence.line>=1&&evidence.line<=50000&&typeof evidence.excerpt==='string'&&evidence.excerpt.length<=160;
  if(value.ruleChecks!==undefined){
    if(!Array.isArray(value.ruleChecks)||value.ruleChecks.length>10||new Set(value.ruleChecks.map(c=>c?.id)).size!==value.ruleChecks.length||value.ruleChecks.some(c=>
      !/^[a-z0-9-]{3,80}$/.test(c?.id||'')||typeof c.title!=='string'||!c.title.trim()||c.title.length>200||
      !['source_pattern_found','coverage_markers_found','partial_pattern','not_observed_in_sample'].includes(c.status)||
      !['preserve_existing','coverage_gap','verification_needed'].includes(c.findingType)||c.runtimeVerified!==false||
      typeof c.nextCheck!=='string'||!c.nextCheck.trim()||c.nextCheck.length>1500||!Array.isArray(c.evidence)||c.evidence.length>4||!c.evidence.every(validEvidence)))throw Error('Invalid source rule checks.');
  }
  for (const item of value.findings) {
    if(item.verify!==undefined&&(typeof item.verify!=='string'||!item.verify.trim()||item.verify.length>1500))throw Error('Invalid source verification criteria.');
    if(item.findingType!==undefined&&!["preserve_existing","coverage_gap","verification_needed"].includes(item.findingType))throw Error("Invalid finding classification.");
    if (!/^[a-z0-9-]{3,80}$/.test(item?.id || "") ||
        typeof item.title !== "string" || item.title.length > 200 ||
        typeof item.observation !== "string" || item.observation.length > 1000 ||
        typeof item.recommendation !== "string" || item.recommendation.length > 1500 ||
        !Array.isArray(item.evidence) || item.evidence.length < 1 || item.evidence.length > 4 ||
        item.provenance !== "observed_in_first_party_source")
      throw new Error("The source report has invalid findings.");
    for (const evidence of item.evidence) {
      if (!validEvidence(evidence))
        throw new Error("Source evidence is missing or invalid.");
    }
  }
  return value;
}

export async function requestInceptionSourceScan(client, http = fetch) {
  if (!client?.auth?.getSession || typeof http !== "function")
    throw new Error("A verified Build Lab login is required.");
  const { data, error } = await client.auth.getSession();
  const token = data?.session?.access_token;
  if (error || typeof token !== "string" || !token)
    throw new Error("Sign in again before running a read-only source scan.");
  const res = await http("/api/eig-build-lab-scan", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ target: "inception_apex" }),
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!res.ok)
    throw new Error(res.status === 403 || res.status === 401
      ? "Your session or Build Lab owner permission needs verification."
      : "The source scan could not complete. Try again later.");
  const payload = await res.json();
  return validateInceptionSourceReport(payload?.report);
}
