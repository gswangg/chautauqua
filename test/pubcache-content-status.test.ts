// DEC-627: reopening content approval (reopenContentReview) sets
// content_status back to 'pending', and visibleSessionConditions()
// (src/server/repo/public/gates.ts) gates every /e/* and /embed/* read on
// content_status='approved'. Any route whose handler writes content_status
// (directly or via reopenContentReview/updateContentStatus[es]) must
// therefore be classified public-affecting in src/server/pubcache.ts.
//
// This is a class-closing guard, not just a one-route regression test: the
// named CONTENT_STATUS_WRITERS table below is paired with a source scan
// (never a hand-maintained "trust me" count) for every call site of the
// three writer functions across src/routes/**, so a sixth writer can't land
// silently misclassified. If the scan count and the table size diverge,
// this test fails loudly and names the mismatch rather than skipping it.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { classifyMutatingPath } from "../src/server/pubcache";

const REPO_ROOT = join(__dirname, "..");
const ROUTES_ROOT = join(REPO_ROOT, "src", "routes");

function listSourceFiles(dir: string, extRe: RegExp): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full, extRe));
    } else if (extRe.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

const WRITER_FN_NAMES = ["reopenContentReview", "updateContentStatuses", "updateContentStatus"] as const;

/** Every (method, fullPath) route whose handler is known to write
 * content_status, and therefore must classify "public-affecting" in
 * pubcache.ts. Paired below with a source-scan count assertion so a new
 * (sixth) writer can't land without also landing here. */
const CONTENT_STATUS_WRITERS: { method: string; fullPath: string; note: string }[] = [
  { method: "POST", fullPath: "/api/v1/submissions/s1/files", note: "files.ts reopenContentReview (raw upload reopen)" },
  {
    method: "POST",
    fullPath: "/portal/tasks/a1/upload",
    note: "portal/tasks.tsx reopenContentReview (speaker portal upload reopen)",
  },
  {
    method: "POST",
    fullPath: "/api/v1/submissions/s1/content-status",
    note: "files.ts updateContentStatus (single-submission organizer set)",
  },
  {
    method: "POST",
    fullPath: "/api/v1/events/e1/submissions/content-status",
    note: "api/submissions.ts updateContentStatuses (bulk organizer set)",
  },
  {
    method: "POST",
    fullPath: "/api/v1/submissions/s1/content-note",
    note: "content-notes.ts updateContentStatus (requestChanges half of the note endpoint)",
  },
];

describe("DEC-627: content_status writers are all classified public-affecting", () => {
  it("every named content_status-writing route classifies public-affecting", () => {
    for (const { method, fullPath, note } of CONTENT_STATUS_WRITERS) {
      expect(
        classifyMutatingPath(fullPath),
        `${method} ${fullPath} (${note}) must classify "public-affecting" in src/server/pubcache.ts`,
      ).toBe("public-affecting");
    }
  });

  it("the source-scanned count of content_status writer call sites matches the named table's size", () => {
    const routeFiles = listSourceFiles(ROUTES_ROOT, /\.(ts|tsx)$/);
    let callSiteCount = 0;
    const found: string[] = [];
    for (const file of routeFiles) {
      const source = readFileSync(file, "utf8");
      for (const fnName of WRITER_FN_NAMES) {
        // Match a call `fnName(` but not the function's own declaration/import.
        const callRe = new RegExp(`(?<!function )\\b${fnName}\\(`, "g");
        const matchCount = [...source.matchAll(callRe)].length;
        for (let i = 0; i < matchCount; i++) {
          callSiteCount++;
          found.push(`${file.slice(REPO_ROOT.length + 1)}: ${fnName}(`);
        }
      }
    }
    expect(
      callSiteCount,
      `Found ${callSiteCount} content_status writer call site(s) under src/routes/** ` +
        `(${found.join(", ")}) but CONTENT_STATUS_WRITERS names ${CONTENT_STATUS_WRITERS.length}. ` +
        `A new writer call site must be added to CONTENT_STATUS_WRITERS in this file (and to ` +
        `pubcache.ts's PUBLIC_AFFECTING list) before this test can pass again.`,
    ).toBe(CONTENT_STATUS_WRITERS.length);
  });
});
