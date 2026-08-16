// DEC-844 (wave 54): dayOutsideEventRangeCondition is the SQL twin of
// isDayWithinEventRange's negation — listSlotsOutsideWindow (agenda.ts)
// composes it into a WHERE clause instead of pulling every row into JS and
// filtering there. This matrix proves the SQL condition tree (walked and
// evaluated the same way `and`/`or`/`lt`/`gt` would in SQLite: lexical
// string comparison on the ISO day column) agrees with
// !isDayWithinEventRange(...) on every cell, including exact boundaries and
// strings that sort adjacent to a boundary (e.g. "2026-08-1" < "2026-08-10").

import { describe, expect, it } from "vitest";
import { dayOutsideEventRangeCondition, isDayWithinEventRange } from "../src/server/repo/agenda";

/** Evaluates a drizzle SQL condition tree built from and/or/lt/gt over the
 * schedule_slot.day column against a single candidate day, by walking the
 * tree and applying the same lexical string comparison SQLite would use on
 * a TEXT column. This is a structural interpreter (not a live SQLite call),
 * matched against the OTHER direction (isDayWithinEventRange) cell by cell. */
function evalCondition(day: string, startDate: string, endDate: string): boolean {
  const cond = dayOutsideEventRangeCondition(startDate, endDate) as unknown as {
    queryChunks: unknown[];
  };
  return evalNode(cond, day);
}

function evalNode(node: unknown, day: string): boolean {
  const n = node as { queryChunks?: unknown[] };
  const chunks = n.queryChunks;
  if (!Array.isArray(chunks)) throw new Error("evalNode: expected a SQL node with queryChunks");

  // Identify this node's own operator from its DIRECT StringChunk children
  // only (not recursing into nested SQL sub-nodes' text, which would smear
  // an inner " or " onto an outer wrapper node): "or(a, b)" carries a direct
  // StringChunk " or " between its two operand sub-nodes; lt/gt carry "<"/">"
  // between the column and the bound Param; a plain "(" ")" wrapper (drizzle's
  // `or()` top-level parenthesization) carries no operator text at all and
  // simply delegates to its one non-StringChunk child.
  const directTexts = chunks
    .filter((c) => isStringChunk(c))
    .map((c) => (c as { value?: unknown[] }).value)
    .filter((v): v is unknown[] => Array.isArray(v))
    .flat()
    .filter((v): v is string => typeof v === "string");
  const joined = directTexts.join("");
  const nonStringChildren = chunks.filter((c) => !isStringChunk(c));

  if (joined.includes(" or ")) {
    if (nonStringChildren.length !== 2) throw new Error("evalNode: expected exactly 2 operands for or()");
    return evalNode(nonStringChildren[0], day) || evalNode(nonStringChildren[1], day);
  }
  if (joined.includes("<") || joined.includes(">")) {
    const isLt = joined.includes("<");
    return isLt ? day < boundaryValue(chunks) : day > boundaryValue(chunks);
  }
  if (nonStringChildren.length === 1) {
    // Paren-only wrapper node (e.g. drizzle's or() outer "(" ... ")") —
    // delegate to the single wrapped sub-node.
    return evalNode(nonStringChildren[0], day);
  }
  throw new Error(`evalNode: unrecognized condition shape: ${joined}`);
}

function isStringChunk(c: unknown): boolean {
  return (c as { constructor?: { name?: string } }).constructor?.name === "StringChunk";
}

function boundaryValue(chunks: unknown[]): string {
  for (const c of chunks) {
    const rec = c as { constructor?: { name?: string }; value?: unknown };
    if (rec.constructor?.name === "Param" && typeof rec.value === "string") return rec.value;
  }
  throw new Error("boundaryValue: no Param found");
}

describe("dayOutsideEventRangeCondition agrees with !isDayWithinEventRange (DEC-844 wave 54)", () => {
  const startDate = "2026-08-10";
  const endDate = "2026-08-12";

  const days = [
    "2026-08-01", // well before
    "2026-08-09", // day before start
    "2026-08-10", // exact start boundary
    "2026-08-11", // strictly inside
    "2026-08-12", // exact end boundary
    "2026-08-13", // day after end
    "2026-08-31", // well after
    "2026-08-1", // adjacent-sorting malformed (non-zero-padded) string: lexically < "2026-08-10"
    "2026-08-100", // adjacent-sorting string: lexically > "2026-08-10", < "2026-08-11"
  ];

  it.each(days)("day=%s", (day) => {
    const within = isDayWithinEventRange(day, startDate, endDate);
    const outside = evalCondition(day, startDate, endDate);
    expect(outside).toBe(!within);
  });

  it("single-day event boundary (start === end)", () => {
    const s = "2026-08-10";
    for (const day of ["2026-08-09", "2026-08-10", "2026-08-11"]) {
      expect(evalCondition(day, s, s)).toBe(!isDayWithinEventRange(day, s, s));
    }
  });
});
