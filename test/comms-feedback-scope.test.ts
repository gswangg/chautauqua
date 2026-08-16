// DEC-682: a decision mailer must never invent feedback nor leak another
// plan's or round's comments alongside the composing plan+round's own. This
// file covers listFeedbackCommentsForSubmissions' plan+round scoping
// directly against a fake db that faithfully filters by the bound
// (submission_id IN batch) AND (plan_id = ?) AND (round = ?) literals — this
// repo has no local sqlite/D1 test driver (see
// test/comms-invite-scope.test.ts's header comment) — plus a
// buildRenderTargets-level check that a submission with comments from a
// different plan/round attached gets NO_FEEDBACK_TEXT, not those comments.

import { describe, expect, it } from "vitest";
import type { AppEnv } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";
import { listFeedbackCommentsForSubmissions } from "../src/server/repo/comms";
import { buildRenderTargets } from "../src/routes/comms";
import type { ComposeSubmission } from "../src/domain/compose";
import { formatFeedback, NO_FEEDBACK_TEXT } from "../src/domain/compose";

// Mirrors test/comms-batched-lookups.test.ts's collectLiteralValues: walks a
// drizzle condition tree collecting bound leaf literals (strings and
// numbers), so the fake db can apply the SAME (submission_id IN batch) AND
// (plan_id = ?) AND (round = ?) predicate the real query builds.
function collectLiterals(node: unknown, seen = new Set<unknown>(), strings = new Set<string>(), numbers = new Set<number>()) {
  if (typeof node === "string") {
    strings.add(node);
    return { strings, numbers };
  }
  if (typeof node === "number") {
    numbers.add(node);
    return { strings, numbers };
  }
  if (node === null || typeof node !== "object" || seen.has(node)) return { strings, numbers };
  seen.add(node);
  if (Array.isArray(node)) {
    for (const c of node) collectLiterals(c, seen, strings, numbers);
    return { strings, numbers };
  }
  const n = node as Record<string, unknown>;
  if (typeof n.value === "string") strings.add(n.value);
  if (typeof n.value === "number") numbers.add(n.value);
  if (Array.isArray(n.value)) {
    for (const v of n.value) {
      if (typeof v === "string") strings.add(v);
      else if (typeof v === "number") numbers.add(v);
      else collectLiterals(v, seen, strings, numbers);
    }
  }
  if (Array.isArray(n.queryChunks)) collectLiterals(n.queryChunks, seen, strings, numbers);
  return { strings, numbers };
}

interface EvalRow {
  submissionId: string;
  comment: string;
  submittedAt: Date | null;
  planId: string;
  round: number;
  createdAt: number;
  id: string;
}

function makeScopedFeedbackDb(rows: EvalRow[]): AppEnv["Variables"]["db"] {
  return {
    select: () => {
      const chain: any = {
        from: () => chain,
        where: (cond: unknown) => {
          const { strings, numbers } = collectLiterals(cond);
          const filtered = rows.filter(
            (r) => strings.has(r.submissionId) && strings.has(r.planId) && numbers.has(r.round),
          );
          return {
            orderBy: () => ({
              then: (resolve: (v: unknown[]) => void) =>
                resolve(
                  [...filtered]
                    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
                    .map((r) => ({ submissionId: r.submissionId, comment: r.comment, submittedAt: r.submittedAt })),
                ),
            }),
          };
        },
      };
      return chain;
    },
  } as unknown as AppEnv["Variables"]["db"];
}

const rows: EvalRow[] = [
  // Composing plan+round: the ONLY comment that should ever come back.
  { submissionId: "sub-1", comment: "This round's comment", submittedAt: new Date(1000), planId: "plan-A", round: 2, createdAt: 1, id: "e1" },
  // Same submission, DIFFERENT plan entirely.
  { submissionId: "sub-1", comment: "Wrong plan's comment", submittedAt: new Date(1000), planId: "plan-B", round: 2, createdAt: 1, id: "e2" },
  // Same submission, SAME plan, EARLIER round.
  { submissionId: "sub-1", comment: "Earlier round's comment", submittedAt: new Date(500), planId: "plan-A", round: 1, createdAt: 0, id: "e3" },
  // Same submission, SAME plan, LATER round.
  { submissionId: "sub-1", comment: "Later round's comment", submittedAt: new Date(2000), planId: "plan-A", round: 3, createdAt: 2, id: "e4" },
];

describe("listFeedbackCommentsForSubmissions plan+round scope (DEC-682)", () => {
  it("attaches only the composing plan+round's comment, never a different plan's or round's", async () => {
    const db = makeScopedFeedbackDb(rows);
    const map = await listFeedbackCommentsForSubmissions(db, ["sub-1"], { planId: "plan-A", round: 2 });
    expect(map.get("sub-1")).toEqual(["This round's comment"]);
  });

  it("returns no comments for a submission with zero rows in the composing plan+round (even though other plans/rounds have comments)", async () => {
    const db = makeScopedFeedbackDb(rows);
    const map = await listFeedbackCommentsForSubmissions(db, ["sub-1"], { planId: "plan-A", round: 5 });
    expect(map.has("sub-1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildRenderTargets: an out-of-scope comment must never surface as this
// recipient's feedback merge var -- the recipient should see NO_FEEDBACK_TEXT
// rather than another plan's/round's comment.
// ---------------------------------------------------------------------------

class InMemoryKV implements KVStore {
  private readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe("buildRenderTargets only renders the composing plan+round's feedback (DEC-682)", () => {
  const submissions: ComposeSubmission[] = [
    { id: "sub-1", title: "Talk One", seq: 1, participants: [{ contactId: "ct-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }] },
  ];
  const event = { id: "evt-1", name: "DevCon", recordPrefix: "DEV", startDate: "2026-09-01", endDate: "2026-09-03" };

  function fakeContext(db: AppEnv["Variables"]["db"]) {
    return {
      var: { db, auth: { orgId: "org-1" } },
      env: { KV: new InMemoryKV() as unknown as KVNamespace, PUBLIC_BASE_URL: "https://events.example.com" },
      req: { url: "https://events.example.com/api/v1/events/evt-1/compose/preview", header: () => undefined },
    };
  }

  function makeDb() {
    const feedbackDb = makeScopedFeedbackDb(rows);
    const emptyChain: any = {
      from: () => emptyChain,
      innerJoin: () => emptyChain,
      where: () => emptyChain,
      // findAccountUserIds' user select ends in .orderBy (DEC-456 wave-71
      // amendment).
      orderBy: () => emptyChain,
      limit: () => emptyChain,
      then: (resolve: (v: unknown[]) => void) => resolve([]),
    };
    return {
      select: (proj: Record<string, unknown>) => {
        if ("submittedAt" in proj) return (feedbackDb.select as any)(proj);
        return emptyChain;
      },
    } as unknown as AppEnv["Variables"]["db"];
  }

  it("a submission with an out-of-scope comment (wrong plan/round) renders NO_FEEDBACK_TEXT, not that comment", async () => {
    const c = fakeContext(makeDb());
    const { targets } = await buildRenderTargets(c as never, event, submissions, { planId: "plan-A", round: 5 });
    expect(targets).toHaveLength(1);
    expect(targets[0]?.vars.feedback).toBe(NO_FEEDBACK_TEXT);
    expect(targets[0]?.vars.feedback).not.toContain("Wrong plan's comment");
    expect(targets[0]?.vars.feedback).not.toContain("Earlier round's comment");
    expect(targets[0]?.vars.feedback).not.toContain("Later round's comment");
  });

  it("the same submission with the composing plan+round DOES attach that comment", async () => {
    const c = fakeContext(makeDb());
    const { targets } = await buildRenderTargets(c as never, event, submissions, { planId: "plan-A", round: 2 });
    expect(targets[0]?.vars.feedback).toBe(formatFeedback(["This round's comment"]));
  });

  it("feedback: null (toggle off) omits the feedback key entirely", async () => {
    const c = fakeContext(makeDb());
    const { targets } = await buildRenderTargets(c as never, event, submissions, null);
    expect(targets[0]?.vars.feedback).toBeUndefined();
    expect("feedback" in (targets[0]?.vars ?? {})).toBe(false);
  });
});
