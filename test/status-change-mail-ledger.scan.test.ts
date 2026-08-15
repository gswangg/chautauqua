// DEC-459 amendment (wave 30): "status changes never auto-email" (SPEC.md
// §2 principle 4, docs/AUDIT.md:353-355) is a universal claim about EVERY
// route module, but until this test existed it was graded only by two
// hand-picked per-file tests (test/api-submissions.test.ts:836,
// test/content-status-bulk.test.ts:299) -- neither of which could ever
// notice a THIRD route module gaining both capabilities. This scan
// re-derives the population of "route modules that can write a content/
// submission/assignment status AND can send mail" AT TEST TIME, the same
// two-directional ledger shape as test/route-authz-enumeration.scan.test.ts
// and test/file-delete-ordering.scan.test.ts (whose length-preserving
// stripComments is copied verbatim below so reported line numbers stay
// accurate).
//
// WHAT THIS SCAN PROVES: which route modules under src/routes/** import (or
// call) at least one status-writer repo helper AND at least one
// mail-sending capability, in the SAME file. Every such module must be a
// deliberate, ledgered, one-line-reasoned exception (or the population must
// come back empty) -- because a route module that can both flip a status
// AND send mail is exactly the shape that produced the DEC-720/DEC-741
// incident (status-change and notification coupled behind a single
// request), so the count of route modules with that shape at all must stay
// small and named.
//
// WHAT THIS SCAN DOES NOT PROVE: that within a ledgered module the specific
// HANDLER that writes a status is disjoint from the handler that sends
// mail, or that any handler auto-sends mail as a *side effect* of a status
// write (that is what the two hand-picked per-file tests already assert for
// their specific routes, and remains their job, not this scan's). A module
// legitimately hosting both capabilities in separate, unrelated handlers
// still matches the file-level predicate below; this scan only proves the
// module-level import shape and forces a human-readable reason to exist for
// each match, not handler-level separation.
//
// If growing the ledger past 3 entries is ever needed, DO NOT just add
// lines -- per the task instructions, that means the file-level predicate is
// too coarse and must be narrowed to the slice of the file from the nearest
// preceding `<router>.<method>(` registration to the next one.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const ROUTES_ROOT = join(ROOT, "src", "routes");
const REPO_ROOT = join(ROOT, "src", "server", "repo");
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

// ---------------------------------------------------------------------------
// stripComments -- copied verbatim from test/file-delete-ordering.scan.test.ts
// (itself copied into test/route-authz-enumeration.scan.test.ts) so line
// numbers stay accurate (length-preserving: comments become spaces, newlines
// inside block comments are kept as newlines; string/template literal
// contents are preserved so a `//`/`/*` inside a string is never mistaken
// for a comment start).
// ---------------------------------------------------------------------------
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : "";
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (c === "/" && c2 === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < n) {
        out += "  ";
        i += 2;
      }
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < n) {
          out += (src[i] ?? "") + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (stat.isFile() && /\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

// ---------------------------------------------------------------------------
// STATUS-WRITER IDENTIFIERS -- a ledgered list of exported status-writing
// repo helpers. Each entry's `file` is asserted below to genuinely export a
// function/const of that name -- a rename that breaks this mapping fails
// loudly here instead of silently emptying the scanned population.
// ---------------------------------------------------------------------------
interface StatusWriter {
  name: string;
  file: string; // repo-relative path expected to export `name`
}

const STATUS_WRITERS: StatusWriter[] = [
  { name: "updateContentStatus", file: "src/server/repo/files-content-status.ts" },
  { name: "updateContentStatuses", file: "src/server/repo/files-content-status.ts" },
  { name: "reopenContentReview", file: "src/server/repo/files-content-status.ts" },
  { name: "updateSubmissionStatuses", file: "src/server/repo/submissions/status.ts" },
  // Task-assignment status writer, found by reading src/server/repo/tasks/
  // (not guessed): src/server/repo/tasks/crud.ts:454.
  { name: "updateAssignmentStatus", file: "src/server/repo/tasks/crud.ts" },
];

const STATUS_WRITER_NAMES = STATUS_WRITERS.map((w) => w.name);

function isExported(strippedSrc: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const funcRe = new RegExp(`export\\s+(?:async\\s+)?function\\s+${escaped}\\b`);
  const constRe = new RegExp(`export\\s+const\\s+${escaped}\\b`);
  return funcRe.test(strippedSrc) || constRe.test(strippedSrc);
}

// ---------------------------------------------------------------------------
// MAILER IDENTIFIERS -- makeMailer, mailer.send, or any import specifier
// starting with a mail module path (e.g. "../mail/", "../../mail/").
// ---------------------------------------------------------------------------
const MAILER_IDENTIFIER_RE = /\bmakeMailer\b|\bmailer\s*\.\s*send\s*\(|from\s+["'](?:\.\.\/)+mail\//;

// ---------------------------------------------------------------------------
// LEDGER -- file path -> one-line reason. Two-directional: the population
// (every src/routes/** file whose stripped source matches a status-writer
// identifier AND a mailer identifier) must equal this ledger's key set
// exactly.
// ---------------------------------------------------------------------------
const LEDGER: Record<string, string> = {
  "src/routes/content-notes.ts":
    "DEC-720/DEC-741: the sanctioned exception. Content-note mail (asking a speaker for changes) sets content_status='changes_requested' as a MESSAGE, not a status-change side effect -- the status write and the mail send are the same deliberate action, not status-change-triggers-mail.",
  "src/routes/tasks.ts":
    "Task-assignment status writes (updateAssignmentStatus, e.g. marking a task complete) and task-invite/reminder mail (makeMailer) both live in this module, but on separate, unrelated handlers -- accepting/completing an assignment never triggers mail, and sending a task invite/reminder never writes a status. Ledgered here because the file-level scan cannot see that separation (see 'WHAT THIS SCAN DOES NOT PROVE' above).",
};

describe("status-change-mail-ledger.scan (DEC-459 amendment, wave 30)", () => {
  const repoFiles: string[] = [];
  walk(REPO_ROOT, repoFiles);
  const repoSources = new Map<string, string>(); // repo-relative path -> stripped source
  for (const file of repoFiles) {
    const rel = relative(ROOT, file).split("\\").join("/");
    repoSources.set(rel, stripComments(readFileSync(file, "utf8")));
  }

  it("every ledgered STATUS_WRITER identifier is genuinely exported by its named module under src/server/repo/**", () => {
    const bad: string[] = [];
    for (const writer of STATUS_WRITERS) {
      const src = repoSources.get(writer.file);
      if (src === undefined) {
        bad.push(`${writer.file}: no such file under src/server/repo/** -- STATUS_WRITERS entry for "${writer.name}" is stale`);
        continue;
      }
      if (!isExported(src, writer.name)) {
        bad.push(`${writer.file}: does not export "${writer.name}" -- renamed or removed, STATUS_WRITERS is stale`);
      }
    }
    expect(bad, `stale STATUS_WRITERS entries:\n${bad.join("\n")}`).toEqual([]);
  });

  const routeFiles: string[] = [];
  walk(ROUTES_ROOT, routeFiles);
  const routeEntries = routeFiles.map((file) => {
    const rel = relative(ROOT, file).split("\\").join("/");
    const stripped = stripComments(readFileSync(file, "utf8"));
    const matchedStatusWriter = STATUS_WRITER_NAMES.find((name) => new RegExp(`\\b${name}\\b`).test(stripped));
    const mailerMatch = MAILER_IDENTIFIER_RE.exec(stripped);
    return { file: rel, stripped, matchedStatusWriter, mailerMatch };
  });

  it("tripwire: at least one status-writer identifier is found somewhere under src/routes/**", () => {
    const found = routeEntries.some((e) => e.matchedStatusWriter !== undefined);
    expect(found, "no status-writer identifier matched anywhere under src/routes/** -- the STATUS_WRITER_NAMES regex is broken").toBe(true);
  });

  it("tripwire: at least one mailer identifier is found somewhere under src/routes/**", () => {
    const found = routeEntries.some((e) => e.mailerMatch !== null);
    expect(found, "no mailer identifier matched anywhere under src/routes/** -- MAILER_IDENTIFIER_RE is broken").toBe(true);
  });

  it("the population (status-writer AND mailer in the same file) equals the ledger exactly, in both directions", () => {
    const population = routeEntries.filter((e) => e.matchedStatusWriter !== undefined && e.mailerMatch !== null);

    const unledgered: string[] = [];
    for (const entry of population) {
      if (LEDGER[entry.file] !== undefined) continue;
      const statusLine = entry.stripped.slice(0, entry.stripped.indexOf(entry.matchedStatusWriter!)).split("\n").length;
      const mailerLine = entry.stripped.slice(0, entry.mailerMatch!.index).split("\n").length;
      unledgered.push(
        `${entry.file}: matches status-writer "${entry.matchedStatusWriter}" at ${entry.file}:${statusLine} AND mailer identifier at ${entry.file}:${mailerLine} -- ` +
          `add a LEDGER entry, or (if population > 3) narrow the predicate to per-registration slices per this scan's own header.`,
      );
    }
    expect(unledgered, `unledgered route modules that both write a status and can send mail:\n${unledgered.join("\n")}`).toEqual([]);

    const populationFiles = new Set(population.map((e) => e.file));
    const stale = Object.keys(LEDGER).filter((f) => !populationFiles.has(f));
    expect(stale, `stale LEDGER entries (no live match -- delete these lines):\n${stale.join("\n")}`).toEqual([]);

    // Population size stays small by construction of the scan's own header
    // instruction: never grow the ledger past 3 without narrowing the
    // predicate first.
    expect(population.length).toBeLessThanOrEqual(3);
  });

  it("src/routes/content-notes.ts is ledgered with a reason citing DEC-720/DEC-741", () => {
    const reason = LEDGER["src/routes/content-notes.ts"];
    expect(reason, "src/routes/content-notes.ts must be present in LEDGER").toBeDefined();
    expect(reason).toMatch(/DEC-720/);
    expect(reason).toMatch(/DEC-741/);
  });
});
