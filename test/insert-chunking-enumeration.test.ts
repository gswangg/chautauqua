// DEC-528: enumerates every `.insert(...).values(...)` call in the repo
// layer whose argument is NOT an object literal (i.e. a multi-row insert —
// an array/identifier of rows rather than one literal row), derived from the
// source tree itself (glob + regex scan), never hand-listed. Each such site
// must either import chunkRowsForInsert (the canonical bound-parameter-safe
// helper) or be explicitly exempted here as bounded by construction, with a
// comment explaining the bound — mirroring the DEC-104-exempt pattern in
// test/chunk-sweep-misc.test.ts.
import { describe, expect, it } from "vitest";

const sourceModules = import.meta.glob("../src/server/repo/**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

// Sites whose row count is bounded by something structural, not by an
// unbounded id list or roster — a chunking helper would be dead code there:
//  - forms.ts's fieldValues: the fixed LOCKED_SESSION_FIELDS/
//    LOCKED_SPEAKER_FIELDS constant lists (a form always has the same small
//    set of locked fields), not scaled by event/contact count.
//  - portal-edit.ts / submit.ts's submissionTrack inserts: one row per track
//    a single submission is filed under — bounded by the event's track list
//    size, never by roster/contact count.
const EXEMPT = new Set<string>([
  "src/server/repo/forms.ts",
  "src/server/repo/portal-edit.ts",
  "src/server/repo/submit.ts::submissionTrack",
]);

interface Site {
  file: string;
  line: number;
}

function findMultiRowInsertSites(): Site[] {
  const sites: Site[] = [];
  for (const [path, src] of Object.entries(sourceModules)) {
    const file = path.replace(/^\.\.\//, "");
    const re = /\.insert\([^)]*\)\s*\.values\(\s*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const after = src.slice(m.index + m[0].length, m.index + m[0].length + 10).trimStart();
      if (!after.startsWith("{")) {
        const line = src.slice(0, m.index).split("\n").length;
        sites.push({ file, line });
      }
    }
  }
  return sites;
}

describe("DEC-528: every multi-row insert imports chunkRowsForInsert (or is exempt)", () => {
  it("finds exactly the known sites (tripwire against a silently vacuous scan)", () => {
    const sites = findMultiRowInsertSites();
    // Ground truth as of this commit: 9 chunked sites (the original 4, plus
    // DEC-542's submissions/create.ts submissionTrack/submissionAnswer/
    // participant clone inserts, DEC-924's reviewers.ts addReviewers, plus
    // DEC-932's submissions/status.ts back-fill-pass taskAssignment insert)
    // + 3 bounded-exempt sites. A new multi-row insert added later must
    // show up here.
    expect(sites.length).toBe(12);
  });

  it("every non-exempt site's file imports chunkRowsForInsert", () => {
    const sites = findMultiRowInsertSites();
    const nonExempt = sites.filter((s) => !EXEMPT.has(s.file) && !EXEMPT.has(`${s.file}::submissionTrack`));
    expect(nonExempt.length).toBeGreaterThan(0);
    for (const site of nonExempt) {
      const src = sourceModules[`../${site.file}`] ?? sourceModules[site.file];
      expect(src, `no source found for ${site.file}`).toBeTruthy();
      expect(
        src,
        `${site.file}:${site.line} — multi-row .values() call but file does not import chunkRowsForInsert`,
      ).toMatch(/import\s*{[^}]*\bchunkRowsForInsert\b[^}]*}\s*from\s*"[^"]*\/lib\/chunk"/);
    }
  });

  it("submit.ts has both an exempt (submissionTrack) and a chunked (submissionAnswer) multi-row site", () => {
    const src = sourceModules["../src/server/repo/submit.ts"];
    expect(src).toBeTruthy();
    expect(src).toMatch(/import\s*{[^}]*\bchunkRowsForInsert\b[^}]*}\s*from\s*"[^"]*\/lib\/chunk"/);
    expect(src).toContain("schema.submissionTrack).values(");
    expect(src).toContain("schema.submissionAnswer).values(chunk)");
  });
});
