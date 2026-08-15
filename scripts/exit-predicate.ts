// DEC-069 exit predicate, made mechanical (wave 37 task w37-b).
//
// Pure functions over the TEXT of docs/verification-log.md: parse its
// `## <date> <branch> — <scope> @ <sha>` sections (EM DASH, U+2014),
// classify each section's free-text scope onto one of the five DEC-069
// required gate slots, and grade whether each slot is currently
// satisfied at a given product sha. No exported function touches the
// filesystem or spawns a process -- that I/O lives only behind the CLI
// entry point below, matching scripts/ensure-dev-vars.ts's shape, so
// this file is trivially unit-testable against fixture strings.
//
// This script has NO npm script (wave 37 is frozen for package.json --
// it is product-bearing this wave). Invoke it directly:
//
//   npx tsx scripts/exit-predicate.ts --product-sha <sha>
//
// It reads docs/verification-log.md, resolves each section's ancestry
// against <sha> via `git merge-base --is-ancestor`, prints the graded
// table, and exits 1 unless all five slots read PASS.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface LogSection {
  header: string;
  date: string;
  branch: string;
  scope: string;
  sha: string;
  result: string | null;
  openItems: number | null;
  qualifying: boolean;
}

const HEADER_RE = /^## (\d{4}-\d{2}-\d{2}) (\S+) — (.+) @ (\S+)\s*$/;

/**
 * Splits verification-log markdown into one LogSection per
 * `## <date> <branch> — <scope> @ <sha>` header line. Any other content
 * (malformed sub-headers, stray `## QUALIFYING (...)` lines, etc.) is
 * treated as body text of the section it falls under, never as its own
 * section -- only lines matching the DEC-068 header contract start a
 * new section.
 *
 * Within each section's body, the LAST `RESULT:` line and LAST
 * `OPEN ITEMS: <n>` line win (a section may restate them; DEC-069 says
 * "ending with exactly one line", but real sections sometimes echo the
 * value earlier in prose -- the closing line is authoritative).
 * `qualifying` is true iff a body line is exactly `QUALIFYING` (the
 * wave-28 DEC-069 amendment's label for a gate section that is
 * allow-listed non-product-bearing).
 */
export function parseLogSections(markdown: string): LogSection[] {
  const lines = markdown.split("\n");

  interface Raw {
    header: string;
    date: string;
    branch: string;
    scope: string;
    sha: string;
    bodyLines: string[];
  }

  const raws: Raw[] = [];
  let current: Raw | null = null;

  for (const line of lines) {
    const m = HEADER_RE.exec(line);
    if (m) {
      current = {
        header: line,
        date: m[1] as string,
        branch: m[2] as string,
        scope: m[3] as string,
        sha: m[4] as string,
        bodyLines: [],
      };
      raws.push(current);
    } else if (current) {
      current.bodyLines.push(line);
    }
  }

  return raws.map((r) => {
    let result: string | null = null;
    let openItems: number | null = null;
    let qualifying = false;
    for (const line of r.bodyLines) {
      const trimmed = line.trim();
      const resultMatch = /^RESULT:\s*(.+)$/.exec(trimmed);
      if (resultMatch) {
        result = (resultMatch[1] as string).trim();
      }
      const openMatch = /^OPEN ITEMS:\s*(\d+)/.exec(trimmed);
      if (openMatch) {
        openItems = Number.parseInt(openMatch[1] as string, 10);
      }
      if (trimmed === "QUALIFYING") {
        qualifying = true;
      }
    }
    return {
      header: r.header,
      date: r.date,
      branch: r.branch,
      scope: r.scope,
      sha: r.sha,
      result,
      openItems,
      qualifying,
    };
  });
}

export type RequiredScope =
  | "build-test-bundle"
  | "walkthrough"
  | "perf-smoke"
  | "spec-audit"
  | "triage-closure";

export const REQUIRED_SCOPES: readonly RequiredScope[] = [
  "build-test-bundle",
  "walkthrough",
  "perf-smoke",
  "spec-audit",
  "triage-closure",
];

/**
 * Maps a section's free-text `scope` field onto one of the five DEC-069
 * required slots. Real verification-log scopes are hand-written prose
 * ("build+test+bundle", "J1-J12 persona walkthrough", "perf-smoke",
 * "spec-audit §6/§7/§8/§9", "triage-closure confirm", ...) -- this is a
 * keyword classifier, most-specific keyword first, and returns null
 * rather than guessing when nothing matches.
 *
 * DEC-099 (w45 instrument repair): each canonical slot name must match as
 * a WHOLE TOKEN, not a bare substring -- "perf" alone (e.g. "onboarding
 * grid TIER-0 perf", "files library headshot join perf") does NOT
 * classify to perf-smoke; only "perf-smoke"/"perf smoke" does. Likewise
 * triage-closure/triage closure and spec-audit/spec audit require the
 * full two-word phrase, walkthrough requires the whole word, and
 * build-test-bundle requires "build" and "test" to each appear as whole
 * words. A scope naming more than one slot (e.g.
 * "build+test+bundle+walkthrough+render-sweep") is classified to
 * whichever slot's keyword is checked first below; this is a narrowing,
 * not a loss, because DEC-069 wants one qualifying section per slot and a
 * combined section can be re-used per slot by naming it distinctly in
 * future runs.
 */
export function classifyScope(scope: string): RequiredScope | null {
  const s = scope.toLowerCase();
  if (/\btriage[-\s]closure\b/.test(s)) return "triage-closure";
  if (/\bspec[-\s]audit\b/.test(s)) return "spec-audit";
  if (/\bperf[-\s]smoke\b/.test(s)) return "perf-smoke";
  if (/\bwalkthrough\b/.test(s)) return "walkthrough";
  if (/\bbuild\b/.test(s) && /\btest\b/.test(s)) return "build-test-bundle";
  return null;
}

export interface PredicateRow {
  slot: RequiredScope;
  status: "PASS" | "FAIL" | "VOID" | "MISSING";
  section?: LogSection;
}

/**
 * Grades each of the five DEC-069 slots against `sections` (assumed to
 * be in document order, i.e. append order -- the log is append-only).
 *
 * `isAncestor(ancestorSha, descendantSha)` answers: "is `ancestorSha` an
 * ancestor of (or equal to) `descendantSha`?", equivalent to
 * `git merge-base --is-ancestor <ancestorSha> <descendantSha>`. It is
 * used two ways here:
 *
 *   1. Ancestry validity: a section only counts toward its slot if
 *      `isAncestor(productSha, section.sha)` holds -- i.e. the tree it
 *      measured already includes the current product sha's changes.
 *      Otherwise later product code has landed since that section ran
 *      and it is stale.
 *
 *   2. Staleness among valid candidates (DEC-099 w44 instrument
 *      repair): among the ancestry-valid, verdict-bearing candidates
 *      for a slot, any candidate whose sha is a PROPER ancestor of
 *      another candidate's sha measured a strictly older tree and is
 *      discarded, even though it is individually ancestry-valid --
 *      last-appended-by-itself is not enough; a section that reran an
 *      older commit after a newer one already qualified must not win
 *      just because it appears later in the log. This is
 *      content-independent and direction-independent: it demotes a
 *      stale PASS exactly as readily as a stale FAIL.
 *
 * For every slot except triage-closure, the section's own `result`
 * line decides PASS vs FAIL (a line starting "PASS" is PASS, anything
 * else -- e.g. "FAIL — ...", "FAIL (...)" -- is FAIL). For
 * triage-closure, DEC-069 grades on `OPEN ITEMS: <n>`: n === 0 is PASS,
 * n > 0 is FAIL, no OPEN ITEMS line at all does not count as a verdict.
 *
 * Sections with no usable verdict line are skipped without deciding
 * VOID vs MISSING by themselves. Among the surviving (ancestry-valid,
 * non-stale) verdict-bearing sections for a slot, the most recent
 * (last-appended) one wins. If every verdict-bearing section for a
 * slot is ancestry-stale relative to `productSha`, the slot is VOID.
 * If no section classifies to the slot at all (or none carries a
 * verdict), the slot is MISSING.
 *
 * DEC-099 (w45 instrument repair): a section is a CANDIDATE for a slot
 * only if BOTH `section.qualifying === true` (the wave-28 amendment's
 * `QUALIFYING` label, previously parsed and discarded) AND
 * `classifyScope` maps it onto that slot as a whole-token match. A
 * section failing either test is skipped entirely -- it contributes
 * neither a PASS/FAIL verdict nor a `sawStaleVerdict` VOID -- so a
 * non-qualifying section can never decide a gate slot no matter how its
 * scope text reads.
 */
export function gradePredicate(
  sections: readonly LogSection[],
  productSha: string,
  isAncestor: (ancestorSha: string, descendantSha: string) => boolean,
): PredicateRow[] {
  return REQUIRED_SCOPES.map((slot) => {
    const candidates = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.qualifying && classifyScope(section.scope) === slot);

    let sawStaleVerdict = false;
    const valid: { section: LogSection; index: number; outcome: "PASS" | "FAIL" }[] = [];

    for (const { section, index } of candidates) {
      const outcome = slotOutcome(section, slot);
      if (outcome === null) continue; // no usable verdict on this section
      if (isAncestor(productSha, section.sha)) {
        valid.push({ section, index, outcome });
      } else {
        sawStaleVerdict = true;
      }
    }

    if (valid.length === 0) {
      return { slot, status: sawStaleVerdict ? "VOID" : "MISSING" } as PredicateRow;
    }

    // Discard any candidate whose sha is a proper ancestor of another
    // surviving candidate's sha -- it measured a strictly older tree.
    const survivors = valid.filter(
      (candidate) =>
        !valid.some(
          (other) =>
            other.section.sha !== candidate.section.sha &&
            isAncestor(candidate.section.sha, other.section.sha),
        ),
    );

    // Among survivors, the last-appended (highest document-order index) wins.
    const winner = survivors.reduce((best, cur) => (cur.index > best.index ? cur : best));

    return { slot, status: winner.outcome, section: winner.section };
  });
}

function slotOutcome(section: LogSection, slot: RequiredScope): "PASS" | "FAIL" | null {
  if (slot === "triage-closure") {
    if (section.openItems === null) return null;
    return section.openItems === 0 ? "PASS" : "FAIL";
  }
  if (section.result === null) return null;
  return section.result.startsWith("PASS") ? "PASS" : "FAIL";
}

export function formatPredicateTable(rows: readonly PredicateRow[]): string {
  const header = ["SLOT", "STATUS", "SHA", "HEADER"];
  const lines: string[][] = [header];
  for (const row of rows) {
    lines.push([
      row.slot,
      row.status,
      row.section?.sha ?? "-",
      row.section?.header ?? "-",
    ]);
  }
  const widths = header.map((_, col) =>
    Math.max(...lines.map((line) => (line[col] as string).length)),
  );
  return lines
    .map((line) => line.map((cell, col) => cell.padEnd(widths[col] as number)).join("  "))
    .join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const flagIdx = process.argv.indexOf("--product-sha");
  if (flagIdx === -1 || !process.argv[flagIdx + 1]) {
    throw new Error(
      "exit-predicate: usage: npx tsx scripts/exit-predicate.ts --product-sha <sha>",
    );
  }
  const productSha = process.argv[flagIdx + 1] as string;

  const REPO_ROOT = join(import.meta.dirname, "..");
  const LOG_FILE = join(REPO_ROOT, "docs", "verification-log.md");
  const markdown = readFileSync(LOG_FILE, "utf8");
  const sections = parseLogSections(markdown);

  const ancestorCache = new Map<string, boolean>();
  function isAncestor(ancestorSha: string, descendantSha: string): boolean {
    const key = `${ancestorSha}:${descendantSha}`;
    const cached = ancestorCache.get(key);
    if (cached !== undefined) return cached;
    let result: boolean;
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", ancestorSha, descendantSha], {
        cwd: REPO_ROOT,
        stdio: "pipe",
      });
      result = true;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 1) {
        result = false;
      } else {
        throw err;
      }
    }
    ancestorCache.set(key, result);
    return result;
  }

  const rows = gradePredicate(sections, productSha, isAncestor);
  console.log(formatPredicateTable(rows));

  const allPass = rows.every((r) => r.status === "PASS");
  if (!allPass) {
    console.error(
      `exit-predicate: not all five DEC-069 slots are PASS at product sha ${productSha}.`,
    );
    process.exit(1);
  }
}
