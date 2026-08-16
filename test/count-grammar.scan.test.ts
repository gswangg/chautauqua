// DEC-925 (amendment, wave 52): ONE spelled-count helper for the whole
// codebase. The DEC's own file:line list named three private word lists
// (root.tsx's 1-9, ErrorSummary.tsx's 0-10 Capitalised, overview/rows.ts's
// 0-10 lowercase) and one sentence built two ways -- "N things need fixing
// before this can be sent" (numeral in the public CFP builder, spelled in
// the admin error summary). This scan's own enumeration found two MORE the
// DEC didn't name: src/routes/public/sessions.tsx's DAY_COUNT_WORDS (0-10
// Capitalised) and app/src/pages/agenda/ConflictChip.tsx's NUMBER_WORDS
// (0-9 Capitalised) -- both fixed in this same task (a DEC's own file list
// is not the same as the codebase's actual population). src/domain/
// count-copy.ts's spellCount is now the ONE home; app/src/lib/plural.ts
// re-exports it (the one app -> src crossing, DEC-957). This scan bans any
// OTHER module from declaring a spelled-number word list, with exactly one
// documented, temporary allowlist entry.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");
const APP_SRC_ROOT = join(ROOT, "app", "src");

// The ONE legitimate home for the word list.
const OWNER = "src/domain/count-copy.ts";

// w51-e has landed: app/src/pages/overview/rows.ts no longer declares its
// own spellSmallNumber word list -- it imports spellCount from
// app/src/lib/plural.ts like everything else. No module besides
// count-copy.ts is allowed to declare a spelled-number word list, so this
// allowlist is empty (kept as a Set, not deleted, so a future exception has
// one obvious place to land with its own dated justification).
const ALLOWLIST = new Set<string>([]);

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

// A spelled-number word list: a run of at least three quoted number words
// in sequence, comma-separated -- ['zero', 'one', 'two', ...] or ['One',
// 'Two', 'Three', ...]. Requiring the literal quote-comma-quote adjacency
// (not just the bare words anywhere in the file) is what distinguishes a
// genuine array-literal declaration from ordinary prose mentioning "the
// current one" or "spans more than one scheduled day" a few lines apart.
const SEQUENCE_LOWER = /['"]one['"]\s*,\s*['"]two['"]\s*,\s*['"]three['"]/;
const SEQUENCE_UPPER = /['"]One['"]\s*,\s*['"]Two['"]\s*,\s*['"]Three['"]/;

// DEC-925 (wave-5 amendment, sha ee8ceffa): this scan's subject is a CODE
// construct (a declared word-list array), not prose, so it must strip
// comments before matching -- a COMMENT that merely quotes the sequence is
// not a declaration. Idiom reused from public-page-title-register.scan.
// test.ts / type-scale-conformance.test.ts.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

export function findSpelledNumberListFiles(root: string, repoRoot: string): string[] {
  const offenders: string[] = [];
  for (const file of walk(root)) {
    const rel = relative(repoRoot, file).split("\\").join("/");
    if (rel === OWNER) continue;
    const contents = stripComments(readFileSync(file, "utf8"));
    if (SEQUENCE_LOWER.test(contents) || SEQUENCE_UPPER.test(contents)) offenders.push(rel);
  }
  return offenders.sort();
}

describe("count-grammar.scan (DEC-925 amendment, wave 52): one spelled-count word list", () => {
  it("scanned at least 1 file under src/ and app/src/", () => {
    expect(walk(SRC_ROOT).length).toBeGreaterThan(0);
    expect(walk(APP_SRC_ROOT).length).toBeGreaterThan(0);
  });

  it("src/domain/count-copy.ts genuinely declares the word list (proves the pattern isn't vacuous)", () => {
    // count-copy.ts itself is excluded from `offenders` by construction (the
    // OWNER skip); assert directly that its source matches the sequence so a
    // future rewrite that drops the word list is caught.
    const src = readFileSync(join(ROOT, OWNER), "utf8");
    expect(SEQUENCE_LOWER.test(src) || SEQUENCE_UPPER.test(src)).toBe(true);
  });

  it("no module other than count-copy.ts declares a spelled-number word list, except the one documented allowlist entry", () => {
    const offenders = [...findSpelledNumberListFiles(SRC_ROOT, ROOT), ...findSpelledNumberListFiles(APP_SRC_ROOT, ROOT)];
    const unexpected = offenders.filter((f) => !ALLOWLIST.has(f));
    expect(unexpected, unexpected.join("\n")).toEqual([]);
  });

  it("the allowlist entry is itself still present and still a genuine offender (a stale allowlist entry is a lie)", () => {
    const offenders = [...findSpelledNumberListFiles(SRC_ROOT, ROOT), ...findSpelledNumberListFiles(APP_SRC_ROOT, ROOT)];
    for (const allowed of ALLOWLIST) {
      expect(offenders, `allowlisted file ${allowed} is no longer a spelled-number list offender -- remove it from ALLOWLIST`).toContain(allowed);
    }
  });

  it("negative control: a synthetic sequential word-list array IS detected", () => {
    const synthetic = "const WORDS = ['one', 'two', 'three', 'four'];";
    expect(SEQUENCE_LOWER.test(synthetic)).toBe(true);
  });

  it("negative control: unrelated prose mentioning the words separately is NOT detected", () => {
    const synthetic = "// pick one, then two, then maybe three separate arrays: [a, b], [1, 2, 3]. It spans more than one day, and points at the current one.";
    expect(SEQUENCE_LOWER.test(synthetic) || SEQUENCE_UPPER.test(synthetic)).toBe(false);
  });

  // DEC-925 (wave-5 amendment): a comment merely quoting the sequence is not
  // a declaration and must not be flagged, now that comments are stripped
  // before matching. The real-array-declaration positive still holds.
  it("[control] a comment quoting 'one', 'two', 'three' is NOT flagged once comments are stripped", () => {
    const synthetic = "// e.g. reason: 'one', 'two', 'three' were the old spelled words before this landed\nconst X = 1;";
    const stripped = stripComments(synthetic);
    expect(SEQUENCE_LOWER.test(stripped) || SEQUENCE_UPPER.test(stripped)).toBe(false);
  });

  it("[control] a real array declaration IS still flagged after comment stripping", () => {
    const synthetic = "// unrelated header comment\nconst WORDS = ['one', 'two', 'three', 'four'];";
    const stripped = stripComments(synthetic);
    expect(SEQUENCE_LOWER.test(stripped) || SEQUENCE_UPPER.test(stripped)).toBe(true);
  });
});

describe("count-grammar.scan: countHeading and the public CFP heading spell the same way (DEC-925)", () => {
  it("both build 'N thing(s) need(s) fixing' with the same spelled prefix for n=1..10", async () => {
    const { countHeading } = await import("../app/src/components/ErrorSummary");
    const { spellCount, plural } = await import("../src/domain/count-copy");

    function capitalizeFirst(s: string): string {
      return s.length === 0 ? s : `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
    }

    for (let n = 1; n <= 10; n++) {
      const admin = countHeading(n, "before this can be sent");
      const publicHeading = `${capitalizeFirst(spellCount(n))} ${plural(n, "thing")} ${plural(n, "needs", "need")} fixing before this can be sent`;
      expect(admin).toBe(publicHeading);
    }
  });
});
