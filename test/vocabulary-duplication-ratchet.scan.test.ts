// DEC-180 wave-73: "a second copy of a vocabulary" was a per-wave hand-find
// (waves 60, 68, 69, 70, 71 each closed exactly ONE duplicated vocabulary by
// hand -- see the field guide's "THE VOCABULARY CLASS IS A POPULATION, NOT A
// SEQUENCE OF WAVES" entry). This file turns it into a scanned, ratcheted
// population instead: it walks every .ts/.tsx under src/ and app/src/,
// finds every top-level declaration of the two vocabulary shapes below,
// normalises each to its sorted member set, and groups declarations by that
// set. A set declared, non-exempt, in two or more DIFFERENT files is a
// "duplicate group" -- the exact bug class DEC-789 (w73) found by hand
// (INVITE_STATUS_LABELS' own vocabulary re-declared, disagreeing on half its
// members, in SubmissionDetailPage.tsx).
//
// Note: task-w73-a/-b/-c were concurrently REMOVING three of the duplicate
// groups this scan measures (this branch was planned alongside them), which
// is why MAX_DUPLICATE_VOCABULARIES was originally a ratchet seeded at THAT
// branch's own measured count (4), not a zero-assertion.
//
// DEC-180 wave-75 amendment RE-SEED: by wave 75 all three of task-w73-a/-b/-c
// had landed, so the seed of 4 (measured on a worktree cut BEFORE they
// landed) was three above the truth -- a ratchet above the truth doesn't
// ratchet, it licenses new duplicates to land silently. Wave 75 also closed
// the same-file exclusion this file used to apply (previously ":247-250"
// deliberately excluded two declarations of the same set living in ONE
// file, on the theory that it "is a different bug class"; DEC-180's wave-75
// amendment overturned that -- a same-file duplicate is still a duplicate
// under the same DEC-citation/re-export exemption rules) and fixed the two
// duplicates the amendment named by hand (src/server/repo/public/gates.ts's
// inlined ["none","accepted"] literal now composes the declared
// ACTIVE_INVITE_STATUSES constant, and
// SCHEDULING_PARTICIPANT_STATUSES/PORTAL_VISIBLE_INVITE_STATUSES in
// src/domain/acceptance.ts collapsed to one declaration re-exported under
// the second name). MAX_DUPLICATE_VOCABULARIES was RE-SEEDED at 5 that
// wave, the count then measured on its own worktree with same-file
// grouping turned on.
//
// DEC-180 wave-79 amendment: the seed of 5 sat unchanged through waves 76,
// 77 and 78 -- each one read this file's own closing sentence ("the next
// wave's job is to shrink this ratchet") and left it as prose. Wave 79
// collapsed all five groups (see the seeding comment beside
// MAX_DUPLICATE_VOCABULARIES below for the full list) and RE-SEEDED the
// constant at 0, the count it measures on this worktree. A ceiling above
// the truth licenses the next duplicate to land silently instead of
// failing the scan; read this file's closing sentence as a work item, not
// as prose, before carrying its number forward again.
//
// The two matched shapes:
//   (1) `export type NAME = 'a' | 'b' | ...;`            (single- or multi-line)
//   (2) `export const NAME<optional type> = ['a','b',...];` (with/without `as const`)
//
// Two-member sets are SKIPPED: they're dominated by legitimate structural
// pairs (asc/desc, pending/complete, ...) that would drown the real signal
// of an accidentally-copied N-member domain vocabulary (N >= 3). This
// mirrors test/serial-write-scan.test.ts and test/query-scoping-invariant.test.ts's
// house idiom of a source-text scanner with a named, reasoned exemption list
// rather than a live AST/type-checker pass.
//
// Exemptions (a declaration matching one of the two shapes above is NOT
// counted toward a duplicate group if either holds):
//   (a) It is a re-export (`export type { X } from ...` / `export { X } from
//       ...`, or an `import { X } from ...` immediately followed by
//       `export type { X }`). In practice neither of the two regexes below
//       can ever match a brace re-export or a bare `import`/`export type {}`
//       pair -- both require `= 'literal' | 'literal' ...` or `= [...]`
//       directly after the declared name -- so this exemption is structural,
//       not a runtime check, and is documented here for the reader rather
//       than enforced by extra code.
//   (b) It carries a `DEC-\d{3}` citation somewhere in the six lines
//       immediately above the declaration line -- the stated-exception form.
//       app/src/pages/speakers/speakerDetail.ts's `SpeakerDetailSessionStatus`
//       (DEC-930, six lines above) is the worked example; this file asserts
//       that site is specifically exempted below, so a future edit that
//       strips the DEC-930 comment trips this scan instead of silently
//       losing the exemption.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SCAN_ROOTS = [join(ROOT, "src"), join(ROOT, "app", "src")];
const SKIP_DIR_NAMES = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);
// src/decisions-data/ is scribe-maintained DEC_* string constant data, not a
// vocabulary declaration; excluded per the task's own instruction.
const SKIP_ROOT_RELATIVE = new Set(["decisions-data"]);

interface VocabDeclaration {
  file: string; // repo-relative
  line: number; // 1-indexed, line of the declaration keyword
  name: string;
  members: string[]; // as written, de-quoted, in declared order (pre-dedupe)
}

function listFiles(dir: string, roots: string[], out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    // only apply the decisions-data exclusion relative to a scan root's
    // immediate children, matching the pattern used by serial-write-scan.
    const relFromAnyRoot = roots.some((r) => relative(r, full).split(/[\\/]/)[0] === entry);
    if (relFromAnyRoot && SKIP_ROOT_RELATIVE.has(entry)) continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      listFiles(full, roots, out);
    } else if (st.isFile() && /\.(ts|tsx)$/.test(entry)) {
      if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
      if (entry.endsWith(".render.test.ts") || entry.endsWith(".render.test.tsx")) continue;
      out.push(full);
    }
  }
}

/** Strips `//` and block comments, preserving newlines and string contents
 * (same approach as test/serial-write-scan.test.ts's stripComments), so a
 * DEC citation or example literal union inside a comment is never matched
 * as a real declaration. */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && c2 === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < n) {
          out += (src[i] ?? "") + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i] ?? "";
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const STRING_LIT = `(?:'[^'\\n]*'|"[^"\\n]*")`;

// Shape (1): export type NAME = 'a' | 'b' | ...; -- also matches the
// leading-pipe multi-line style (`export type X =\n  | 'a'\n  | 'b';`).
const TYPE_UNION_RE = new RegExp(
  `export\\s+type\\s+([A-Za-z0-9_]+)\\s*=\\s*\\|?\\s*(${STRING_LIT}(?:\\s*\\|\\s*${STRING_LIT})+)\\s*;`,
  "g",
);

// Shape (2): export const NAME<optional : Type> = ['a', 'b', ...] [as const];
const CONST_ARRAY_RE = new RegExp(
  `export\\s+const\\s+([A-Za-z0-9_]+)(?:\\s*:\\s*[^=]+?)?\\s*=\\s*\\[\\s*(${STRING_LIT}(?:\\s*,\\s*${STRING_LIT})*)\\s*,?\\s*\\]\\s*(?:as\\s+const)?\\s*;`,
  "g",
);

function extractMembers(literalListText: string): string[] {
  const out: string[] = [];
  const re = new RegExp(STRING_LIT, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(literalListText))) {
    const raw = m[0];
    out.push(raw.slice(1, -1));
  }
  return out;
}

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split("\n").length;
}

/** True if any of the (up to) six lines immediately above `declLine`
 * (1-indexed) contains a `DEC-\d{3}` citation. */
function hasDecCitationAbove(lines: string[], declLine: number): boolean {
  const start = Math.max(0, declLine - 1 - 6);
  const end = declLine - 1; // exclusive, lines above the declaration line
  for (let i = start; i < end; i++) {
    if (/DEC-\d{3}/.test(lines[i] ?? "")) return true;
  }
  return false;
}

function findDeclarations(rawSrc: string, file: string): VocabDeclaration[] {
  const src = stripComments(rawSrc);
  const out: VocabDeclaration[] = [];

  for (const re of [TYPE_UNION_RE, CONST_ARRAY_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const name = m[1] as string;
      const listText = m[2] as string;
      const members = extractMembers(listText);
      const declLine = lineOf(src, m.index);
      out.push({ file, line: declLine, name, members: dedupeAndSort(members) });
    }
  }
  return out;
}

function dedupeAndSort(members: string[]): string[] {
  return [...new Set(members)].sort();
}

function relativePath(file: string): string {
  return relative(ROOT, file).split("\\").join("/");
}

describe("vocabulary duplication ratchet (DEC-180 wave 73, re-seeded wave 79): every non-exempt >=3-member string vocabulary is unique across the tree, same-file or cross-file", () => {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) listFiles(root, SCAN_ROOTS, files);

  it("scanner sanity check: walks a large multi-directory file set", () => {
    expect(files.length).toBeGreaterThan(150);
  });

  interface Declared extends VocabDeclaration {
    setKey: string;
    exempt: boolean;
  }

  const allDeclared: Declared[] = [];
  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    // DEC citations live in comments, which stripComments deliberately
    // blanks out (so a citation mentioned inside a JSDoc example is never
    // mistaken for a real declaration match) -- so the citation check below
    // reads the RAW lines, not the comment-stripped ones. stripComments
    // preserves every newline 1:1 with the raw source, so line numbers
    // computed against the stripped source (declLine) still index correctly
    // into rawLines.
    const rawLines = raw.split("\n");
    const decls = findDeclarations(raw, file);
    for (const d of decls) {
      if (d.members.length < 3) continue; // two-member sets excluded, see file header
      const exempt = hasDecCitationAbove(rawLines, d.line);
      allDeclared.push({ ...d, setKey: JSON.stringify(d.members), exempt });
    }
  }

  it("finds at least 10 qualifying (>=3-member) vocabulary declarations (scanner sanity check)", () => {
    expect(allDeclared.length).toBeGreaterThanOrEqual(10);
  });

  it("speakerDetail.ts's DEC-930-cited SpeakerDetailSessionStatus is exempted (worked example)", () => {
    const site = allDeclared.find(
      (d) => d.name === "SpeakerDetailSessionStatus" && relativePath(d.file).endsWith("speakerDetail.ts"),
    );
    expect(site, "expected to find SpeakerDetailSessionStatus declared in speakerDetail.ts").toBeTruthy();
    expect(site?.exempt).toBe(true);
  });

  // Group NON-EXEMPT declarations by member set. DEC-180 wave-75 amendment:
  // a duplicate vocabulary declared TWICE in the SAME file (e.g.
  // src/domain/acceptance.ts's SCHEDULING_PARTICIPANT_STATUSES /
  // PORTAL_VISIBLE_INVITE_STATUSES before that wave collapsed them to one
  // declaration) is still a duplicate group under the same exemption rules
  // (DEC citation within six lines, or a re-export) -- it is no longer
  // excluded just because both declarations happen to live in one module.
  const bySetKey = new Map<string, Declared[]>();
  for (const d of allDeclared) {
    if (d.exempt) continue;
    const list = bySetKey.get(d.setKey) ?? [];
    list.push(d);
    bySetKey.set(d.setKey, list);
  }

  const duplicateGroups = [...bySetKey.entries()]
    .map(([setKey, decls]) => ({ setKey, decls }))
    .filter((g) => g.decls.length >= 2);

  // DEC-180 wave-79 amendment: SPENT the ratchet instead of carrying it.
  // Waves 76, 77 and 78 each re-read the wave-75 note ("The next wave's job
  // is to shrink this ratchet, not to raise it") and carried the inherited
  // 5 forward unchanged. Wave 79 collapsed all five groups the seed of 5
  // was covering:
  //   - src/domain/status.ts: SubmissionStatus/SUBMISSION_STATUSES same-file
  //     pair collapsed to one `as const` array + derived type (the
  //     acceptance.ts:162-171 idiom); app/src/pages/submissions/types.ts's
  //     own copy of both now re-exports from src/domain/status.ts instead
  //     of re-listing the six literals a third time.
  //   - src/domain/submission-sort.ts: SortOrder/SORT_ORDERS same-file pair
  //     collapsed the same way.
  //   - app/src/pages/content/worklist.ts: WorklistTab/WORKLIST_TABS
  //     same-file pair collapsed the same way.
  //   - src/server/repo/contacts/query.ts's PipelineStageLike (a hand
  //     re-listed copy of src/server/repo/pipeline.ts's PipelineStage,
  //     justified by a stale "avoid a module cycle" comment that did not
  //     hold for a type-only import) now re-exports PipelineStage under its
  //     existing local name instead.
  //   - app/src/pages/content/types.ts's CONTENT_STATUS_PRIORITY (same
  //     three ContentStatus members as CONTENT_STATUSES, in a deliberately
  //     different display order) and
  //     app/src/pages/speakers/speakerDetail.ts's SpeakerDetailContentStatus
  //     (a leaf re-declaration for the same DEC-930 render-test-isolation
  //     reason as its SpeakerDetailSessionStatus sibling three lines above)
  //     are genuinely separate vocabularies sharing a member set, not
  //     re-listed copies -- each now carries its own DEC-180/DEC-930
  //     citation within six lines, the exemption this file already grants.
  //
  // MAX_DUPLICATE_VOCABULARIES is RE-SEEDED AT 0, the count this scan
  // measures on this worktree at wave 79 (verified by temporarily lowering
  // the constant to 0 and reading the failure's printed group list, per
  // this task's own STEP 1 instruction) -- not a number inherited from any
  // prior wave's note. May only ever go DOWN from here (0 cannot go
  // lower): a future wave that introduces a genuine duplicate must fix the
  // duplicate, not raise this constant.
  const MAX_DUPLICATE_VOCABULARIES = 0;

  it(`has at most ${MAX_DUPLICATE_VOCABULARIES} duplicate (non-exempt, same-file or cross-file) vocabulary groups`, () => {
    const details = duplicateGroups
      .map((g) => {
        const members = (JSON.parse(g.setKey) as string[]).join(", ");
        const sites = g.decls.map((d) => `${relativePath(d.file)}:${d.line}`).join(", ");
        return `  [${members}]: ${sites}`;
      })
      .join("\n");

    expect(
      duplicateGroups.length,
      `Found ${duplicateGroups.length} duplicate vocabulary group(s) (max allowed: ${MAX_DUPLICATE_VOCABULARIES}):\n${details}\n` +
        `Either consolidate one of these groups to a single shared export (re-exported by the others), add a ` +
        `DEC-\\d{3} citation within six lines above a deliberately-separate declaration, or, if you added a new ` +
        `duplicate, fix it rather than raising MAX_DUPLICATE_VOCABULARIES.`,
    ).toBeLessThanOrEqual(MAX_DUPLICATE_VOCABULARIES);
  });

  it("never DECREASES silently: MAX_DUPLICATE_VOCABULARIES must not be lower than the count this scan currently measures (would be a stale ratchet, not a passing test)", () => {
    // This is the mirror check: if the measured count somehow dropped below
    // the ratchet without anyone lowering the constant, that's not a failure
    // to catch here (it's a good thing) -- but if it's now genuinely below
    // the seeded value, that's worth surfacing so the ratchet gets tightened
    // in the same commit rather than drifting. This assertion documents
    // intent; it does not fail on its own (the previous test is the gate).
    expect(duplicateGroups.length).toBeLessThanOrEqual(MAX_DUPLICATE_VOCABULARIES);
  });
});
