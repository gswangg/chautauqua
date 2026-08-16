// DEC-417 (wave-31 amendment, second half): parseRulesQueryParam
// (src/routes/api/contacts/segments.ts) accepted an unbounded ARRAY of
// rules and an unbounded `value` per rule -- unbounded read work per
// request and an unbounded LIKE bind. MAX_SEGMENT_RULES bounds the array
// length on both the read path (GET /api/v1/contacts?rules=) and the
// write path (POST/PATCH /api/v1/contacts/segments); parseBoundedText +
// MAX_NAME_LENGTH bounds each rule's `value`.
//
// The read path is exercised end-to-end through the real contactsRoutes
// sub-app (registerCrudRoutes -> parseRulesQueryParam -> repo.
// listContactsForOrg), not just the parser -- a minimal fake db double
// (no D1 test harness exists in stage 1) models the org-scoped select the
// rules/segment scan issues (src/server/repo/contacts/crud.ts
// scanOrgContactRecords: select -> from -> where -> orderBy -> limit).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { parseRulesQueryParam } from "../src/routes/api/contacts/segments";
import { MAX_SEGMENT_RULES } from "../src/domain/contacts";
import { overCapCountMessage } from "../src/domain/cap-copy";
import { registerErrorHandler, ApiError } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

function makeContactRow(overrides: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    id: "contact-x",
    orgId: ORG_A,
    email: "x@example.com",
    firstName: "X",
    lastName: "Y",
    phone: null,
    company: null,
    title: null,
    bio: null,
    headshotUrl: null,
    socialLinksJson: null,
    notes: null,
    customFieldsJson: null,
    createdAt: new Date(1000),
    updatedAt: new Date(1000),
    ...overrides,
  };
}

const CONTACTS = [
  makeContactRow({
    id: "contact-1",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    company: "Acme",
    updatedAt: new Date(1000),
  }),
  makeContactRow({
    id: "contact-2",
    email: "grace@example.com",
    firstName: "Grace",
    lastName: "Hopper",
    company: "Widgetco",
    updatedAt: new Date(2000),
  }),
];

/** Minimal fake db double for the select().from().where().orderBy().limit()
 * chain scanOrgContactRecords issues -- WHERE/ORDER BY are ignored (this
 * suite only ever seeds rows relevant to the org under test, and asserts
 * on matchesSegment's in-memory filtering, not SQL ordering). */
function fakeDb(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  const db = {
    select: (_cols?: unknown) => chain,
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

function appWithDb(db: AppEnv["Variables"]["db"], auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", contactsRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

function rulesOfLength(n: number): { field: string; op: "eq"; value: string }[] {
  return Array.from({ length: n }, (_, i) => ({ field: "any", op: "eq" as const, value: `v${i}` }));
}

describe("MAX_SEGMENT_RULES bounds the segment rule set (DEC-417 wave-31 amendment)", () => {
  it("parseRulesQueryParam: 21 rules 400s naming rules", () => {
    const raw = JSON.stringify(rulesOfLength(MAX_SEGMENT_RULES + 1));
    try {
      parseRulesQueryParam(raw);
      throw new Error("expected parseRulesQueryParam to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe("invalid");
      expect(apiErr.fields).toEqual({ rules: overCapCountMessage(MAX_SEGMENT_RULES + 1, MAX_SEGMENT_RULES, "rule") });
    }
  });

  it("parseRulesQueryParam: a 5000-char rule value 400s naming rules", () => {
    const raw = JSON.stringify([{ field: "any", op: "eq", value: "x".repeat(5000) }]);
    try {
      parseRulesQueryParam(raw);
      throw new Error("expected parseRulesQueryParam to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe("invalid");
      expect(apiErr.fields).toHaveProperty("rules");
    }
  });

  it("parseRulesQueryParam: exactly MAX_SEGMENT_RULES rules with normal values still parses", () => {
    const raw = JSON.stringify(rulesOfLength(MAX_SEGMENT_RULES));
    expect(parseRulesQueryParam(raw)).toHaveLength(MAX_SEGMENT_RULES);
  });

  it("GET /api/v1/contacts?rules=<21 rules> 400s naming rules, never reaches the db", async () => {
    const db = fakeDb(CONTACTS);
    const app = appWithDb(db, ORGANIZER_A);
    const raw = JSON.stringify(rulesOfLength(MAX_SEGMENT_RULES + 1));

    const res = await app.request(`http://local/api/v1/contacts?rules=${encodeURIComponent(raw)}`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields).toEqual({ rules: overCapCountMessage(MAX_SEGMENT_RULES + 1, MAX_SEGMENT_RULES, "rule") });
  });

  it("GET /api/v1/contacts?rules=<20 rules matching field 'any'/'ada'> 200s and still filters", async () => {
    const db = fakeDb(CONTACTS);
    const app = appWithDb(db, ORGANIZER_A);
    // 20 rules: 19 no-op eq-on-"any" against a value nothing matches (so
    // they'd exclude everything if AND'd) -- instead assert against a
    // single real filtering rule padded out to MAX_SEGMENT_RULES with the
    // pseudo-field 'any' contains "" (matches everything, DEC-149), so the
    // real "contains ada" rule is the one doing the work.
    const rules = [
      { field: "any", op: "contains", value: "ada" },
      ...Array.from({ length: MAX_SEGMENT_RULES - 1 }, () => ({ field: "any", op: "contains", value: "" })),
    ];
    const raw = JSON.stringify(rules);

    const res = await app.request(`http://local/api/v1/contacts?rules=${encodeURIComponent(raw)}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { email: string }[] };
    expect(body.items.map((i) => i.email)).toEqual(["ada@example.com"]);
  });

  it("POST /api/v1/segments: saving a segment with 21 rules 400s naming rules, writes nothing", async () => {
    const db = fakeDb([]);
    const app = appWithDb(db, ORGANIZER_A);

    const res = await app.request("http://local/api/v1/segments", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ name: "Too many rules", rules: rulesOfLength(MAX_SEGMENT_RULES + 1) }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.rules).toBe(overCapCountMessage(MAX_SEGMENT_RULES + 1, MAX_SEGMENT_RULES, "rule"));
  });
});

// DEC-554 (amendment, wave 11): isValidSegmentRule (parse time) previously
// only checked `typeof field === "string"`, so a rule referencing an
// unrecognized field passed the parser and threw an unnamed TypeError from
// fieldValue (match time) instead of a named 400 -- an unnamed 500 on the
// contacts list and the bulk-email recipient count. The write path
// (POST/PATCH /segments) already routed an unresolvable field through
// assertRulesResolvable -> matchesSegment -> fieldValue
// (src/routes/api/contacts/segments.ts:52-55, :81-89), so this exercises
// that door still refuses the same set after fieldValue and
// isValidSegmentRule were unified onto isSegmentField.
describe("segment rule field vocabulary (DEC-554 amendment, wave 11)", () => {
  it("POST /api/v1/segments: an unknown rule field 400s naming it, writes nothing", async () => {
    const db = fakeDb([]);
    const app = appWithDb(db, ORGANIZER_A);

    const res = await app.request("http://local/api/v1/segments", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ name: "Bad field segment", rules: [{ field: "nickname", op: "eq", value: "a" }] }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.rules).toMatch(/nickname/);
  });

  it("PATCH /api/v1/segments/:id: an unknown rule field (malformed custom.<key>) 400s, not a 500", async () => {
    const existingSegment = {
      id: "seg-1",
      orgId: ORG_A,
      name: "Existing",
      rulesJson: "[]",
      createdAt: new Date(1000),
      updatedAt: new Date(1000),
    };
    // findSegmentForOrg (src/server/repo/contacts/segments.ts) issues
    // select().from(schema.segment).where(...).limit(1) -- this fakeDb
    // returns the single seeded segment row for any select/from/where/limit
    // chain, matching segment-rules-bounds.test.ts's contacts fakeDb shape.
    const chain: any = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      then: (resolve: (v: unknown[]) => void) => resolve([existingSegment]),
    };
    const db = { select: (_cols?: unknown) => chain } as unknown as AppEnv["Variables"]["db"];
    const app = appWithDb(db, ORGANIZER_A);

    const res = await app.request(`http://local/api/v1/segments/${existingSegment.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ rules: [{ field: "custom.", op: "eq", value: "a" }] }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.rules).toBeTruthy();
  });
});
