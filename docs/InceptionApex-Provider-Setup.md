# Connect InceptionApex design providers

Updated October 7, 2026. OpenAI, Canva and Adobe generation are still marked connection pending. Creating developer credentials prepares the connection; it does not activate background generation until the server jobs, permissions, outputs and failure handling are implemented and tested.

## What Ryan can prepare

| Provider | Owner steps | Server secret names |
| --- | --- | --- |
| OpenAI | Create an EIG-owned API project for InceptionApex, enable API billing, and create a project API key. Start here: https://platform.openai.com/api-keys. Check billing and usage in the API dashboard. | `OPENAI_API_KEY` |
| Canva | Open the Developer Portal, create an InceptionApex app, select Outside Canva → Start integrating and enable Canva REST APIs. Generate a client secret. Prepare approved brand templates for flyers/signage. | `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET` |
| Adobe | In Adobe Developer Console, create an InceptionApex project and add Firefly API if available to the organization. Use OAuth Server-to-Server credentials. | `ADOBE_CLIENT_ID`, `ADOBE_CLIENT_SECRET`, `ADOBE_SCOPES` |

Store credentials in Supabase Edge Function Secrets: https://supabase.com/dashboard/project/aszixzrdayrivungodwq/functions/secrets. Never paste secrets into chat, commit them, or put them in frontend `VITE_*` variables. Keep accounts and billing under EIG ownership. If a provider API is unavailable, confirm entitlement with that provider before buying a different subscription.

Canva's current Autofill documentation supports Pro (including Education and Nonprofits), Teams and Enterprise. Private apps still require Enterprise; an app made available to all users must follow Canva's publication/review process. Create a development app first. We must implement the secure OAuth callback before supplying the production redirect URL. Do not register a guessed callback or the local URL from the sample app.

Adobe's Firefly API credentials/access are a developer integration, separate from merely having the Adobe app connected in ChatGPT. Do not share temporary Adobe access tokens; the server derives them from the client credentials and the scopes shown by Adobe.

## Implementation after credentials

1. OpenAI first: authorized generation/edit jobs, input validation, output storage linked to the existing project/version, controlled use and explicit generation status. Test a real edit and save/reopen round trip.
2. Canva: verified OAuth with state/PKCE, scoped account/project mapping, asset upload, brand-template autofill, design editing and export back to the approved project. Test connection, denial, token renewal and export.
3. Adobe: Firefly operations supported by EIG's API entitlement, server token renewal, generation status and image import; product mockup/Photoshop operations require their own supported API setup. Test the actual selected operations.
4. Keep event names/dates/prices, sponsor logos, QR codes and measured maps/layouts as verified editable elements. Every billable event upgrade preserves the required Ella, Marshal and Maverick sponsorship reminder and event-scoped help action.

## Official references

- OpenAI quickstart: https://developers.openai.com/api/docs/quickstart
- OpenAI production credentials/billing guidance: https://developers.openai.com/api/docs/guides/production-best-practices
- Canva setup: https://www.canva.dev/docs/apps/quickstart/
- Canva Autofill: https://www.canva.dev/docs/apps/rest-apis/autofill-guide/
- Adobe Firefly credentials: https://developer.adobe.com/firefly-services/docs/firefly-api/getting-started/create-credentials/

## Google Drive

The existing EIG website connection already has server-side Google OAuth credentials and a stored refresh token. The resizer now uses that connection; no new Google credentials are required for this EIG-only rollout. This is not a personal-account connection. Its new folder is Hangars / Elevated Impact Group / InceptionApex / Resized Images underneath the existing configured Drive root. Single exports and batch ZIPs share the destination. See `ElevationPilot-Drive-Folder-Rules.md` for the wider organization audit and remaining legacy-folder work.

## Optional connections after the core design providers

- Runway: candidate for sponsor ads, pre-round briefings and Ella/Marshal/Maverick hole guides. Create an EIG-owned Runway API developer account, configure API billing and store the API key server-side (`RUNWAYML_API_SECRET`). Runway web subscriptions and credits are separate from API credits. Do not buy or enable generation before reviewing the actual API budget and workflow. Official setup: https://docs.dev.runwayml.com/guides/using-the-api/ and https://help.runwayml.com/hc/en-us/articles/50683115755155-Runway-API-FAQs.
- ElevenLabs: optional consistent narration voices if the selected video workflow needs them. Official capabilities: https://elevenlabs.io/docs/overview/capabilities/text-to-speech. Select authorized character voices; live voice generation and synchronization still need implementation and review.
- Printful: candidate for supplier catalog, selected-product mockups and fulfillment, routed through EIC's product/order authority. Official developer documentation: https://developers.printful.com/docs/. These product starters do not yet submit supplier orders.

Connect core image/design providers first. The golfer-video scope and verified course/challenge requirements are in InceptionApex-Video-Challenges.md. Connecting a provider inside ChatGPT does not automatically authorize background jobs in the EIG website.
