const { buildLabPreviewAuthProviders } = require("../server/eig-build-lab-auth-client.cjs");
const { createBuildLabInceptionScanHandler } = require("../server/eig-build-lab-scan-handler.cjs");
const { readAllowlistedInceptionSource, scanInceptionSource } = require("../server/eig-inception-source-scan.cjs");

const env = (name) => process.env[name];

// Strictly first-party and read-only; the server rechecks owner, current
// session, membership, preview branch and origin BEFORE accessing source.
module.exports = createBuildLabInceptionScanHandler({
  env,
  ...buildLabPreviewAuthProviders(env),
  readSources: readAllowlistedInceptionSource,
  scan: scanInceptionSource,
});
