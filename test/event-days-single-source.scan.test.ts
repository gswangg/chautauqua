// DEC-277 (wave 60 amendment): ONE owner of the event's calendar-day list.
// src/domain/event-days.ts exports eventDays(startDate, endDate) -- the
// pure-core, fail-loud implementation every other reader (admin agenda
// payload, auto-schedule, and both public surfaces) delegates to. This scan
// bans any OTHER module from advancing a day cursor by 86400000 (or the
// equivalent `24 * 60 * 60 * 1000` spelling) to accumulate a YYYY-MM-DD list
// -- that arithmetic IS the day-range loop, so a second copy of it is a
// second implementation of "which days does this event span?" even if it
// never says so in a comment.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");

// The ONE legitimate home for the day-cursor loop.
const OWNER = "src/domain/event-days.ts";

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(path);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx")) && !isTestFile(full)) {
      out.push(full);
    }
  }
  return out;
}

// Matches `+= 86400000` or `+= 24 * 60 * 60 * 1000` (whitespace-tolerant),
// the day-length increment that advances a millisecond cursor one day.
const DAY_CURSOR_INCREMENT = /\+=\s*(86400000|24\s*\*\s*60\s*\*\s*60\s*\*\s*1000)/;

export function findDayCursorFiles(root: string, repoRoot: string): string[] {
  const offenders: string[] = [];
  for (const file of walk(root)) {
    const rel = relative(repoRoot, file).split("\\").join("/");
    if (rel === OWNER) continue;
    const contents = readFileSync(file, "utf8");
    if (DAY_CURSOR_INCREMENT.test(contents)) offenders.push(rel);
  }
  return offenders.sort();
}

describe("event-days-single-source.scan (DEC-277 wave 60 amendment): one event-day-list owner", () => {
  it("scanned at least 1 file under src/ (vacuous-scan tripwire)", () => {
    expect(walk(SRC_ROOT).length).toBeGreaterThan(0);
  });

  it("src/domain/event-days.ts genuinely declares the day-cursor increment (proves the pattern isn't vacuous)", () => {
    const src = readFileSync(join(ROOT, OWNER), "utf8");
    expect(DAY_CURSOR_INCREMENT.test(src)).toBe(true);
  });

  it("no module other than src/domain/event-days.ts advances a day cursor by 86400000", () => {
    const offenders = findDayCursorFiles(SRC_ROOT, ROOT);
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("negative control: a synthetic day-cursor loop IS detected", () => {
    const synthetic = "for (let t = start; t <= end; t += 86400000) { days.push(t); }";
    expect(DAY_CURSOR_INCREMENT.test(synthetic)).toBe(true);
  });

  it("negative control: the '24 * 60 * 60 * 1000' spelling IS detected too", () => {
    const synthetic = "for (let cursor = start; cursor <= end; cursor += 24 * 60 * 60 * 1000) {}";
    expect(DAY_CURSOR_INCREMENT.test(synthetic)).toBe(true);
  });

  it("negative control: unrelated arithmetic is NOT detected", () => {
    const synthetic = "const total = a += 1000;";
    expect(DAY_CURSOR_INCREMENT.test(synthetic)).toBe(false);
  });
});
