// DEC-635 (amendment, wave 50): a two-directional source scan guarding the
// "one guarded body reader" invariant across every route file.
//
// (a) No request body may be run through a bare JSON.parse. An optional
//     body must go through src/server/http.ts's readOptionalJsonBody, which
//     turns a malformed body into the house 400 `invalid` envelope instead
//     of an uncaught SyntaxError landing on the generic 500 `internal`
//     handler. Flags:
//       (a-i)  JSON.parse(<ident>) where <ident> was assigned from
//              `c.req.text()` earlier in the same handler.
//       (a-ii) JSON.parse(await c.req.text()) / JSON.parse(c.req.text())
//              written inline.
//     Non-body JSON.parse calls (event.brandingJson, row.customFieldsJson,
//     the DEC-149 ?rules= query param, browser localStorage, etc.) are
//     never touched by c.req.text() and so never match -- no ledger of
//     exceptions is needed for this direction.
//
// (b) Every `c.req.json()` call must be immediately chained with `.catch(`
//     -- an unguarded call throws a raw SyntaxError on a malformed body,
//     which the shared onError handler can only report as a 500
//     `internal`, not the house 400 `invalid` envelope. Direction (b) is a
//     PRE-EXISTING, repo-wide invariant this lane did not introduce and
//     does not own the files for (src/routes/review/plans-crud.ts,
//     plans-reviewers.ts, reviewer.ts; src/routes/api/events.ts;
//     src/routes/api/portal-config.ts) -- those sites are carried in
//     KNOWN_MISSING_CATCH below as an explicit, two-directional ledger:
//     an unlisted violation still fails the scan, and a ledger entry that
//     no longer matches the source (fixed, moved, or deleted) also fails
//     the scan, so the ledger cannot silently go stale.
//
// This lane's own two routes (plans-progress.ts's /remind,
// plans-distribute.ts's /assignments/distribute) were converted to
// readOptionalJsonBody and carry zero entries in either direction.

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

// (b) ledger: file:line sites where `c.req.json()` is NOT chained with
// `.catch(`, as of wave 50. This is a two-directional ledger over a
// PRE-EXISTING, repo-wide gap this lane does not own the files for -- see
// header comment. Keep sorted by file then line.
const KNOWN_MISSING_CATCH: { file: string; line: number }[] = [
  { file: "api/events.ts", line: 216 },
  { file: "api/events.ts", line: 312 },
  { file: "api/events.ts", line: 405 },
  { file: "api/events.ts", line: 435 },
  { file: "api/events.ts", line: 488 },
  { file: "api/events.ts", line: 518 },
  { file: "api/portal-config.ts", line: 103 },
  { file: "api/portal-config.ts", line: 250 },
  { file: "api/portal-config.ts", line: 291 },
  { file: "review/plans-crud.ts", line: 65 },
  { file: "review/plans-crud.ts", line: 112 },
  { file: "review/plans-reviewers.ts", line: 26 },
  { file: "review/reviewer.ts", line: 295 },
];

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
  it("no unlisted unguarded c.req.json() call site exists", () => {
    const ledgerByFile = new Map<string, Set<number>>();
    for (const { file, line } of KNOWN_MISSING_CATCH) {
      const set = ledgerByFile.get(file) ?? new Set<number>();
      set.add(line);
      ledgerByFile.set(file, set);
    }

    const unlisted: string[] = [];
    for (const file of files) {
      const rel = path.relative(ROUTES_ROOT, file).split(path.sep).join("/");
      const content = fs.readFileSync(file, "utf8");
      const lines = ledgerByFile.get(rel) ?? new Set<number>();
      for (const line of findUnguardedJsonCalls(content)) {
        if (!lines.has(line)) {
          unlisted.push(
            `${rel}:${line}: c.req.json() with no .catch( -- add .catch (e.g. .catch(() => ({}))) or, if this body is optional, use readOptionalJsonBody(c)`,
          );
        }
      }
    }
    expect(unlisted, unlisted.join("\n")).toEqual([]);
  });

  it("every ledgered entry still matches an unguarded call site (no stale ledger lines)", () => {
    const byFile = new Map<string, number[]>();
    for (const { file, line } of KNOWN_MISSING_CATCH) {
      const arr = byFile.get(file) ?? [];
      arr.push(line);
      byFile.set(file, arr);
    }

    const stale: string[] = [];
    for (const [rel, expectedLines] of byFile) {
      const abs = path.join(ROUTES_ROOT, rel);
      if (!fs.existsSync(abs)) {
        stale.push(`${rel}: file no longer exists -- remove its ledger entries`);
        continue;
      }
      const content = fs.readFileSync(abs, "utf8");
      const actual = new Set(findUnguardedJsonCalls(content));
      for (const line of expectedLines) {
        if (!actual.has(line)) {
          stale.push(`${rel}:${line}: no longer an unguarded c.req.json() call -- remove this stale ledger entry`);
        }
      }
    }
    expect(stale, stale.join("\n")).toEqual([]);
  });
});
