import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  cleanHangarWebsite, hangarDomain, normalizeHangarName,
  onboardingProblem, suggestExistingHangars
} from "../src/lib/hangarOnboarding.mjs";

const file = path => readFile(new URL(path, import.meta.url), "utf8");
const admin = "10000000-0000-0000-0000-000000000001";
const other = "10000000-0000-0000-0000-000000000002";

test("client-side match review checks name, site and test isolation without auto-merging", () => {
  const orgs = [
    { id: "1", name: "Chapel Hill Golf Course", website_url: "https://www.chapelhillgolf.net/", is_test: false },
    { id: "2", name: "Chapel Hill Catering", website_url: "https://catering.example.com/", is_test: true }
  ];
  assert.equal(normalizeHangarName("Chapel-Hill Golf Course"), normalizeHangarName("CHAPEL HILL golf course"));
  assert.equal(hangarDomain("https://www.chapelhillgolf.net/tour"), "chapelhillgolf.net");
  const name = suggestExistingHangars(orgs, { name: "Chapel Hill Golf Course" });
  assert.equal(name.length, 1);
  assert.equal(name[0].organization.id, "1");
  assert.equal(name[0].definite, true);
  const site = suggestExistingHangars(orgs, { name: "Other business", websiteUrl: "https://chapelhillgolf.net/offers" });
  assert.equal(site[0].organization.id, "1");
  assert.equal(site[0].definite, true);
  const separateTest = suggestExistingHangars(orgs, { name: "Chapel Hill Catering", isTest: false });
  assert.deepEqual(separateTest, []);
  assert.equal(cleanHangarWebsite("example.com"), "https://example.com/");
  assert.throws(() => cleanHangarWebsite("http://localhost/private"), /HTTPS/i);
  assert.throws(() => cleanHangarWebsite("https://someone:pass@example.com"), /HTTPS/i);
  assert.equal(onboardingProblem({ name: "Restaurant", organizationType: "business" }), "");
  assert.match(onboardingProblem({ name: "Restaurant", organizationType: "business", invitePilot: true }), /Pilot/i);
});

test("Hanger onboarding database function checks admin, exact duplicates, audit and zero-app creation", async () => {
  const db = new PGlite();
  async function as(user, task) {
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: user })
    ]);
    await db.exec("set role authenticated");
    try { return await task(); }
    finally { await db.exec("reset role"); }
  }
  const start = async ({ name, site = null, isTest = false, source = "hometown_magazine" }) => {
    const result = await db.query(
      "select public.begin_hangar_onboarding($1,$2,$3,$4,$5,$6,$7) as response",
      [name, "business", site, "Manager", "manager@example.com", isTest, source]
    );
    return result.rows[0].response;
  };
  try {
    await db.exec(await file("./fixtures/event-builder-base.sql"));
    await db.exec(`
      alter table public.organizations alter column id set default gen_random_uuid();
      alter table public.organizations add column organization_type text not null default 'business';
      alter table public.organizations add column is_test boolean not null default false;
      alter table public.organizations add column onboarding_status text not null default 'profile_incomplete';
      alter table public.organizations add column created_at timestamptz not null default now();
      create table public.organization_profiles (
        organization_id uuid primary key references public.organizations(id) on delete cascade,
        primary_contact_name text, primary_contact_email text, website_url text,
        setup_sections jsonb not null default '{}'::jsonb
      );
      grant select on public.organizations, public.organization_profiles to authenticated;
      create or replace function public.is_eig_admin() returns boolean
        language sql stable as $$select auth.uid() = '10000000-0000-0000-0000-000000000001'::uuid$$;
      insert into auth.users(id) values ('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002');
    `);
    await db.exec(await file("../supabase/migrations/20261013090000_hangar_onboarding_foundation.sql"));

    await assert.rejects(
      () => as(other, () => start({ name: "Unauthorized company" })),
      /EIG administrator|permission|not permitted/i
    );

    const first = await as(admin, () => start({ name: "Hometown Bakery", site: "https://www.bakery.example.com/" }));
    assert.equal(first.outcome, "created");
    assert.ok(first.organization.id);
    assert.equal(first.organization.onboarding_status, "profile_incomplete");

    const duplicate = await as(admin, () => start({ name: "Hometown-Bakery" }));
    assert.equal(duplicate.outcome, "matches");
    assert.equal(duplicate.candidates[0].id, first.organization.id);

    const bySite = await as(admin, () => start({ name: "Different Name", site: "https://bakery.example.com/" }));
    assert.equal(bySite.outcome, "matches");
    assert.equal(bySite.candidates[0].id, first.organization.id);

    const testCompany = await as(admin, () => start({ name: "Hometown Bakery", isTest: true }));
    assert.equal(testCompany.outcome, "created");

    await assert.rejects(
      () => as(admin, () => start({ name: "Not HTTPS", site: "http://bakery.example.com/" })),
      /HTTPS/i
    );
    await db.exec("reset role");
    const count = await db.query("select count(*)::int as count from public.organizations");
    assert.equal(count.rows[0].count, 2);
    const profile = await db.query("select website_url from public.organization_profiles where organization_id=$1", [first.organization.id]);
    assert.equal(profile.rows[0].website_url, "https://www.bakery.example.com/");
    const membershipCount = await db.query("select count(*)::int as count from public.organization_memberships where organization_id=$1", [first.organization.id]);
    assert.equal(membershipCount.rows[0].count, 0);
    const audit = await db.query("select action,source,actor_user_id from public.hangar_onboarding_events where organization_id=$1", [first.organization.id]);
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0].source, "hometown_magazine");
    assert.equal(audit.rows[0].actor_user_id, admin);

    // The audit is not a new privileged data surface for ordinary accounts.
    const unseen = await as(other, async () => {
      const r = await db.query("select count(*)::int as count from public.hangar_onboarding_events");
      return r.rows[0].count;
    });
    assert.equal(unseen, 0);
  } finally {
    await db.close();
  }
});

test("Command Center wiring preserves core Cockpit with no EIE entitlement", async () => {
  const app = await file("../src/PlatformApp.jsx");
  const cockpit = await file("../src/components/CoreCockpitServices.jsx");
  assert.match(app, /begin_hangar_onboarding/);
  assert.match(app, /hasEieApp/);
  assert.match(app, /if \(!hasEieApp\)/);
  assert.match(app, /CoreCockpitServices/);
  for (const title of ["Contracts", "Financials", "Ad Proofs", "Ad Tracking"])
    assert.ok(cockpit.includes(title));
  assert.match(cockpit, /Data connection pending/);
});
