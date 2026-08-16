// DEC-111 amendment (findings wave 15, task-w15-d): a UNIQUE index in
// src/db/schema/ is a promise the write path enforces it without ever
// surfacing a raw D1 "UNIQUE constraint failed" as an unhandled 500. This
// scan reads every file under src/db/schema/ as text at run time (never a
// hand-maintained list), extracts every `uniqueIndex("<name>", ...)`
// declaration, and requires each name to appear exactly once in the
// ALLOWLIST below. Each entry names the write-path file that guards the
// index and a token the test must find, verbatim, in that file's text:
// one of the real guard idioms this codebase uses (onConflictDoNothing,
// onConflictDoUpdate, isUniqueViolation, submissionSeqSubquery), or an
// explicit not-user-writable reason (the column is only ever populated by
// server-minted randomness the caller never chooses, so no user input can
// collide it). Fails on: an index with no entry, an entry naming a file
// that doesn't exist, and an entry whose cited file no longer contains its
// token (a stale citation is as dangerous as no citation).
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(__dirname, "..");
const SCHEMA_DIR = join(REPO_ROOT, "src", "db", "schema");

type GuardToken = "onConflictDoNothing" | "onConflictDoUpdate" | "isUniqueViolation" | "submissionSeqSubquery";

interface AllowlistEntry {
  index: string;
  file: string; // repo-root-relative path
  // Either a real guard token that must appear verbatim in `file`, or an
  // explicit reason string (checked only for non-emptiness, never a token
  // match) for columns no user input can ever collide.
  guard: GuardToken | { reason: string };
}

const ALLOWLIST: AllowlistEntry[] = [
  {
    index: "api_token_token_hash_idx",
    file: "src/routes/api/tokens.ts",
    guard: { reason: "tokenHash is hashToken(newApiToken()) — server-minted randomness, never user-chosen input" },
  },
  {
    index: "auth_session_token_hash_idx",
    file: "src/server/auth-session.ts",
    guard: { reason: "tokenHash is minted server-side randomness at session creation, never user-chosen input" },
  },
  { index: "contact_org_id_external_ref_idx", file: "src/server/repo/import/sessionboard.ts", guard: "isUniqueViolation" },
  {
    index: "contact_duplicate_dismissal_org_id_contact_id_a_contact_id_b_idx",
    file: "src/server/repo/contacts/merge.ts",
    guard: "onConflictDoNothing",
  },
  { index: "evaluation_plan_submission_reviewer_round_idx", file: "src/server/repo/review/evaluations.ts", guard: "onConflictDoUpdate" },
  { index: "event_slug_idx", file: "src/server/repo/events.ts", guard: "isUniqueViolation" },
  // DEC-818 amendment (wave-47): partial-unique on file.previous_file_id
  // encodes the version-chain invariant ("at most one row may name a given
  // predecessor"). insertFile catches the violation and rethrows it as an
  // ApiError("conflict") -- a loud, retryable refusal, never a silent retry.
  { index: "file_previous_file_id_unique", file: "src/server/repo/files-versions-write.ts", guard: "isUniqueViolation" },
  { index: "form_event_id_title_idx", file: "src/server/repo/forms.ts", guard: "onConflictDoNothing" },
  { index: "participant_submission_id_contact_id_idx", file: "src/server/repo/participants.ts", guard: "onConflictDoNothing" },
  { index: "pipeline_entry_org_id_contact_id_idx", file: "src/server/repo/pipeline.ts", guard: "onConflictDoNothing" },
  { index: "portal_settings_event_id_idx", file: "src/server/repo/portal-config.ts", guard: "onConflictDoUpdate" },
  { index: "review_recusal_plan_submission_user_idx", file: "src/server/repo/review/recusal.ts", guard: "onConflictDoNothing" },
  { index: "schedule_slot_submission_id_idx", file: "src/server/repo/agenda/slots.ts", guard: "onConflictDoUpdate" },
  { index: "segment_org_id_name_idx", file: "src/server/repo/contacts/segments.ts", guard: "isUniqueViolation" },
  { index: "submission_answer_submission_id_form_field_id_idx", file: "src/server/repo/submit.ts", guard: "onConflictDoUpdate" },
  { index: "submission_event_id_external_ref_idx", file: "src/server/repo/import/sessionboard.ts", guard: "isUniqueViolation" },
  { index: "submission_event_id_seq_idx", file: "src/server/repo/submissions/seq.ts", guard: "submissionSeqSubquery" },
  { index: "task_assignment_task_id_contact_id_idx", file: "src/server/repo/tasks/crud.ts", guard: "onConflictDoNothing" },
  { index: "task_event_id_title_idx", file: "src/server/repo/tasks/crud.ts", guard: "isUniqueViolation" },
  { index: "track_event_id_external_ref_idx", file: "src/server/repo/import/sessionboard.ts", guard: "isUniqueViolation" },
  { index: "user_email_idx", file: "src/server/repo/users.ts", guard: "onConflictDoNothing" },
];

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/** Extracts every `uniqueIndex("<name>"` declaration name from file text.
 * `\s` matches newlines too, so a wrapped declaration like
 * `uniqueIndex(\n  "name",\n)` resolves the same as a single-line one. */
function extractUniqueIndexNames(src: string): string[] {
  const re = /uniqueIndex\(\s*"([a-zA-Z0-9_]+)"/g;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1];
    if (name) names.push(name);
  }
  return names;
}

const schemaFiles = listTsFiles(SCHEMA_DIR);
const declaredIndexNames = schemaFiles.flatMap((f) => extractUniqueIndexNames(readFileSync(f, "utf8")));

describe("DEC-111 unique-index guard coverage (every uniqueIndex has exactly one reviewed guard)", () => {
  it("scanned at least one schema file and found at least 15 uniqueIndex declarations (tripwire against a vacuous scan)", () => {
    expect(schemaFiles.length).toBeGreaterThan(0);
    expect(declaredIndexNames.length).toBeGreaterThanOrEqual(15);
  });

  it("every declared uniqueIndex name has exactly one ALLOWLIST entry", () => {
    const counts = new Map<string, number>();
    for (const name of declaredIndexNames) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const missing = [...counts.keys()].filter((name) => !ALLOWLIST.some((e) => e.index === name));
    const unlisted = ALLOWLIST.filter((e) => !counts.has(e.index)).map((e) => e.index);
    const duplicated = [...counts.entries()].filter(([, n]) => n > 1).map(([name]) => name);
    expect(missing, `uniqueIndex declarations with no ALLOWLIST entry: ${missing.join(", ")}`).toEqual([]);
    expect(unlisted, `ALLOWLIST entries naming an index that no longer exists in schema: ${unlisted.join(", ")}`).toEqual([]);
    expect(duplicated, `uniqueIndex names declared more than once in schema (should be impossible): ${duplicated.join(", ")}`).toEqual(
      [],
    );
    // Exactly one entry per name (no allowlist duplicates either).
    const allowlistCounts = new Map<string, number>();
    for (const e of ALLOWLIST) allowlistCounts.set(e.index, (allowlistCounts.get(e.index) ?? 0) + 1);
    const allowlistDuplicates = [...allowlistCounts.entries()].filter(([, n]) => n > 1).map(([name]) => name);
    expect(allowlistDuplicates, `ALLOWLIST has more than one entry for: ${allowlistDuplicates.join(", ")}`).toEqual([]);
  });

  for (const entry of ALLOWLIST) {
    it(`${entry.index}: ALLOWLIST entry's file (${entry.file}) exists and cites a live guard`, () => {
      const absFile = join(REPO_ROOT, entry.file);
      if (!existsSync(absFile)) {
        throw new Error(`${entry.index}: ALLOWLIST names ${entry.file} which does not exist -- fix or remove this entry.`);
      }
      const text = readFileSync(absFile, "utf8");
      if (typeof entry.guard === "string") {
        expect(
          text.includes(entry.guard),
          `${entry.index}: ${entry.file} no longer contains the token "${entry.guard}" -- the guard was removed or renamed, ` +
            `re-verify the write path is still protected and update this ALLOWLIST entry.`,
        ).toBe(true);
      } else {
        expect(entry.guard.reason.length, `${entry.index}: ALLOWLIST entry has an empty not-user-writable reason`).toBeGreaterThan(0);
      }
    });
  }

  it("relative-path sanity: every ALLOWLIST file path is repo-root-relative (never absolute)", () => {
    for (const e of ALLOWLIST) {
      expect(e.file.startsWith("/"), `${e.index}: ${e.file} must be repo-root-relative`).toBe(false);
    }
  });

  it("schema files scanned are repo-root-relative when reported (sanity on listTsFiles/relative pairing)", () => {
    for (const f of schemaFiles) {
      expect(relative(REPO_ROOT, f).startsWith("..")).toBe(false);
    }
  });
});
