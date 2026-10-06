import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createRequire } from "node:module";
import { cleanEstimate, estimateHtml } from "../src/lib/eventEstimate.mjs";
import {
  eventFlyerFacts,
  newFlyer,
  sanitizePacket,
  flyerSvg,
  flyerTemplate,
  packetHtml,
  orderingHandoff,
  materialsPacketSection,
} from "../src/lib/eventCreative.mjs";
import {
  newSponsorPlan,
  sanitizeSponsorPlan,
  sponsorTotals,
  signMakerCsv,
  sponsorInventoryUse,
} from "../src/lib/sponsorPlan.mjs";
const require = createRequire(import.meta.url);
const { createHandler } = require("../api/event-builder.js");
const {
  providerStatus,
  envelopeDefinition,
  bookingExhibit,
  providerConfig,
} = require("../server/event-builder.cjs");
const actor = "10000000-0000-0000-0000-000000000001",
  session = "20000000-0000-0000-0000-000000000001",
  org = "30000000-0000-0000-0000-000000000001",
  otherOrg = "30000000-0000-0000-0000-000000000002",
  request = "40000000-0000-0000-0000-000000000001",
  envelopeId = "50000000-0000-0000-0000-000000000001";
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
let db;
async function role(name, work) {
  await db.exec("set role " + name);
  try {
    return await work();
  } finally {
    await db.exec("reset role");
  }
}
async function action(name, payload = {}, target = request) {
  return role("service_role", async () => {
    const r = await db.query(
      "select public.event_builder_action($1,$2,$3,$4,$5) as state",
      [actor, session, target, name, JSON.stringify(payload)],
    );
    return r.rows[0].state;
  });
}
async function signed() {
  return action("sync", {
    envelope_id: envelopeId,
    status: "completed",
    signed: true,
    completed_at: new Date().toISOString(),
    expected_updated_at: (await action("load")).request.updated_at,
  });
}
test("booking transaction, authority, privacy, freshness, deposits and packet concurrency", async () => {
  db = new PGlite();
  try {
    await db.exec(await read("./fixtures/event-builder-base.sql"));
    await db.exec(
      await read(
        "../supabase/migrations/20261006022154_event_builder_booking_and_packet.sql",
      ),
    );
    await db.query(
      "insert into auth.users(id,email_confirmed_at) values($1,now());",
      [actor],
    );
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
      session,
      actor,
    ]);
    await db.query("insert into public.profiles(id) values($1)", [actor]);
    await db.query(
      "insert into public.organizations(id,name,slug) values($1,'Synthetic venue','synthetic'),($2,'Other venue','other')",
      [org, otherOrg],
    );
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin')",
      [org, actor],
    );
    await role("anon", () =>
      db.query(
        "insert into public.event_requests(id,organization_id,status,contact_full_name,contact_email,event_name,venue_internal_notes) values($1,$2,'submitted','Synthetic Organizer','organizer@example.test','Synthetic Venue Dinner','DO NOT EXPORT PRIVATE NOTES')",
        [request, org],
      ),
    );
    assert.equal(
      (
        await role("anon", () =>
          db.query("select * from public.event_requests"),
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      role("anon", () =>
        db.query(
          "insert into public.event_requests(organization_id,status,deposit_status) values($1,'submitted','paid')",
          [org],
        ),
      ),
      /Inquiries cannot supply/,
    );
    await assert.rejects(
      role("authenticated", () =>
        db.query("select event_builder_action($1,$2,$3,'load','{}')", [
          actor,
          session,
          request,
        ]),
      ),
      /permission denied/,
    );
    assert.equal(
      (
        await role("service_role", () =>
          db.query(
            "select has_table_privilege('service_role','auth.sessions','SELECT') as allowed",
          ),
        )
      ).rows[0].allowed,
      false,
    );
    await db.query(
      "insert into public.event_requests(id,organization_id,status) values('40000000-0000-0000-0000-000000000002',$1,'submitted')",
      [otherOrg],
    );
    await assert.rejects(
      action("load", {}, "40000000-0000-0000-0000-000000000002"),
      /active Pilot/,
    );
    await db.query(
      "update auth.sessions set not_after=now()-interval '1 minute' where id=$1",
      [session],
    );
    await assert.rejects(action("load"), /active Pilot/);
    await db.query("update auth.sessions set not_after=null where id=$1", [
      session,
    ]);
    await db.query(
      "update public.organization_memberships set access_ends_at=now()-interval '1 minute' where user_id=$1",
      [actor],
    );
    await assert.rejects(action("load"), /active Pilot/);
    await db.query(
      "update public.organization_memberships set access_ends_at=null where user_id=$1",
      [actor],
    );
    await role("authenticated", () =>
      db.query(
        "update public.event_requests set status='hold',confirmed_date='2027-06-12',confirmed_start_time='17:30',confirmed_capacity=80,confirmed_package='Venue space only',deposit_amount=200,deposit_status='pending',hold_expires_at=now()+interval '1 day',locked_fields='[\"confirmed_date\",\"confirmed_start\",\"confirmed_capacity\"]' where id=$1",
        [request],
      ),
    );
    const prepare = {
      agreement_kind: "venue",
      template_id: "venue-template",
      venue_signer_name: "Venue Signer",
      venue_signer_email: "venue@example.test",
    };
    await assert.rejects(
      action("prepare", {
        ...prepare,
        expected_updated_at: (await action("load")).request.updated_at,
      }),
      /approved itemized quote/,
    );
    let state = await action("estimate", {
      estimate: cleanEstimate({
        items: [{ name: "Venue rental", quantity: 1, unit_price: 1200 }],
        tax: 84,
      }),
      approved: true,
      expected_updated_at: (await action("load")).request.updated_at,
    });
    await assert.rejects(
      action("prepare", { ...prepare, expected_updated_at: "2000-01-01" }),
      /inquiry changed/,
    );
    state = await action("prepare", {
      ...prepare,
      expected_updated_at: state.request.updated_at,
    });
    assert.equal(state.workflow.terms.pricing.total, 1284);
    assert.equal(state.workflow.agreement_kind, "venue");
    assert.equal(state.workflow.terms.venue_internal_notes, undefined);
    await assert.rejects(
      role("authenticated", () =>
        db.query(
          "update public.event_requests set confirmed_package='Changed' where id=$1",
          [request],
        ),
      ),
      /frozen/,
    );
    await assert.rejects(
      action("estimate", {
        estimate: {},
        expected_updated_at: state.request.updated_at,
      }),
      /frozen/,
    );
    const providerCalls = [];
    const api = createHandler({
      env: {
        SUPABASE_URL: "https://example.test",
        SUPABASE_SERVICE_ROLE_KEY: "fixture",
        DOCUSIGN_ENVIRONMENT: "demo",
        DOCUSIGN_INTEGRATION_KEY: "fixture",
        DOCUSIGN_USER_ID: actor,
        DOCUSIGN_ACCOUNT_ID: org,
        DOCUSIGN_ORGANIZATION_ID: org,
        DOCUSIGN_PRIVATE_KEY: "fixture",
        DOCUSIGN_VENUE_TEMPLATE_ID: "venue-template",
      },
      clientFactory: () => ({
        auth: { getUser: async () => ({ data: { user: { id: actor } } }) },
        rpc: async (_, p) => {
          try {
            return {
              data: await action(p.p_action, p.p_payload, p.p_request_id),
            };
          } catch (e) {
            return { error: { message: e.message, code: e.code } };
          }
        },
      }),
      providerFactory:
        async () =>
        async (path, method = "GET", body) => {
          providerCalls.push({ path, method, body });
          if (method === "POST") return { envelopeId };
          if (path.endsWith("/documents"))
            return { envelopeDocuments: [{ documentId: "999" }] };
          if (path.endsWith("/recipients")) return { signers: [] };
          return { envelopeId, status: "created" };
        },
    });
    async function apiCall(name) {
      let code, result;
      await api(
        {
          method: "POST",
          headers: {
            authorization:
              "Bearer x." +
              Buffer.from(JSON.stringify({ session_id: session })).toString(
                "base64url",
              ) +
              ".x",
          },
          body: {
            request_id: request,
            action: name,
            agreement_kind: "venue",
            expected_updated_at: (await action("load")).request.updated_at,
          },
        },
        {
          setHeader() {},
          status(c) {
            code = c;
            return this;
          },
          json(data) {
            result = data;
            return this;
          },
        },
      );
      return { code, result };
    }
    let apiResult = await apiCall("prepare");
    assert.equal(apiResult.code, 200);
    state = apiResult.result;
    assert.equal(state.workflow.exhibit_attached, true);
    assert.equal(
      providerCalls.find((p) => p.method === "POST").body.status,
      "created",
    );
    assert.equal(
      providerCalls.find((p) => p.path.endsWith("/documents")).body.documents[0]
        .documentId,
      "999",
    );
    assert.equal((await apiCall("prepare")).code, 200);
    assert.equal(providerCalls.filter((p) => p.method === "POST").length, 1);
    assert.equal((await apiCall("send")).code, 409);
    assert.equal(
      providerCalls.some((p) => p.body?.status === "sent"),
      false,
    );
    state = await action("load");
    await assert.rejects(
      action("confirm", { expected_updated_at: state.request.updated_at }),
      /Verify all signatures/,
    );
    await assert.rejects(
      action("deposit", {
        status: "paid",
        amount: 1,
        method: "check",
        reference: "test",
        expected_updated_at: state.request.updated_at,
      }),
      /exact deposit/,
    );
    state = await action("deposit", {
      status: "paid",
      amount: 200,
      method: "check",
      reference: "synthetic receipt",
      expected_updated_at: state.request.updated_at,
    });
    await assert.rejects(
      role("authenticated", () =>
        db.query(
          "update public.event_requests set deposit_status='pending' where id=$1",
          [request],
        ),
      ),
      /authorized agreement/,
    );
    state = await signed();
    await db.query(
      "update public.event_request_workflows set synced_at=now()-interval '6 minutes' where request_id=$1",
      [request],
    );
    await assert.rejects(
      action("confirm", { expected_updated_at: state.request.updated_at }),
      /Verify all signatures/,
    );
    state = await signed();
    state = await action("confirm", {
      expected_updated_at: state.request.updated_at,
    });
    assert.equal(state.request.status, "confirmed");
    assert.equal(state.request.calendar_status, "not_created");
    assert.equal(
      (
        await action("confirm", {
          expected_updated_at: state.request.updated_at,
        })
      ).request.event_id,
      state.request.event_id,
    );
    const event = (
      await db.query(
        "select * from public.golf_registration_events where id=$1",
        [state.workflow.golf_event_id],
      )
    ).rows[0];
    assert.equal(event.field_settings.event_kind, "general");
    assert.equal(event.status, "draft");
    const master = (
      await db.query("select * from public.events where id=$1", [
        state.request.event_id,
      ])
    ).rows[0];
    assert.equal(master.is_published, false);
    assert.equal(master.registration_status, "draft");
    assert.equal(
      (await role("anon", () => db.query("select * from public.events"))).rows
        .length,
      0,
    );
    await assert.rejects(
      role("anon", () =>
        db.query(
          "insert into public.events(name,is_published) values('Forged',true)",
        ),
      ),
      /row-level security/,
    );
    assert.equal(
      (await db.query("select count(*)::integer as count from public.events"))
        .rows[0].count,
      1,
    );
    await assert.rejects(
      role("authenticated", () =>
        db.query(
          "update public.golf_registration_events set event_dates='[\"2028-01-01\"]' where id=$1",
          [event.id],
        ),
      ),
      /venue-approved amendment/,
    );
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: actor, session_id: session }),
    ]);
    await assert.rejects(
      role("authenticated", () =>
        db.query(
          "update public.events set event_date='2028-01-01' where id=$1",
          [master.id],
        ),
      ),
      /venue-approved amendment/,
    );
    await assert.rejects(
      role("authenticated", () =>
        db.query(
          "update public.event_requests set locked_fields='[]' where id=$1",
          [request],
        ),
      ),
      /frozen/,
    );
    const quote = (
      await role("authenticated", () =>
        db.query("select public.get_event_builder_quote($1) as quote", [
          event.id,
        ]),
      )
    ).rows[0].quote;
    assert.equal(quote.estimate.total, 1284);
    assert.equal(JSON.stringify(quote).includes("PRIVATE"), false);
    const save = (version) =>
      role("authenticated", async () => {
        const r = await db.query(
          "select public.save_event_builder_assets($1,$2,$3) as data",
          [
            event.id,
            version,
            JSON.stringify({ itinerary: [{ activity: "Arrival" }] }),
          ],
        );
        return r.rows[0].data;
      });
    assert.equal((await save(0)).version, 1);
    assert.equal((await save(1)).version, 2);
    await assert.rejects(save(1), /Someone saved newer/);
    assert.equal(
      (
        await db.query(
          "select count(*)::integer as count from public.event_builder_asset_audit",
        )
      ).rows[0].count,
      2,
    );
    await assert.rejects(
      role("authenticated", () =>
        db.query("update event_builder_assets set data='{}'"),
      ),
      /permission denied/,
    );
    await db.query("delete from auth.sessions where id=$1", [session]);
    await assert.rejects(save(2), /Authorized event access/);
    await assert.rejects(action("load"), /active Pilot/);
    assert.equal(
      (
        await role("authenticated", () =>
          db.query("select * from event_builder_assets"),
        )
      ).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
test("regular events use the existing offer/payment provisioner and preserve linked context", async () => {
  db = new PGlite();
  try {
    await db.exec(await read("./fixtures/event-builder-base.sql"));
    await db.exec(`create table public.golf_event_payment_settings(organization_id uuid,event_id uuid,allow_online boolean,allow_clubhouse boolean,price_mode text,team_payment_mode text,allow_split_team_payments boolean,convenience_fee_type text,convenience_fee_value numeric,clubhouse_hold_mode text,clubhouse_hold_days integer,allow_card_guarantee boolean,auto_charge_at_deadline boolean,failed_charge_grace_hours integer,reminders_enabled boolean);
  create table public.event_offers(organization_id uuid,master_event_id uuid,golf_event_id uuid,source_app text,source_module text,offer_type text,name text,description text,price numeric,charge_by text,is_required boolean,is_default boolean,availability_start date,availability_end date,coupon_eligible boolean,visibility text,status text,sort_order integer,created_by uuid,metadata jsonb);
  create table public.event_registration_fields(event_id uuid,field_key text,label text,field_type text,applies_to text,requirement_status text,is_system_field boolean,include_in_internal_export boolean,include_in_golf_genius_export boolean,sort_order integer,status text);
  create table public.products(id uuid,product_key text);create table public.event_product_entitlements(event_id uuid,product_id uuid,status text,enabled_by uuid,settings jsonb);`);
    await db.exec(
      await read("./fixtures/event-builder-existing-provisioner.sql"),
    );
    await db.exec(
      await read(
        "../supabase/migrations/20261006022154_event_builder_booking_and_packet.sql",
      ),
    );
    await db.query(
      "insert into auth.users(id,email_confirmed_at) values($1,now())",
      [actor],
    );
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
      session,
      actor,
    ]);
    await db.query("insert into public.profiles(id) values($1)", [actor]);
    await db.query(
      "insert into public.organizations(id,name,slug) values($1,'Synthetic venue','synthetic')",
      [org],
    );
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin')",
      [org, actor],
    );
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: actor, session_id: session }),
    ]);
    const options = {
      p_organization_id: org,
      p_name: "Community Dinner",
      p_course: "CHGC",
      p_event_start: "2027-06-12",
      p_event_start_time: "17:30",
      p_registration_format: "individual",
      p_team_size: 1,
      p_max_golfers: 80,
      p_items: [
        {
          name: "Dinner admission",
          item_type: "registration",
          price: 35,
          charge_by: "player",
          required: true,
        },
      ],
      p_allow_online: true,
      p_allow_clubhouse: false,
      p_convenience_fee_type: "none",
      p_allow_card_guarantee: false,
    };
    const run = () =>
      role("authenticated", () =>
        db.query("select public.create_eie_regular_event($1) as event", [
          JSON.stringify(options),
        ]),
      );
    const result = (await run()).rows[0].event;
    const event = (
      await db.query("select * from golf_registration_events where id=$1", [
        result.golf_event_id,
      ])
    ).rows[0];
    assert.equal(event.master_event_id, result.master_event_id);
    assert.equal(event.field_settings.event_kind, "general");
    assert.equal(event.field_settings.ghin, "hidden");
    assert.equal(event.field_settings.event_start_time, "17:30");
    assert.equal(
      (
        await db.query("select event_type from events where id=$1", [
          result.master_event_id,
        ])
      ).rows[0].event_type,
      "Event",
    );
    assert.equal(
      (await db.query("select * from event_offers")).rows[0].price,
      "35",
    );
    assert.equal(
      (await db.query("select * from golf_event_payment_settings")).rows[0]
        .allow_online,
      true,
    );
    assert.equal(
      (await db.query("select * from event_registration_fields")).rows.length,
      4,
    );
    await db.query("delete from auth.sessions");
    await assert.rejects(run(), /active authorized event session/);
    assert.equal(
      (await db.query("select count(*)::integer as count from events")).rows[0]
        .count,
      1,
    );
  } finally {
    await db.close();
  }
});
test("provider requires exact envelope and completed expected signers, never trusts local status", () => {
  const w = {
    id: request,
    request_id: request,
    agreement_kind: "venue",
    template_id: "t",
    envelope_id: envelopeId,
    terms: {
      name: "Dinner",
      organizer_name: "Organizer",
      organizer_email: "organizer@example.test",
      venue_signer_name: "Venue",
      venue_signer_email: "venue@example.test",
    },
  };
  const e = {
    envelopeId,
    status: "completed",
    completedDateTime: "2027-01-01T12:00:00Z",
  };
  assert.equal(envelopeDefinition(w).status, "created");
  assert.equal(
    envelopeDefinition(w).templateRoles[0].roleName,
    "Renter Authorized Signer",
  );
  const recipients = {
    signers: [
      { email: w.terms.organizer_email, status: "completed" },
      { email: w.terms.venue_signer_email, status: "completed" },
    ],
  };
  assert.equal(providerStatus(e, recipients, w).signed, true);
  recipients.signers[1].status = "sent";
  assert.equal(providerStatus(e, recipients, w).signed, false);
  assert.throws(
    () => providerStatus({ ...e, envelopeId: request }, recipients, w),
    /does not match/,
  );
  assert.equal(providerConfig({}).sendsEnabled, false);
  assert.equal(
    bookingExhibit(
      {
        ...w.terms,
        venue_internal_notes: "PRIVATE",
        name: "<script>alert(1)</script>",
      },
      "venue",
    ).includes("PRIVATE"),
    false,
  );
  assert.equal(
    bookingExhibit(
      { ...w.terms, name: "<script>alert(1)</script>" },
      "venue",
    ).includes("<script>"),
    false,
  );
});
test("server refuses unauthenticated, stale and unconfigured signing requests; prices are recomputed", async () => {
  const token =
    "x." +
    Buffer.from(JSON.stringify({ session_id: session })).toString("base64url") +
    ".x";
  let auth = true;
  const calls = [];
  const state = {
    request: { id: request, organization_id: org, updated_at: "2027-01-01" },
    workflow: null,
    audit: [],
  };
  const handler = createHandler({
    env: {
      SUPABASE_URL: "https://example.test",
      SUPABASE_SERVICE_ROLE_KEY: "fixture",
    },
    clientFactory: () => ({
      auth: {
        getUser: async () => ({ data: { user: auth ? { id: actor } : null } }),
      },
      rpc: async (name, p) => {
        calls.push(p);
        return { data: state };
      },
    }),
  });
  async function invoke(body, authorization = "Bearer " + token) {
    let code;
    let data;
    await handler(
      {
        method: "POST",
        headers: { authorization },
        body: { request_id: request, ...body },
      },
      {
        setHeader() {},
        status(c) {
          code = c;
          return this;
        },
        json(d) {
          data = d;
          return this;
        },
      },
    );
    return { code, data };
  }
  assert.equal((await invoke({ action: "load" }, "")).code, 401);
  auth = false;
  assert.equal((await invoke({ action: "load" })).code, 401);
  auth = true;
  assert.equal(
    (await invoke({ action: "deposit", expected_updated_at: "old" })).code,
    409,
  );
  assert.equal(calls.at(-1).p_action, "load");
  assert.equal(
    (
      await invoke({
        action: "confirm",
        expected_updated_at: state.request.updated_at,
      })
    ).code,
    503,
  );
  assert.equal(
    (
      await invoke({
        action: "estimate",
        expected_updated_at: state.request.updated_at,
        estimate: {
          items: [{ name: "Rental", quantity: 2, unit_price: 10, total: 1 }],
          total: 1,
        },
        approved: true,
      })
    ).code,
    200,
  );
  assert.equal(calls.at(-1).p_payload.estimate.total, 20);
});
test("flyers, templates, packet and material handoffs use saved facts and escape exported text", () => {
  const event = {
    id: request,
    organization_id: org,
    master_event_id: envelopeId,
    name: "Community Dinner",
    course: "CHGC",
    event_dates: ["2027-06-12"],
    status: "draft",
    public_slug: "community-dinner",
    field_settings: {
      event_start_time: "17:30",
      hub_description: "Join us",
      venue_internal_notes: "PRIVATE",
    },
  };
  const facts = eventFlyerFacts(event, "https://example.test");
  assert.equal(facts.time, "5:30 PM");
  assert.equal(
    facts.registration,
    "https://example.test/events/community-dinner",
  );
  assert.equal(JSON.stringify(facts).includes("PRIVATE"), false);
  const flyer = newFlyer();
  assert.equal(flyerSvg(flyer, facts).includes("Community Dinner"), true);
  assert.equal(
    JSON.stringify(flyerTemplate(flyer)).includes("Community Dinner"),
    false,
  );
  const data = sanitizePacket({
    flyer,
    map: {
      image: "data:image/svg+xml;base64,PHN2Zz4=",
      pins: [{ label: "<script>bad</script>", x: Infinity, y: -1 }],
    },
    materials: [
      {
        id: "material",
        type: "Invitation",
        quantity: 50,
        wording: "Dinner at 5:30",
        artwork_url: "javascript:bad",
      },
    ],
  });
  assert.equal(data.map.image, "");
  assert.equal(data.map.pins[0].y, 0);
  assert.equal(data.materials[0].artwork_url, "");
  assert.equal(
    packetHtml(event, data, "https://example.test").includes("<script>bad"),
    false,
  );
  assert.equal(
    materialsPacketSection(data.materials).includes("Dinner at 5:30"),
    true,
  );
  const handoff = orderingHandoff(event, data);
  assert.equal(handoff.master_event_id, envelopeId);
  assert.equal(handoff.order_status, "draft_request");
  assert.equal(handoff.items[0].quantity, 50);
  assert.equal(
    cleanEstimate({
      items: [{ name: "Rental", quantity: 2, unit_price: 1.255 }],
    }).total,
    2.52,
  );
  assert.throws(() => cleanEstimate({ tax: -1 }));
  assert.equal(
    estimateHtml({ items: [] }, "<script>x</script>").includes("<script>"),
    false,
  );
});
test("sponsor starter excludes sample sales/prices, inventory and fulfillment preserve commitments", () => {
  const plan = newSponsorPlan();
  assert.equal(plan.items.length, 27);
  assert.equal(plan.sales.length, 0);
  assert.equal(
    plan.items.every((i) => i.price === ""),
    true,
  );
  const item = plan.items[0];
  plan.sales = [
    {
      id: "sale",
      buyer: "=bad()",
      offer_name: "Tee Sponsor",
      quantity: 2,
      unit_price: 100,
      paid: true,
      reference: "receipt",
      fulfillment: [
        {
          id: item.id,
          name: item.name,
          quantity: 1,
          wording: "=FORMULA()",
          completed: false,
        },
      ],
    },
  ];
  assert.equal(sponsorInventoryUse(plan, item.id), 2);
  assert.equal(sponsorTotals(plan).received, 200);
  assert.equal(sponsorTotals(plan).unfinished, 1);
  assert.equal(signMakerCsv(plan).includes("'=FORMULA()"), true);
  assert.equal(
    sanitizeSponsorPlan(plan).sales[0].fulfillment[0].name,
    item.name,
  );
});
