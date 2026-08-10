/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import {
  isValidStatusLiteral,
  parseListQuery,
  SORT_ORDERS,
} from "../src/server/repo/submissions";
import { changeStatus } from "../src/domain/status";
import { planAcceptance } from "../src/domain/acceptance";

describe("parseListQuery (DEC-013 pagination + DEC-016 filters)", () => {
  it("defaults page=1, perPage=50, sort=newest, includeAnswers=false", () => {
    expect(parseListQuery({})).toEqual({
      page: 1,
      perPage: 50,
      q: null,
      status: [],
      trackId: null,
      sort: "newest",
      includeAnswers: false,
    });
  });

  it("parses page/perPage, clamping perPage to 200", () => {
    expect(parseListQuery({ page: "3", perPage: "500" })).toMatchObject({ page: 3, perPage: 200 });
  });

  it("falls back to defaults for non-positive or non-integer page/perPage", () => {
    expect(parseListQuery({ page: "0", perPage: "-5" })).toMatchObject({ page: 1, perPage: 50 });
    expect(parseListQuery({ page: "abc" })).toMatchObject({ page: 1 });
  });

  it("trims q and treats blank q as absent", () => {
    expect(parseListQuery({ q: "  hello  " }).q).toBe("hello");
    expect(parseListQuery({ q: "   " }).q).toBeNull();
  });

  it("parses comma-separated status, dropping unknown literals", () => {
    expect(parseListQuery({ status: "pending,accepted" }).status).toEqual(["pending", "accepted"]);
    expect(parseListQuery({ status: "pending,bogus,declined" }).status).toEqual(["pending", "declined"]);
  });

  it("parses all four DEC-016 sorts and falls back to newest", () => {
    for (const sort of SORT_ORDERS) {
      expect(parseListQuery({ sort }).sort).toBe(sort);
    }
    expect(parseListQuery({ sort: "bogus" }).sort).toBe("newest");
  });

  it("reads trackId and includeAnswers=1", () => {
    expect(parseListQuery({ trackId: "t1" }).trackId).toBe("t1");
    expect(parseListQuery({ includeAnswers: "1" }).includeAnswers).toBe(true);
    expect(parseListQuery({ includeAnswers: "true" }).includeAnswers).toBe(false);
  });
});

describe("isValidStatusLiteral (DEC-003 literals, write-path validation)", () => {
  it("accepts exactly the five DEC-003 literals", () => {
    for (const s of ["pending", "accept_queue", "decline_queue", "accepted", "declined"]) {
      expect(isValidStatusLiteral(s)).toBe(true);
    }
  });

  it("rejects unknown strings, non-strings, and undefined", () => {
    expect(isValidStatusLiteral("approved")).toBe(false);
    expect(isValidStatusLiteral(123)).toBe(false);
    expect(isValidStatusLiteral(undefined)).toBe(false);
    expect(isValidStatusLiteral(null)).toBe(false);
  });
});

describe("DEC-009 acceptance idempotence guard (pure logic, exercised via the domain cores this module composes)", () => {
  it("fires acceptance exactly once across repeated transitions into 'accepted'", () => {
    const now = 1000;
    const first = changeStatus({ status: "pending", acceptedAt: null }, "accepted", now);
    expect(first.fireAcceptance).toBe(true);
    expect(first.acceptedAt).toBe(now);

    // Re-running with the persisted acceptedAt (simulating a retry / re-accept).
    const second = changeStatus({ status: "accepted", acceptedAt: first.acceptedAt }, "accepted", now + 500);
    expect(second.fireAcceptance).toBe(false);
    expect(second.acceptedAt).toBe(now); // unchanged, never re-stamped

    // Un-accept then re-accept: still guarded because acceptedAt was never cleared.
    const declined = changeStatus({ status: "accepted", acceptedAt: first.acceptedAt }, "declined", now + 1000);
    expect(declined.acceptedAt).toBe(now);
    const reaccepted = changeStatus({ status: "declined", acceptedAt: declined.acceptedAt }, "accepted", now + 2000);
    expect(reaccepted.fireAcceptance).toBe(false);
  });

  it("planAcceptance is idempotent when re-run with previously-planned titles folded in", () => {
    const input = {
      submissionId: "s1",
      eventId: "e1",
      participantContactIds: ["c1"],
      existingTaskTitlesByContact: {},
    };
    const first = planAcceptance(input);
    expect(first.taskAssignments.length).toBeGreaterThan(0);

    const existingTaskTitlesByContact: Record<string, string[]> = {
      c1: first.taskAssignments.map((a) => a.taskTitle),
    };
    const second = planAcceptance({ ...input, existingTaskTitlesByContact });
    expect(second.taskAssignments).toEqual([]);
  });
});

const sourceModules = import.meta.glob(
  ["../src/routes/api/submissions.ts", "../src/server/repo/submissions.ts"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

describe("DEC-009 invariant #1: no mailer import reachable from the status-change path", () => {
  it("neither the route module nor the repo module import a mailer", () => {
    const entries = Object.entries(sourceModules);
    expect(entries.length).toBe(2);
    for (const [path, source] of entries) {
      expect(source, `${path} must not import from mail/`).not.toMatch(/from ["'].*\/mail\//);
      expect(source, `${path} must not reference Mailer`).not.toMatch(/Mailer/);
    }
  });
});
