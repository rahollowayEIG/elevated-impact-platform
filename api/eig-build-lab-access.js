const { createBuildLabPreviewAccessHandler } = require("../server/eig-build-lab-preview-access.cjs");
const { buildLabPreviewAuthProviders } = require("../server/eig-build-lab-auth-client.cjs");

const env = (name) => process.env[name];
// Read-only, fail-closed, single-owner branch-preview authorization route.
// The same verified owner and caller-RLS checks protect the source scanner.
module.exports = createBuildLabPreviewAccessHandler({
  env, ...buildLabPreviewAuthProviders(env),
});
