// DEC-527: locks the DEC-517 isEpochMs boundary predicate over every route
// that accepts a request-body field as a ms-epoch value, via a GLOBBED
// enumeration of src/routes/**/*.ts (same approach as the DEC-511
// like-escaping enumeration in test/like-escaping-enumeration.test.ts). No
// allowlist of files is hand-maintained here — three prior spot-fixes
// (DEC-509/DEC-517) reached forms.ts and review/shared.ts but missed
// tasks.ts, which is exactly why this test derives its member list from the
// tree rather than hand-listing it.
//
// A file is identified as "accepts a ms-epoch field" by scanning its raw
// source (comments included, since the validation-failure error message
// itself — e.g. "must be a ms-epoch integer" — is the marker) for the
// phrase "ms-epoch integer". That phrase is the house convention for this
// class of validation error (see src/routes/api/forms.ts, src/routes/review/
// shared.ts, src/routes/tasks.ts); src/routes/api/validators.ts's own JSDoc
// for isEpochMs does not use that exact phrase, so the predicate's own
// definition site is not mistaken for a consumer.
//
// This is verification-only: it reads source files as plain text and
// regex-scans them. It does not import or execute production code, so a
// change here can never affect src/ behavior.

import { describe, expect, it } from "vitest";
import { globSync, readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");
const ROUTES_DIR = path.join(REPO_ROOT, "src", "routes");

/** All route-layer source files, globbed fresh on every run so a route file
 * added tomorrow that accepts a ms-epoch field is covered automatically. */
const ROUTE_FILES: string[] = globSync("src/routes/**/*.ts", { cwd: REPO_ROOT }).sort();

interface FileText {
  relPath: string;
  absPath: string;
  text: string;
}

const FILES: FileText[] = ROUTE_FILES.map((relPath) => {
  const absPath = path.join(REPO_ROOT, relPath);
  const text = readFileSync(absPath, "utf8");
  return { relPath, absPath, text };
});

const MS_EPOCH_MARKER = /ms-epoch integer/i;
const IMPORTS_IS_EPOCH_MS = /\bimport\s*\{[^}]*\bisEpochMs\b[^}]*\}\s*from\s*["'][^"']+["']/;

describe("DEC-527: isEpochMs invariant, enumerated over src/routes/**/*.ts", () => {
  it("found at least one route file to scan (glob is not silently empty)", () => {
    expect(FILES.length).toBeGreaterThan(3);
  });

  const membersWithMarker = FILES.filter((f) => MS_EPOCH_MARKER.test(f.text)).map((f) => f.relPath);

  it("derives today's expected member set from the tree (documents current membership)", () => {
    expect(membersWithMarker.sort()).toEqual(
      ["src/routes/api/forms.ts", "src/routes/review/shared.ts", "src/routes/tasks.ts"].sort(),
    );
  });

  it("every file accepting a ms-epoch request-body field imports isEpochMs", () => {
    const offenders = FILES.filter((f) => MS_EPOCH_MARKER.test(f.text) && !IMPORTS_IS_EPOCH_MS.test(f.text)).map(
      (f) => f.relPath,
    );
    expect(offenders, `ms-epoch validation without isEpochMs import: ${offenders.join(", ")}`).toEqual([]);
  });
});
