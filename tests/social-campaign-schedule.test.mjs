import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  templatePlan,
  localInstant,
  scheduleProblem,
  scheduleRows,
  campaignCalendar,
} from "../src/lib/campaignSchedule.mjs";
import {
  cleanCampaignData,
  campaignProblem,
} from "../src/lib/socialCampaign.mjs";
const migration =
  "../supabase/migrations/20261008204951_social_campaign_schedules.sql";
const file = (path) => readFile(new URL(path, import.meta.url), "utf8");
const plan = () =>
  templatePlan("countdown", {
    subject: "Community Outing",
    anchor: "2027-06-20T09:00",
    timeZone: "America/New_York",
  });
test("templates and time zones preserve local calendar days and reject missing/ambiguous clock times", () => {
  const p = plan();
  assert.deepEqual(
    p.data.posts.map((p) => p.local_at),
    [
      "2027-06-06T09:00",
      "2027-06-13T09:00",
      "2027-06-19T09:00",
      "2027-06-20T09:00",
    ],
  );
  assert.equal(
    localInstant("2027-06-20T09:00", "America/New_York"),
    "2027-06-20T13:00:00.000Z",
  );
  assert.equal(
    localInstant("2027-01-20T09:00", "America/New_York"),
    "2027-01-20T14:00:00.000Z",
  );
  assert.throws(
    () => localInstant("2027-03-14T02:30", "America/New_York"),
    /does not exist/,
  );
  assert.throws(
    () => localInstant("2027-11-07T01:30", "America/New_York"),
    /occurs twice/,
  );
  assert.throws(() => localInstant("2027-02-30T09:00", "UTC"), /valid date/);
  assert.throws(
    () => localInstant("2027-06-20T09:00", "Invalid/Zone"),
    /valid IANA/,
  );
  assert.throws(
    () =>
      templatePlan("weekly-deal", {
        subject: "Store",
        anchor: "2027-06-20T09:00",
        timeZone: "UTC",
      }),
    /approved offer/,
  );
  const weekly = templatePlan("weekly-deal", {
    subject: "Store",
    offer: "Save 10% on approved products.",
    anchor: "2027-06-20T09:00",
    timeZone: "UTC",
  });
  assert.equal(weekly.data.posts.at(-1).local_at, "2027-07-11T09:00");
  assert.match(weekly.data.posts[0].body, /Save 10%/);
  const spotlight = templatePlan("spotlight", {
    subject: "Outing",
    sponsor: "A & B",
    anchor: "2027-06-20T09:00",
    timeZone: "UTC",
  });
  assert.match(spotlight.data.posts[2].body, /Thank you to A & B/);
  const registration = templatePlan("registration", {
    subject: "Outing",
    anchor: "2027-06-20T09:00",
    timeZone: "UTC",
  });
  assert.equal(registration.data.posts[0].local_at, "2027-06-13T09:00");
  assert.equal(registration.data.posts.length, 3);
});
test("review validates every planned post; calendar escapes content and preserves stable identities across revisions", () => {
  const p = {
    ...plan(),
    id: crypto.randomUUID(),
    version: 1,
    status: "reviewed",
  };
  assert.equal(campaignProblem(p, true), "");
  const invalid = {
    ...p.data,
    posts: p.data.posts.map((post, i) =>
      i ? post : { ...post, local_at: "2027-06-01T09:00" },
    ),
  };
  assert.match(scheduleProblem(invalid, true), /within the campaign/);
  assert.match(
    scheduleProblem({ ...p.data, posts: [p.data.posts[0], p.data.posts[0]] }),
    /unique/,
  );
  assert.match(
    scheduleProblem(
      { ...p.data, posts: [{ ...p.data.posts[0], local_at: "" }] },
      true,
    ),
    /posting date/,
  );
  const cleaned = cleanCampaignData({
    ...p.data,
    posts: [
      {
        ...p.data.posts[0],
        sent: true,
        published_id: "fake",
        scheduled_at: "fake",
      },
    ],
  });
  assert.equal(cleaned.posts[0].sent, undefined);
  assert.equal(cleaned.posts[0].scheduled_at, undefined);
  p.data.posts[0].body = "A, B; C\nBEGIN:VEVENT\n🚀".repeat(12);
  const calendar = campaignCalendar(p);
  assert.equal(
    calendar.split("\r\n").filter((l) => l === "BEGIN:VEVENT").length,
    4,
  );
  assert.ok(calendar.includes("DTSTART:20270606T130000Z"));
  assert.ok(calendar.includes("SEQUENCE:1"));
  assert.ok(calendar.includes("\\nBEGIN:VEVENT"));
  for (const line of calendar.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
  const uid = calendar.match(/UID:([^\r]+)/)[1];
  assert.ok(campaignCalendar({ ...p, version: 2 }).includes(`UID:${uid}`));
  assert.throws(() => campaignCalendar({ ...p, status: "draft" }), /reviewed/);
  const rows = scheduleRows(
    [p, { ...p, id: crypto.randomUUID(), name: "Other", status: "draft" }],
    "Community",
    "reviewed",
    "2027-06",
    "instant",
    false,
  );
  assert.equal(rows.length, 4);
  assert.equal(rows[0].local_at, "2027-06-20T09:00");
  assert.equal(scheduleRows([p], "nothing", "all", "2027-06").length, 0);
});
test("actual schedule migration canonicalizes UTC, rejects forged delivery and invalid dates, and preserves scope/CAS/audit", async () => {
  const db = new PGlite(),
    owner = crypto.randomUUID(),
    session = crypto.randomUUID(),
    outsider = crypto.randomUUID(),
    outsiderSession = crypto.randomUUID(),
    org = crypto.randomUUID(),
    event = crypto.randomUUID();
  async function as(user, sid, work) {
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({
        sub: user,
        session_id: sid,
        user_metadata: { role: "super_admin" },
      }),
    ]);
    await db.exec("set role authenticated");
    try {
      return await work();
    } finally {
      await db.exec("reset role");
    }
  }
  const campaign = {
    ...plan(),
    id: crypto.randomUUID(),
    version: 0,
    event_id: event,
  };
  async function save(p, status = "reviewed") {
    return (
      await db.query(
        "select public.save_social_campaign($1,$2,$3,$4,$5,$6) as c",
        [p.id, p.version, p.name, p.event_id, JSON.stringify(p.data), status],
      )
    ).rows[0].c;
  }
  try {
    await db.exec(await file("./fixtures/event-builder-base.sql"));
    await db.exec(
      await file(
        "../supabase/migrations/20261007040350_inception_creative_foundation.sql",
      ),
    );
    await db.exec(
      await file(
        "../supabase/migrations/20261007064246_social_campaign_workspace.sql",
      ),
    );
    await db.exec(await file(migration));
    for (const [u, s] of [
      [owner, session],
      [outsider, outsiderSession],
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
      "insert into public.golf_registration_events(id,event_key,name,organization_id) values($1,'synthetic','Synthetic event',$2)",
      [event, org],
    );
    const saved = await as(owner, session, () =>
      save({
        ...campaign,
        data: {
          ...campaign.data,
          posts: campaign.data.posts.map((p) => ({
            ...p,
            sent: true,
            scheduled_at: "2001-01-01T00:00:00Z",
          })),
        },
      }),
    );
    assert.equal(saved.organization_id, org);
    assert.equal(
      Date.parse(saved.data.posts[0].scheduled_at),
      Date.parse("2027-06-06T13:00:00Z"),
    );
    assert.equal(saved.data.posts[0].sent, undefined);
    await as(owner, session, async () => {
      assert.equal(
        (await db.query("select public.list_social_events() as e")).rows[0].e
          .length,
        1,
      );
      await assert.rejects(() => save(campaign), /newer version/);
      await assert.rejects(
        () =>
          save({
            ...saved,
            data: {
              ...saved.data,
              posts: [saved.data.posts[0], saved.data.posts[0]],
            },
          }),
        /unique/,
      );
      await assert.rejects(
        () =>
          save({
            ...saved,
            data: {
              ...saved.data,
              posts: [{ ...saved.data.posts[0], body: "" }],
            },
          }),
        /message/,
      );
      await assert.rejects(
        () =>
          save({
            ...saved,
            data: {
              ...saved.data,
              posts: [{ ...saved.data.posts[0], local_at: "2027-06-01T09:00" }],
            },
          }),
        /within/,
      );
      await assert.rejects(
        () =>
          db.query("update public.social_campaigns set data=$1", [
            JSON.stringify(campaign.data),
          ]),
        /permission denied/,
      );
      await assert.rejects(
        () =>
          save({
            ...saved,
            data: { ...saved.data, time_zone: "Invalid/Zone" },
          }),
        /time zone/,
      );
      await assert.rejects(
        () =>
          save({
            ...saved,
            data: {
              ...saved.data,
              desired_at: "2027-03-14T02:30",
              ends_at: "2027-03-14T04:00",
            },
          }),
        /clock change/,
      );
      await assert.rejects(
        () =>
          save({
            ...saved,
            data: {
              ...saved.data,
              desired_at: "2027-11-07T01:30",
              ends_at: "2027-11-07T04:00",
            },
          }),
        /occurs twice/,
      );
    });
    await as(outsider, outsiderSession, async () => {
      assert.equal(
        (await db.query("select public.list_social_events() as e")).rows[0].e
          .length,
        0,
      );
      assert.equal(
        (await db.query("select * from public.social_campaigns")).rows.length,
        0,
      );
      await assert.rejects(() => save(saved), /event access/);
    });
    const revised = await as(owner, session, () =>
      save(
        {
          ...saved,
          data: {
            ...saved.data,
            posts: saved.data.posts.map((p) => ({
              ...p,
              body: "Revised post",
            })),
          },
        },
        "draft",
      ),
    );
    await as(owner, session, async () => {
      const legacy = { ...revised.data };
      delete legacy.posts;
      await assert.rejects(
        () => save({ ...revised, data: legacy }, "draft"),
        /Refresh the app/,
      );
    });
    assert.equal(revised.reviewed_at, null);
    assert.equal(revised.version, 2);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.social_campaign_versions",
        )
      ).rows[0].n,
      2,
    );
    await db.query(
      "update public.organizations set status='inactive' where id=$1",
      [org],
    );
    await as(owner, session, async () => {
      assert.equal(
        (await db.query("select * from public.social_campaigns")).rows.length,
        0,
      );
      await assert.rejects(() => save(revised), /event access/);
    });
    await db.query(
      "update public.organizations set status='active' where id=$1",
      [org],
    );
    await db.query(
      "update public.organization_memberships set access_ends_at=now()-interval '1 minute' where user_id=$1",
      [owner],
    );
    await as(owner, session, () =>
      assert.rejects(() => save(revised), /event access/),
    );
    await db.query("delete from auth.sessions where id=$1", [session]);
    await as(owner, session, () =>
      assert.rejects(() => save(revised), /active verified/),
    );
  } finally {
    await db.close();
  }
});
