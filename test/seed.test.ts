import { describe, expect, it } from "vitest";
import {
  additionalSubmissionStatuses,
  deleteAllStmt,
  insertStmt,
  seedId,
  sqlQuote,
} from "../scripts/seed-lib";

describe("sqlQuote", () => {
  it("quotes plain strings", () => {
    expect(sqlQuote("hello")).toBe("'hello'");
  });

  it("escapes single quotes by doubling", () => {
    expect(sqlQuote("O'Brien's talk")).toBe("'O''Brien''s talk'");
  });

  it("passes numbers through unquoted", () => {
    expect(sqlQuote(42)).toBe("42");
    expect(sqlQuote(0)).toBe("0");
  });

  it("rejects non-finite numbers", () => {
    expect(() => sqlQuote(Number.NaN)).toThrow();
    expect(() => sqlQuote(Number.POSITIVE_INFINITY)).toThrow();
  });

  it("renders booleans as 0/1 integers", () => {
    expect(sqlQuote(true)).toBe("1");
    expect(sqlQuote(false)).toBe("0");
  });

  it("renders null/undefined as SQL NULL", () => {
    expect(sqlQuote(null)).toBe("NULL");
    expect(sqlQuote(undefined)).toBe("NULL");
  });
});

describe("insertStmt", () => {
  it("builds an INSERT with columns in row-key order", () => {
    const stmt = insertStmt("track", { id: "t1", event_id: "e1", name: "AI", position: 0 });
    expect(stmt).toBe('INSERT INTO track ("id", "event_id", "name", "position") VALUES (\'t1\', \'e1\', \'AI\', 0);');
  });

  it("throws on an empty row", () => {
    expect(() => insertStmt("track", {})).toThrow();
  });
});

describe("deleteAllStmt", () => {
  it("builds a DELETE FROM statement", () => {
    expect(deleteAllStmt("submission")).toBe("DELETE FROM submission;");
  });
});

describe("seedId", () => {
  it("zero-pads deterministic ids", () => {
    expect(seedId("submission", 4)).toBe("seed_submission_0004");
    expect(seedId("org", 1)).toBe("seed_org_0001");
  });

  it("rejects negative or non-integer n", () => {
    expect(() => seedId("x", -1)).toThrow();
    expect(() => seedId("x", 1.5)).toThrow();
  });
});

describe("additionalSubmissionStatuses", () => {
  it("returns 27 statuses matching the ~18/4/5/1/2 distribution (incl. 3 fixture pending)", () => {
    const statuses = additionalSubmissionStatuses(27);
    expect(statuses).toHaveLength(27);
    const counts: Record<string, number> = {};
    for (const s of statuses) counts[s] = (counts[s] ?? 0) + 1;
    expect(counts["pending"]).toBe(15);
    expect(counts["accept_queue"]).toBe(4);
    expect(counts["accepted"]).toBe(5);
    expect(counts["decline_queue"]).toBe(1);
    expect(counts["declined"]).toBe(2);
    // Plus the 3 fixture submissions (all pending) totals 18 pending / 30 overall.
    expect((counts["pending"] ?? 0) + 3).toBe(18);
  });

  it("only uses DEC-003 submission status literals", () => {
    const allowed = new Set(["pending", "accept_queue", "decline_queue", "accepted", "declined"]);
    for (const s of additionalSubmissionStatuses(27)) {
      expect(allowed.has(s)).toBe(true);
    }
  });

  it("throws if count does not match the fixed distribution total", () => {
    expect(() => additionalSubmissionStatuses(10)).toThrow();
  });
});
