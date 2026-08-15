import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// DEC-918: src/lib/event-time.ts is the ONE date-formatting home for every
// server-rendered (customer-facing) surface -- the mirror of
// test/spa-date-format-single-source.test.ts's rule for app/src/lib/dates.ts.
// A page that calls toLocale*() directly forks the display grammar from
// event-time.ts's (e.g. shell.tsx's former en-US "May 12" vs. root.tsx's
// hand-rolled en-GB "12 May" for the identical startDate/endDate range).
// This guard scans every src/ file (excluding event-time.ts itself and test
// files) for those bare calls.

const REPO_ROOT = join(__dirname, "..");
const SRC_DIR = join(REPO_ROOT, "src");
const EVENT_TIME_MODULE = join(SRC_DIR, "lib/event-time.ts");

/** Recursively collect .ts/.tsx files under `dir`, skipping test files and
 * event-time.ts itself. */
function glob(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry) && full !== EVENT_TIME_MODULE) {
      out.push(full);
    }
  }
  return out;
}

const BANNED = ["toLocaleDateString(", "toLocaleTimeString(", "toLocaleString("];

// Named, legible exemptions -- every non-event-time.ts file that would
// otherwise trip the scan below, with the reason it's not a date-formatting
// call (so the exemption is a documented decision, not an accident of the
// substring check):
//
//   - src/lib/timezone.ts: constructs `new Intl.DateTimeFormat(...)` (and
//     calls `.formatToParts`, not any `toLocale*` method) purely to read a
//     zone's UTC OFFSET for the DST-safe wall-clock -> instant algorithm --
//     never to render a date string.
//   - src/routes/api/validators.ts: constructs `new Intl.DateTimeFormat(...)`
//     purely to VALIDATE that an IANA timezone identifier is resolvable
//     (catching the RangeError an unknown zone throws) -- it never formats
//     or renders anything.
//   - src/views/form-render.tsx: calls `n.toLocaleString("en-US")` on a
//     NUMBER (a long-text field's live character counter), not a date --
//     Number.prototype.toLocaleString shares a name with the banned
//     Date methods but has nothing to do with DEC-918's calendar-day
//     grammar.
//   - src/routes/public/submit.tsx: overLengthErrorMessage() calls
//     `.toLocaleString("en-US")` on three NUMBERS (typed length, overage,
//     and the cap) to group thousands in the DEC-124 over-length error
//     copy -- same Number.prototype.toLocaleString as form-render.tsx's
//     counter above, nothing to do with dates.
//   - src/routes/tasks.ts: calls `MAX_INSTRUCTIONS_LENGTH.toLocaleString(
//     "en-US")` on the NUMBER 2000 to group thousands in the DEC-124
//     over-length field error for task instructions (CNT-01) -- again
//     Number.prototype.toLocaleString, not a date.
//   - src/routes/portal/tasks.tsx: calls `MAX_COMMENT_BODY_LENGTH
//     .toLocaleString("en-US")` on the NUMBER 4000 to group thousands in the
//     DEC-244 over-cap speaker-comment error copy -- again
//     Number.prototype.toLocaleString, not a date.
//   - src/routes/portal/tasks/views.tsx: calls the same
//     `MAX_COMMENT_BODY_LENGTH.toLocaleString("en-US")` NUMBER in the reply
//     textarea's quiet "Up to 4,000 characters." helper line (DEC-244) --
//     same Number.prototype.toLocaleString, nothing to do with dates.
const NAMED_EXEMPTIONS = new Set(
  [
    join(SRC_DIR, "lib/timezone.ts"),
    join(SRC_DIR, "routes/api/validators.ts"),
    join(SRC_DIR, "views/form-render.tsx"),
    join(SRC_DIR, "routes/public/submit.tsx"),
    join(SRC_DIR, "routes/tasks.ts"),
    join(SRC_DIR, "routes/portal/tasks.tsx"),
    join(SRC_DIR, "routes/portal/tasks/views.tsx"),
  ].map((p) => relative(REPO_ROOT, p)),
);

describe("Server date-time formatting is single-sourced through lib/event-time.ts (DEC-918)", () => {
  it("no src/ file (other than event-time.ts) calls toLocale*() to format a DATE", () => {
    const offenders: string[] = [];
    for (const file of glob(SRC_DIR)) {
      const rel = relative(REPO_ROOT, file);
      if (NAMED_EXEMPTIONS.has(rel)) continue;
      const text = readFileSync(file, "utf8");
      const lines = text.split("\n");
      lines.forEach((line, idx) => {
        for (const needle of BANNED) {
          if (line.includes(needle)) {
            offenders.push(`${rel}:${idx + 1}: ${line.trim()}`);
          }
        }
      });
    }
    expect(offenders, `Found direct toLocale* calls outside lib/event-time.ts:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("the two named Intl.DateTimeFormat construction sites are exactly the exemptions this test documents", () => {
    // Legibility check for the opposite direction: if a THIRD file starts
    // constructing `new Intl.DateTimeFormat(` outside event-time.ts, this
    // test should fail loudly and force that file to be named here too,
    // rather than silently accumulating undocumented date-formatting call
    // sites.
    const intlSites: string[] = [];
    for (const file of glob(SRC_DIR)) {
      const rel = relative(REPO_ROOT, file);
      const text = readFileSync(file, "utf8");
      if (text.includes("new Intl.DateTimeFormat(")) intlSites.push(rel);
    }
    expect(new Set(intlSites)).toEqual(new Set(["src/lib/timezone.ts", "src/routes/api/validators.ts"]));
  });
});
