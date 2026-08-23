// DEC-020 (wave-55 amendment): src/domain/evaluation/criteria.ts:288's
// `if (!(value in counts))` was a prototype-inclusive membership test over a
// plain `{}` -- `in` walks Object.prototype, so a stored Choice score of
// "toString"/"constructor" cleared the guard the code was written to throw
// on, and the very next line wrote a number onto a key the committee never
// declared. That was the last surviving instance of the class the wave-39
// amendment fixed in src/mail/render.ts, src/domain/contacts-parts/merge.ts
// and src/domain/files.ts (all now Object.prototype.hasOwnProperty.call).
//
// A HAND-LISTED POPULATION IS NOT A POPULATION (DEC-808): rather than trust
// "these four sites are the whole class", this scan DERIVES the population
// from the tracked corpus at test time, over the exact same
// enumerateSourceFiles() population every ledger in this file imports
// (DEC-613 -- never a second copy).
//
// PREDICATE (deliberately narrower than "any `in` test over a Record"): a
// bare structural grep for `<expr> in <ident>` where `ident` resolves to a
// plain-object/Record-typed local finds real, already-safe hits elsewhere
// in the tree -- e.g. src/domain/evaluation/scores-json.ts:104
// (`criterion.id in scores`, read-only, the mis-typed value is caught by a
// `typeof` check two lines later), src/routes/public/feeds.ts:43 (`key in
// item`, key drawn only from a fixed CARD_FIELD_KEYS vocabulary, and the
// write lands in a DIFFERENT object, `out`, never `item`), and
// app/src/test-utils/mockApi.ts:34 (`key in routes`, read-only, a
// test-harness helper). None of those exhibit DEC-020's actual hazard: a
// guard that, if bypassed, lets an attacker-shaped key get WRITTEN into the
// very map the guard tested. So this scan's predicate is exactly that
// hazard shape -- a prototype-inclusive `in` guard over an object literal or
// Record<string, ...>-typed local, whose consequent bracket-writes that
// SAME object using the SAME tested key -- which is precisely the shape all
// four already-fixed sites share, and (once
// app/src/pages/settings/tracksRooms/useTracksRoomsPanel.ts's two
// `track.id`/`room.id in next` guards -- found live at this wave, same
// guard-then-write shape, same fix -- are included) the true population is
// zero. A broader predicate with no write requirement cannot pass on this
// corpus without either a hand-carved exemption list (DEC-808) or fixing
// several call sites this lane never touches; narrowed here per "take the
// narrowest reasonable interpretation and flag it" and flagged in the
// worker notes for this task (w55-h).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEC_020 } from "../src/decisions";
import { enumerateSourceFiles, stripComments } from "./frame-source-corpus";

void DEC_020;

const ROOTS = ["app/src", "src"];

/** Blanks single/double/template string+template contents (preserving
 * length, so offsets stay stable) after stripComments has already removed
 * comments -- so a literal `in` inside a string body can never be mistaken
 * for the `in` operator. Deliberately local to this scan (not hoisted to
 * frame-source-corpus.ts): no other ledger needs string-blanking, only
 * comment-stripping, and DEC-613 forbids growing the shared module with
 * single-consumer logic. */
function blankStringBodies(src: string): string {
  return src.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, (m) => " ".repeat(m.length));
}

interface Offender {
  file: string;
  leftExpr: string;
  ident: string;
  snippet: string;
}

const IDENT_RE = "[A-Za-z_$][\\w$]*";
const IN_TEST_RE = new RegExp(`([\\w$]+(?:\\.[\\w$]+)*)\\s+in\\s+(${IDENT_RE})\\b`, "g");

/** True when `ident` is declared (anywhere in `code`, the whole
 * comment-stripped/string-blanked file) either as a `Record<...>`-typed
 * local/param, or assigned a plain object literal (`= {`), or cast via
 * `as Record<...>` -- the two shapes `in`'s prototype-chain hole actually
 * bites (a bare `{}` literal and a `Record<string, X>` alias for one). */
function isRecordOrPlainObjectLocal(code: string, ident: string): boolean {
  const escaped = ident.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const recordTypeRe = new RegExp(`\\b${escaped}\\s*:\\s*Record\\s*<`);
  const recordCastRe = new RegExp(`\\b${escaped}\\b[^;\\n]{0,120}\\bas\\s+Record\\s*<`);
  const plainObjectAssignRe = new RegExp(`\\b(?:const|let|var)\\s+${escaped}\\b[^=;\\n]{0,80}=\\s*\\{`);
  return recordTypeRe.test(code) || recordCastRe.test(code) || plainObjectAssignRe.test(code);
}

/** True when, within `windowAfter` (the file's text immediately following
 * the matched `in` test), `ident[leftExpr] =` occurs -- a bracket WRITE
 * into the very object the `in` guard just tested, keyed by the very
 * expression it tested. This is DEC-020's exact hazard: bypass the guard,
 * and an unvalidated key gets written into the map. `(?!=)` refuses to
 * match `==`/`===` so a subsequent comparison never counts as a write. */
function hasSameKeyWriteAfter(windowAfter: string, ident: string, leftExpr: string): boolean {
  const escapedIdent = ident.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedExpr = leftExpr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const writeRe = new RegExp(`\\b${escapedIdent}\\s*\\[\\s*${escapedExpr}\\s*\\]\\s*=(?!=)`);
  return writeRe.test(windowAfter);
}

/** Scans one file's already-normalized (comment-stripped, string-blanked)
 * text for the guard-then-write hazard shape, skipping `for (... in ...)`
 * loop headers (a structurally different `in` usage that never guards a
 * subsequent bracket write the same way). */
export function findPrototypeInclusiveGuardWrites(code: string): Omit<Offender, "file">[] {
  const offenders: Omit<Offender, "file">[] = [];
  let match: RegExpExecArray | null;
  IN_TEST_RE.lastIndex = 0;
  while ((match = IN_TEST_RE.exec(code))) {
    const [full, leftExpr, ident] = match;
    if (leftExpr === undefined || ident === undefined) continue;
    const matchStart = match.index;
    // Skip for-in loop headers: `for (const/let/var IDENT in EXPR)` --
    // the `in` there is immediately preceded by a single loop-variable
    // identifier that is itself preceded by `for ( const|let|var `.
    const before = code.slice(Math.max(0, matchStart - 60), matchStart);
    if (/for\s*\(\s*(?:const|let|var)\s+[\w$]*$/.test(before)) continue;

    if (!isRecordOrPlainObjectLocal(code, ident)) continue;

    const windowAfter = code.slice(matchStart, matchStart + 400);
    if (!hasSameKeyWriteAfter(windowAfter, ident, leftExpr)) continue;

    offenders.push({ leftExpr, ident, snippet: full });
  }
  return offenders;
}

function scanCorpus(): Offender[] {
  const offenders: Offender[] = [];
  for (const root of ROOTS) {
    const absRoot = join(process.cwd(), root);
    for (const file of enumerateSourceFiles(absRoot)) {
      const raw = readFileSync(file, "utf8");
      const code = blankStringBodies(stripComments(raw));
      for (const hit of findPrototypeInclusiveGuardWrites(code)) {
        offenders.push({ file, ...hit });
      }
    }
  }
  return offenders;
}

describe("prototype-inclusive membership scan: matcher correctness (DEC-020)", () => {
  it("positive control: catches a fabricated guard-then-write over a Record local", () => {
    const synthetic = `
      function aggregate(values: string[]): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const value of values) {
          if (!(value in counts)) {
            throw new Error("not declared");
          }
          counts[value] = (counts[value] ?? 0) + 1;
        }
        return counts;
      }
    `;
    const hits = findPrototypeInclusiveGuardWrites(blankStringBodies(stripComments(synthetic)));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.ident === "counts" && h.leftExpr === "value")).toBe(true);
  });

  it("positive control: catches the plain-object-literal variant (no explicit Record annotation)", () => {
    const synthetic = `
      function tally(keys: string[]) {
        const seen = {};
        for (const key of keys) {
          if (!(key in seen)) {
            seen[key] = 0;
          }
          seen[key] = seen[key] + 1;
        }
        return seen;
      }
    `;
    const hits = findPrototypeInclusiveGuardWrites(blankStringBodies(stripComments(synthetic)));
    expect(hits.some((h) => h.ident === "seen" && h.leftExpr === "key")).toBe(true);
  });

  it("negative control: an Object.prototype.hasOwnProperty.call form is never flagged", () => {
    const synthetic = `
      function lookup(map: Record<string, string>, ext: string): string | null {
        return Object.prototype.hasOwnProperty.call(map, ext) ? map[ext]! : null;
      }
    `;
    const hits = findPrototypeInclusiveGuardWrites(blankStringBodies(stripComments(synthetic)));
    expect(hits).toEqual([]);
  });

  it("negative control: an `in` test over a Map/class instance (not a plain object/Record) is never flagged", () => {
    const synthetic = `
      class Registry {
        private items = new Map<string, number>();
        has(key: string): boolean {
          return key in this.items;
        }
      }
      function checkMap(m: Map<string, number>, key: string) {
        if (!(key in m)) {
          m[key] = 0;
        }
        return m;
      }
    `;
    const hits = findPrototypeInclusiveGuardWrites(blankStringBodies(stripComments(synthetic)));
    expect(hits).toEqual([]);
  });

  it("negative control: a guard with no subsequent same-key write (read-only) is never flagged", () => {
    const synthetic = `
      function readOnly(scores: Record<string, number>, id: string) {
        if (!(id in scores)) return undefined;
        const value = scores[id];
        return value;
      }
    `;
    const hits = findPrototypeInclusiveGuardWrites(blankStringBodies(stripComments(synthetic)));
    expect(hits).toEqual([]);
  });

  it("negative control: a for-in loop header is never flagged", () => {
    const synthetic = `
      function walk(obj: Record<string, number>) {
        for (const key in obj) {
          obj[key] = obj[key] + 1;
        }
      }
    `;
    const hits = findPrototypeInclusiveGuardWrites(blankStringBodies(stripComments(synthetic)));
    expect(hits).toEqual([]);
  });
});

describe("prototype-inclusive membership scan: the tracked corpus is clean (DEC-020)", () => {
  it("zero guard-then-write prototype-inclusive `in` tests over app/src/** + src/**", () => {
    const offenders = scanCorpus();
    const report = offenders
      .map((o) => `${o.file}: \`${o.leftExpr} in ${o.ident}\` guards a write into ${o.ident}[${o.leftExpr}]`)
      .join("\n");
    expect(offenders, `offenders found:\n${report}`).toEqual([]);
  });
});
