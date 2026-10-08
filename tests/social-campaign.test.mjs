import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  cleanCampaignData,
  campaignAdHtml,
  campaignProblem,
  visibleCampaigns,
} from "../src/lib/socialCampaign.mjs";
const file = (p) => readFile(new URL(p, import.meta.url), "utf8");
const owner = "10000000-0000-0000-0000-000000000001",
  other = "10000000-0000-0000-0000-000000000002";
const session = "20000000-0000-0000-0000-000000000001",
  otherSession = "20000000-0000-0000-0000-000000000002";
const org = "30000000-0000-0000-0000-000000000001",
  event = "40000000-0000-0000-0000-000000000001";
test("private and event campaign authorization, immutable context/revisions, CAS and review state", async () => {
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
  const draft = {
    id: "50000000-0000-0000-0000-000000000001",
    version: 0,
    name: "Sponsor offer",
    event_id: null,
    data: cleanCampaignData({
      body: "Verified sponsor message",
      destinations: ["website"],
      link: "https://example.com/event",
    }),
  };
  async function save(p, status = "draft") {
    return (
      await db.query(
        "select public.save_social_campaign($1,$2,$3,$4,$5,$6) as campaign",
        [p.id, p.version, p.name, p.event_id, JSON.stringify(p.data), status],
      )
    ).rows[0].campaign;
  }
  try {
    await db.exec(await file("./fixtures/event-builder-base.sql"));
    await db.exec(
      await file(
        "../supabase/migrations/20261007040350_inception_creative_foundation.sql",
      ),
    );
    const policies = (
      await db.query(
        "select tablename,policyname,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname",
      )
    ).rows;
    await db.exec(
      await file(
        "../supabase/migrations/20261007064246_social_campaign_workspace.sql",
      ),
    );
    await db.exec(
      await file(
        "../supabase/migrations/20261008204951_social_campaign_schedules.sql",
      ),
    );
    assert.deepEqual(
      (
        await db.query(
          "select tablename,policyname,cmd,qual,with_check from pg_policies where schemaname='public' and tablename not like 'social_%' order by tablename,policyname",
        )
      ).rows,
      policies,
    );
    for (const [u, s] of [
      [owner, session],
      [other, otherSession],
    ]) {
      await db.query(
        "insert into auth.users(id,email_confirmed_at) values($1,now())",
        [u],
      );
      await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
        s,
        u,
      ]);
      await db.query(
        "insert into public.profiles(id,account_status) values($1,'active')",
        [u],
      );
    }
    await db.query(
      "insert into public.organizations(id,name) values($1,'Synthetic Hangar')",
      [org],
    );
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin')",
      [org, owner],
    );
    await db.query(
      "insert into public.golf_registration_events(id,event_key,name,organization_id) values($1,'test','Synthetic event',$2)",
      [event, org],
    );
    await db.exec("set role anon");
    await assert.rejects(() =>
      db.query("select * from public.social_campaigns"),
    );
    await assert.rejects(() => save(draft));
    await db.exec("reset role");
    const saved = await as(owner, session, () =>
      save(
        {
          ...draft,
          data: { ...draft.data, owner_user_id: other, published: true },
        },
        "reviewed",
      ),
    );
    assert.equal(saved.owner_user_id, owner);
    assert.equal(saved.status, "reviewed");
    assert.equal(saved.data.published, undefined);
    assert.equal(saved.data.owner_user_id, undefined);
    assert.equal(saved.reviewed_by, owner);
    await as(owner, session, async () => {
      await assert.rejects(() =>
        db.query("update public.social_campaigns set name='bypass'"),
      );
      await assert.rejects(() =>
        db.query("delete from public.social_campaign_versions"),
      );
      await assert.rejects(() => save(draft), /newer version/);
    });
    await as(other, otherSession, async () => {
      assert.equal(
        (await db.query("select * from public.social_campaigns")).rows.length,
        0,
      );
      await assert.rejects(() => save(saved), /access/);
    });
    const revised = await as(owner, session, () =>
      save({ ...saved, data: { ...saved.data, body: "New message" } }, "draft"),
    );
    assert.equal(revised.reviewed_at, null);
    assert.equal(revised.version, 2);
    await as(owner, session, async () => {
      await assert.rejects(
        () => save({ ...revised, event_id: event }),
        /change its event/,
      );
      await assert.rejects(
        () =>
          save({
            ...revised,
            data: { ...revised.data, link: "javascript:alert(1)" },
          }),
        /HTTPS/,
      );
      await assert.rejects(
        () =>
          save({
            ...revised,
            data: { ...revised.data, destinations: ["unknown"] },
          }),
        /destination/,
      );
      await assert.rejects(
        () =>
          save({ ...revised, data: { ...revised.data, body: "" } }, "reviewed"),
        /message/,
      );
    });
    const eventDraft = {
      ...draft,
      id: "50000000-0000-0000-0000-000000000002",
      event_id: event,
    };
    await as(other, otherSession, () =>
      assert.rejects(() => save(eventDraft), /event access/),
    );
    const eventSaved = await as(owner, session, () => save(eventDraft));
    assert.equal(eventSaved.organization_id, org);
    await db.query(
      "update public.organization_memberships set status='revoked' where user_id=$1",
      [owner],
    );
    await as(owner, session, async () => {
      assert.equal(
        (
          await db.query(
            "select * from public.social_campaigns where event_id=$1",
            [event],
          )
        ).rows.length,
        0,
      );
      await assert.rejects(() => save(eventSaved), /event access/);
    });
    await db.query(
      "update public.profiles set account_status='disabled' where id=$1",
      [owner],
    );
    await as(owner, session, async () => {
      assert.equal(
        (await db.query("select * from public.social_campaigns")).rows.length,
        0,
      );
      await assert.rejects(() => save(revised), /active verified/);
    });
    await db.query(
      "update public.profiles set account_status='active' where id=$1",
      [owner],
    );
    await db.query("delete from auth.sessions where id=$1", [session]);
    await as(owner, session, () =>
      assert.rejects(() => save(revised), /active verified/),
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.social_campaign_versions",
        )
      ).rows[0].n,
      3,
    );
  } finally {
    await db.close();
  }
});
test("ad exports use a reviewed snapshot, safe links and escaped text; list search/sort preserves state", () => {
  const data = cleanCampaignData({
    body: "<script>alert(1)</script>",
    headline: "Prize <car>",
    sponsor: "A & B",
    link: "https://example.com/?a=1&b=2",
    destinations: ["website", "website", "invalid"],
  });
  assert.deepEqual(data.destinations, ["website"]);
  const p = { name: "Campaign --> bad", version: 1, status: "reviewed", data };
  const html = campaignAdHtml(p);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("A &amp; B"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.throws(() => campaignAdHtml({ ...p, status: "draft" }), /reviewed/);
  assert.throws(
    () =>
      campaignAdHtml({ ...p, data: { ...data, link: "javascript:alert(1)" } }),
    /destination link/,
  );
  assert.match(
    campaignProblem(
      {
        ...p,
        data: { ...data, image: "https://user:pass@example.com/image.png" },
      },
      true,
    ),
    /HTTPS/,
  );
  assert.deepEqual(
    visibleCampaigns(
      [
        { id: 1, name: "Bravo", status: "draft", data: { sponsor: "ACME" } },
        { id: 2, name: "Alpha", status: "reviewed", data: {} },
        {
          id: 3,
          name: "Archived",
          status: "archived",
          data: { sponsor: "ACME" },
        },
      ],
      "acme",
      "all",
      "name",
      true,
    ).map((p) => p.id),
    [1],
  );
});
