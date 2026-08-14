// DEC-518 (wave-33 amendment): "the decisions' own path references are a
// cheap drift detector" -- decision prose is the repo's primary index of
// intent (field guide: "grep decisions/ first"), and it carries file:line
// references written across dozens of refactors. A monolith split (e.g.
// src/routes/api/contacts.ts -> src/routes/api/contacts/) leaves pre-split
// prose pointing at a deleted file, handing the next reader a dead pointer.
//
// This scan enumerates every path-shaped token in decisions/*.md whose root
// is one of src/, app/src/, scripts/, migrations/, test/ and whose extension
// is one of .ts .tsx .css .sql .json .md .sh (optionally suffixed with
// :<line> or :<line>-<line>, stripped before the existence check). Each
// extracted path must either:
//   (a) exist on disk, or
//   (b) have its containing sentence carry an explicit historical marker --
//       one of: former, formerly, was at, superseded, deleted, renamed,
//       moved to, replaced by (case-insensitive).
//
// Deliberately NO allowlist array: an exemption must be a word in the prose
// where the next reader of that decision will see it, not a line in this
// test file.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const DECISIONS_DIR = join(ROOT, "decisions");

const HISTORICAL_MARKERS = ["former", "formerly", "was at", "superseded", "deleted", "renamed", "moved to", "replaced by"];

// Extension alternation MUST try the longer extension (tsx) before its
// prefix (ts) -- JS regex alternation picks the first alternative that
// matches at a position, it does NOT backtrack for a longer overall match,
// so `ts|tsx` would silently truncate every `.tsx` reference to `.ts` and
// report it as missing (a real bug hit while building this scan: it turned
// ~550 genuine, still-valid `.tsx` references into false positives).
const PATH_RE = /\b((?:src|app\/src|scripts|migrations|test)\/[A-Za-z0-9_\-./]+\.(?:tsx|ts|css|sql|json|md|sh))(:\d+(?:-\d+)?)?/g;

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
    if (c === "." || c === "!" || c === "?") {
      e++;
      break;
    }
    if (c === "\n" && text[e + 1] === "\n") break;
    e++;
  }
  return text.slice(s, e).trim();
}

function collectPathRefs(): PathRef[] {
  const files = readdirSync(DECISIONS_DIR).filter((f) => /^DEC-\d+\.md$/.test(f));
  const out: PathRef[] = [];
  for (const f of files) {
    const content = readFileSync(join(DECISIONS_DIR, f), "utf8");
    let match: RegExpExecArray | null;
    PATH_RE.lastIndex = 0;
    while ((match = PATH_RE.exec(content))) {
      const rawMatch = match[0];
      const p = match[1] ?? "";
      const start = match.index;
      const end = start + rawMatch.length;
      out.push({
        decision: f,
        rawMatch,
        path: p,
        sentence: sentenceAround(content, start, end),
      });
    }
  }
  return out;
}

function hasHistoricalMarker(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  return HISTORICAL_MARKERS.some((marker) => lower.includes(marker));
}

describe("decision path references scan (DEC-518 wave-33 amendment)", () => {
  it("population sanity: finds at least 200 path references across at least 100 decision files (a broken regex must not pass vacuously)", () => {
    const refs = collectPathRefs();
    const decisionsWithRefs = new Set(refs.map((r) => r.decision));
    expect(refs.length).toBeGreaterThanOrEqual(200);
    expect(decisionsWithRefs.size).toBeGreaterThanOrEqual(100);
  });

  it("every extracted path either exists on disk or its sentence carries an explicit historical marker", () => {
    const refs = collectPathRefs();
    const offenders = refs.filter((r) => !existsSync(join(ROOT, r.path)) && !hasHistoricalMarker(r.sentence));
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
});
