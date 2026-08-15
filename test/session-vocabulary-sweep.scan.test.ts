// DEC-908 + DEC-400 (wave 55 amendment): ONE session-format display
// grammar. src/lib/session-vocabulary.ts's sessionFormatLabel is the only
// place a '(N min)' parenthetical may be rewritten into a display label;
// every reader that actually PRINTS a session's format or audienceLevel to
// a human imports the vocabulary rather than re-deriving its own reading.
//
// Two checks:
//  1. No module other than session-vocabulary.ts declares a helper that
//     rewrites a '(N min)'-style parenthetical (the SubmissionDetailPage
//     private formatSessionFormatGrammar this task deletes is exactly the
//     shape this bans from reappearing). Detected as: a regex targeting the
//     "min|mins|minutes" alternation used inside a `.replace(...)` call.
//     src/domain/schedule.ts's parseFormatDurationMin uses the same
//     alternation but only to EXTRACT (via .match), never to REWRITE (via
//     .replace) — it is deliberately not flagged.
//  2. Every currently-known reader that prints a session's format or
//     audienceLevel through sessionFormatLabel/audienceLevelLabel actually
//     imports them from session-vocabulary.ts. This is a positive,
//     enumerated regression guard (not a blind filesystem heuristic) so it
//     stays narrow enough not to flag editors of a DIFFERENT field, e.g.
//     SubmissionDetailPage's format <select> (writes a CFP answer, doesn't
//     display one) or EmbedsPanel/SavedEmbedsPanel's embed "format" (an
//     unrelated export-format string, not a session format).
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");
const APP_SRC_ROOT = join(ROOT, "app", "src");

const OWNER = "src/lib/session-vocabulary.ts";
// parseFormatDurationMin lives here and legitimately shares the
// "min|mins|minutes" alternation text — but only inside a .match(...) call,
// never a .replace(...), so it can never trip the rewrite-detector below.
const DURATION_EXTRACTOR = "src/domain/schedule.ts";

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

function relPath(absPath: string): string {
  return relative(ROOT, absPath).split("\\").join("/");
}

// The alternation text every '(N min)'-family regex shares, whether it's
// used to extract (.match) or rewrite (.replace).
const MIN_ALTERNATION = /\(\?:min\|mins\|minutes\)/;
const REPLACE_CALL = /\.replace\s*\(/;

function findRewriteOffenders(root: string): string[] {
  const offenders: string[] = [];
  for (const file of walk(root)) {
    const rel = relPath(file);
    if (rel === OWNER || rel === DURATION_EXTRACTOR) continue;
    const contents = readFileSync(file, "utf8");
    if (MIN_ALTERNATION.test(contents) && REPLACE_CALL.test(contents)) offenders.push(rel);
  }
  return offenders;
}

describe("session-vocabulary-sweep.scan (DEC-908/DEC-400 wave 55): one rewrite site", () => {
  it("scanned at least 1 file under src/ and app/src/", () => {
    expect(walk(SRC_ROOT).length).toBeGreaterThan(0);
    expect(walk(APP_SRC_ROOT).length).toBeGreaterThan(0);
  });

  it("session-vocabulary.ts itself genuinely rewrites a '(N min)' parenthetical, via parseFormatDurationMin (proves the pattern isn't vacuous)", () => {
    const src = readFileSync(join(ROOT, OWNER), "utf8");
    expect(src).toMatch(/parseFormatDurationMin/);
    expect(REPLACE_CALL.test(src)).toBe(true);
  });

  it("schedule.ts shares the alternation (extraction) but never pairs it with .replace (proves the exclusion is deliberate, not blind)", () => {
    const src = readFileSync(join(ROOT, DURATION_EXTRACTOR), "utf8");
    expect(MIN_ALTERNATION.test(src)).toBe(true);
    expect(REPLACE_CALL.test(src)).toBe(false);
  });

  it("no module other than session-vocabulary.ts declares a '(N min)'-rewriting helper", () => {
    const offenders = [...findRewriteOffenders(SRC_ROOT), ...findRewriteOffenders(APP_SRC_ROOT)];
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("negative control: a synthetic .match-only extractor is NOT flagged", () => {
    const synthetic = 'const m = label.match(/\\((\\d+)\\s*(?:min|mins|minutes)\\)/i);';
    expect(MIN_ALTERNATION.test(synthetic) && REPLACE_CALL.test(synthetic)).toBe(false);
  });

  it("negative control: a synthetic .replace-based rewriter IS flagged", () => {
    const synthetic = 'return label.replace(/\\s*\\(\\d+\\s*(?:min|mins|minutes)\\)\\s*$/i, \"\");';
    expect(MIN_ALTERNATION.test(synthetic) && REPLACE_CALL.test(synthetic)).toBe(true);
  });
});

// Positive, enumerated regression guard: the readers this task swept (and
// the readers already swept in prior waves) still import the vocabulary
// rather than re-deriving their own reading. Scoped to modules that
// DISPLAY a session's format/audienceLevel -- not the CFP editors that
// WRITE one (SubmissionDetailPage's <select>) and not the unrelated
// export/embed "format" string (EmbedsPanel/SavedEmbedsPanel).
const DISPLAY_READERS = [
  "src/routes/portal/index.tsx",
  "src/routes/public/cards.tsx",
  "app/src/pages/Overview.tsx",
  "app/src/pages/submissions/SubmissionDetailPage.tsx",
  "app/src/pages/review/Scorecard.tsx",
  "app/src/pages/review/ReviewerQueue.tsx",
  "app/src/pages/overview/AgendaWorkSection.tsx",
];

describe("session-vocabulary-sweep.scan: every known format/audienceLevel display reader imports the vocabulary", () => {
  for (const rel of DISPLAY_READERS) {
    it(`${rel} imports from session-vocabulary`, () => {
      const contents = readFileSync(join(ROOT, rel), "utf8");
      expect(contents).toMatch(/from ['"].*session-vocabulary['"]/);
    });
  }

  it("negative control: SubmissionDetailPage's format <select> editor and EmbedsPanel's export-format string are NOT in the display-reader list", () => {
    expect(DISPLAY_READERS).not.toContain("app/src/pages/settings/EmbedsPanel.tsx");
    expect(DISPLAY_READERS).not.toContain("app/src/pages/settings/SavedEmbedsPanel.tsx");
  });
});
