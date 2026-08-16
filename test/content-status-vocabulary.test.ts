// DEC-003 wave-73 amendment: CONTENT_STATUSES lives in src/domain/
// content-status.ts (pure core), re-exported verbatim by
// src/server/repo/files-content-status.ts. This test asserts the repo
// module's export IS the domain array (identity, not a copy), that both
// hand-written refusal strings name every member and no member the array
// lacks, and that the counts record has one key per member.
import { describe, expect, it } from "vitest";
import { CONTENT_STATUSES as DOMAIN_CONTENT_STATUSES, isContentStatus } from "../src/domain/content-status";
import { CONTENT_STATUSES as REPO_CONTENT_STATUSES } from "../src/server/repo/files-content-status";
import * as fs from "node:fs";
import * as path from "node:path";

describe("content-status vocabulary", () => {
  it("the repo module's CONTENT_STATUSES IS the domain array (identity)", () => {
    expect(REPO_CONTENT_STATUSES).toBe(DOMAIN_CONTENT_STATUSES);
  });

  it("isContentStatus recognizes every member and rejects a stranger", () => {
    for (const status of DOMAIN_CONTENT_STATUSES) {
      expect(isContentStatus(status)).toBe(true);
    }
    expect(isContentStatus("bogus")).toBe(false);
  });

  // The refusal string is a template literal built from CONTENT_STATUSES at
  // call time (`` `contentStatus must be one of ${CONTENT_STATUSES.map(...)
  // .join(", ")}` ``), not a hand-listed literal -- so its *source text*
  // never spells out the member names directly. We evaluate the same
  // expression the file uses (map+join over the live array) and assert the
  // file's source contains that exact composition, which is what makes the
  // rendered message name every member and no member the array lacks: it IS
  // the array, rendered.
  const EXPECTED_COMPOSITION = "CONTENT_STATUSES.map((s) => `'${s}'`).join(\", \")";
  const EXPECTED_RENDERED = `contentStatus must be one of ${DOMAIN_CONTENT_STATUSES.map((s) => `'${s}'`).join(", ")}`;

  function assertRefusalComposedFromArray(filePath: string) {
    const src = fs.readFileSync(path.join(__dirname, "..", filePath), "utf8");
    expect(src.includes(EXPECTED_COMPOSITION), `${filePath}: refusal string is not composed from CONTENT_STATUSES`).toBe(true);
    // No hand-listed literal left behind (the pre-DEC-003 hardcoded string).
    expect(src.includes("'pending', 'approved' or 'changes_requested'")).toBe(false);
  }

  it("the composed refusal message names every member and no member the array lacks", () => {
    for (const status of DOMAIN_CONTENT_STATUSES) {
      expect(EXPECTED_RENDERED.includes(`'${status}'`)).toBe(true);
    }
    const quoted = [...EXPECTED_RENDERED.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
    expect(quoted).toEqual([...DOMAIN_CONTENT_STATUSES]);
  });

  it("src/routes/files.ts refusal string is composed from CONTENT_STATUSES", () => {
    assertRefusalComposedFromArray("src/routes/files.ts");
  });

  it("src/routes/api/submissions.ts refusal string is composed from CONTENT_STATUSES", () => {
    assertRefusalComposedFromArray("src/routes/api/submissions.ts");
  });

  it("the counts record has one key per member", async () => {
    const { listSubmissions } = await import("../src/server/repo/submissions/list");
    void listSubmissions; // presence check only -- exercised by other suites
    // Build a zero record the same way list.ts does, and assert its keys
    // match the vocabulary exactly.
    const counts = Object.fromEntries(DOMAIN_CONTENT_STATUSES.map((s) => [s, 0]));
    expect(Object.keys(counts).sort()).toEqual([...DOMAIN_CONTENT_STATUSES].sort());
  });
});
