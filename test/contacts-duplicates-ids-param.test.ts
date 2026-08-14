// w39-c: GET /contacts/duplicates?ids= resolves its OWN pair server-side,
// against the SAME stably-ordered array the unfiltered list pages -- a pair
// that sorts past the default page (clamped through listPerPage) must still
// come back with a true position + the full total, never a page-length
// masquerading as a total (MergePage.tsx used to findIndex over just the
// first page's items). Mirrors test/contacts-duplicates-merge-route.test.ts's
// fake-db-queue pattern (no D1 test harness exists in stage 1).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const ORG_B = "org-b";

function contactRaw(id: string, orgId: string, email: string, firstName: string, lastName: string, createdAt = 1000) {
  return {
    id,
    orgId,
    firstName,
    lastName,
    email,
    phone: null,
    company: null,
    title: null,
    bio: null,
    headshotUrl: null,
    socialLinksJson: null,
    notes: null,
    customFieldsJson: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

/** Feeds successive db.select() calls the queued row sets, in order. */
function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  };
  return { db: db as unknown as AppEnv["Variables"]["db"] };
}

function appWithDbAndAuth(db: AppEnv["Variables"]["db"], auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", contactsRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

// Build 251 duplicate pairs (id-sortable so findDuplicateGroupsForOrg's
// first-contact-id tiebreak orders them p000 < p001 < ... < p250), each pair
// sharing an email so every pair is its own group. The pair at index 250 is
// the 251st group -- past the 200-row default page GET /contacts/duplicates
// (without ?ids=) would have clamped to.
function buildManyPairs(count: number) {
  const rows: ReturnType<typeof contactRaw>[] = [];
  for (let i = 0; i < count; i++) {
    const idx = String(i).padStart(4, "0");
    rows.push(contactRaw(`p${idx}a`, ORG_A, `dup${idx}@example.com`, "Dup", `Person${idx}`));
    rows.push(contactRaw(`p${idx}b`, ORG_A, `dup${idx}@example.com`, "Dup", `Person${idx}`));
  }
  return rows;
}

describe("GET /api/v1/contacts/duplicates?ids= (w39-c)", () => {
  it("returns the exact pair, its true position, and the FULL total even when it sorts past the default page", async () => {
    const allRows = buildManyPairs(251);
    const target = ["p0250a", "p0250b"];

    const { db } = fakeDb([
      [allRows[500], allRows[501]], // requireOwnedContacts([p0250a, p0250b])
      allRows, // contact scan (findDuplicateGroupsForOrg)
      [], // dismissed pair keys
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      new Request(`http://local/api/v1/contacts/duplicates?ids=${target.join(",")}`),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      items: { contactIds: string[] }[];
      total: number;
      page: number;
      perPage: number;
      position: number | null;
    };

    expect(json.items).toHaveLength(1);
    expect(json.items[0]!.contactIds.sort()).toEqual([...target].sort());
    expect(json.total).toBe(251);
    expect(json.page).toBe(1);
    expect(json.position).toBe(251);
    expect(json.position!).toBeGreaterThan(json.perPage);
  });

  it("an ids set matching no duplicate group returns items: [] with the true (unfiltered) total", async () => {
    const allRows = buildManyPairs(3);
    // "p0000a" alone (or with a foreign id) never groups with anything.
    const { db } = fakeDb([
      [allRows[0]], // requireOwnedContacts(["p0000a"]) -- only itself is owned
      allRows, // contact scan
      [], // dismissed pair keys
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    // requireOwnedContacts requires every id to resolve; use a single real id
    // twice so it's a legitimate (deduped) owned-id set that just doesn't
    // name any real 2+ group once collapsed to one id.
    const res = await app.request(
      new Request(`http://local/api/v1/contacts/duplicates?ids=p0000a`),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: unknown[]; total: number; position: number | null };
    expect(json.items).toEqual([]);
    expect(json.total).toBe(3);
    expect(json.position).toBeNull();
  });

  it("a cross-org id refuses exactly as the sibling contact routes do (404, no existence leak)", async () => {
    const foreign = contactRaw("p-foreign", ORG_B, "foreign@example.com", "For", "Eign");
    const own = buildManyPairs(1)[0]!;
    const { db } = fakeDb([
      [own], // requireOwnedContacts([own.id, "p-foreign"]) -- foreign never matches orgId filter
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      new Request(`http://local/api/v1/contacts/duplicates?ids=${own.id},${foreign.id}`),
    );
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("not_found");
  });

  it("the unfiltered call's shape is unchanged (no `ids` query param)", async () => {
    const allRows = buildManyPairs(2);
    const { db } = fakeDb([
      allRows, // contact scan
      [], // dismissed pair keys
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(new Request("http://local/api/v1/contacts/duplicates"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: unknown[]; total: number; page: number; perPage: number };
    expect(Object.keys(json).sort()).toEqual(["items", "page", "perPage", "total"]);
    expect(json.items).toHaveLength(2);
    expect(json.total).toBe(2);
    expect(json.page).toBe(1);
  });
});
