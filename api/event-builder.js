const { createClient } = require("@supabase/supabase-js");
const {
  UUID,
  CHGC_TEMPLATES,
  bookingExhibit,
  providerConfig,
  envelopeDefinition,
  providerStatus,
  docusignClient,
} = require("../server/event-builder.cjs");

function createHandler({
  env = process.env,
  clientFactory = createClient,
  providerFactory = docusignClient,
} = {}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST")
      return res.status(405).json({ error: "Use POST." });
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    const { action, request_id: requestId } = req.body || {};
    if (!token)
      return res.status(401).json({ error: "Sign in again to continue." });
    if (
      !UUID.test(requestId || "") ||
      ![
        "load",
        "estimate",
        "prepare",
        "sync",
        "send",
        "deposit",
        "confirm",
      ].includes(action)
    )
      return res.status(400).json({ error: "Invalid Event Builder action." });
    try {
      const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
      if (!url || !env.SUPABASE_SERVICE_ROLE_KEY)
        return res.status(503).json({
          error: "The Event Builder server connection needs configuration.",
        });
      const admin = clientFactory(url, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: auth, error: authError } = await admin.auth.getUser(token);
      if (authError || !auth?.user)
        return res.status(401).json({ error: "Sign in again to continue." });
      // Read only the session identifier from a token whose signature getUser just verified.
      const sessionId = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url"),
      ).session_id;
      if (!UUID.test(sessionId || ""))
        return res
          .status(401)
          .json({ error: "An active session is required." });
      let state;
      async function db(operation, payload = {}) {
        const { data, error } = await admin.rpc("event_builder_action", {
          p_actor_id: auth.user.id,
          p_session_id: sessionId,
          p_request_id: requestId,
          p_action: operation,
          p_payload: {
            ...payload,
            expected_updated_at:
              state?.request.updated_at || req.body.expected_updated_at,
          },
        });
        if (error) {
          const problem = new Error(error.message);
          problem.status = error.code === "42501" ? 403 : 409;
          throw problem;
        }
        state = data;
        return state;
      }
      await db("load"); // Database rechecks the session, account, scope and access window.
      if (
        action !== "load" &&
        req.body.expected_updated_at !== state.request.updated_at
      )
        return res
          .status(409)
          .json({ error: "The inquiry changed. Reload it before continuing." });
      const config = providerConfig(env);
      const organizationMatches =
        state.request.organization_id === env.DOCUSIGN_ORGANIZATION_ID;
      const providerReady = config.configured && organizationMatches;
      if (action === "estimate") {
        const { cleanEstimate } = await import("../src/lib/eventEstimate.mjs");
        let estimate;
        try {
          estimate = cleanEstimate(req.body.estimate);
        } catch (error) {
          return res.status(400).json({ error: error.message });
        }
        if (
          req.body.approved === true &&
          (!estimate.items.length || estimate.items.some((i) => !i.name))
        )
          return res
            .status(400)
            .json({ error: "Each approved quote item needs a name." });
        await db("estimate", {
          estimate,
          approved: req.body.approved === true,
        });
      } else if (action === "prepare") {
        const kind = req.body.agreement_kind;
        if (!CHGC_TEMPLATES[kind])
          return res
            .status(400)
            .json({ error: "Choose golf outing or venue rental." });
        // Demo accounts must configure their own templates; production templates are account-bound.
        const templateId =
          env["DOCUSIGN_" + kind.toUpperCase() + "_TEMPLATE_ID"];
        if (!templateId)
          return res.status(503).json({
            error:
              "Configure the agreement template before preparing this booking.",
          });
        await db("prepare", {
          agreement_kind: kind,
          template_id: templateId,
          venue_signer_name: String(req.body.venue_signer_name || "")
            .trim()
            .slice(0, 120),
          venue_signer_email: String(req.body.venue_signer_email || "")
            .trim()
            .slice(0, 254),
        });
        if (providerReady && !state.workflow.exhibit_attached) {
          const provider = await providerFactory(env);
          if (!state.workflow.envelope_id) {
            // Recover a draft created before an interrupted database save.
            // Docusign transaction IDs are retained for seven days.
            if (
              state.workflow.provider_attempted_at &&
              Date.now() - Date.parse(state.workflow.provider_attempted_at) >
                7 * 86400000
            ) {
              const error = new Error(
                "This interrupted draft needs Docusign reconciliation before creating another envelope.",
              );
              error.status = 409;
              throw error;
            }
            const found = await provider(
              "/envelopes?transaction_ids=" +
                encodeURIComponent(state.workflow.id) +
                "&status=any",
            );
            const matches = found.envelopes || [];
            if (
              matches.length > 1 ||
              (matches[0] && matches[0].status !== "created")
            ) {
              const error = new Error(
                "Review the existing Docusign envelope before completing this draft.",
              );
              error.status = 409;
              throw error;
            }
            let envelope = matches[0];
            if (!envelope) {
              await db("begin_envelope_attempt");
              envelope = await provider(
                "/envelopes?merge_roles_on_draft=true",
                "POST",
                envelopeDefinition(state.workflow),
              );
            }
            if (!UUID.test(envelope.envelopeId || ""))
              throw new Error("Docusign did not return an envelope ID.");
            await db("save_envelope", { envelope_id: envelope.envelopeId });
          }
          // A stable document ID makes retrying an interrupted attachment replace the exhibit.
          const attachment = await provider(
            "/envelopes/" + state.workflow.envelope_id + "/documents",
            "PUT",
            {
              documents: [
                {
                  documentId: "999",
                  name: "Venue-approved booking exhibit",
                  fileExtension: "html",
                  documentBase64: Buffer.from(
                    await exhibitFor(state.workflow),
                  ).toString("base64"),
                },
              ],
            },
          );
          if (attachment.envelopeDocuments?.some((d) => d.errorDetails))
            throw new Error("The booking exhibit could not be attached.");
          await db("exhibit_attached");
        }
      } else if (["sync", "send", "confirm"].includes(action)) {
        if (!providerReady)
          return res.status(503).json({
            error:
              "Connect the Docusign API for this venue to verify signatures.",
          });
        if (!UUID.test(state.workflow?.envelope_id || ""))
          return res
            .status(409)
            .json({ error: "Prepare a Docusign draft first." });
        const provider = await providerFactory(env);
        const path = "/envelopes/" + state.workflow.envelope_id;
        const sync = async () => {
          const [envelope, recipients] = await Promise.all([
            provider(path),
            provider(path + "/recipients"),
          ]);
          await db("sync", {
            ...providerStatus(envelope, recipients, state.workflow),
            envelope_id: state.workflow.envelope_id,
          });
        };
        await sync();
        if (action === "send") {
          if (!config.sendsEnabled)
            return res.status(409).json({
              error:
                "Sending is disabled until contract policy cleanup is approved.",
            });
          await db("send_check", { reviewed: req.body.reviewed === true });
          await provider(path, "PUT", { status: "sent" });
          await sync();
        } else if (action === "confirm") await db("confirm");
      } else if (action === "deposit") {
        await db("deposit", {
          status: req.body.status,
          amount: req.body.amount,
          method: req.body.method,
          reference: String(req.body.reference || "")
            .trim()
            .slice(0, 500),
        });
      }
      return res.status(200).json({
        ...state,
        connection: {
          configured: providerReady,
          environment: config.environment,
          sends_enabled: providerReady && config.sendsEnabled,
        },
        exhibit: state.workflow ? await exhibitFor(state.workflow) : null,
      });
    } catch (error) {
      return res.status(error.status || 502).json({
        error: error.status
          ? error.message
          : "This step could not be completed. Reload status before retrying; the saved draft is retained.",
      });
    }
  };
}
async function exhibitFor(workflow) {
  const { estimateText } = await import("../src/lib/eventEstimate.mjs");
  return bookingExhibit(
    {
      ...workflow.terms,
      pricing_breakdown: estimateText(workflow.terms.pricing),
    },
    workflow.agreement_kind,
  );
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
