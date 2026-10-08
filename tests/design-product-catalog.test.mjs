import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  newDesignProduct,
  cleanDesignProduct,
  cleanProductDefinition,
  productProblem,
  catalogDesignProblem,
  designForProduct,
} from "../src/lib/designProducts.mjs";
import {
  newProductProject,
  newProject,
  materialDesign,
  cleanProjectData,
  projectHandoff,
} from "../src/lib/inceptionProject.mjs";
import { flyerSvg } from "../src/lib/eventCreative.mjs";
const migration =
  "../supabase/migrations/20261008054858_eic_design_product_catalog.sql";
const file = (p) => readFile(new URL(p, import.meta.url), "utf8");
const owner = "10000000-0000-0000-0000-000000000001",
  other = "10000000-0000-0000-0000-000000000002";
const sid = "20000000-0000-0000-0000-000000000001",
  otherSid = "20000000-0000-0000-0000-000000000002",
  org = "30000000-0000-0000-0000-000000000001";
function example() {
  return cleanDesignProduct({
    ...newDesignProduct(),
    name: "Tee sign",
    version: 1,
    status: "active",
    definition: {
      ...newDesignProduct().definition,
      canvas_width: 1000,
      canvas_height: 700,
      finished_size: "24 × 18 in",
      print_area: "Front face",
      qr_size: 200,
      qr_corner: "top-left",
    },
  });
}
test("product artwork uses fixed geometry and snapshots specifications independently of later catalog edits", () => {
  const product = example(),
    p = newProductProject(product, { name: "Sponsor showcase" });
  assert.equal(p.data.design.width, 1000);
  assert.equal(p.data.design.height, 700);
  assert.equal(p.data.design.link.x, 24);
  assert.equal(p.data.design.link.size, 200);
  assert.equal(p.data.catalog.print_area, "Front face");
  p.data.design.link = {
    ...p.data.design.link,
    url: "https://example.com/sponsor",
    showQr: true,
  };
  const reopened = cleanProjectData(JSON.parse(JSON.stringify(p.data)));
  product.definition.canvas_width = 1500;
  product.version = 2;
  assert.equal(reopened.catalog.version, 1);
  assert.equal(reopened.catalog.canvas_width, 1000);
  const handoff = projectHandoff({
    ...p,
    data: reopened,
    status: "approved",
    version: 1,
  });
  assert.equal(handoff.catalog_product.id, p.data.catalog.id);
  assert.equal(handoff.production.size, "24 × 18 in");
  assert.ok(handoff.artwork_svg.includes('data-creative-link="true"'));
  assert.ok(!handoff.artwork_svg.includes("stroke-dasharray"));
  reopened.design.width = 900;
  assert.ok(catalogDesignProblem(reopened));
  assert.throws(
    () =>
      projectHandoff({ ...p, data: reopened, status: "approved", version: 1 }),
    /fits/,
  );
  assert.equal(cleanProjectData(newProject("flyer").data).catalog, null);
});
test("shared product starter clears destinations and bound wording, retains intended layout and rejects wrong dimensions", () => {
  const product = example(),
    template = designForProduct(product.definition, materialDesign("sign"));
  template.boxes[0].text = "Private event";
  template.link = {
    ...template.link,
    url: "https://example.com/private",
    showQr: true,
  };
  const definition = cleanProductDefinition({
    ...product.definition,
    template,
  });
  assert.equal(definition.template.boxes[0].text, "");
  assert.equal(definition.template.link.url, "");
  assert.equal(definition.template.link.showQr, false);
  const p = newProductProject({ ...product, definition });
  assert.equal(p.data.design.boxes[0].x, template.boxes[0].x);
  assert.equal(p.data.design.link.url, "");
  assert.ok(
    productProblem({
      ...product,
      definition: { ...definition, canvas_width: 1200 },
    }),
  );
  assert.ok(
    productProblem({ ...product, definition: { ...definition, qr_size: 700 } }),
  );
  assert.ok(
    productProblem({
      ...product,
      definition: { ...definition, canvas_width: 9999 },
    }),
  );
  assert.equal(
    cleanProductDefinition({ image: 'data:image/svg+xml,<svg onload="bad"/>' })
      .image,
    "",
  );
  assert.ok(
    flyerSvg(p.data.design, { name: "New sponsor" }).includes("New sponsor"),
  );
});
test("catalog SQL restricts management, publication, immutable audit, fresh sessions and compare-and-swap", async () => {
  const db = new PGlite();
  async function as(user, session, work) {
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: user, session_id: session }),
    ]);
    await db.exec("set role authenticated");
    try {
      return await work();
    } finally {
      await db.exec("reset role");
    }
  }
  async function save(p) {
    return (
      await db.query(
        "select public.save_design_product($1,$2,$3,$4,$5,$6,$7,$8) as product",
        [
          p.id,
          p.version,
          p.name,
          p.category,
          p.material,
          p.status,
          p.description,
          JSON.stringify(p.definition),
        ],
      )
    ).rows[0].product;
  }
  try {
    await db.exec(await file("./fixtures/event-builder-base.sql"));
    await db.exec(
      await file(
        "../supabase/migrations/20261007040350_inception_creative_foundation.sql",
      ),
    );
    await db.exec(await file(migration));
    await db.exec(
      await file(
        "../supabase/migrations/20261008055348_eic_design_product_sorting.sql",
      ),
    );
    for (const [user, session] of [
      [owner, sid],
      [other, otherSid],
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
      "insert into public.organizations(id,name,slug) values($1,'EIG','elevated-impact-group')",
      [org],
    );
    await db.query(
      "insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'eig_admin')",
      [org, owner],
    );
    const p = {
      ...example(),
      version: 0,
      status: "draft",
      name: "Private draft sign",
    };
    const saved = await as(owner, sid, () => save(p));
    assert.equal(saved.created_by, owner);
    assert.equal(saved.version, 1);
    await as(owner, sid, async () => {
      const a = await save({
        ...example(),
        id: crypto.randomUUID(),
        version: 0,
        status: "draft",
        name: "alpha",
      });
      const z = await save({
        ...example(),
        id: crypto.randomUUID(),
        version: 0,
        status: "draft",
        name: "Zeta",
      });
      assert.deepEqual(
        (
          await db.query(
            "select name from public.eic_design_products where id=any($1::uuid[]) order by sort_name,id",
            [[a.id, z.id]],
          )
        ).rows.map((r) => r.name),
        ["alpha", "Zeta"],
      );
      const keys = (
        await db.query(
          "select sort_material,sort_status from public.eic_design_products where name='Swag artwork'",
        )
      ).rows[0];
      assert.deepEqual(keys, {
        sort_material: "gifts & swag",
        sort_status: "available",
      });
    });
    await as(other, otherSid, async () => {
      assert.equal(
        (await db.query("select id from public.eic_design_products")).rows
          .length,
        4,
      );
      assert.equal(
        (await db.query("select * from public.eic_design_product_versions"))
          .rows.length,
        0,
      );
      assert.equal(
        (await db.query("select public.design_product_catalog_access() as a"))
          .rows[0].a.can_manage,
        false,
      );
      await assert.rejects(save(saved), /EIG catalog/);
      await assert.rejects(
        db.query("update public.eic_design_products set name='changed'"),
        /permission denied/,
      );
      await assert.rejects(
        db.query(
          "insert into public.eic_design_products(id) values(gen_random_uuid())",
        ),
        /permission denied/,
      );
      await assert.rejects(
        db.query("delete from public.eic_design_products"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select created_by from public.eic_design_products"),
        /permission denied/,
      );
    });
    const available = await as(owner, sid, () =>
      save({ ...saved, status: "active" }),
    );
    await as(other, otherSid, async () =>
      assert.equal(
        (
          await db.query(
            "select id from public.eic_design_products where id=$1",
            [p.id],
          )
        ).rows.length,
        1,
      ),
    );
    await as(owner, sid, async () => {
      await assert.rejects(save(saved), /newer product/);
      await assert.rejects(
        save({
          ...available,
          definition: { ...available.definition, canvas_width: 9999 },
        }),
        /Invalid product/,
      );
      await assert.rejects(
        save({
          ...available,
          definition: {
            ...available.definition,
            template: {
              version: 1,
              width: 1000,
              height: 700,
              boxes: [],
              link: { url: "https://example.com/private" },
            },
          },
        }),
        /Invalid product/,
      );
      assert.equal(
        (
          await db.query(
            "select snapshot from public.eic_design_product_versions where product_id=$1 order by version",
            [p.id],
          )
        ).rows[0].snapshot.status,
        "draft",
      );
      await assert.rejects(
        db.query("update public.eic_design_product_versions set version=999"),
        /permission denied/,
      );
    });
    const archived = await as(owner, sid, () =>
      save({ ...available, status: "archived" }),
    );
    assert.equal(archived.version, 3);
    await as(other, otherSid, async () =>
      assert.equal(
        (
          await db.query(
            "select id from public.eic_design_products where id=$1",
            [p.id],
          )
        ).rows.length,
        0,
      ),
    );
    for (const change of [
      "status='revoked'",
      "status='active',access_ends_at=now()-interval '1 minute'",
      "status='active',access_ends_at=null,access_starts_at=now()+interval '1 day'",
    ]) {
      await db.exec("update public.organization_memberships set " + change);
      await as(owner, sid, () => assert.rejects(save(archived), /EIG catalog/));
    }
    await db.exec(
      "update public.organization_memberships set status='active',access_ends_at=null,access_starts_at=null",
    );
    await db.query("delete from auth.sessions where id=$1", [sid]);
    await as(owner, sid, async () => {
      assert.equal(
        (await db.query("select id from public.eic_design_products")).rows
          .length,
        0,
      );
      await assert.rejects(save(archived), /EIG catalog/);
    });
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select id from public.eic_design_products"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.design_product_catalog_access()"),
      /permission denied/,
    );
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});
