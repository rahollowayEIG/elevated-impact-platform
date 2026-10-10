import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  newBudget,
  newBudgetLine,
  budgetStarter,
  budgetProblem,
  budgetTotals,
  centsInput,
  budgetCsv,
  visibleBudgetRows,
} from "../src/lib/eventBudget.mjs";
const file = (path) => readFile(new URL(path, import.meta.url), "utf8");
function example() {
  const b = newBudget();
  b.goal_cents = 100000;
  b.contingency_percent = 10;
  b.costs = [
    {
      ...newBudgetLine("costs"),
      name: "Meals",
      quantity: 10,
      unit_cents: 10000,
    },
    {
      ...newBudgetLine("costs"),
      name: "Venue",
      unit_cents: 200000,
      actual_cents: 220000,
      paid_cents: 100000,
    },
  ];
  b.income = [
    {
      ...newBudgetLine("income"),
      name: "Outside donation",
      target_cents: 100000,
      committed_cents: 50000,
      received_cents: 20000,
    },
  ];
  return b;
}
test("exact cents, estimates versus actual zero, contingency, committed totals and source targets without duplicate receipts", () => {
  assert.equal(centsInput("0.29"), 29);
  assert.equal(centsInput("1.001"), null);
  assert.equal(centsInput("-1"), null);
  assert.equal(centsInput(""), null);
  assert.equal(centsInput("1e2"), null);
  const b = example();
  b.live_targets.registration = 200000;
  const sources = {
    income: [
      {
        source_key: "registration",
        target_cents: 0,
        committed_cents: 100000,
        received_cents: 80000,
      },
      {
        source_key: "sponsors",
        target_cents: 50000,
        committed_cents: 25000,
        received_cents: 25000,
      },
    ],
  };
  const t = budgetTotals(b, sources);
  assert.equal(t.forecast, 320000);
  assert.equal(t.contingency, 30000);
  assert.equal(t.projectedIncome, 350000);
  assert.equal(t.committed, 175000);
  assert.equal(t.received, 125000);
  assert.equal(t.cash, 25000);
  assert.equal(t.gap, 275000);
  assert.equal(t.sponsorCount, 6);
  b.costs[0].actual_cents = 0;
  assert.equal(budgetTotals(b).forecast, 220000);
  assert.equal(budgetTotals(b).missingActuals, 0);
  b.costs[0].paid_cents = 1;
  assert.match(budgetProblem(b), /Paid/);
  b.costs[0].paid_cents = 0;
  b.income[0].received_cents = 60000;
  assert.match(budgetProblem(b), /Received/);
  const draft = budgetStarter("golf");
  assert.equal(budgetProblem(draft), "");
  assert.equal(budgetTotals(draft).received, 0);
  assert.ok(draft.costs.some((r) => r.name.includes("Tee signs")));
});
test("search, stable text and numeric sorting, export includes provenance and prevents spreadsheet formulas", () => {
  const b = example();
  b.income[0].name = '=HYPERLINK("bad")';
  b.notes = "\t=cmd";
  const csv = budgetCsv(b, "Demo", 3, {
    refreshed_at: "2026-10-08T18:00:00Z",
    income: [],
  });
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes("'\t=cmd"));
  assert.ok(csv.includes("System totals refreshed"));
  assert.ok(csv.includes("Additional committed funding needed"));
  const compCsv = budgetCsv(b, "Demo", 3, {
    refreshed_at: "2026-10-08T18:00:00Z",
    income: [],
    comps: { value_cents: 48000, spot_count: 4, fee_count: 1 },
  });
  assert.ok(compCsv.includes("Complimentary registration face value (USD)"));
  assert.ok(compCsv.includes('"480"'));
  assert.ok(compCsv.includes("Active Comp golfer spots (count)"));
  assert.equal(budgetTotals(b, { income: [], comps: { value_cents: 48000, spot_count: 4, fee_count: 1 } }).received,
    budgetTotals(b, { income: [] }).received);

  const rows = [
    { ...b.costs[0], name: "zebra", notes: "signs" },
    { ...b.costs[1], name: "Alpha" },
  ];
  assert.deepEqual(
    visibleBudgetRows(rows, "", "", { key: "name", direction: "asc" }).map(
      (r) => r.name,
    ),
    ["Alpha", "zebra"],
  );
  assert.deepEqual(
    visibleBudgetRows(rows, "", "", { key: "planned", direction: "desc" }).map(
      (r) => r.name,
    ),
    ["Alpha", "zebra"],
  );
  assert.equal(visibleBudgetRows(rows, "SIGN", "", null).length, 1);
});
test("real budget SQL aggregates sources once, preserves income after withdrawal, excludes full refunds, protects scope and audit", async () => {
  const db = new PGlite();
  const u = "10000000-0000-0000-0000-000000000001",
    other = "10000000-0000-0000-0000-000000000002",
    sid = "20000000-0000-0000-0000-000000000001",
    osid = "20000000-0000-0000-0000-000000000002",
    org = "30000000-0000-0000-0000-000000000001",
    e = "40000000-0000-0000-0000-000000000001",
    e2 = "40000000-0000-0000-0000-000000000002";
  async function as(user, session, work) {
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({
        sub: user,
        session_id: session,
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
  const read = async () =>
    (await db.query("select public.read_eie_event_budget($1) as result", [e]))
      .rows[0].result;
  const save = async (version, b) =>
    (
      await db.query(
        "select public.save_eie_event_budget($1,$2,$3) as result",
        [e, version, JSON.stringify(b)],
      )
    ).rows[0].result;
  try {
    await db.exec(await file("./fixtures/event-builder-base.sql"));
    await db.exec(
      `create table public.golf_registrations(id uuid primary key default gen_random_uuid(),event_id uuid,price numeric,amount_paid numeric,convenience_fee numeric,payment_status text default 'pending',registration_status text default 'active',spot_hold_status text,refunded_at timestamptz,payment_reference text);`,
    );
    await db.exec(
      await file(
        "../supabase/migrations/20261007040350_inception_creative_foundation.sql",
      ),
    );
    await db.exec(
      await file("../supabase/migrations/20261008182645_eie_event_budgets.sql"),
    );
    await db.exec(
      await file("../supabase/migrations/20261010052030_eie_budget_comp_value_metric.sql"),
    );
    for (const [user, session] of [
      [u, sid],
      [other, osid],
    ]) {
      await db.query(
        "insert into auth.users(id,email_confirmed_at) values($1,now())",
        [user],
      );
      await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
        session,
        user,
      ]);
      await db.query("insert into public.profiles(id) values($1)", [user]);
    }
    await db.query(
      "insert into public.organizations(id,name) values($1,'Demo')",
      [org],
    );
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'organization_admin')",
      [org, u],
    );
    for (const id of [e, e2])
      await db.query(
        "insert into public.golf_registration_events(id,organization_id,event_key,name) values($1::uuid,$2,$1::text,'Demo')",
        [id, org],
      );
    const records = [
      [400, 412, 12, "paid", "active", null, null],
      [0, 0, 0, "paid", "active", null, null],
      [50, null, 0, "pending", "active", null, null],
      [50, 50, 12, "paid", "active", null, "clubhouse"],
      [100, 103, 3, "paid", "withdrawn", null, null],
      [100, 103, 3, "refunded", "cancelled", "2026-10-01", null],
      [100, 0, 0, "comp", "active", null, null],
      [70, null, 0, "pending", "cancelled", null, null],
    ];
    for (const row of records)
      await db.query(
        "insert into public.golf_registrations(event_id,price,amount_paid,convenience_fee,payment_status,registration_status,refunded_at,payment_reference) values($1,$2,$3,$4,$5,$6,$7,$8)",
        [e, ...row],
      );
    await db.query(
      "insert into public.golf_registrations(event_id,price,payment_status) values($1,9999,$2)",
      [e2, "paid"],
    );
    await db.query(
      "insert into public.event_builder_assets(event_id,version,updated_by,data) values($1,1,$2,$3)",
      [
        e,
        u,
        JSON.stringify({
          sponsors: {
            sales: [
              { quantity: 2, unit_price: 500, paid: false },
              { quantity: 1, unit_price: 250, paid: true },
            ],
          },
        }),
      ],
    );
    let first = await as(u, sid, read);
    assert.equal(first.budget, null);
    let live = first.sources.income;
    assert.equal(live[0].committed_cents, 60000);
    assert.equal(live[0].received_cents, 55000);
    assert.deepEqual(first.sources.comps, {
      value_cents: 10000,
      spot_count: 1,
      fee_count: 1,
    });

    assert.equal(live[1].target_cents, 125000);
    assert.equal(live[1].committed_cents, 25000);
    assert.equal(live[1].received_cents, 25000);
    const b = example();
    first = await as(u, sid, () => save(0, b));
    assert.equal(first.budget.version, 1);
    assert.equal(first.history[0].actor_user_id, u);
    await assert.rejects(
      as(u, sid, () => save(0, b)),
      /newer budget/,
    );
    await assert.rejects(
      as(u, sid, () => save(1, { ...b, currency: "EUR" })),
      /Invalid/,
    );
    await assert.rejects(
      as(u, sid, () => save(1, { ...b, schema: undefined })),
      /Invalid/,
    );
    await assert.rejects(
      as(u, sid, () =>
        save(1, { ...b, costs: [{ ...b.costs[0], unit_cents: 0.5 }] }),
      ),
      /Invalid/,
    );
    await assert.rejects(
      as(u, sid, () =>
        db.exec("update public.eie_event_budgets set version=99"),
      ),
      /permission denied/,
    );
    await assert.rejects(as(other, osid, read), /Authorized/);
    await assert.rejects(
      as(other, osid, () => save(0, b)),
      /Authorized/,
    );
    assert.equal(
      (
        await as(other, osid, () =>
          db.query("select * from public.eie_event_budgets"),
        )
      ).rows.length,
      0,
    );
    await db.query(
      "insert into public.event_assignments(event_id,user_id,role) values($1,$2,'event_coordinator')",
      [e, other],
    );
    assert.equal((await as(other, osid, read)).budget.version, 1);
    await db.query(
      "update public.event_assignments set access_ends_at=now() where user_id=$1",
      [other],
    );
    await assert.rejects(as(other, osid, read), /Authorized/);
    await db.query(
      "update public.organizations set status='inactive' where id=$1",
      [org],
    );
    await assert.rejects(as(u, sid, read), /Authorized/);
    await db.query(
      "update public.organizations set status='active' where id=$1",
      [org],
    );
    await db.query("delete from auth.sessions where id=$1", [sid]);
    await assert.rejects(as(u, sid, read), /Authorized/);
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select public.read_eie_event_budget($1)", [e]),
      /permission denied/,
    );
    await db.exec("reset role");
    const revision = (
      await db.query("select * from public.eie_event_budget_versions")
    ).rows;
    assert.equal(revision.length, 1);
    assert.deepEqual(revision[0].data, b);
    assert.equal(revision[0].source_snapshot.income[0].received_cents, 55000);
  } finally {
    await db.close();
  }
});
