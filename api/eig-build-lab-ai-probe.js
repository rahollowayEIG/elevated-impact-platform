// Preview-only owner-authorized OpenAI connectivity test for EIG Build Lab.
// No customer records, arbitrary prompts, model-selected tools or repository writes.
const { authorizeBuildLabPreviewOwner, response } = require('../server/eig-build-lab-preview-access.cjs');
const { buildLabPreviewAuthProviders } = require('../server/eig-build-lab-auth-client.cjs');

function createBuildLabAiProbe({ env, verifyUser, membershipsForUser, http = fetch, now = Date.now }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const grant = await authorizeBuildLabPreviewOwner(req, { env, verifyUser, membershipsForUser, now });
    if (!grant.allowed) return response(res, grant.status, { ok: false });
    if (env('EIG_BUILD_LAB_AI_TEST_ENABLED') !== 'true')
      return response(res, 503, { ok: false, message: 'AI preview test is disabled.' });
    if (req.body && (typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length))
      return response(res, 400, { ok: false, message: 'This diagnostic accepts no prompts or data.' });
    const key = env('OPENAI_API_KEY');
    if (!key) return response(res, 503, { ok: false, message: 'AI credential is not configured.' });
    try {
      const upstream = await http('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4.1-mini', store: false, tools: [], max_output_tokens: 24,
          input: 'Reply with exactly: EIG_AI_CONNECTED'
        }),
        signal: AbortSignal.timeout(15000)
      });
      if (!upstream.ok) return response(res, 502, { ok: false, message: 'AI provider did not accept the connection.' });
      const data = await upstream.json();
      const message = (data.output || []).flatMap(x => x.content || []).filter(x => x.type === 'output_text').map(x => x.text).join('').trim();
      return response(res, message === 'EIG_AI_CONNECTED' ? 200 : 502, {
        ok: message === 'EIG_AI_CONNECTED', model: 'gpt-4.1-mini',
        purpose: 'connection_test_only', stored: false,
        usage: { input_tokens: data.usage?.input_tokens || 0, output_tokens: data.usage?.output_tokens || 0 }
      });
    } catch { return response(res, 503, { ok: false, message: 'AI connection unavailable.' }); }
  };
}
module.exports = createBuildLabAiProbe({
  env: name => process.env[name],
  ...buildLabPreviewAuthProviders(name => process.env[name])
});
module.exports.createBuildLabAiProbe = createBuildLabAiProbe;
