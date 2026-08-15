// DEC-511: behavioral gap-fill alongside test/like-escaping-enumeration.test.ts's
// static enumeration. test/public-speakers-like-escape.test.ts already covers
// getPublicSpeakers for `?q=%` (zero matches, not the whole roster) and a
// literal `_` in a surname being findable; this file covers what that search
// turned up as missing:
//   - getPublicSessions (EMB-02 keyword search) for `?q=%` and `?q=_`
//   - a speaker whose surname literally contains `%` being findable by
//     searching for `%` (the speakers file only exercised literal `_`)
//
// Same no-local-sqlite-driver convention as test/public-sessions-pagination.test.ts
// and test/public-speakers-like-escape.test.ts: a fake db chain captures the
// drizzle WHERE condition and a small LIKE...ESCAPE '\\' regex emulator
// evaluates it against fixture rows, so the real production condition-
// building code (searchCondition + likeContains) in
// src/server/repo/public/sessions.ts is exercised end-to-end.

import { describe, expect, it } from "vitest";
import { getPublicSessions, type PublicEvent } from "../src/server/repo/public";
import { getPublicSpeakers } from "../src/server/repo/public/speakers";
import type { Db } from "../src/server/context";

function escapeRegExp(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Translates a SQLite `LIKE pattern ESCAPE '\\'` pattern into a case-
 * insensitive RegExp with the same semantics — mirrors
 * test/public-speakers-like-escape.test.ts's likePatternToRegExp. */
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

function extractLikePattern(cond: unknown): string | undefined {
  const out: unknown[] = [];
  collectParams(cond, out, new Set());
  return out.find((v): v is string => typeof v === "string" && v.startsWith("%") && v.endsWith("%"));
}

const EVENT: PublicEvent = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

interface FixtureSession {
  id: string;
  title: string;
}

const SESSION_FIXTURE: FixtureSession[] = [
  { id: "s1", title: "Intro to Testing" },
  { id: "s2", title: "50% Off Refactoring" }, // literal % in title
  { id: "s3", title: "Data_Driven Design" }, // literal _ in title
];

/** Builds a fake db whose id-query/count-query .where() calls run the
 * captured condition's like pattern against SESSION_FIXTURE's title —
 * enough to exercise getVisibleSubmissionIdsOrdered/countVisibleSubmissions'
 * searchCondition without needing to fake the participant/contact join. */
function makeSessionsFakeDb(): Db {
  const matches = (row: FixtureSession, cond: unknown) => {
    if (cond === undefined) return true;
    const pattern = extractLikePattern(cond);
    if (pattern === undefined) return true;
    return likePatternToRegExp(pattern).test(row.title);
  };

  let idFilteredIds: string[] = [];

  const idChain = {
    from: () => idChain,
    leftJoin: () => idChain,
    where: (cond: unknown) => {
      idFilteredIds = SESSION_FIXTURE.filter((r) => matches(r, cond)).map((r) => r.id);
      return idChain;
    },
    orderBy: () => idChain,
    limit: async (_n: number) => idFilteredIds.map((id) => ({ id })),
  };

  let selectCall = 0;
  const db = {
    selectDistinct: () => idChain,
    select: (fields: Record<string, unknown>) => {
      if ("count" in fields) {
        return {
          from: () => ({
            leftJoin: () => ({
              leftJoin: () => ({
                where: (cond: unknown) =>
                  Promise.resolve([{ count: SESSION_FIXTURE.filter((r) => matches(r, cond)).length }]),
              }),
            }),
          }),
        };
      }
      selectCall += 1;
      // hydrateSessions' 4 batched selects (subRows/trackRows/speakerRows/
      // slotRows) — see test/public-sessions-pagination.test.ts's buildDb.
      // subRows resolves straight off .where() (no .orderBy()); the other
      // three chain a further .orderBy() before resolving, so this chain
      // supports both shapes.
      const rows =
        selectCall === 1
          ? idFilteredIds.map((id) => ({
              id,
              seq: 1,
              title: SESSION_FIXTURE.find((r) => r.id === id)!.title,
              description: null,
              icsSequence: 0,
            }))
          : [];
      const resolved = Promise.resolve(rows) as Promise<unknown[]> & { orderBy: (o: unknown) => Promise<unknown[]> };
      resolved.orderBy = (_o: unknown) => Promise.resolve(rows);
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: (_cond: unknown) => resolved,
      };
      return chain;
    },
  } as unknown as Db;
  return db;
}

describe("getPublicSessions ?q= search (DEC-506/DEC-511 LIKE escaping)", () => {
  it("q=% matches only the session whose title literally contains %, not the whole roster", async () => {
    // Escaped to `%\%%`: matches s2 ("50% Off Refactoring", which literally
    // contains `%`), but not s1/s3 — proving `%` behaves as a literal
    // character to search for, never a wildcard that widens to every
    // session (the pre-DEC-506 bug this locks against).
    const db = makeSessionsFakeDb();
    const page = await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, q: "%" });
    expect(page.items.map((s) => s.id)).toEqual(["s2"]);
    expect(page.total).toBe(1);
  });

  it("q=_ matches only the session whose title literally contains an underscore, not the whole roster", async () => {
    const db = makeSessionsFakeDb();
    const page = await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, q: "_" });
    expect(page.items.map((s) => s.id)).toEqual(["s3"]);
    expect(page.total).toBe(1);
  });

  it("a session whose title literally contains % is findable by searching for %", async () => {
    const db = makeSessionsFakeDb();
    const page = await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, q: "50%" });
    expect(page.items.map((s) => s.id)).toEqual(["s2"]);
  });

  it("q=% against a roster where nothing contains a literal % returns zero matches, not the whole roster", async () => {
    const originalTitle = SESSION_FIXTURE[1]!.title;
    SESSION_FIXTURE[1]!.title = "No Wildcard Characters Here"; // temporarily remove the only literal %
    try {
      const db = makeSessionsFakeDb();
      const page = await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, q: "%" });
      expect(page.items).toHaveLength(0);
      expect(page.total).toBe(0);
    } finally {
      SESSION_FIXTURE[1]!.title = originalTitle;
    }
  });

  // DEC-506 wave-64 amendment: the ONE case-insensitive idiom is the raw
  // (unfolded) needle compared with plain LIKE, with no SQL lower() and no
  // JS .toLowerCase() applied anywhere before likeContains. Prove an
  // uppercase non-ASCII needle still matches its haystack, and that
  // lowercase-ASCII matching is unaffected by removing the lower()/
  // COLLATE NOCASE idioms.
  it("an uppercase non-ASCII needle matches a haystack containing the same letter", async () => {
    const originalTitle = SESSION_FIXTURE[1]!.title;
    SESSION_FIXTURE[1]!.title = "École Polytechnique";
    try {
      const db = makeSessionsFakeDb();
      const page = await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, q: "ÉCOLE" });
      expect(page.items.map((s) => s.id)).toEqual(["s2"]);
      expect(page.total).toBe(1);
    } finally {
      SESSION_FIXTURE[1]!.title = originalTitle;
    }
  });

  it("lowercase-ASCII matching is unchanged (case-insensitive substring match still works)", async () => {
    const db = makeSessionsFakeDb();
    const page = await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, q: "intro" });
    expect(page.items.map((s) => s.id)).toEqual(["s1"]);
    expect(page.total).toBe(1);
  });
});

interface FixtureContact {
  contactId: string;
  firstName: string;
  lastName: string;
}

// DEC-511 gap-fill: test/public-speakers-like-escape.test.ts's FIXTURE only
// carries a literal `_` (O_Brien) — add a literal `%` surname here so both
// SQL metacharacters are proven findable-by-literal, not just one.
const SPEAKER_FIXTURE: FixtureContact[] = [
  { contactId: "c1", firstName: "Jane", lastName: "Doe" },
  { contactId: "c2", firstName: "Sam", lastName: "100%Sure" }, // literal % in surname
];

function makeSpeakersFakeDb(): Db {
  let capturedWhere: unknown;
  const matches = (row: FixtureContact) => {
    if (capturedWhere === undefined) return true;
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
    selectDistinct: (_fields: unknown) => chain(SPEAKER_FIXTURE, (f) => ({ contactId: f.contactId })),
    select: (fields: Record<string, unknown>) => {
      if ("total" in fields) {
        return {
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: (cond: unknown) => {
                  capturedWhere = cond;
                  const count = SPEAKER_FIXTURE.filter((r) => matches(r)).length;
                  return Promise.resolve([{ total: count }]);
                },
              }),
            }),
          }),
        };
      }
      return chain(SPEAKER_FIXTURE, (f) => ({
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

describe("getPublicSpeakers ?q= search — literal % gap-fill (DEC-506/DEC-511)", () => {
  it("a speaker whose surname literally contains % is findable by searching for %", async () => {
    const db = makeSpeakersFakeDb();
    const page = await getPublicSpeakers(db, "ev1", { q: "100%Sure", page: 1, perPage: 12 });
    expect(page.items.map((s) => s.contactId)).toEqual(["c2"]);
  });

  it("a bare q=% still only matches speakers whose name literally contains %, not the whole roster", async () => {
    // Escaped to `%\%%`, so this matches any name containing a literal `%`
    // (c2), but not a name with no `%` at all (c1) — proving the escape
    // makes `%` behave as a literal character to search for, never a
    // wildcard that widens to the whole roster.
    const db = makeSpeakersFakeDb();
    const page = await getPublicSpeakers(db, "ev1", { q: "%", page: 1, perPage: 12 });
    expect(page.items.map((s) => s.contactId)).toEqual(["c2"]);
    expect(page.total).toBe(1);
  });
});
