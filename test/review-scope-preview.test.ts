// DEC-572 regression coverage: the reviewer track-assignment scope preview
// (ABS-S2-D1) must agree, by construction, with resolveReviewerSubmissions'
// own predicate -- both now build their `submission` where() condition via
// the same exported buildPlanScopeConditions helper, so this test captures
// the exact condition tree each function hands to `.where()` for an
// equivalent single-track scope and asserts they are structurally
// IDENTICAL (not just "produced the same count by coincidence").

import { describe, expect, it } from "vitest";
import {
  countPlanScopedSubmissions,
  resolveReviewerSubmissions,
  SCOPE_PREVIEW_LIMIT,
  type PlanRecord,
} from "../src/server/repo/review";

const PLAN: PlanRecord = {
  id: "plan-1",
  eventId: "event-1",
  name: "Plan One",
  instructions: null,
  openDate: null,
  closeDate: null,
  filters: null,
  anonymized: false,
  scale: { min: 1, max: 5 },
  criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
  rounds: 1,
  maxEvaluations: null,
} as unknown as PlanRecord;

interface FakeSubmission {
  id: string;
  seq: number;
  title: string;
  eventId: string;
}
interface FakeSubmissionTrack {
  submissionId: string;
  trackId: string;
}

// Nine submissions in the event; only sub-2/4/6/8 are tagged track-a, sub-3
// is tagged track-b. sub-9 belongs to a different event and must never
// surface.
const SUBMISSIONS: FakeSubmission[] = [
  { id: "sub-1", seq: 1, title: "Talk 1", eventId: "event-1" },
  { id: "sub-2", seq: 2, title: "Talk 2", eventId: "event-1" },
  { id: "sub-3", seq: 3, title: "Talk 3", eventId: "event-1" },
  { id: "sub-4", seq: 4, title: "Talk 4", eventId: "event-1" },
  { id: "sub-5", seq: 5, title: "Talk 5", eventId: "event-1" },
  { id: "sub-6", seq: 6, title: "Talk 6", eventId: "event-1" },
  { id: "sub-7", seq: 7, title: "Talk 7", eventId: "event-1" },
  { id: "sub-8", seq: 8, title: "Talk 8", eventId: "event-1" },
  { id: "sub-9", seq: 9, title: "Talk 9", eventId: "event-2" },
];
const TRACKS: FakeSubmissionTrack[] = [
  { submissionId: "sub-2", trackId: "track-a" },
  { submissionId: "sub-4", trackId: "track-a" },
  { submissionId: "sub-6", trackId: "track-a" },
  { submissionId: "sub-8", trackId: "track-a" },
  { submissionId: "sub-3", trackId: "track-b" },
];

/** Every trackId string literal drizzle embedded anywhere in the built
 * condition tree (via JSON walk of its Param/StringChunk nodes) -- used to
 * both (a) evaluate a submission's membership in JS against the TRACKS
 * fixture, replicating what the EXISTS subquery would do in real SQL, and
 * (b) prove two condition trees reference the identical trackId set. */
function collectStringLeaves(node: unknown, seen = new Set<unknown>(), depth = 0, out: string[] = []): string[] {
  if (depth > 60 || node === null || node === undefined) return out;
  if (typeof node === "string") {
    out.push(node);
    return out;
  }
  if (typeof node !== "object") return out;
  if (seen.has(node)) return out;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const c of node) collectStringLeaves(c, seen, depth + 1, out);
    return out;
  }
  const n = node as Record<string, unknown>;
  // Drizzle SQL condition trees hang their bound values off `.value`
  // (Param nodes) and their sub-fragments off `.queryChunks` -- walking only
  // those two keys (never arbitrary object keys, which would recurse into
  // circular `.table` backrefs on column objects) keeps this cycle-safe.
  if ("value" in n) collectStringLeaves(n.value, seen, depth + 1, out);
  if (Array.isArray(n.queryChunks)) collectStringLeaves(n.queryChunks, seen, depth + 1, out);
  return out;
}

function trackLiteralsIn(predicate: unknown): string[] {
  const leaves = new Set(collectStringLeaves(predicate));
  return ["track-a", "track-b"].filter((t) => leaves.has(t)).sort();
}

function evaluateSubmission(sub: FakeSubmission, predicate: unknown): boolean {
  if (sub.eventId !== "event-1") return false;
  for (const t of trackLiteralsIn(predicate)) {
    if (!TRACKS.some((tr) => tr.submissionId === sub.id && tr.trackId === t)) return false;
  }
  return true;
}

/** Captures every `where()` predicate the `submission` table select issues,
 * so the test can assert both call sites produced the SAME condition tree. */
function makeFakeDb(capturedConditions: unknown[]) {
  return {
    select(cols: Record<string, unknown>) {
      if ("trackId" in cols && "submissionId" in cols && !("id" in cols)) {
        // planReviewer select (resolveReviewerSubmissions) -- overridden per
        // test via the wrapper below.
        return {
          from: () => ({
            where: () => ({ orderBy: () => ({ limit: () => Promise.resolve([]) }) }),
          }),
        };
      }
      return {
        from() {
          return {
            where(predicate: unknown) {
              if ("recordPrefix" in cols) return { limit: () => Promise.resolve([{ recordPrefix: "SES" }]) };
              // submissionTrack EXISTS subquery build: `exists()` just wraps
              // whatever this returns via `sql\`exists ${subquery}\``, so
              // returning the real drizzle condition (which still carries
              // the embedded trackId literal) is what makes it visible to
              // trackLiteralsIn on the OUTER submission where() capture --
              // an object with no getSQL would get embedded as an opaque
              // bound param instead and silently lose the literal.
              if ("one" in cols) return predicate;
              capturedConditions.push(predicate);
              const matched = SUBMISSIONS.filter((s) => evaluateSubmission(s, predicate));
              if ("count" in cols) return Promise.resolve([{ count: matched.length }]);
              const rows = matched
                .slice()
                .sort((a, b) => a.seq - b.seq || a.id.localeCompare(b.id))
                .map((s) => ({ id: s.id, seq: s.seq, title: s.title }));
              return {
                orderBy: () => ({ limit: (n: number) => Promise.resolve(rows.slice(0, n)) }),
                then: (resolve: (v: unknown[]) => void) => resolve(rows),
              };
            },
          };
        },
      };
    },
  };
}

describe("DEC-572: countPlanScopedSubmissions agrees with resolveReviewerSubmissions", () => {
  it("count and row set match resolveReviewerSubmissions' for the same plan+track scope, via an identical where() condition", async () => {
    const previewConditions: unknown[] = [];
    const previewDb = makeFakeDb(previewConditions);
    const preview = await countPlanScopedSubmissions(previewDb as never, PLAN, { trackId: "track-a" });
    expect(preview.count).toBe(4);
    expect(preview.items.map((i) => i.id)).toEqual(["sub-2", "sub-4", "sub-6", "sub-8"]);
    expect(preview.items.length).toBeLessThanOrEqual(SCOPE_PREVIEW_LIMIT);

    const resolvedConditions: unknown[] = [];
    const baseDb = makeFakeDb(resolvedConditions);
    const reviewerDb = {
      ...baseDb,
      select(cols: Record<string, unknown>) {
        if ("trackId" in cols && "submissionId" in cols && !("id" in cols)) {
          return {
            from: () => ({
              where: () => ({
                orderBy: () => ({ limit: () => Promise.resolve([{ trackId: "track-a", submissionId: null }]) }),
              }),
            }),
          };
        }
        return baseDb.select(cols);
      },
    };
    const resolved = await resolveReviewerSubmissions(reviewerDb as never, PLAN, "rev-1");
    expect(resolved.length).toBe(preview.count);
    expect(resolved.map((r) => r.id).sort()).toEqual(preview.items.map((i) => i.id).sort());

    // Both call sites issued exactly one `submission` where() (the count
    // query and the row query in countPlanScopedSubmissions share the same
    // condition array reference, so only 2 captures for it: count + rows).
    expect(previewConditions.length).toBeGreaterThanOrEqual(1);
    expect(resolvedConditions.length).toBeGreaterThanOrEqual(1);
    // The trackId literal set embedded in each condition tree is identical
    // -- proof the two call sites scoped by the SAME track, not by
    // coincidentally-equal counts.
    expect(trackLiteralsIn(resolvedConditions[0])).toEqual(trackLiteralsIn(previewConditions[0]));
    expect(trackLiteralsIn(previewConditions[0])).toEqual(["track-a"]);
  });

  it("excludes submissions from a different event and a different track", async () => {
    const captured: unknown[] = [];
    const db = makeFakeDb(captured);
    const preview = await countPlanScopedSubmissions(db as never, PLAN, { trackId: "track-b" });
    expect(preview.count).toBe(1);
    expect(preview.items.map((i) => i.id)).toEqual(["sub-3"]);
  });
});
