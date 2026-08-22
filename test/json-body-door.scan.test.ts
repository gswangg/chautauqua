// ONE JSON-object body door (DEC-613 wave-23 amendment).
//
// WHY: every route that reads a request body must go through
// src/server/http.ts's readJsonBody / readOptionalJsonBody -- both refuse a
// literal `null` body (valid JSON, an invalid shape) with the house 400
// `invalid` envelope instead of letting a bare `c.req.json()` succeed on
// `null` and crash the next dereference into an unhandled 500 `internal`.
// This scan is the reader: it enumerates every *.ts file under src/routes/**
// via readdirSync({ recursive: true }) -- never a hand-listed file array
// (DEC-180: "a hand-listed population is not a population") -- and fails on
// any raw `c.req.json(` occurrence found in one of those real files. The one
// sanctioned reader of the raw Hono API lives in src/server/http.ts itself,
// which is outside src/routes and so is never part of this population.
//
// DEC-808 two-sided ratchet: a companion assertion that merely checks the
// offender count never rises above 0 is vacuous on a population that could
// silently shrink to nothing (a moved/deleted routes directory would make
// this scan pass by finding nothing to scan). Instead of a second ceiling,
// this file asserts the population itself is non-empty (there must be real
// *.ts route files to scan) and adds a POSITIVE control: a synthetic
// offender string is run through the SAME detection regex the real scan
// uses, and the test fails if that regex does not flag it -- so the scan
// mechanism cannot silently stop matching its own target pattern.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROUTES_ROOT = path.resolve(__dirname, "..", "src", "routes");

// The ONE detection pattern this scan uses, exercised both against the real
// population below and against the synthetic positive control. A line that
// routes its `c.req.json()` result through `asRecord(` (the shared
// null-and-array-refusing shape check, DEC-613 wave-23 STEP 2) or through
// `readJsonBody`/`readOptionalJsonBody` is already guarded and is not the
// unguarded-null-body defect this scan exists to catch -- same population
// boundary the task's own verification grep used:
// `grep -rn "c.req.json()" src/routes/ | grep -v 'asRecord\|readJsonBody'`.
const RAW_JSON_CALL = /c\.req\.json\(/;
const GUARDED_LINE = /asRecord\(|readJsonBody|readOptionalJsonBody/;

/** Ceiling: real `c.req.json(` occurrences allowed under src/routes/**. */
export const RAW_JSON_BODY_DOOR_CEILING = 0;

interface Offender {
  file: string;
  line: number;
  text: string;
}

function listRouteFiles(): string[] {
  // readdirSync({ recursive: true }) -- never a hand-listed file array
  // (DEC-180). Node's recursive readdir returns paths relative to `dir`.
  const entries = fs.readdirSync(ROUTES_ROOT, { recursive: true, encoding: "utf8" });
  const out: string[] = [];
  for (const rel of entries) {
    if (!rel.endsWith(".ts")) continue;
    const full = path.join(ROUTES_ROOT, rel);
    if (!fs.statSync(full).isFile()) continue;
    out.push(full);
  }
  return out;
}

function findOffenders(files: string[]): Offender[] {
  const offenders: Offender[] = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");
    lines.forEach((lineText, idx) => {
      if (RAW_JSON_CALL.test(lineText) && !GUARDED_LINE.test(lineText)) {
        offenders.push({ file: path.relative(ROUTES_ROOT, file), line: idx + 1, text: lineText.trim() });
      }
    });
  }
  return offenders;
}

describe("DEC-613 (amendment, wave 23): ONE JSON-object body door under src/routes", () => {
  const files = listRouteFiles();

  it("population is non-empty -- readdirSync must actually find route files (DEC-180 vacuity tripwire)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("the detection regex actually flags a synthetic offender (positive control)", () => {
    const synthetic = 'const body = await c.req.json().catch(() => ({}));';
    expect(RAW_JSON_CALL.test(synthetic)).toBe(true);
  });

  it(`every *.ts file under src/routes uses readJsonBody/readOptionalJsonBody, never a raw c.req.json( (ceiling ${RAW_JSON_BODY_DOOR_CEILING})`, () => {
    const offenders = findOffenders(files);
    const report = offenders.map((o) => `${o.file}:${o.line}: ${o.text}`).join("\n");
    expect(offenders.length, `offenders found:\n${report}`).toBe(RAW_JSON_BODY_DOOR_CEILING);
  });
});
