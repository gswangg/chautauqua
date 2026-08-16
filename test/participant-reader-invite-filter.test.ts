// DEC-981/DEC-974: enumerates every `.from(schema.participant)` read under
// src/ (never a hand-listed manifest — a file added after this test is
// written must still be caught) and requires each site's enclosing
// statement to either mention `inviteStatus` or one of the shared
// active/visible-participant predicate helpers, or to appear in the ALLOWED
// map below with a one-line reason. This is the class of defect that let a
// DECLINED co-presenter reach src/sync/airtable.ts's Speakers cell — the one
// reader whose output leaves the product entirely, publishing to the
// customer's own Airtable base.
//
// ALLOWED entries are NOT a blanket exemption: each is a real site, read and
// justified below. A brand-new unfiltered `.from(schema.participant)` site
// that isn't in ALLOWED fails this test — the author must either filter by
// eligibility or add a reasoned ALLOWED entry (reviewed, not rubber-stamped).

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_ROOT = join(__dirname, "..", "src");

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

/** Strips // line comments and block comments so a comment mentioning
 * inviteStatus never counts as a live filter. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const SHARED_HELPER_RE =
  /inviteStatus|acceptedSpeakerConditions|rosterParticipantConditions|visibleParticipantConditions|PORTAL_VISIBLE_INVITE_STATUSES|ACTIVE_INVITE_STATUSES/;

const FROM_PARTICIPANT_RE = /\.from\(schema\.participant\)/g;

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split("\n").length;
}

/** Enclosing statement: from the match back to the previous top-level ';'
 * (exclusive) through the next ';' (inclusive of neither delimiter). Good
 * enough for the drizzle query-builder chains this codebase uses — every
 * site here is a single `const x = await db.select(...).from(...)....;`
 * chain with no nested statements inside it. */
function enclosingStatement(src: string, matchIndex: number): string {
  let start = src.lastIndexOf(";", matchIndex);
  start = start === -1 ? 0 : start + 1;
  let end = src.indexOf(";", matchIndex);
  end = end === -1 ? src.length : end;
  return src.slice(start, end);
}

/** relative/path.ts (forward-slash, relative to src/) -> reason(s), one per
 * known unfiltered `.from(schema.participant)` site, read and justified by
 * hand against the current tree. Every entry here is a read that is NOT an
 * eligibility enumeration: an ownership/by-id lookup, an admin/CRM/export
 * surface that intentionally shows every participant regardless of invite
 * state, a per-submission cap count, or a query that wraps a shared
 * predicate helper under a different local name than this scanner's regex
 * knows (e.g. gates.ts's visibleSubmissionConditions(), which itself calls
 * visibleParticipantConditions()). If a site's true behavior changes, this
 * map must be re-justified, not just re-typed.
 */
const ALLOWED: Record<string, string[]> = {
  "server/repo/portal/submissions.ts": [
    "getMySubmissions reads by the caller's own contactId — a portal user sees their own submissions in every invite state, not an eligibility enumeration.",
  ],
  "server/repo/participants.ts": [
    "getParticipantOwnership looks up a single participant row by participantId before a write — ownership check, not eligibility.",
    "getSubmissionLeadParticipantId (DEC-900 amendment, wave 13) resolves ONE submission's lead participant id to refuse retargeting it in the role-PATCH route. It must mirror the SPA rail's rule exactly — the rail picks role==='speaker' (else first by order asc) out of detail.participants, which is the admin detail list and is itself unfiltered by invite status — so filtering this by eligibility would make the server's lead disagree with the lead the organizer is looking at, and would let the displayed lead be demoted the moment it declined. Addressed by submissionId; returns an id used only as a write guard, never serialized.",
    "getParticipantCount (DEC-422 wave-67 / DEC-604 amendment, wave 12) is the MAX_PARTICIPANTS_PER_SUBMISSION count that closes the organizer door, the exact mirror of portal-edit.ts's cap count below: a per-submission cap over EVERY participant row, not an eligibility read. Filtering it by invite status would be a defect, not a fix — a declined or withdrawn co-presenter still occupies its slot (same reasoning as import/sessionboard.ts's MAX(order) read), so an eligibility-filtered count would let a submission be pushed past the cap by re-inviting into declined rows.",
  ],
  "server/repo/contacts/history.ts": [
    "CRM contact-history timeline lists every submission the contact ever touched, not an eligibility read.",
    "submissionsTotal's count(*) must count the SAME population the capped list above slices — filtering it by eligibility would make the total disagree with the rows it totals (w56-c).",
    "The distinct-events read spans the same contactId-addressed join as the submissions list above and is now itself capped at MAX_CONTACT_HISTORY_EVENTS (w47-f); the cap is a rendering bound on one CRM population, not an eligibility enumeration (w56-c).",
    "eventsTotal's count(distinct event.id) is the only source of truth for the 'Across your events' total and must count the SAME population the capped distinct-events list above slices — filtering it by eligibility would make the total disagree with the rows it totals, exactly as for submissionsTotal (w47-f).",
  ],
  "server/repo/contacts/crud.ts": [
    "listContactReferenceRows lists every submission referencing the contact for the admin CRM page, not an eligibility read.",
  ],
  // mergeParticipants/keepParticipants (DEC-282 amendment): both selects now
  // project inviteStatus/visible so the dedupe can fold an accepted invite
  // or public visibility into the surviving row before deleting the
  // duplicate — this scanner's SHARED_HELPER_RE matches the literal
  // `inviteStatus` column reference in that projection, so those two sites
  // now count as filtered (not an eligibility read either way; still
  // addressed by contactId, not by invite state) and are absent here.
  "server/repo/contacts/merge.ts": [
    "discard-count read counts participant rows by discardedContactIds for a merge-outcome summary, not by eligibility.",
  ],
  // server/repo/overview.ts is deliberately absent: both of its participant
  // reads (the placed-session fan-out behind speaker-clash detection and
  // fetchLeadSpeakers' worklist name) now declare the ACTIVE audience per
  // DEC-512, so an exemption here would be a stale allowance (DEC-985).
  "server/repo/exports/submissions.ts": [
    "Admin CSV export hydrates every participant of the exported row for the organizer, mirroring submissions/list.ts — not an eligibility read.",
  ],
  "server/repo/exports/showflow.ts": [
    "Admin CSV export hydrates every participant of the exported row for the organizer, mirroring submissions/list.ts — not an eligibility read.",
  ],
  "server/repo/exports/agenda.ts": [
    "Admin CSV export hydrates every participant of the exported row for the organizer, mirroring submissions/list.ts — not an eligibility read.",
  ],
  "server/repo/public/counts.ts": [
    "Filters via gates.ts's visibleSubmissionConditions(), which itself ANDs visibleParticipantConditions() (DEC-274) — same predicate, different local call name than this scanner's regex.",
  ],
  "server/repo/public/speakers.ts": [
    "Speaker-id-page read filters via the local `conditions` array built from gates.ts's visibleSubmissionConditions() (DEC-274) — same predicate, indirected through a variable this scanner's regex doesn't follow.",
    "Speaker-count read filters via the same local `conditions` array built from visibleSubmissionConditions() — same predicate, indirected through a variable.",
    "Speaker-detail-batch read filters via the same local `conditions` array built from visibleSubmissionConditions() — same predicate, indirected through a variable.",
  ],
  "server/repo/public/detail.ts": [
    "Filters via gates.ts's visibleSubmissionConditions(), which itself ANDs visibleParticipantConditions() (DEC-274) — same predicate, different local call name than this scanner's regex.",
  ],
  "server/repo/review/submissions.ts": [
    "listSpeakersForSubmission lists every named author of a submission for the review UI, mirroring submissions/list.ts — not an eligibility read.",
    "listSpeakerIdentitiesForSubmissions (DEC-018 wave-57) builds the REDACTION identity set the anonymized reviewer queue masks titles against. Its unfilteredness is the point, and the inverse of a leak: a redaction set must be a superset of every display predicate, never narrower, or a declined/withdrawn co-presenter — excluded from the display lists — would still leave their name unredacted in the title free text. Not an eligibility enumeration; nothing from it is ever serialized, only matched-and-masked.",
  ],
  "server/repo/profile.ts": [
    "Filters via gates.ts's visibleSubmissionConditions(), which itself ANDs visibleParticipantConditions() (DEC-274) — same predicate, different local call name than this scanner's regex.",
  ],
  "server/repo/submissions/status.ts": [
    "getSubmissionStatusForParticipant looks up a single participant row by participantId — ownership/status lookup, not eligibility.",
  ],
  "server/repo/submissions/list.ts": [
    "Hydrates every author of an admin submission-list row, not an eligibility read.",
  ],
  "server/repo/submissions/detail.ts": [
    "DEC-900 (wave 7) speaker-rail history read: a contactId-addressed timeline of the submissions this contact ever appeared on in the same org, same class as contacts/history.ts's CRM timeline — the amendment defines submissionsThisYear as 'submissions on which this contact is a participant', with no invite-state qualifier, and lastSpokeYear is narrowed by submission STATUS (accepted-and-scheduled) rather than by invite status. Not an eligibility enumeration and never leaves the product.",
  ],
  "server/repo/comms.ts": [
    "Reads by an admin-supplied set of explicit contactIds (targeted recipients), not an eligibility enumeration.",
  ],
  "server/repo/import/sessionboard.ts": [
    "Builds a (submissionId, contactId) -> participant id map for the import writer, addressing rows by id, not by eligibility.",
    "loadMaxOrderBySubmissionId's grouped MAX(order) per submission must count EVERY existing participant row — a declined/withdrawn co-presenter still occupies its order slot, so filtering by eligibility here would hand a new participant a colliding order.",
  ],
  "server/repo/portal-edit.ts": [
    "The MAX_PARTICIPANTS_PER_SUBMISSION count is a per-submission cap over every participant row, not an eligibility read.",
  ],
  "server/repo/submissions/touch.ts": [
    "touchSubmissionsForContacts resolves participant.contactId -> participant.submissionId to find which submissions to re-stamp after a contact rename -- every participant row denormalizes the same contact name into the pushed Speakers cell regardless of invite status, not an eligibility read.",
  ],
  "server/repo/tasks/grid.ts": [
    "getOnboardingGrid's total COUNT (DEC-829 wave-29 TIER-0): the driving relation became `participant JOIN submission` precisely so the grid stops scanning the whole org contact directory, and it IS eligibility-filtered — by rosterParticipantConditions(eventId), pushed into the local `conditions` array and ANDed into `whereExpr` a few lines above, an indirection this scanner's regex does not follow (same class as files-library.ts's `headshotWhere` and public/speakers.ts's `conditions`). Not an unfiltered enumeration.",
    "getOnboardingGrid's page SELECT filters via the SAME `whereExpr` variable built from rosterParticipantConditions(eventId) — same predicate, same variable indirection; it must range over exactly the population the COUNT above totals or the pagination would disagree with its own total.",
  ],
  // The wave-64 custodian split moved these two reads out of the 837-line
  // src/server/repo/files-library.ts (now a re-export barrel with no query of
  // its own) into the two files below, predicates unchanged — so the two
  // allowances moved with them rather than being retired.
  "server/repo/files-library-query.ts": [
    "computeKindCounts' headshot-count read filters via the local `headshotWhere` variable, built from buildHeadshotWhere()'s acceptedSpeakerConditions(eventId) — same predicate, indirected through a variable this scanner's regex doesn't follow.",
  ],
  "server/repo/files-library-list.ts": [
    "fetchHeadshotRoots' headshot-list read filters via the same local `headshotWhere` variable built from acceptedSpeakerConditions(eventId) — same predicate, indirected through a variable.",
  ],
};

describe("every `.from(schema.participant)` read is eligibility-filtered or explicitly allowed (DEC-981)", () => {
  const files = listSourceFiles(SRC_ROOT);

  it("finds source files to scan (scanner sanity check)", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain(join(SRC_ROOT, "sync", "airtable.ts"));
  });

  it("src/sync/airtable.ts's participant read filters by inviteStatus", () => {
    const raw = stripComments(readFileSync(join(SRC_ROOT, "sync", "airtable.ts"), "utf8"));
    let match: RegExpExecArray | null;
    FROM_PARTICIPANT_RE.lastIndex = 0;
    let found = 0;
    while ((match = FROM_PARTICIPANT_RE.exec(raw)) !== null) {
      found++;
      const stmt = enclosingStatement(raw, match.index);
      expect(stmt).toMatch(SHARED_HELPER_RE);
    }
    expect(found).toBeGreaterThan(0);
  });

  it("every unfiltered `.from(schema.participant)` read is in the ALLOWED map with a used-up reason", () => {
    const usedAllowances = new Map<string, number>();
    const offenders: string[] = [];

    for (const file of files) {
      const relPath = relative(SRC_ROOT, file).split("\\").join("/");
      const raw = readFileSync(file, "utf8");
      const stripped = stripComments(raw);
      FROM_PARTICIPANT_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = FROM_PARTICIPANT_RE.exec(stripped)) !== null) {
        const stmt = enclosingStatement(stripped, match.index);
        if (SHARED_HELPER_RE.test(stmt)) continue;

        const reasons = ALLOWED[relPath];
        const used = usedAllowances.get(relPath) ?? 0;
        if (reasons && used < reasons.length) {
          usedAllowances.set(relPath, used + 1);
          continue;
        }

        const line = lineOf(stripped, match.index);
        offenders.push(`${relPath}:${line}: unfiltered .from(schema.participant) read, not in ALLOWED`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("every ALLOWED entry is still consumed by a real site (no stale allowances)", () => {
    const seenByFile = new Map<string, number>();
    for (const file of files) {
      const relPath = relative(SRC_ROOT, file).split("\\").join("/");
      if (!(relPath in ALLOWED)) continue;
      const raw = readFileSync(file, "utf8");
      const stripped = stripComments(raw);
      FROM_PARTICIPANT_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      let unfilteredCount = 0;
      while ((match = FROM_PARTICIPANT_RE.exec(stripped)) !== null) {
        const stmt = enclosingStatement(stripped, match.index);
        if (!SHARED_HELPER_RE.test(stmt)) unfilteredCount++;
      }
      seenByFile.set(relPath, unfilteredCount);
    }

    const stale: string[] = [];
    for (const [relPath, reasons] of Object.entries(ALLOWED)) {
      const seen = seenByFile.get(relPath) ?? 0;
      if (seen !== reasons.length) {
        stale.push(`${relPath}: ALLOWED has ${reasons.length} reason(s) but ${seen} unfiltered site(s) found`);
      }
    }
    expect(stale).toEqual([]);
  });
});
