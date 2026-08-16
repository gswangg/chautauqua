// DEC-512 scan-lock: every source file that READS participant rows must
// either declare its invite-status audience (ACTIVE_INVITE_STATUSES /
// PORTAL_VISIBLE_INVITE_STATUSES / visibleParticipantConditions /
// isActiveParticipant / rosterParticipantConditions /
// schema.participant.inviteStatus) or be named in the hard-coded exemption
// map below with a stated, file-specific reason. A file that reads
// participant rows and is neither declared NOR exempt fails this test --
// that's the seventh-recurrence guard for the invite-status predicate
// (fixed six times before this wave per FINDINGS w35).
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const REPO_ROOT = join(__dirname, "..");

// Every file that has a genuine participant READ but is not (and, per its
// stated reason, should not be) audience-filtered by invite status. Keep
// this list honest: each reason describes what the file at that path
// ACTUALLY does (read at scan time), not a guess.
const EVERY_PARTICIPANT_AUDIENCE: Record<string, string> = {
  "src/server/repo/contacts/crud.ts":
    "delete-reference check: lists every submission a contact participates in so a delete refusal can name them, regardless of invite status",
  "src/server/repo/contacts/history.ts":
    "contact detail history panel: lists every submission a contact ever participated in, including declined invites",
  // src/server/repo/contacts/merge.ts is deliberately absent (DEC-282
  // amendment, wave 60): its participant dedupe now selects
  // schema.participant.inviteStatus (to fold an accepted invite into the
  // surviving row before the duplicate is deleted), which is itself an
  // AUDIENCE_MARKERS literal -- the file now "declares an audience" by this
  // scan's own definition, so an exemption entry here would be the stale
  // allowance DEC-985 guards against, even though the read is still a
  // write-path dedupe by contactId, not an eligibility read.
  "src/server/repo/exports/agenda.ts":
    "export surface: reports every participant row on an accepted/placed session",
  "src/server/repo/exports/showflow.ts":
    "export surface: reports every participant row on a placed session",
  "src/server/repo/exports/submissions.ts":
    "export surface: reports every participant row on a submission",
  "src/server/repo/import/sessionboard.ts":
    "write path: inserts/updates participant rows during import (id lookup for dedup, not an audience read)",
  "src/server/repo/public/counts.ts":
    "public speaker count: counts every participant row on a visible submission, regardless of invite status",
  "src/server/repo/public/detail.ts":
    "public speaker detail page: renders every participant row on a visible submission, regardless of invite status",
  "src/server/repo/public/speakers.ts":
    "public speakers directory/gallery: lists every participant row on a visible submission, regardless of invite status",
  "src/server/repo/submissions/history.ts":
    "submission history: joins email_log through every participant row for an audit trail, not an audience read",
  "src/server/repo/submissions/list.ts":
    "admin submissions grid: names every participant on a row (including the name-search subquery), regardless of invite status",
  "src/server/repo/submissions/touch.ts":
    "write path: touchSubmissionsForContacts resolves participant.contactId -> participant.submissionId to find which submissions to re-stamp after a contact rename -- every participant row denormalizes the SAME contact name into the pushed Speakers cell regardless of invite status, so this is not an eligibility read.",
};

// `acceptedSpeakerConditions` (src/server/repo/tasks/crud.ts) is on this
// list because it IS an invite-status audience declaration by construction:
// it ANDs `inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES])`
// into every query that composes it. Before the wave-64 files-library split
// its callers sat in the 837-line src/server/repo/files-library.ts, which
// declared the audience by containing the ACTIVE_INVITE_STATUSES literal for
// a DIFFERENT read in the same file; the split moved the headshot reads into
// files-library-query.ts / files-library-resolve.ts, severing them from that
// incidental literal without changing a single predicate. Naming the helper
// here keeps the scan exactly as strong (the helper cannot declare anything
// but the ACTIVE audience) instead of minting exemptions for reads that are,
// in fact, filtered.
const AUDIENCE_MARKERS = [
  "acceptedSpeakerConditions",
  "ACTIVE_INVITE_STATUSES",
  "PORTAL_VISIBLE_INVITE_STATUSES",
  "visibleParticipantConditions",
  "isActiveParticipant",
  "rosterParticipantConditions",
  "schema.participant.inviteStatus",
];

const READ_PATTERNS = [
  /\.from\(schema\.participant\)/,
  /innerJoin\(\s*schema\.participant/,
  /leftJoin\(\s*schema\.participant/,
  /from\s*\$\{schema\.participant\}/,
];

function hasParticipantRead(src: string): boolean {
  return READ_PATTERNS.some((re) => re.test(src));
}

function declaresAudience(src: string): boolean {
  return AUDIENCE_MARKERS.some((marker) => src.includes(marker));
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (relative(join(REPO_ROOT, "src"), abs) === "decisions-data") continue;
      walk(abs, out);
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      out.push(relative(REPO_ROOT, abs).split(sep).join("/"));
    }
  }
}

function everySourceFile(): string[] {
  const out: string[] = [];
  walk(join(REPO_ROOT, "src"), out);
  return out;
}

describe("participant-invite-audience scan (DEC-512)", () => {
  it("every read-but-undeclared participant-read file is exactly the hard-coded exemption map", () => {
    const relFiles = everySourceFile();
    const readUndeclared: string[] = [];
    for (const rel of relFiles) {
      const abs = join(REPO_ROOT, rel);
      const src = readFileSync(abs, "utf-8");
      if (hasParticipantRead(src) && !declaresAudience(src)) {
        readUndeclared.push(rel);
      }
    }
    readUndeclared.sort();
    const expected = Object.keys(EVERY_PARTICIPANT_AUDIENCE).sort();
    expect(readUndeclared).toEqual(expected);
  });

  it("every reason in the exemption map is a non-empty string", () => {
    for (const [, reason] of Object.entries(EVERY_PARTICIPANT_AUDIENCE)) {
      expect(typeof reason).toBe("string");
      expect(reason.trim().length).toBeGreaterThan(0);
    }
  });

  it("no exemption entry names a file that no longer exists", () => {
    for (const path of Object.keys(EVERY_PARTICIPANT_AUDIENCE)) {
      expect(existsSync(join(REPO_ROOT, path))).toBe(true);
    }
  });

  it("no exemption entry names a file that now declares an audience (a stale exemption fails loudly, per DEC-985)", () => {
    for (const path of Object.keys(EVERY_PARTICIPANT_AUDIENCE)) {
      const src = readFileSync(join(REPO_ROOT, path), "utf-8");
      expect(declaresAudience(src)).toBe(false);
    }
  });
});
