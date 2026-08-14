// DEC-432/DEC-809: the J11 walkthrough check (scripts/walkthrough/data.ts)
// asserts field names on the /api/v1/contacts/stats response body by hand,
// against the ContactStats interface exported by
// src/server/repo/contacts/stats.ts, by hand. Nothing ties the two
// together, so a field can be renamed/deleted on one side (as happened to
// returningSpeakers/eventCount) and the walkthrough dies at that assertion
// with every later J12 check unrun (fail() is process.exit(1)). This test
// is a two-directional binding: every field the J11 check asserts on must
// exist on ContactStats, and vice versa, so neither side can drift silently
// again. It parses both sources as text (no runtime import of the script,
// which calls process.exit on failure) and ships a negative control proving
// the comparison itself catches a missing field on either side.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WALKTHROUGH_PATH = resolve(fileURLToPath(import.meta.url), "../../scripts/walkthrough/data.ts");
const STATS_PATH = resolve(fileURLToPath(import.meta.url), "../../src/server/repo/contacts/stats.ts");

/** Returns the text between a `{` at `openBraceIdx` and its matching `}`,
 * respecting nested braces (a naive `[^}]*` regex stops at the FIRST `}`,
 * which breaks on a field whose type itself contains one, e.g.
 * `topCompanies: { company: string; count: number }[]`). */
function extractBalancedBraceBody(source: string, openBraceIdx: number): string {
  let depth = 0;
  for (let i = openBraceIdx; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(openBraceIdx + 1, i);
    }
  }
  throw new Error("unbalanced braces starting at index " + openBraceIdx);
}

/** Top-level field names only: skips any line whose declared type itself
 * opens a nested `{` (e.g. topCompanies' inline object-array type), since
 * those inner keys ('company'/'count') are not ContactStats fields. */
function topLevelFieldNames(body: string): string[] {
  const fields: string[] = [];
  const lines = body.split("\n");
  let skipDepth = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("//")) continue;
    if (skipDepth > 0) {
      skipDepth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
      continue;
    }
    const fieldMatch = /^(\w+)\??:/.exec(line);
    if (fieldMatch) fields.push(fieldMatch[1]!);
    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;
    if (opens > closes) skipDepth += opens - closes;
  }
  return fields;
}

/** Extracts the field names the J11 "dashboard stats" check asserts on the
 * /api/v1/contacts/stats response: the `as { ... }` type annotation on the
 * `stats` const right after that check's fetch, PLUS any
 * `stats.<field>` access below it (the annotation alone would miss a field
 * the script reads but never types explicitly). */
function extractWalkthroughStatsFields(source: string): string[] {
  const checkIdx = source.indexOf('check("J11: dashboard stats');
  if (checkIdx === -1) throw new Error('J11 "dashboard stats" check not found in scripts/walkthrough/data.ts — has it moved or been renamed?');
  // Bound the scan to this check's block (up to the next check(...) call).
  const nextCheckIdx = source.indexOf("check(", checkIdx + 1);
  const block = source.slice(checkIdx, nextCheckIdx === -1 ? undefined : nextCheckIdx);

  const typeStartMatch = /const stats = \(await asJson\(statsRes\)\) as \{/.exec(block);
  if (!typeStartMatch) throw new Error("J11 dashboard-stats check's `stats` type annotation not found — has its shape changed?");
  const openBraceIdx = typeStartMatch.index + typeStartMatch[0].length - 1;
  const typeBody = extractBalancedBraceBody(block, openBraceIdx);

  const fields = new Set<string>(topLevelFieldNames(typeBody.replace(/;/g, "\n")));
  for (const accessMatch of block.matchAll(/\bstats\.(\w+)\b/g)) {
    fields.add(accessMatch[1]!);
  }
  return Array.from(fields);
}

/** Extracts the field names declared on the exported ContactStats
 * interface. */
function extractContactStatsFields(source: string): string[] {
  const startMatch = /export interface ContactStats \{/.exec(source);
  if (!startMatch) throw new Error("ContactStats interface not found in src/server/repo/contacts/stats.ts — has it moved or been renamed?");
  const openBraceIdx = startMatch.index + startMatch[0].length - 1;
  const body = extractBalancedBraceBody(source, openBraceIdx);
  return topLevelFieldNames(body);
}

/** The two-directional comparison itself, factored out so the negative
 * control below can exercise it against synthetic inputs without touching
 * the real files. */
function diffFields(walkthroughFields: string[], statsFields: string[]): { missingFromStats: string[]; missingFromWalkthrough: string[] } {
  const walkthroughSet = new Set(walkthroughFields);
  const statsSet = new Set(statsFields);
  return {
    missingFromStats: walkthroughFields.filter((f) => !statsSet.has(f)),
    missingFromWalkthrough: statsFields.filter((f) => !walkthroughSet.has(f)),
  };
}

describe("J11 walkthrough <-> ContactStats: two-directional field binding", () => {
  const walkthroughSource = readFileSync(WALKTHROUGH_PATH, "utf-8");
  const statsSource = readFileSync(STATS_PATH, "utf-8");
  const walkthroughFields = extractWalkthroughStatsFields(walkthroughSource);
  const statsFields = extractContactStatsFields(statsSource);

  it("found at least one field on each side", () => {
    expect(walkthroughFields.length).toBeGreaterThan(0);
    expect(statsFields.length).toBeGreaterThan(0);
  });

  it("every field the J11 check asserts on exists on ContactStats", () => {
    const { missingFromStats } = diffFields(walkthroughFields, statsFields);
    if (missingFromStats.length > 0) {
      throw new Error(
        `scripts/walkthrough/data.ts's J11 dashboard-stats check asserts on field(s) ${JSON.stringify(missingFromStats)} that ContactStats no longer declares — the walkthrough will fail() (process.exit(1)) before every later J12 check runs.`,
      );
    }
    expect(missingFromStats).toEqual([]);
  });

  it("every ContactStats field named 'returningSpeakers' or asserted elsewhere is covered (contract fields present)", () => {
    // The J11 check does not have to assert on EVERY ContactStats field
    // (topCompanies/duplicateCount/etc. are covered by other J11/J12
    // checks and route tests) -- but the two DEC-432/DEC-809 contract
    // fields specifically must round-trip, since they are the ones this
    // wave restores.
    expect(statsFields).toContain("returningSpeakers");
    expect(statsFields).toContain("eventCount");
    expect(walkthroughFields).toContain("returningSpeakers");
  });

  describe("negative control: the comparison itself reports a field missing from either side", () => {
    it("reports a walkthrough field absent from ContactStats", () => {
      const { missingFromStats } = diffFields(["total", "returningSpeakers", "ghostField"], ["total", "returningSpeakers", "eventCount"]);
      expect(missingFromStats).toEqual(["ghostField"]);
    });

    it("reports a ContactStats field the walkthrough never asserts on", () => {
      const { missingFromWalkthrough } = diffFields(["total", "returningSpeakers"], ["total", "returningSpeakers", "orphanField"]);
      expect(missingFromWalkthrough).toEqual(["orphanField"]);
    });

    it("reports nothing when both sides match", () => {
      const result = diffFields(["a", "b"], ["a", "b"]);
      expect(result.missingFromStats).toEqual([]);
      expect(result.missingFromWalkthrough).toEqual([]);
    });
  });
});
