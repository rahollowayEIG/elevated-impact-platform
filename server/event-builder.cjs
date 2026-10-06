const { createSign } = require("node:crypto");

const CHGC_TEMPLATES = {
  golf: {
    id: "a24f9b57-659c-4188-a867-b099fc3b3920",
    role: "Group Authorized Signer",
    label: "Golf outing",
  },
  venue: {
    id: "669a24c1-a867-4c14-81c6-3b8e74910075",
    role: "Renter Authorized Signer",
    label: "Venue rental",
  },
};
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

function bookingExhibit(terms, kind) {
  // An explicit allowlist keeps internal notes and contract policy decisions out of the document.
  const fields = [
    ["Agreement", CHGC_TEMPLATES[kind]?.label],
    ["Event", terms.name],
    ["Venue", terms.venue],
    ["Date", terms.date],
    ["Start time (venue local time)", terms.time],
    ["Start type", terms.start_type],
    ["Participants / guests", terms.capacity],
    ["Venue package and pricing", terms.package],
    ["Approved itemized pricing (USD)", terms.pricing_breakdown],
    ["Booking deposit (USD)", terms.deposit_amount],
    ["Organizer", terms.organizer_name],
    ["Organizer email", terms.organizer_email],
    ["Organizer phone", terms.organizer_phone],
    ["Venue authorized representative", terms.venue_signer_name],
    ["Venue representative email", terms.venue_signer_email],
  ];
  return (
    '<!doctype html><html><head><meta charset="UTF-8"><title>Event booking exhibit</title>' +
    "<style>body{font:14px Arial,sans-serif;color:#14213b;margin:48px}h1{font-size:26px}table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #ddd}th{width:32%}td{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body>" +
    "<h1>Event booking exhibit</h1><p>This exhibit records the venue-approved booking details. Read it together with the completed agreement and its named exhibits.</p><table>" +
    fields
      .map(
        ([key, value]) =>
          "<tr><th>" +
          escapeHtml(key) +
          "</th><td>" +
          escapeHtml(
            value === null || value === undefined || value === ""
              ? "Not specified — complete before sending"
              : value,
          ) +
          "</td></tr>",
      )
      .join("") +
    "</table></body></html>"
  );
}

function providerConfig(env = process.env) {
  const environment = env.DOCUSIGN_ENVIRONMENT || "demo";
  if (!["demo", "production"].includes(environment))
    throw new Error("Invalid Docusign environment.");
  const configured = [
    "DOCUSIGN_INTEGRATION_KEY",
    "DOCUSIGN_USER_ID",
    "DOCUSIGN_ACCOUNT_ID",
    "DOCUSIGN_PRIVATE_KEY",
    "DOCUSIGN_ORGANIZATION_ID",
  ].every((key) => Boolean(env[key]));
  return {
    configured,
    environment,
    sendsEnabled:
      configured &&
      env.DOCUSIGN_SEND_ENABLED === "true" &&
      env.DOCUSIGN_POLICIES_APPROVED === "true",
  };
}

function envelopeDefinition(workflow) {
  const terms = workflow.terms;
  return {
    status: "created",
    transactionId: workflow.id,
    templateId: workflow.template_id,
    emailSubject: ("Agreement: " + terms.name).slice(0, 100),
    templateRoles: [
      {
        roleName: CHGC_TEMPLATES[workflow.agreement_kind].role,
        name: terms.organizer_name,
        email: terms.organizer_email,
        routingOrder: "1",
      },
      {
        roleName: "Chapel Authorized Representative",
        name: terms.venue_signer_name,
        email: terms.venue_signer_email,
        routingOrder: "2",
      },
    ],
    customFields: {
      textCustomFields: [
        {
          name: "ElevationPilotRequest",
          value: workflow.request_id,
          show: "false",
        },
      ],
    },
  };
}

function providerStatus(envelope, recipients, workflow) {
  if (
    !UUID.test(envelope.envelopeId || "") ||
    envelope.envelopeId !== workflow.envelope_id
  )
    throw new Error("Envelope does not match this request.");
  const signers = recipients.signers || [];
  const expected = [
    workflow.terms.organizer_email,
    workflow.terms.venue_signer_email,
  ].map((email) => email.toLowerCase());
  const complete =
    envelope.status === "completed" &&
    expected.every((email) =>
      signers.some(
        (s) => s.email?.toLowerCase() === email && s.status === "completed",
      ),
    ) &&
    signers.length >= 2 &&
    signers.every((s) => s.status === "completed");
  return {
    status: envelope.status,
    signed: complete,
    completed_at: complete ? envelope.completedDateTime : null,
    sent_at: envelope.sentDateTime || null,
  };
}

async function docusignClient(env = process.env, fetcher = fetch) {
  const config = providerConfig(env);
  if (!config.configured)
    throw new Error("Docusign API connection has not been configured.");
  const host =
    config.environment === "demo"
      ? "account-d.docusign.com"
      : "account.docusign.com";
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const input =
    encode({ alg: "RS256", typ: "JWT" }) +
    "." +
    encode({
      iss: env.DOCUSIGN_INTEGRATION_KEY,
      sub: env.DOCUSIGN_USER_ID,
      aud: host,
      iat: now,
      exp: now + 3600,
      scope: "signature impersonation",
    });
  const signer = createSign("RSA-SHA256");
  signer.update(input);
  signer.end();
  const assertion =
    input +
    "." +
    signer
      .sign(env.DOCUSIGN_PRIVATE_KEY.replace(/\\n/g, "\n"))
      .toString("base64url");
  const tokenResponse = await fetcher("https://" + host + "/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!tokenResponse.ok)
    throw new Error(
      "Docusign authorization failed. Check integration settings and signing-user consent.",
    );
  const token = (await tokenResponse.json()).access_token;
  const infoResponse = await fetcher("https://" + host + "/oauth/userinfo", {
    headers: { Authorization: "Bearer " + token },
    signal: AbortSignal.timeout(12000),
  });
  if (!infoResponse.ok)
    throw new Error("Unable to verify the Docusign account.");
  const account = (await infoResponse.json()).accounts?.find(
    (a) => a.account_id === env.DOCUSIGN_ACCOUNT_ID,
  );
  const base = account && new URL(account.base_uri);
  if (
    !base ||
    base.protocol !== "https:" ||
    !/^(demo|www|na\d+|eu\d*|au\d*|ca\d*)\.docusign\.net$/.test(
      base.hostname,
    ) ||
    (config.environment === "demo") !== (base.hostname === "demo.docusign.net")
  )
    throw new Error(
      "Docusign account does not match the configured environment.",
    );
  return async function request(path, method = "GET", body) {
    const response = await fetcher(
      base.origin + "/restapi/v2.1/accounts/" + env.DOCUSIGN_ACCOUNT_ID + path,
      {
        method,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new Error(
        "Docusign could not complete this step. Refresh status before retrying.",
      );
    return response.status === 204 ? {} : response.json();
  };
}

module.exports = {
  UUID,
  CHGC_TEMPLATES,
  bookingExhibit,
  providerConfig,
  envelopeDefinition,
  providerStatus,
  docusignClient,
};
