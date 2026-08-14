// DEC-078 (wave-11 amendment) repo-wide enforcement: src/lib/chunk.ts's
// header states every inArray(...) over an unbounded id list MUST iterate
// chunkIds batches. Wave-10's per-area chunk-sweep tests (chunk-sweep-*.ts)
// only cover the areas they were written for, so a brand new unchunked
// reader can land silently in an area nobody swept. This test reads every
// *.ts file under src/server/repo/** and src/routes/** as text at run time
// (not a hand-maintained file list) and requires each file that mentions
// inArray( to either import chunkIds from ../lib/chunk (at any relative
// depth) or be named in the BOUNDED_INARRAY_FILES allowlist below with a
// reviewable reason for why its id list can never grow past D1's bound
// parameter ceiling.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(__dirname, "..");
const SCAN_ROOTS = ["src/server/repo", "src/routes"];

// Each entry: [file path relative to repo root, reason the inArray(...) call
// site(s) in that file are bounded and therefore exempt from chunkIds].
const BOUNDED_INARRAY_FILES: Array<[file: string, reason: string]> = [
  [
    "src/server/repo/files-authz.ts",
    "getSubmissionScope filters participant.inviteStatus against the " +
      "literal ACTIVE_INVITE_STATUSES enum (['none','accepted']) — a fixed " +
      "2-element set, never a data-sized id list.",
  ],
  [
    "src/server/repo/users.ts",
    "Both call sites filter user.role against the literal ORG_USER_ROLES " +
      "enum — a fixed role set, never a data-sized id list.",
  ],
  [
    "src/server/repo/contacts/stats.ts",
    "Filters participant.inviteStatus against the literal " +
      "ACTIVE_INVITE_STATUSES enum — a fixed 2-element set.",
  ],
  [
    "src/server/repo/public/gates.ts",
    "Filters participant.inviteStatus against the literal " +
      "['none','accepted'] enum — a fixed 2-element set.",
  ],
  [
    "src/server/repo/public/home.ts",
    "eventIds/visibleEventIds are derived from listHubEvents' own " +
      "LIMIT HUB_CANDIDATE_LIMIT candidate rows (DEC-581) — bounded by a " +
      "fixed page-size constant, never the full org event count.",
  ],
  [
    "src/server/repo/portal/submissions.ts",
    "ids is the submission id list for a SINGLE contact's own portal " +
      "submissions (scoped by contactId+orgId) — bounded by one person's " +
      "submission history, not by org-wide data volume.",
  ],
  [
    "src/server/repo/portal/data.ts",
    "Both call sites filter participant.inviteStatus against the literal " +
      "PORTAL_VISIBLE_INVITE_STATUSES enum — a fixed set.",
  ],
  [
    "src/server/repo/review/evaluations.ts",
    "listPlanCriteriaByIds' planIds is the DISTINCT set of evaluation " +
      "plan ids referenced by one submission's evaluation rows — bounded " +
      "by event configuration (rounds/tracks), not by review-row volume.",
  ],
  [
    "src/server/repo/tasks/speaker-detail.ts",
    "submissionIds is one contact's own submissions within one event — " +
      "bounded by a single speaker's talk count at one event.",
  ],
  [
    "src/server/repo/submissions/detail.ts",
    "contactIds is the DISTINCT participant contact set for ONE " +
      "submission (co-speakers on a single talk) — naturally small, " +
      "never data-sized.",
  ],
];

const allowlistByFile = new Map(BOUNDED_INARRAY_FILES.map(([file, reason]) => [file, reason]));

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

const scannedFiles = SCAN_ROOTS.flatMap((root) => listTsFiles(join(REPO_ROOT, root))).map((f) =>
  relative(REPO_ROOT, f),
);

describe("DEC-078 repo-wide inArray/chunkIds scan", () => {
  it("scanned at least the wave-11 planning-time file count (tripwire against a vacuous scan)", () => {
    expect(scannedFiles.length).toBeGreaterThan(100);
  });

  it("every allowlisted BOUNDED_INARRAY_FILES entry is a real file that was actually scanned", () => {
    for (const [file] of BOUNDED_INARRAY_FILES) {
      expect(scannedFiles).toContain(file);
    }
  });

  it("chunkIds has exactly one definition site (src/lib/chunk.ts) -- justifies treating any relative chunkIds import as resolving to the canonical chunker", () => {
    const allSrcFiles = listTsFiles(join(REPO_ROOT, "src"));
    const definitionSites = allSrcFiles.filter((f) => /export function chunkIds\(/.test(readFileSync(f, "utf8")));
    expect(definitionSites.map((f) => relative(REPO_ROOT, f))).toEqual(["src/lib/chunk.ts"]);
  });

  for (const relFile of scannedFiles) {
    const absFile = join(REPO_ROOT, relFile);
    const src = readFileSync(absFile, "utf8");
    if (!src.includes("inArray(")) continue;

    it(`${relFile}: inArray( call site imports chunkIds or is in the BOUNDED_INARRAY_FILES allowlist (DEC-078)`, () => {
      // Accepts a direct import from ../lib/chunk at any relative depth, or
      // an import of chunkIds from a local module that re-exports it (e.g.
      // submissions/query.ts's `export { chunkIds } from "../../../lib/chunk"`)
      // -- the only definition site is src/lib/chunk.ts, verified separately
      // below, so any relative `chunkIds` import resolves back to it.
      const importsChunkIds = /import\s*\{[^}]*\bchunkIds\b[^}]*\}\s*from\s*"\.[^"]*"/.test(src);
      const allowlisted = allowlistByFile.has(relFile);
      if (!importsChunkIds && !allowlisted) {
        throw new Error(
          `${relFile} calls inArray( but neither imports chunkIds from ../lib/chunk nor appears in ` +
            `BOUNDED_INARRAY_FILES — DEC-078 requires every inArray(...) over an unbounded id list to ` +
            `iterate chunkIds batches. Either chunk the id list or add a reviewed allowlist entry.`,
        );
      }
      expect(importsChunkIds || allowlisted).toBe(true);
    });
  }
});
