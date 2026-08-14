// DEC-082 wave-43 amendment: plan `rounds` is a bounded small integer
// (MAX_PLAN_ROUNDS = 10) at every writer, because the SPA turns the stored
// value straight into an array length (`Array.from({ length: rounds })`).
// Covers: (1) parseRounds' own bound, (2) parseRoundCriteria inheriting the
// bound via the effective `rounds`, (3) the wave-ratchet writer (POST
// /api/v1/plans/:id/waves) refusing at the cap over a real HTTP route, and
// (4) a source scan asserting every non-literal `Array.from({ length })`
// site in app/src/pages either names the bounded `rounds` field or is
// ledgered against its own closed, cited bound.

import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { MAX_PLAN_ROUNDS, parseRounds, parseRoundCriteria } from "../src/routes/review/shared";

describe("parseRounds bound (DEC-082 wave-43)", () => {
  it("accepts the boundary values 1 and 10", () => {
    for (const rounds of [1, MAX_PLAN_ROUNDS]) {
      const errors: Record<string, string> = {};
      expect(parseRounds({ rounds }, errors)).toBe(rounds);
      expect(errors.rounds).toBeUndefined();
    }
  });

  it.each([0, -1, MAX_PLAN_ROUNDS + 1, 1e9, Number.MAX_SAFE_INTEGER, 2.5, "3", null, undefined])(
    "refuses %p with errors.rounds set",
    (bad) => {
      const errors: Record<string, string> = {};
      expect(parseRounds({ rounds: bad }, errors)).toBeUndefined();
      expect(errors.rounds).toBeTruthy();
    },
  );
});

describe("parseRoundCriteria inherits the rounds cap", () => {
  it("rejects a round key above the effective cap", () => {
    const errors: Record<string, string> = {};
    const criterion = [{ id: "c1", label: "Relevance", kind: "rating" as const, weight: 1 }];
    const result = parseRoundCriteria({ roundCriteria: { "3": criterion } }, errors, 2);
    expect(result).toBeUndefined();
    expect(errors.roundCriteria).toMatch(/between 1 and 2/);
  });
});

// --- HTTP-level: the wave ratchet is the third writer -----------------

const ORG_A = "org-a";

interface FakePlan {
  id: string;
  eventId: string;
  name: string;
  instructions: string | null;
  openDate: number | null;
  closeDate: number | null;
  filters: null;
  anonymized: boolean;
  scale: { min: number; max: number };
  criteria: { id: string; label: string; kind: string; weight: number }[];
  rounds: number;
  currentRound: number;
  roundCriteria: Record<string, unknown> | null;
  maxEvaluations: number | null;
  timezone: string;
}

const FROZEN_CRITERIA = [{ id: "c1", label: "Relevance", kind: "rating", weight: 3 }];

function makePlan(overrides: Partial<FakePlan> = {}): FakePlan {
  return {
    id: "plan-1",
    eventId: "event-1",
    name: "Plan One",
    instructions: null,
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: FROZEN_CRITERIA,
    rounds: MAX_PLAN_ROUNDS,
    currentRound: MAX_PLAN_ROUNDS,
    roundCriteria: null,
    maxEvaluations: null,
    timezone: "UTC",
    ...overrides,
  };
}

let plan = makePlan();

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === plan.id && orgId === ORG_A ? plan : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) => (planId === plan.id ? plan : null)),
    countSubmittedEvaluationsForRound: vi.fn(async (_db: unknown, planId: string, round: number) =>
      planId === plan.id && round === plan.currentRound ? 7 : 0,
    ),
    startNewWave: vi.fn(
      async (_db: unknown, planId: string, input: { newRound: number; roundCriteria: Record<string, unknown> }) => {
        if (planId !== plan.id) throw new Error("unknown plan");
        plan = { ...plan, rounds: input.newRound, currentRound: input.newRound, roundCriteria: input.roundCriteria };
        return plan;
      },
    ),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  plan = makePlan();
});

async function buildApp(auth: AuthInfo) {
  const { reviewRoutes } = await import("../src/routes/review");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/", reviewRoutes);
  return app;
}

const organizer: AuthInfo = { userId: "org-user", role: "organizer", orgId: ORG_A };

describe("POST /api/v1/plans/:id/waves refuses at the cap (DEC-082 wave-43)", () => {
  it("400s naming the cap when the plan is already at MAX_PLAN_ROUNDS, and never calls startNewWave", async () => {
    plan = makePlan({ rounds: MAX_PLAN_ROUNDS, currentRound: MAX_PLAN_ROUNDS });
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/waves`, {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.message).toMatch(/maximum number of waves/i);
    expect(body.error.message).toMatch(new RegExp(String(MAX_PLAN_ROUNDS)));
    const repo = await import("../src/server/repo/review");
    expect(repo.startNewWave).not.toHaveBeenCalled();
  });

  it("still allows a wave below the cap (control case)", async () => {
    plan = makePlan({ rounds: MAX_PLAN_ROUNDS - 1, currentRound: MAX_PLAN_ROUNDS - 1 });
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/waves`, {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(200);
    const repo = await import("../src/server/repo/review");
    expect(repo.startNewWave).toHaveBeenCalledTimes(1);
  });
});

// --- Source scan: every non-literal Array.from({ length: <expr> }) site ---
// in app/src/pages must either name `rounds` (the field this wave bounds)
// or be closed-ledgered with a cited, verified reason. Two-directional: a
// stale ledger entry (naming a site that no longer exists, or whose text
// drifted) fails just as loudly as an unledgered new site.

interface LedgerEntry {
  file: string;
  expr: string;
  reason: string;
}

const LEDGER: LedgerEntry[] = [
  {
    file: "app/src/pages/agenda/DayGrid.tsx",
    expr: "rows",
    reason:
      "rows = totalGridRows(dayStartMin, dayEndMin, gridMin); gridMin is bounded [1,480] at src/routes/agenda.ts:160 (AUTO_SCHEDULE_BOUNDS.gridMin), and dayStartMin/dayEndMin are minute-of-day values -- not an unbounded client-derived count.",
  },
];

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkTsx(full));
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

function repoRelative(absPath: string, repoRoot: string): string {
  return absPath.slice(repoRoot.length + 1);
}

describe("source scan: Array.from({ length }) sites are all accounted for", () => {
  const repoRoot = join(__dirname, "..");
  const pagesDir = join(repoRoot, "app/src/pages");
  const files = walkTsx(pagesDir);

  const ARRAY_FROM_LENGTH = /Array\.from\(\{\s*length:\s*([^,}]+?)\s*\}/g;

  interface Site {
    file: string;
    expr: string;
  }

  const sites: Site[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    ARRAY_FROM_LENGTH.lastIndex = 0;
    while ((match = ARRAY_FROM_LENGTH.exec(text)) !== null) {
      const capture = match[1];
      if (capture === undefined) continue;
      const expr = capture.trim();
      if (/^\d+(\.\d+)?$/.test(expr)) continue; // numeric literal, no bound needed
      sites.push({ file: repoRelative(file, repoRoot), expr });
    }
  }

  it("finds at least 3 non-literal Array.from({length}) sites (regex tripwire)", () => {
    expect(sites.length).toBeGreaterThanOrEqual(3);
  });

  it("every found site names `rounds` or is closed-ledgered", () => {
    const unaccounted = sites.filter((s) => {
      const namesRounds = s.expr === "rounds" || s.expr.endsWith(".rounds");
      const ledgered = LEDGER.some((l) => l.file === s.file && l.expr === s.expr);
      return !namesRounds && !ledgered;
    });
    expect(unaccounted).toEqual([]);
  });

  it("ledger is not stale: every ledgered entry still exists in the current scan", () => {
    const stale = LEDGER.filter(
      (l) => !sites.some((s) => s.file === l.file && s.expr === l.expr),
    );
    expect(stale).toEqual([]);
  });
});
