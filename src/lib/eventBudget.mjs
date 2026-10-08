export const COST_CATEGORIES = [
  "Venue & course",
  "Food & beverage",
  "Gifts & swag",
  "Prizes & contests",
  "Signs & printing",
  "Marketing",
  "Staff & services",
  "Fees & insurance",
  "Other",
];
export const INCOME_CATEGORIES = [
  "Registration",
  "Sponsorship",
  "Donation",
  "Sales",
  "Other",
];
export const MAX_BUDGET_ROWS = 250;
export const MAX_AMOUNT_CENTS = 100000000000;
export const dollars = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export const moneyInput = (cents) =>
  cents === null ? "" : (cents / 100).toFixed(2);
export function centsInput(value) {
  const s = String(value).trim();
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [whole, fraction = ""] = s.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) && result <= MAX_AMOUNT_CENTS
    ? result
    : null;
}
export function newBudget() {
  return {
    schema: 1,
    currency: "USD",
    goal_cents: 0,
    contingency_percent: 0,
    sponsor_package_cents: 50000,
    notes: "",
    live_targets: { registration: 0, sponsors: 0 },
    costs: [],
    income: [],
  };
}
export function newBudgetLine(kind) {
  return kind === "costs"
    ? {
        id: crypto.randomUUID(),
        name: "",
        category: "Other",
        vendor: "",
        quantity: 1,
        unit_cents: 0,
        actual_cents: null,
        paid_cents: 0,
        notes: "",
      }
    : {
        id: crypto.randomUUID(),
        name: "",
        category: "Other",
        vendor: "",
        target_cents: 0,
        committed_cents: 0,
        received_cents: 0,
        notes: "",
      };
}
const amount = (v) =>
  Number.isSafeInteger(v) && v >= 0 && v <= MAX_AMOUNT_CENTS;
export function budgetProblem(b) {
  if (!b || b.schema !== 1 || b.currency !== "USD")
    return "This budget must use the supported USD format.";
  if (
    !amount(b.goal_cents) ||
    !amount(b.sponsor_package_cents) ||
    !Number.isInteger(b.contingency_percent) ||
    b.contingency_percent < 0 ||
    b.contingency_percent > 100
  )
    return "Enter a valid event goal, sponsor package value, and contingency from 0 to 100%.";
  if (typeof b.notes !== "string" || b.notes.length > 3000)
    return "Budget notes must be 3,000 characters or fewer.";
  if (
    !b.live_targets ||
    !amount(b.live_targets.registration) ||
    !amount(b.live_targets.sponsors)
  )
    return "Enter valid targets for connected income.";
  for (const kind of ["costs", "income"]) {
    if (!Array.isArray(b[kind]) || b[kind].length > MAX_BUDGET_ROWS)
      return `Keep each list to ${MAX_BUDGET_ROWS} items or fewer.`;
    const ids = new Set();
    for (const row of b[kind]) {
      if (
        row.source_key ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          row.id,
        ) ||
        ids.has(row.id)
      )
        return "Each budget item needs a unique identifier.";
      ids.add(row.id);
      if (
        typeof row.name !== "string" ||
        !row.name.trim() ||
        row.name.length > 160
      )
        return "Give each budget item a name (up to 160 characters).";
      if (
        !(kind === "costs" ? COST_CATEGORIES : INCOME_CATEGORIES).includes(
          row.category,
        )
      )
        return "Choose a supported category.";
      if (
        typeof row.vendor !== "string" ||
        row.vendor.length > 160 ||
        typeof row.notes !== "string" ||
        row.notes.length > 1000
      )
        return "Keep vendor or source names under 160 characters and item notes under 1,000.";
      if (kind === "costs") {
        if (
          !Number.isInteger(row.quantity) ||
          row.quantity < 1 ||
          row.quantity > 100000 ||
          !amount(row.unit_cents) ||
          row.quantity * row.unit_cents > MAX_AMOUNT_CENTS
        )
          return "Enter a whole quantity and a valid unit estimate.";
        if (
          (row.actual_cents !== null && !amount(row.actual_cents)) ||
          !amount(row.paid_cents) ||
          row.paid_cents > (row.actual_cents ?? 0)
        )
          return "Paid costs cannot exceed actual costs. Enter the actual total before recording payment.";
      } else if (
        ![row.target_cents, row.committed_cents, row.received_cents].every(
          amount,
        ) ||
        row.received_cents > row.committed_cents
      )
        return "Received income cannot exceed the committed total. The committed total includes money already received.";
    }
  }
  return "";
}
export function withLiveIncome(b, sources) {
  return {
    ...b,
    income: [
      ...b.income,
      ...(sources?.income || []).map((r) => ({
        ...r,
        target_cents: Math.max(
          r.target_cents || 0,
          b.live_targets[r.source_key] || 0,
        ),
      })),
    ],
  };
}
export function budgetTotals(b, sources) {
  b = withLiveIncome(b, sources);
  const planned = b.costs.reduce((s, r) => s + r.quantity * r.unit_cents, 0);
  const actual = b.costs.reduce((s, r) => s + (r.actual_cents ?? 0), 0);
  const forecast = b.costs.reduce(
    (s, r) => s + (r.actual_cents ?? r.quantity * r.unit_cents),
    0,
  );
  const paid = b.costs.reduce((s, r) => s + r.paid_cents, 0);
  const contingency = Math.round((planned * b.contingency_percent) / 100);
  const target = b.income.reduce((s, r) => s + r.target_cents, 0);
  const projectedIncome = b.income.reduce(
    (s, r) => s + Math.max(r.target_cents, r.committed_cents),
    0,
  );
  const committed = b.income.reduce((s, r) => s + r.committed_cents, 0);
  const received = b.income.reduce((s, r) => s + r.received_cents, 0);
  const needed = forecast + contingency + b.goal_cents;
  const gap = Math.max(0, needed - committed);
  return {
    planned,
    actual,
    forecast,
    paid,
    contingency,
    target,
    projectedIncome,
    committed,
    received,
    needed,
    gap,
    projectedNet: projectedIncome - forecast - contingency,
    cash: received - paid,
    outstandingIncome: committed - received,
    unpaidCosts: actual - paid,
    missingActuals: b.costs.filter((r) => r.actual_cents === null).length,
    sponsorCount:
      b.sponsor_package_cents > 0
        ? Math.ceil(gap / b.sponsor_package_cents)
        : null,
  };
}
export function budgetStarter(kind) {
  const b = newBudget();
  const names =
    kind === "golf"
      ? [
          ["Course & carts", "Venue & course"],
          ["Meals & beverages", "Food & beverage"],
          ["Player gifts", "Gifts & swag"],
          ["Prizes & hole challenges", "Prizes & contests"],
          ["Tee signs & banners", "Signs & printing"],
          ["Event staff", "Staff & services"],
        ]
      : [
          ["Venue rental", "Venue & course"],
          ["Food & beverages", "Food & beverage"],
          ["Gifts & prizes", "Gifts & swag"],
          ["Signs & programs", "Signs & printing"],
          ["Event promotion", "Marketing"],
          ["Event staff", "Staff & services"],
        ];
  b.costs = names.map(([name, category]) => ({
    ...newBudgetLine("costs"),
    name,
    category,
  }));
  b.income = [["Outside donations", "Donation"]].map(([name, category]) => ({
    ...newBudgetLine("income"),
    name,
    category,
  }));
  return b;
}
export function visibleBudgetRows(rows, search, category, sort) {
  const term = search.trim().toLocaleLowerCase();
  const found = rows.filter(
    (r) =>
      (!category || r.category === category) &&
      (!term ||
        [r.name, r.category, r.vendor, r.notes].some((v) =>
          v.toLocaleLowerCase().includes(term),
        )),
  );
  if (!sort?.key) return found;
  const value = (r) =>
    sort.key === "planned" ? r.quantity * r.unit_cents : r[sort.key];
  return [...found].sort((a, b) => {
    const av = value(a),
      bv = value(b);
    const result =
      av === null
        ? bv === null
          ? 0
          : -1
        : bv === null
          ? 1
          : typeof av === "number"
            ? av - bv
            : String(av).localeCompare(String(bv), undefined, {
                sensitivity: "base",
              });
    return (
      (sort.direction === "desc" ? -result : result) || a.id.localeCompare(b.id)
    );
  });
}
export function budgetCsv(b, eventName, version = 0, sources = null) {
  const issue = budgetProblem(b);
  if (issue) throw new Error(issue);
  const t = budgetTotals(b, sources);
  b = withLiveIncome(b, sources);
  const rows = [
    ["Event budget", eventName],
    ["Version", version || "Unsaved draft"],
    ["Currency", "USD"],
    ["System totals refreshed", sources?.refreshed_at || "Unavailable"],
    [
      "Record type",
      "Name",
      "Category",
      "Vendor / source",
      "Quantity",
      "Unit estimate",
      "Planned / target",
      "Actual / committed total",
      "Paid / received",
      "Notes",
    ],
  ];
  for (const r of b.costs)
    rows.push([
      "Cost",
      r.name,
      r.category,
      r.vendor,
      r.quantity,
      r.unit_cents / 100,
      (r.quantity * r.unit_cents) / 100,
      r.actual_cents === null ? "" : r.actual_cents / 100,
      r.paid_cents / 100,
      r.notes,
    ]);
  for (const r of b.income)
    rows.push([
      r.source_key ? "System income" : "Manual income",
      r.name,
      r.category,
      r.vendor,
      "",
      "",
      r.target_cents / 100,
      r.committed_cents / 100,
      r.received_cents / 100,
      r.notes,
    ]);
  rows.push(
    [],
    ["Summary", "Amount (USD)"],
    ...[
      ["Cost estimate", t.planned],
      ["Cost forecast", t.forecast],
      ["Actual costs entered", t.actual],
      ["Costs paid", t.paid],
      ["Contingency reserve", t.contingency],
      ["Income target", t.target],
      ["Projected income", t.projectedIncome],
      ["Committed income including received", t.committed],
      ["Received income", t.received],
      ["Projected net after reserve", t.projectedNet],
      ["Cash remaining", t.cash],
      ["Event net goal", b.goal_cents],
      ["Additional committed funding needed", t.gap],
    ].map(([label, v]) => [label, v / 100]),
    ["Notes", b.notes],
  );
  return (
    rows
      .map((row) =>
        row
          .map((v) => {
            const s = String(v);
            return (
              '"' +
              (typeof v === "string" && /^[\s]*[=+\-@]/.test(s) ? "'" : "") +
              s.replaceAll('"', '""') +
              '"'
            );
          })
          .join(","),
      )
      .join("\r\n") + "\r\n"
  );
}
