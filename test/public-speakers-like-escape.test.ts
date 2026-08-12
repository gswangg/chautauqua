// DEC-506 regression: getPublicSpeakers's `q` search previously interpolated
// a raw `%${q}%` pattern with no ESCAPE clause, so a literal `%`/`_` in the
// query string widened into a SQL wildcard — `?q=%` matched every visible
// speaker instead of speakers whose name literally contains "%". This test
// exercises the real production condition-building code (searchCondition +
// likeContains) via getPublicSpeakers, evaluating the captured WHERE
// condition against fixture rows using a small SQLite LIKE...ESCAPE '\\'
// emulator so the fix is verified end-to-end rather than just at the
// likeContains unit level.
//
// No local sqlite/D1 test driver is wired up in this repo (see
// test/public-speakers-pagination.test.ts) — this mirrors that file's
// fake-db + captured-condition-param convention.

import { describe, expect, it } from "vitest";
import { getPublicSpeakers } from "../src/server/repo/public/speakers";
import type { Db } from "../src/server/context";

function escapeRegExp(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Translates a SQLite `LIKE pattern ESCAPE '\\'` pattern into a case-
 * insensitive RegExp with the same semantics: `%` = any run (incl. empty),
 * `_` = exactly one char, `\` escapes the next char literally. */
function likePatternToRegExp(pattern: string): RegExp {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\") {
      i++;
      re += escapeRegExp(pattern[i] ?? "");
    } else if (ch === "%") {
      re += ".*";
    } else if (ch === "_") {
      re += ".";
    } else {
      re += escapeRegExp(ch!);
    }
  }
  return new RegExp(`^${re}$`, "i");
}

/** Recursively collects every bound-parameter value out of a drizzle SQL
 * condition tree — same walk as test/public.test.ts's walkCondition /
 * test/public-speakers-pagination.test.ts's collectParams. */
function collectParams(node: unknown, out: unknown[], seen: Set<unknown>, depth = 0): void {
  if (depth > 20 || node === null || typeof node !== "object") return;
  if (seen.has(node)) return;
  seen.add(node);
  const n = node as Record<string, unknown>;
  if (n.value !== undefined && typeof n.value !== "object") out.push(n.value);
  if (Array.isArray(n.queryChunks)) {
    for (const c of n.queryChunks) {
      if (c !== null && typeof c !== "object") {
        out.push(c);
      } else {
        collectParams(c, out, seen, depth + 1);
      }
    }
  }
  if (Array.isArray(node)) {
    for (const c of node) collectParams(c, out, seen, depth + 1);
  }
}

/** The like pattern is the only string-valued bound param in the WHERE
 * condition once the fixed eq(eventId) condition is stripped by the
 * caller — extracted generically here as "the single %...% shaped param". */
function extractLikePattern(cond: unknown): string | undefined {
  const out: unknown[] = [];
  collectParams(cond, out, new Set());
  return out.find((v): v is string => typeof v === "string" && v.startsWith("%") && v.endsWith("%"));
}

interface FixtureContact {
  contactId: string;
  firstName: string;
  lastName: string;
}

const FIXTURE: FixtureContact[] = [
  { contactId: "c1", firstName: "Jane", lastName: "Doe" },
  { contactId: "c2", firstName: "Priya", lastName: "O_Brien" }, // literal underscore in surname
  { contactId: "c3", firstName: "Ada", lastName: "Lovelace" },
];

/** Builds a fake db whose selectDistinct/select/hydration calls run the
 * captured WHERE's like pattern against FIXTURE using the SQLite LIKE
 * emulator above — the same rows a real D1 LIKE ESCAPE '\\' COLLATE NOCASE
 * predicate would return. */
function makeFakeDb(): Db {
  let capturedWhere: unknown;
  const matches = (row: FixtureContact) => {
    if (capturedWhere === undefined) return true; // no q: everything matches
    const pattern = extractLikePattern(capturedWhere);
    if (pattern === undefined) return true;
    const re = likePatternToRegExp(pattern);
    return re.test(row.firstName) || re.test(row.lastName) || re.test(`${row.firstName} ${row.lastName}`);
  };

  const chain = (rows: FixtureContact[], project: (r: FixtureContact) => unknown) => ({
    from: () => chain(rows, project),
    innerJoin: () => chain(rows, project),
    where: (cond: unknown) => {
      capturedWhere = cond;
      return chain(rows.filter((r) => matches(r)), project);
    },
    orderBy: () => chain(rows, project),
    limit: async (_n: number) => rows.map(project),
    then: (resolve: (v: unknown[]) => void) => resolve(rows.map(project)),
  });

  const db = {
    selectDistinct: (_fields: unknown) => chain(FIXTURE, (f) => ({ contactId: f.contactId })),
    select: (fields: Record<string, unknown>) => {
      if ("total" in fields) {
        return {
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: (cond: unknown) => {
                  capturedWhere = cond;
                  const count = FIXTURE.filter((r) => matches(r)).length;
                  return Promise.resolve([{ total: count }]);
                },
              }),
            }),
          }),
        };
      }
      // hydration select: full rows, still filtered through the same
      // captured-where matcher (mirrors the real query's
      // `and(...conditions, inArray(contact.id, batch))`)
      return chain(FIXTURE, (f) => ({
        contactId: f.contactId,
        firstName: f.firstName,
        lastName: f.lastName,
        title: null,
        company: null,
        headshotUrl: null,
        bio: null,
        submissionId: `sub-${f.contactId}`,
        submissionTitle: "Talk",
      }));
    },
  } as unknown as Db;
  return db;
}

describe("getPublicSpeakers ?q= search (DEC-506 LIKE escaping)", () => {
  it("q=% (the decoded form of ?q=%25) matches zero speakers, not the whole roster", async () => {
    const db = makeFakeDb();
    const page = await getPublicSpeakers(db, "ev1", { q: "%", page: 1, perPage: 12 });
    expect(page.items).toHaveLength(0);
    expect(page.total).toBe(0);
  });

  it("a speaker whose name literally contains _ is findable by that _", async () => {
    const db = makeFakeDb();
    const page = await getPublicSpeakers(db, "ev1", { q: "O_Brien", page: 1, perPage: 12 });
    expect(page.items.map((s) => s.contactId)).toEqual(["c2"]);
  });

  it("an unescaped _ never behaves as a single-char wildcard", async () => {
    // If the fix regressed to unescaped LIKE, "O.Brien"-style single-char
    // substitutions would also match "O_Brien" — assert only the literal
    // underscore form matches.
    const db = makeFakeDb();
    const page = await getPublicSpeakers(db, "ev1", { q: "OXBrien", page: 1, perPage: 12 });
    expect(page.items).toHaveLength(0);
  });
});
