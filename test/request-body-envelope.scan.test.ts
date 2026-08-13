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
//     immediately chained with `.catch(` -- an unguarded call throws a raw
//     SyntaxError on a malformed body, which the shared onError handler can
//     only report as a 500 `internal`, not the house 400 `invalid`
//     envelope. As of wave 52 this is an absolute invariant with no
//     exception ledger: every former ledger site (src/routes/review/
//     plans-crud.ts, plans-reviewers.ts, reviewer.ts; src/routes/api/
//     events.ts; src/routes/api/portal-config.ts) was converted to the
//     guarded readJsonBody/readOptionalJsonBody readers.

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

function findUnguardedJsonCalls(content: string): number[] {
  const out: number[] = [];
  const marker = "c.req.json()";
  let i = 0;
  while ((i = content.indexOf(marker, i)) !== -1) {
    const after = content.slice(i + marker.length);
    const chained = /^\s*\.catch\(/.test(after);
    if (!chained) {
      out.push(lineAt(content, i));
    }
    i += marker.length;
  }
  return out;
}

describe("DEC-635 amendment: every c.req.json() call must be chained with .catch(", () => {
  it("no unguarded c.req.json() call site exists anywhere under src/routes", () => {
    const unlisted: string[] = [];
    for (const file of files) {
      const rel = path.relative(ROUTES_ROOT, file).split(path.sep).join("/");
      const content = fs.readFileSync(file, "utf8");
      for (const line of findUnguardedJsonCalls(content)) {
        unlisted.push(
          `${rel}:${line}: c.req.json() with no .catch( -- add .catch (e.g. .catch(() => ({}))) or use readJsonBody(c)/readOptionalJsonBody(c) from src/server/http.ts`,
        );
      }
    }
    expect(unlisted, unlisted.join("\n")).toEqual([]);
  });
});
