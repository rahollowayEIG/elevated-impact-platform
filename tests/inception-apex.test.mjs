import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  MATERIALS,
  newProject,
  materialDesign,
  cleanProjectData,
  projectHandoff,
  projectBrief,
  visibleProjects,
} from "../src/lib/inceptionProject.mjs";
import {
  flyerSvg,
  sanitizePacket,
  designPacketSection,
} from "../src/lib/eventCreative.mjs";
const owner = "10000000-0000-0000-0000-000000000001",
  other = "10000000-0000-0000-0000-000000000002";
const session = "20000000-0000-0000-0000-000000000001",
  otherSession = "20000000-0000-0000-0000-000000000002";
const org = "30000000-0000-0000-0000-000000000001",
  event = "40000000-0000-0000-0000-000000000001",
  master = "40000000-0000-0000-0000-000000000002";
const file = (name) => readFile(new URL(name, import.meta.url), "utf8");

test("private designs, active event authority, immutable approvals, packet preservation and stale saves", async () => {
  const db = new PGlite();
  async function as(user, sid, work) {
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: user, session_id: sid }),
    ]);
    await db.exec("set role authenticated");
    try {
      return await work();
    } finally {
      await db.exec("reset role");
    }
  }
  async function save(p, status = "draft") {
    return (
      await db.query(
        "select public.save_inception_project($1,$2,$3,$4,$5,$6,$7) as project",
        [
          p.id,
          p.version,
          p.name,
          p.material,
          p.event_id,
          JSON.stringify(p.data),
          status,
        ],
      )
    ).rows[0].project;
  }
  try {
    await db.exec(await file("./fixtures/event-builder-base.sql"));
    const legacyPolicies = await db.query(
      "select tablename,policyname,cmd,qual,with_check from pg_policies where schemaname='public' and tablename in ('events','event_requests','golf_registration_events') order by tablename,policyname",
    );
    await db.exec(
      await file(
        "../supabase/migrations/20261007040350_inception_creative_foundation.sql",
      ),
    );
    await db.exec(
      await file(
        "../supabase/migrations/20261007040355_inception_apex_projects.sql",
      ),
    );
    assert.deepEqual(
      (
        await db.query(
          "select tablename,policyname,cmd,qual,with_check from pg_policies where schemaname='public' and tablename in ('events','event_requests','golf_registration_events') order by tablename,policyname",
        )
      ).rows,
      legacyPolicies.rows,
    );
    assert.equal(
      (
        await db.query(
          "select to_regclass('public.event_request_workflows') as booking",
        )
      ).rows[0].booking,
      null,
    );
    for (const [id, sid] of [
      [owner, session],
      [other, otherSession],
    ]) {
      await db.query(
        "insert into auth.users(id,email_confirmed_at) values($1,now())",
        [id],
      );
      await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
        sid,
        id,
      ]);
      await db.query(
        "insert into public.profiles(id,account_status) values($1,'active')",
        [id],
      );
    }
    await db.query(
      "insert into public.organizations(id,name) values($1,'Synthetic venue')",
      [org],
    );
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin')",
      [org, owner],
    );
    await db.query(
      "insert into public.events(id,name,organization_id) values($1,'Synthetic master',$2)",
      [master, org],
    );
    await db.query(
      "insert into public.golf_registration_events(id,event_key,name,organization_id,master_event_id,field_settings) values($1,'test','Synthetic event',$2,$3,$4)",
      [
        event,
        org,
        master,
        JSON.stringify({
          hub_description: "Public description",
          private_internal_notes: "Do not return",
        }),
      ],
    );
    const personal = newProject("sign", { name: "Thank you sponsors" });
    const saved = await as(owner, session, () => save(personal));
    assert.equal(saved.owner_user_id, owner);
    assert.equal(saved.organization_id, null);
    await as(other, otherSession, async () => {
      assert.equal(
        (await db.query("select id from public.inception_projects")).rows
          .length,
        0,
      );
      assert.equal(
        (await db.query("select * from public.inception_project_versions")).rows
          .length,
        0,
      );
      await assert.rejects(save(saved), /Project access/);
      await assert.rejects(
        db.query("update public.inception_projects set status='approved'"),
        /permission denied/,
      );
      const scope = await db.query(
        "select public.list_inception_events() as events",
      );
      assert.deepEqual(scope.rows[0].events, []);
    });
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select * from public.inception_projects"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.list_inception_events()"),
      /permission denied/,
    );
    await db.exec("reset role");
    const ep = newProject("banner", { name: "Community event" });
    ep.data.design.link = {
      url: "https://example.com/sponsor",
      showQr: true,
      showLink: true,
      size: 200,
      x: 100,
      y: 100,
      label: "Visit sponsor",
    };
    ep.event_id = event;
    const eventProject = await as(owner, session, () => save(ep));
    assert.equal(eventProject.organization_id, org);
    assert.equal(eventProject.master_event_id, master);
    await as(owner, session, async () => {
      const scope = (
        await db.query("select public.list_inception_events() as events")
      ).rows[0].events;
      assert.equal(scope.length, 1);
      assert.equal(scope[0].field_settings.private_internal_notes, undefined);
      await assert.rejects(
        db.query("select public.attach_inception_project($1,$2)", [ep.id, 1]),
        /Approve the design/,
      );
    });
    const approved = await as(owner, session, () =>
      save(eventProject, "approved"),
    );
    assert.equal(approved.version, 2);
    assert.equal(approved.approved_by, owner);
    await as(owner, session, async () => {
      await assert.rejects(save(eventProject), /newer version/);
      await assert.rejects(
        save({ ...approved, event_id: null }),
        /change its event/,
      );
      await db.query("select public.save_event_builder_assets($1,0,$2)", [
        event,
        JSON.stringify({
          map: { pins: [{ label: "Keep this pin" }] },
          itinerary: [{ activity: "Keep schedule" }],
        }),
      ]);
      const attached = (
        await db.query(
          "select public.attach_inception_project($1,$2) as result",
          [ep.id, approved.version],
        )
      ).rows[0].result;
      assert.equal(attached.packet_version, 2);
      const packet = (
        await db.query(
          "select data from public.event_builder_assets where event_id=$1",
          [event],
        )
      ).rows[0].data;
      assert.equal(packet.map.pins[0].label, "Keep this pin");
      assert.equal(packet.itinerary[0].activity, "Keep schedule");
      assert.equal(packet.designs[0].version, 2);
      assert.equal(packet.designs[0].design.width, 1800);
      assert.equal(
        packet.designs[0].design.link.url,
        "https://example.com/sponsor",
      );
      await assert.rejects(
        db.query("select public.save_event_builder_assets($1,1,$2)", [
          event,
          JSON.stringify({}),
        ]),
        /newer event packet/,
      );
    });
    const revised = await as(owner, session, () =>
      save({ ...approved, name: "Revised banner" }),
    );
    assert.equal(revised.status, "draft");
    assert.equal(revised.approved_at, null);
    await as(owner, session, async () => {
      const historical = (
        await db.query(
          "select status,data from public.inception_project_versions where project_id=$1 and version=2",
          [ep.id],
        )
      ).rows[0];
      assert.equal(historical.status, "approved");
      assert.equal(historical.data.facts.name, "Community event");
      await assert.rejects(
        db.query("delete from public.inception_project_versions"),
        /permission denied/,
      );
    });
    await db.query(
      "update public.organization_memberships set status='inactive' where user_id=$1",
      [owner],
    );
    await as(owner, session, async () => {
      assert.equal(
        (
          await db.query(
            "select id from public.inception_projects where event_id=$1",
            [event],
          )
        ).rows.length,
        0,
      );
      await assert.rejects(save(revised), /Authorized event access/);
      assert.equal(
        (
          await db.query(
            "select id from public.inception_projects where event_id is null",
          )
        ).rows.length,
        1,
      );
    });
    await db.query(
      "update auth.sessions set not_after=now()-interval '1 minute' where id=$1",
      [session],
    );
    await as(owner, session, async () => {
      assert.equal(
        (await db.query("select * from public.inception_projects")).rows.length,
        0,
      );
      await assert.rejects(save(saved), /active verified account session/);
    });
    const definers = await db.query(
      "select n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prosecdef and p.proname like '%inception%'",
    );
    assert.ok(definers.rows.every((r) => r.nspname === "eig_private"));
  } finally {
    await db.close();
  }
});
test("material templates, safe imagery, draft labels, sponsor handoffs and private packet snapshots", () => {
  for (const m of MATERIALS) {
    const design = materialDesign(m.id);
    assert.equal(design.width, m.width);
    assert.equal(design.height, m.height);
  }
  const p = newProject("sign", { name: "Sponsors <script>bad()</script>" }),
    logo = "data:image/png;base64,AA==";
  p.data.design.images = [
    {
      id: "one",
      src: logo,
      label: "Sponsor",
      x: 10,
      y: 10,
      width: 200,
      height: 100,
    },
    { id: "unsafe", src: "javascript:alert(1)" },
  ];
  const clean = cleanProjectData(p.data);
  assert.equal(clean.design.images.length, 1);
  const svg = flyerSvg(clean.design, clean.facts, "DRAFT DESIGN");
  assert.ok(svg.includes("DRAFT DESIGN"));
  assert.ok(!svg.includes("EVENT NOT PUBLISHED"));
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes(logo));
  assert.throws(() => projectHandoff(p), /Save and approve/);
  p.data = clean;
  p.version = 2;
  p.status = "approved";
  const handoff = projectHandoff(p);
  assert.equal(handoff.artwork_version, 2);
  assert.equal(handoff.order_status, "draft_request");
  assert.ok(!handoff.artwork_svg.includes("DRAFT DESIGN"));
  assert.ok(projectBrief(p).includes("sponsor sign"));
  const packet = sanitizePacket({
    designs: [
      {
        project_id: p.id,
        version: 2,
        name: p.name,
        material: p.material,
        design: clean.design,
        facts: clean.facts,
      },
    ],
  });
  assert.equal(packet.designs.length, 1);
  assert.ok(designPacketSection(packet.designs).includes("Version 2"));
  const rows = [
    { ...p, name: "Zeta", status: "approved", updated_at: "2026-10-01" },
    {
      ...p,
      id: "next",
      name: "Alpha",
      status: "draft",
      data: { ...p.data, favorite: true },
      updated_at: "2026-10-02",
    },
  ];
  assert.equal(
    visibleProjects(rows, "alpha", "favorites", {
      field: "name",
      ascending: true,
    })[0].id,
    "next",
  );
  assert.equal(
    visibleProjects(rows, "", "all", {
      field: "updated_at",
      ascending: false,
    })[0].name,
    "Alpha",
  );
});
