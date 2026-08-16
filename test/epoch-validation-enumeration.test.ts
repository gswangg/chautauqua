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
// DEC-522 (wave-52 amendment) added a SECOND door phrasing. A day-label
// column (form.open_date/close_date, evaluation-plan window fields) is now
// refused by isDayLabelMs with the message "must be a UTC-midnight day
// label (ms-epoch multiple of 86400000)". That door is still a ms-epoch
// boundary — isDayLabelMs delegates to isEpochMs and then additionally
// requires the midnight multiple — so it belongs in THIS enumeration.
// Recognising only the older phrase would have let src/routes/api/forms.ts
// drop silently out of the member set the moment both of its doors became
// day labels, re-opening exactly the coverage hole DEC-527 exists to close.
// So the marker is the union of both phrasings, and the import obligation
// is satisfied by either predicate.
//
// This is verification-only: it reads source files as plain text and
// regex-scans them. It does not import or execute production code, so a
// change here can never affect src/ behavior.

import { describe, expect, it } from "vitest";
import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { isEpochMs, isDayLabelMs, DAY_LABEL_MS, MIN_EPOCH_MS, MAX_EPOCH_MS } from "../src/routes/api/validators";

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

/** The older, plain ms-epoch door phrasing (DEC-509/DEC-517). */
const MS_EPOCH_MARKER = /ms-epoch integer/i;
/** The DEC-522 day-label door phrasing, which is a ms-epoch door too. */
const DAY_LABEL_MARKER = /UTC-midnight day label/i;
/** A file is a member if it carries EITHER door phrasing. */
const EPOCH_DOOR_MARKER = (text: string): boolean => MS_EPOCH_MARKER.test(text) || DAY_LABEL_MARKER.test(text);
/** Either predicate discharges the obligation: isDayLabelMs is isEpochMs
 * plus the midnight-multiple requirement, so importing it still binds the
 * DEC-517 range at that door. */
const IMPORTS_EPOCH_PREDICATE =
  /\bimport\s*\{[^}]*\b(?:isEpochMs|isDayLabelMs)\b[^}]*\}\s*from\s*["'][^"']+["']/;

describe("DEC-527: isEpochMs invariant, enumerated over src/routes/**/*.ts", () => {
  it("found at least one route file to scan (glob is not silently empty)", () => {
    expect(FILES.length).toBeGreaterThan(3);
  });

  const membersWithMarker = FILES.filter((f) => EPOCH_DOOR_MARKER(f.text)).map((f) => f.relPath);

  it("derives today's expected member set from the tree (documents current membership)", () => {
    expect(membersWithMarker.sort()).toEqual(
      ["src/routes/api/forms.ts", "src/routes/review/shared.ts", "src/routes/tasks.ts"].sort(),
    );
  });

  it("every file accepting a ms-epoch request-body field imports isEpochMs or isDayLabelMs", () => {
    const offenders = FILES.filter((f) => EPOCH_DOOR_MARKER(f.text) && !IMPORTS_EPOCH_PREDICATE.test(f.text)).map(
      (f) => f.relPath,
    );
    expect(offenders, `ms-epoch validation without a shared predicate import: ${offenders.join(", ")}`).toEqual([]);
  });

  // DEC-522 wave-52: the day-label door is strictly narrower than the plain
  // ms-epoch door — it inherits the DEC-517 range AND refuses any sub-day
  // component, which is how a `Date.now() - N` offset reached a day-label
  // column in the first place.
  it("isDayLabelMs is isEpochMs narrowed to exact UTC midnights", () => {
    expect(DAY_LABEL_MS).toBe(86_400_000);
    expect(isDayLabelMs(Date.UTC(2027, 2, 1))).toBe(true);
    expect(isDayLabelMs(0)).toBe(true);
    // a sub-day offset is refused even though it is a valid ms-epoch
    expect(isEpochMs(Date.UTC(2027, 2, 1) - 60_000)).toBe(true);
    expect(isDayLabelMs(Date.UTC(2027, 2, 1) - 60_000)).toBe(false);
    // out-of-range is refused even when it is an exact day multiple
    expect(isDayLabelMs(1e18)).toBe(false);
    expect(isDayLabelMs(-1e18)).toBe(false);
  });

  // DEC-517 amendment (wave 42): every one of the above members shares the
  // SAME predicate object (imported, not reimplemented), so this range
  // assertion — run once, here, against the shared predicate — covers all
  // of them. An unbounded integer (e.g. 1e18) is no longer a valid ms-epoch
  // value: it satisfied the old Number.isInteger-only guard but broke every
  // downstream reader (dayLabelToYmd -> "NaN-NaN-NaN" -> throw).
  it("isEpochMs enforces the DEC-517 amendment range, not just integer-ness", () => {
    expect(isEpochMs(0)).toBe(true);
    expect(isEpochMs(MIN_EPOCH_MS)).toBe(true);
    expect(isEpochMs(MAX_EPOCH_MS)).toBe(true);
    expect(isEpochMs(1e18)).toBe(false);
    expect(isEpochMs(-1e18)).toBe(false);
    expect(isEpochMs(MAX_EPOCH_MS + 1)).toBe(false);
    expect(isEpochMs(MIN_EPOCH_MS - 1)).toBe(false);
  });
});
