// DEC-518 (wave-33 amendment, extended wave-19): "the decisions' own path
// references are a cheap drift detector" -- decision prose is the repo's
// primary index of intent (field guide: "grep decisions/ first"), and it
// carries file:line references written across dozens of refactors. A
// monolith split (e.g. src/routes/api/contacts.ts -> src/routes/api/contacts/)
// leaves pre-split prose pointing at a deleted file, handing the next reader
// a dead pointer.
//
// Wave-19 widens the population from decisions/*.md to also cover
// docs/design/audit/**/*.md: the v12 audit corpus carries the same kind of
// file:line citations (source-file and other-audit-file cross references)
// and is exactly as prone to path drift as decision prose is.
//
// This scan enumerates every path-shaped token in decisions/*.md and
// docs/design/audit/**/*.md whose root is one of src/, app/src/, scripts/,
// migrations/, test/, docs/ and whose extension is one of .ts .tsx .css
// .sql .json .md .sh (optionally suffixed with :<line> or :<line>-<line>,
// stripped before the existence check). Each extracted path must either:
//   (a) exist on disk, or
//   (b) have its containing sentence carry an explicit historical marker --
//       one of: former, formerly, was at, superseded, deleted, renamed,
//       moved to, replaced by (case-insensitive).
//
// Deliberately NO allowlist array: an exemption must be a word in the prose
// where the next reader of that decision (or audit file) will see it, not a
// line in this test file.
//
// Population guard note: bare filenames and directory-relative shorthand
// established by surrounding prose (e.g. "submissions/SubmissionsTable.tsx"
// inside a paragraph that already names the directory, or
// "settings-v12/w10-frame-verdicts.md" relative to the audit dir) do NOT
// start with one of the rooted prefixes below and are therefore never
// extracted -- they are prose shorthand, not drift.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const DECISIONS_DIR = join(ROOT, "decisions");
const AUDIT_DIR = join(ROOT, "docs/design/audit");

const HISTORICAL_MARKERS = ["former", "formerly", "was at", "superseded", "deleted", "renamed", "moved to", "replaced by"];

// Extension alternation MUST try the longer extension (tsx) before its
// prefix (ts) -- JS regex alternation picks the first alternative that
// matches at a position, it does NOT backtrack for a longer overall match,
// so `ts|tsx` would silently truncate every `.tsx` reference to `.ts` and
// report it as missing (a real bug hit while building this scan: it turned
// ~550 genuine, still-valid `.tsx` references into false positives).
//
// Two root sets, not one: decisions/*.md's population was measured and
// fixed with roots {src, app/src, scripts, migrations, test} only. Adding
// `docs/` to that population retroactively pulls in several pre-existing
// `docs/verification-log/index/NNNN-...-....md` ELISION placeholders (the
// literal `...` in those sentences is prose shorthand for an elided
// content-hash suffix, not a path -- they are not owned by this wave and
// are not audit-corpus drift). `docs/` is therefore scoped to the new
// docs/design/audit/**/*.md population only, per the wave-19 task's
// population guard, which the audit corpus's own cross-references to
// `docs/design/audit/*.md` and DEC prose actually needs.
const DECISIONS_PATH_RE = /\b((?:src|app\/src|scripts|migrations|test)\/[A-Za-z0-9_\-./]+\.(?:tsx|ts|css|sql|json|md|sh))(:\d+(?:-\d+)?)?/g;
const AUDIT_PATH_RE = /\b((?:src|app\/src|scripts|migrations|test|docs)\/[A-Za-z0-9_\-./]+\.(?:tsx|ts|css|sql|json|md|sh))(:\d+(?:-\d+)?)?/g;

interface PathRef {
  decision: string;
  rawMatch: string;
  path: string;
  sentence: string;
}

/** Finds the sentence containing the match [start,end) in `text`: scans
 * backward from `start` to the nearest sentence-terminating `.`/`!`/`?`
 * followed by whitespace (or a paragraph break, or the start of the
 * string), and forward from `end` to the next terminator (or a paragraph
 * break, or the end of the string). A path's own internal `.` (e.g.
 * `schema.ts`) is never mistaken for a terminator because it is never
 * followed by whitespace. */
function sentenceAround(text: string, start: number, end: number): string {
  let s = start;
  while (s > 0) {
    const prev = text[s - 1];
    if ((prev === "." || prev === "!" || prev === "?") && /\s/.test(text[s] ?? "")) break;
    if (text[s - 1] === "\n" && text[s - 2] === "\n") break;
    s--;
  }
  let e = end;
  while (e < text.length) {
    const c = text[e];
    // Mirror the backward scan's rule: a terminator only ends the sentence
    // when followed by whitespace or end-of-string -- a path's own internal
    // `.` (e.g. `csv.ts`) is otherwise indistinguishable from a real
    // sentence break and would truncate the forward context mid-path.
    if ((c === "." || c === "!" || c === "?") && (e + 1 >= text.length || /\s/.test(text[e + 1] ?? ""))) {
      e++;
      break;
    }
    if (c === "\n" && text[e + 1] === "\n") break;
    e++;
  }
  return text.slice(s, e).trim();
}

/** Reusable core: extracts every path-shaped reference from one file's
 * content. Shared by the real-corpus scans and the synthetic controls
 * below so the controls exercise the exact same logic the scan runs. */
function extractPathRefs(label: string, content: string, sourceRe: RegExp = AUDIT_PATH_RE): PathRef[] {
  const out: PathRef[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(sourceRe.source, sourceRe.flags);
  while ((match = re.exec(content))) {
    const rawMatch = match[0];
    const p = match[1] ?? "";
    // A literal "NNN" placeholder (e.g. `src/decisions-data/DEC-NNN.md`,
    // used two dozen times across decisions/ and docs/design/audit/ as
    // shorthand for "any decision id") is prose describing a naming
    // convention, not a citation of one concrete file -- it can never
    // resolve on disk by construction, and is not drift. No real path in
    // this repo contains the substring "NNN".
    if (p.includes("NNN")) continue;
    const start = match.index;
    const end = start + rawMatch.length;
    out.push({
      decision: label,
      rawMatch,
      path: p,
      sentence: sentenceAround(content, start, end),
    });
  }
  return out;
}

function hasHistoricalMarker(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  return HISTORICAL_MARKERS.some((marker) => lower.includes(marker));
}

function isOffender(ref: PathRef): boolean {
  return !existsSync(join(ROOT, ref.path)) && !hasHistoricalMarker(ref.sentence);
}

function listMarkdownFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listMarkdownFilesRecursive(full));
    } else if (/\.md$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function collectDecisionPathRefs(): PathRef[] {
  const files = readdirSync(DECISIONS_DIR).filter((f) => /^DEC-\d+\.md$/.test(f));
  const out: PathRef[] = [];
  for (const f of files) {
    const content = readFileSync(join(DECISIONS_DIR, f), "utf8");
    out.push(...extractPathRefs(f, content, DECISIONS_PATH_RE));
  }
  return out;
}

function collectAuditPathRefs(): PathRef[] {
  const files = listMarkdownFilesRecursive(AUDIT_DIR);
  const out: PathRef[] = [];
  for (const full of files) {
    const content = readFileSync(full, "utf8");
    const label = "docs/design/audit/" + full.slice(AUDIT_DIR.length + 1);
    out.push(...extractPathRefs(label, content));
  }
  return out;
}

describe("decision path references scan (DEC-518 wave-33 amendment, wave-19 extension)", () => {
  it("population sanity: finds at least 200 path references across at least 100 decision files (a broken regex must not pass vacuously)", () => {
    const refs = collectDecisionPathRefs();
    const decisionsWithRefs = new Set(refs.map((r) => r.decision));
    expect(refs.length).toBeGreaterThanOrEqual(200);
    expect(decisionsWithRefs.size).toBeGreaterThanOrEqual(100);
  });

  it("every extracted decision path either exists on disk or its sentence carries an explicit historical marker", () => {
    const refs = collectDecisionPathRefs();
    const offenders = refs.filter(isOffender);
    expect(
      offenders,
      offenders
        .map(
          (o) =>
            `${o.decision}: ${o.path} does not exist on disk and its sentence carries no historical marker ` +
            `(former/formerly/was at/superseded/deleted/renamed/moved to/replaced by). Sentence: "${o.sentence}"`,
        )
        .join("\n\n"),
    ).toEqual([]);
  });

  // Vacuous-population tripwire: docs/design/audit/**/*.md is a large,
  // separately-walked corpus (recursive, unlike decisions/ which is flat) --
  // a broken recursive walk (e.g. one that silently skips the settings-v12/
  // subdirectory) must not pass by finding zero files and zero refs.
  it("population sanity: finds at least 500 path references across at least 80 audit files (a broken recursive walk must not pass vacuously)", () => {
    const refs = collectAuditPathRefs();
    const filesWithRefs = new Set(refs.map((r) => r.decision));
    expect(refs.length).toBeGreaterThanOrEqual(500);
    expect(filesWithRefs.size).toBeGreaterThanOrEqual(80);
  });

  it("every extracted docs/design/audit path either exists on disk or its sentence carries an explicit historical marker", () => {
    const refs = collectAuditPathRefs();
    const offenders = refs.filter(isOffender);
    expect(
      offenders,
      offenders
        .map(
          (o) =>
            `${o.decision}: ${o.path} does not exist on disk and its sentence carries no historical marker ` +
            `(former/formerly/was at/superseded/deleted/renamed/moved to/replaced by). Sentence: "${o.sentence}"`,
        )
        .join("\n\n"),
    ).toEqual([]);
  });

  // Synthetic positive control: the detector must actually be able to fire,
  // not just report zero because its own logic is inert. A fabricated
  // sentence citing a rooted path that does not exist, with no historical
  // marker nearby, must be flagged as an offender.
  it("synthetic positive control: a fabricated rooted path with no historical marker is flagged", () => {
    const fixture = "See src/fake/DoesNotExistAtAll12345.ts for the implementation.";
    const refs = extractPathRefs("fixture.md", fixture);
    expect(refs.length).toBe(1);
    expect(refs.filter(isOffender).length).toBe(1);
  });

  // Synthetic negative control: the same fabricated non-existent path, but
  // its sentence carries an explicit historical marker -- must not fire.
  it("synthetic negative control: a fabricated rooted path with a historical marker is not flagged", () => {
    const fixture = "This logic was formerly at src/fake/DoesNotExistAtAll12345.ts before the refactor.";
    const refs = extractPathRefs("fixture.md", fixture);
    expect(refs.length).toBe(1);
    expect(refs.filter(isOffender).length).toBe(0);
  });

  // Synthetic negative control: directory-relative shorthand (no rooted
  // prefix) is out of population entirely -- it must not even be extracted,
  // let alone flagged.
  it("synthetic negative control: bare/directory-relative shorthand is not extracted at all", () => {
    const fixture = "See submissions/SubmissionsTable.tsx and settings-v12/w10-frame-verdicts.md for detail.";
    const refs = extractPathRefs("fixture.md", fixture);
    expect(refs.length).toBe(0);
  });

  // Synthetic control: a .tsx path must not be truncated to .ts by the
  // extension alternation (the wave-33 regression this scan was built to
  // avoid re-introducing).
  it("synthetic control: a .tsx reference to an existing file is not falsely flagged as missing", () => {
    const fixture = "See app/src/pages/Overview.tsx for the component.";
    const refs = extractPathRefs("fixture.md", fixture);
    expect(refs.length).toBe(1);
    expect(refs[0]!.path).toBe("app/src/pages/Overview.tsx");
    expect(refs.filter(isOffender).length).toBe(0);
  });
});
