// DEC-635 (amendment, wave 50, emptied wave 52): a two-directional source
// scan guarding the "one guarded body reader" invariant across every route
// file.
//
// (a) No request body may be run through a bare JSON.parse. An optional
//     body must go through src/server/http.ts's readOptionalJsonBody, and a
//     required body through its twin readJsonBody -- either turns a
//     malformed body into the house 400 `invalid` envelope instead of an
//     uncaught SyntaxError landing on the generic 500 `internal` handler.
//     Flags:
//       (a-i)  JSON.parse(<ident>) where <ident> was assigned from
//              `c.req.text()` earlier in the same handler.
//       (a-ii) JSON.parse(await c.req.text()) / JSON.parse(c.req.text())
//              written inline.
//     Non-body JSON.parse calls (event.brandingJson, row.customFieldsJson,
//     the DEC-149 ?rules= query param, browser localStorage, etc.) are
//     never touched by c.req.text() and so never match -- no ledger of
//     exceptions is needed for this direction.
//
// (b) Every `c.req.json()` call anywhere under src/routes must be
//     immediately chained with a `.catch(` whose body THROWS -- a catch that
//     swallows the SyntaxError and returns a default (e.g. `.catch(() =>
//     ({}))`) is not a guard: it turns a malformed body into a silent
//     `{}`/`null`, which on an all-optional PATCH is a fail-loudly violation
//     (a truncated request looks like a successful no-op) instead of the
//     house 400 `invalid` envelope DEC-013 promises. (Wave 21 amendment:
//     the guard used to accept the mere presence of `.catch(` -- its own
//     failure message even recommended the forbidden shape -- which is how
//     28 silent sites accumulated across 11 files after wave 52 emptied the
//     ledger.) As of wave 21 this is an absolute invariant with no exception
//     ledger: every call site either has no `.catch(` (violation), a
//     `.catch(` whose body does not throw (violation), or reads through
//     readJsonBody/readOptionalJsonBody (sanctioned, and never followed by
//     a bare `c.req.json()`, so it never even reaches this scan).

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROUTES_ROOT = path.resolve(__dirname, "..", "src", "routes");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function lineAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

// Finds every `JSON.parse(...)` call and returns its balanced-paren
// argument text plus the 1-based line it starts on.
function findJsonParseCalls(content: string): { arg: string; line: number }[] {
  const out: { arg: string; line: number }[] = [];
  const marker = "JSON.parse(";
  let i = 0;
  while ((i = content.indexOf(marker, i)) !== -1) {
    const argStart = i + marker.length;
    let depth = 1;
    let j = argStart;
    while (j < content.length && depth > 0) {
      if (content[j] === "(") depth++;
      else if (content[j] === ")") depth--;
      j++;
    }
    out.push({ arg: content.slice(argStart, j - 1).trim(), line: lineAt(content, i) });
    i = j;
  }
  return out;
}

// A route-handler boundary in this codebase: every handler is registered as
// `<something>Routes.get/post/put/patch/delete(...)` (or `app.<verb>(`), one
// per top-level statement. Used to bound the backward scan for "assigned
// from c.req.text() in the SAME function" so an assignment in a sibling
// handler earlier in the file is never mistaken for a same-function match.
const ROUTE_BOUNDARY = /\b(?:[A-Za-z_$][\w$]*\.)+(get|post|put|patch|delete)\(/;

const files = walk(ROUTES_ROOT);

describe("DEC-635 amendment: request body must never be parsed with a bare JSON.parse", () => {
  for (const file of files) {
    const rel = path.relative(ROUTES_ROOT, file);
    it(`${rel}: no JSON.parse on a c.req.text() body`, () => {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      const violations: string[] = [];

      for (const { arg, line } of findJsonParseCalls(content)) {
        const flat = arg.replace(/\s+/g, "");
        // (a-ii) inline JSON.parse(await c.req.text()) / JSON.parse(c.req.text())
        if (flat === "awaitc.req.text()" || flat === "c.req.text()") {
          violations.push(
            `${rel}:${line}: JSON.parse(c.req.text()) written inline -- use readOptionalJsonBody(c) from src/server/http.ts instead`,
          );
          continue;
        }
        // (a-i) JSON.parse(<ident>) where <ident> was assigned from c.req.text()
        // earlier in the same handler.
        if (/^[A-Za-z_$][\w$]*$/.test(arg)) {
          const assignRe = new RegExp(
            `\\b(?:const|let)\\s+${arg}\\s*(?::[^=]+)?=\\s*await\\s*c\\.req\\.text\\(\\)|\\b(?:const|let)\\s+${arg}\\s*(?::[^=]+)?=\\s*c\\.req\\.text\\(\\)`,
          );
          let boundaryStart = 0;
          for (let k = line - 2; k >= 0; k--) {
            if (ROUTE_BOUNDARY.test(lines[k] ?? "")) {
              boundaryStart = k;
              break;
            }
          }
          const scope = lines.slice(boundaryStart, line - 1).join("\n");
          if (assignRe.test(scope)) {
            violations.push(
              `${rel}:${line}: JSON.parse(${arg}) where '${arg}' was read via c.req.text() -- use readOptionalJsonBody(c) from src/server/http.ts instead`,
            );
          }
        }
      }

      expect(violations, violations.join("\n")).toEqual([]);
    });
  }
});

// Extracts the balanced-paren argument text of the `.catch(` chained
// immediately after `c.req.json()`, or null if no such chain exists.
function chainedCatchArg(content: string, afterIndex: number): string | null {
  const after = content.slice(afterIndex);
  const m = /^\s*\.catch\(/.exec(after);
  if (!m) return null;
  const argStart = afterIndex + m[0].length;
  let depth = 1;
  let j = argStart;
  while (j < content.length && depth > 0) {
    if (content[j] === "(") depth++;
    else if (content[j] === ")") depth--;
    j++;
  }
  return content.slice(argStart, j - 1);
}

// Direction (b): every `c.req.json()` call site under src/routes must be
// guarded by a catch that THROWS -- a `.catch(` whose body does not contain
// `throw` is a silent-default fallback wearing the shape of a guard.
function findUnguardedJsonCalls(content: string): number[] {
  const out: number[] = [];
  const marker = "c.req.json()";
  let i = 0;
  while ((i = content.indexOf(marker, i)) !== -1) {
    const catchArg = chainedCatchArg(content, i + marker.length);
    if (catchArg === null || !/throw/.test(catchArg)) {
      out.push(lineAt(content, i));
    }
    i += marker.length;
  }
  return out;
}

// Counts every sanctioned reader call site (readJsonBody/readOptionalJsonBody)
// across src/routes -- a tripwire so a rename of either function (or of the
// scan's marker string) cannot silently make this whole describe block
// vacuous by making both directions pass on zero matches.
function countSanctionedReaderCalls(content: string): number {
  const matches = content.match(/\breadJsonBody\(c\)|\breadOptionalJsonBody\(c\)/g);
  return matches ? matches.length : 0;
}

describe("DEC-635 amendment (wave 21): every c.req.json() call must be chained with a .catch( that THROWS", () => {
  it("no unguarded/silent-default c.req.json() call site exists anywhere under src/routes", () => {
    const unlisted: string[] = [];
    for (const file of files) {
      const rel = path.relative(ROUTES_ROOT, file).split(path.sep).join("/");
      const content = fs.readFileSync(file, "utf8");
      for (const line of findUnguardedJsonCalls(content)) {
        unlisted.push(
          `${rel}:${line}: c.req.json() with no .catch( that throws -- a silent-default catch (e.g. .catch(() => ({}))) is not a guard; use readJsonBody(c)/readOptionalJsonBody(c) from src/server/http.ts instead`,
        );
      }
    }
    expect(unlisted, unlisted.join("\n")).toEqual([]);
  });

  it("tripwire: at least 15 sanctioned reader call sites exist across src/routes (a rename cannot make this scan vacuous)", () => {
    let total = 0;
    for (const file of files) {
      total += countSanctionedReaderCalls(fs.readFileSync(file, "utf8"));
    }
    expect(total).toBeGreaterThanOrEqual(15);
  });
});
