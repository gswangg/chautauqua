// DEC-518 (wave-36 amendment): the rubric-coverage claim becomes a DERIVED,
// two-directional ledger, not sha-pinned prose. docs/verification-log/
// task-w13-g-rubric-coverage-stage1.md tables all 116 `- id:` rows of
// docs/eval-rubric/*.yaml with a file:line + test citation each, RESULT:
// PASS -- frozen at sha 0578511. Nothing re-checked it, and its own prose
// already records that src/routes/review.ts and src/server/repo/public.ts
// were decomposed under it. DEC-459 set the precedent for exactly this move
// -- replacing pinned prose with a scan that re-derives the population at
// test time (see test/route-authz-enumeration.scan.test.ts).
//
// The frozen log (docs/verification-log/task-w13-g-...) stays frozen --
// historical documents may point at moved files. What becomes executable is
// the coverage CLAIM: this file transcribes the log's file:line/test columns
// into a ledger, then asserts the ledger against a population re-derived
// from docs/eval-rubric/*.yaml at test time, in both directions.
//
// Where a transcribed path no longer resolves, it was re-located by grepping
// for the symbol the log names and recording the CURRENT path (CFP-06/ABS-12:
// src/db/schema.ts split into src/db/schema/*.ts; ABS-10: resultsSort.ts's
// sort logic now lives inline in ResultsTable.tsx; CNT-06: upload-
// validation.ts's formatAcceptedTypesMessage is now uploadHintText in
// src/domain/files.ts, consumed by UploadZone.tsx; CRM-12: StatsStrip.tsx
// was never split out -- the stats strip is inline in ContactsApp.tsx).
// CFP-S4/CFP-14 cited src/routes/comms.ts, which the wave-36 custodian pass
// decomposed into src/routes/comms/*.ts; both rows name `POST /compose/send`
// in the frozen log, which now lives in src/routes/comms/send.ts.
// SPK-01/SPK-04 cited rowFilters.ts's filterOnboardingRows, which DEC-340
// records as deliberately DELETED (not renamed) when onboarding-grid
// filtering moved server-side -- those two rows are marked `waived` naming
// DEC-340 rather than pointed at an artifact that doesn't implement the same
// pure-filter capability.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const RUBRIC_DIR = join(ROOT, "docs", "eval-rubric");

// ---------------------------------------------------------------------------
// Population -- derived at test time from docs/eval-rubric/*.yaml, never
// hardcoded. Every `- id: <ID>` line (both scenario rows like CFP-S1 and
// criterion rows like CFP-01) is a population member; criterion rows also
// carry a `weight:` on the following lines, captured for completeness.
// ---------------------------------------------------------------------------
interface DerivedId {
  id: string;
  file: string; // basename of the yaml file this id was found in
  weight: number | null;
}

const ID_LINE_RE = /^\s*-\s*id:\s*([A-Za-z]+-(?:S\d+|\d+))\s*$/;
const WEIGHT_LINE_RE = /^\s*weight:\s*(\d+)\s*$/;

function deriveIds(): DerivedId[] {
  const files = readdirSync(RUBRIC_DIR).filter((f) => f.endsWith(".yaml"));
  const out: DerivedId[] = [];
  for (const file of files) {
    const lines = readFileSync(join(RUBRIC_DIR, file), "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const m = ID_LINE_RE.exec(line);
      if (!m) continue;
      const id = m[1] as string;
      // A criterion row's `weight:` appears on one of the next few lines
      // (immediately under `criterion:`), before the next `- id:`. A
      // scenario row has no weight field at all.
      let weight: number | null = null;
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j] ?? "";
        if (ID_LINE_RE.test(next)) break;
        const wm = WEIGHT_LINE_RE.exec(next);
        if (wm) {
          weight = Number(wm[1]);
          break;
        }
      }
      out.push({ id, file, weight });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ledger -- transcribed from docs/verification-log/task-w13-g-rubric-
// coverage-stage1.md's per-area tables. Each row's `file:line` and `test`
// columns become `artifacts` (any `:<line>` or `:<line>-<line>` suffix
// stripped). Verdicts: the log's "COVERED (scenario)" rows -> "scenario";
// its "COVERED" and "PARTIAL (...meets minimum, not counted OPEN)" rows
// (EMB-03, EMB-15) -> "covered" (the log itself disposes both as non-OPEN);
// its one "WAIVED" row (ABS-14, DEC-272) -> "waived". SPK-01/SPK-04 are
// re-verdicted `waived` here (see file-header note) because their cited
// artifact no longer exists and was not renamed, per DEC-340.
// ---------------------------------------------------------------------------
interface LedgerEntry {
  id: string;
  verdict: "covered" | "scenario" | "waived";
  artifacts: string[];
  reason?: string;
}

const RUBRIC_COVERAGE: LedgerEntry[] = [
  { id: "CFP-S1", verdict: "scenario", artifacts: ["src/forms/builder.ts", "src/routes/api/events.ts", "src/routes/public/submit.tsx"] },
  { id: "CFP-S2", verdict: "scenario", artifacts: ["src/lib/draft.ts", "src/routes/portal/edit.tsx", "src/routes/public/submit.tsx"] },
  { id: "CFP-S3", verdict: "scenario", artifacts: ["src/domain/status.ts", "src/routes/review/plans.ts", "src/routes/review/reviewer.ts"] },
  { id: "CFP-S4", verdict: "scenario", artifacts: ["src/domain/acceptance.ts", "src/routes/comms/send.ts"] },
  { id: "CFP-01", verdict: "covered", artifacts: ["src/forms/builder.ts", "src/forms/validate.ts", "test/form-render-rules.test.ts", "test/forms-api.test.ts", "test/forms.test.ts"] },
  { id: "CFP-02", verdict: "covered", artifacts: ["src/forms/visibility.ts", "test/form-render-rules.test.ts"] },
  { id: "CFP-03", verdict: "covered", artifacts: ["src/routes/public/index.tsx", "src/routes/public/submit.tsx", "test/public.test.ts"] },
  { id: "CFP-04", verdict: "covered", artifacts: ["src/lib/submit-core.ts", "test/submit-core.test.ts"] },
  { id: "CFP-05", verdict: "covered", artifacts: ["src/routes/portal/index.tsx", "src/routes/public/submit.tsx", "test/portal.test.ts", "test/submit-mailer-failure.test.ts"] },
  { id: "CFP-06", verdict: "covered", artifacts: ["src/db/schema/submissions.ts", "src/routes/api/submissions.ts", "test/api-submissions.test.ts"] },
  { id: "CFP-07", verdict: "covered", artifacts: ["src/lib/draft.ts", "src/routes/public/submit.tsx", "test/submit-draft-notice.test.ts"] },
  { id: "CFP-08", verdict: "covered", artifacts: ["src/routes/public/submit.tsx", "test/dev-mailbox.test.ts", "test/submit-mailer-failure.test.ts"] },
  { id: "CFP-09", verdict: "covered", artifacts: ["src/domain/edit-lock.ts", "src/routes/portal/edit.tsx", "test/edit-lock.test.ts", "test/portal-edit-track-validation.test.ts"] },
  { id: "CFP-10", verdict: "covered", artifacts: ["src/routes/api/users.ts", "src/routes/review/reviewer.ts", "test/events-reviewer-access.test.ts", "test/users-api.test.ts"] },
  { id: "CFP-11", verdict: "covered", artifacts: ["src/domain/evaluation.ts", "src/routes/review/reviewer.ts", "test/evaluation.test.ts", "test/round-criteria.test.ts"] },
  { id: "CFP-12", verdict: "covered", artifacts: ["src/domain/status.ts", "src/routes/api/submissions.ts", "test/status-bulk-full-match.test.ts"] },
  { id: "CFP-13", verdict: "covered", artifacts: ["src/routes/portal/index.tsx", "test/portal.test.ts"] },
  { id: "CFP-14", verdict: "covered", artifacts: ["src/routes/comms/send.ts", "test/comms-send-mailer-failure.test.ts", "test/compose-full-set.test.ts", "test/compose.test.ts"] },
  { id: "CFP-15", verdict: "covered", artifacts: ["src/domain/acceptance.ts", "test/api-submissions.test.ts", "test/domain.test.ts"] },
  { id: "CFP-16", verdict: "covered", artifacts: ["src/domain/edit-lock.ts", "src/routes/portal/edit.tsx", "test/edit-lock.test.ts", "test/portal-edit-speaker-locked.test.ts"] },
  { id: "ABS-S1", verdict: "scenario", artifacts: ["src/routes/review/plans.ts"] },
  { id: "ABS-S2", verdict: "scenario", artifacts: ["src/domain/evaluation.ts"] },
  { id: "ABS-S3", verdict: "scenario", artifacts: ["src/routes/review/plans.ts", "src/routes/review/recusals.ts"] },
  { id: "ABS-01", verdict: "covered", artifacts: ["src/domain/evaluation.ts", "src/routes/review/plans.ts", "test/review-rounds.test.ts", "test/rounds.test.ts"] },
  { id: "ABS-02", verdict: "covered", artifacts: ["src/routes/review/plans.ts", "test/round-criteria.test.ts"] },
  { id: "ABS-03", verdict: "covered", artifacts: ["app/src/pages/review/scorecardLogic.test.ts", "src/domain/evaluation.ts", "src/routes/review/reviewer.ts", "test/round-criteria.test.ts"] },
  { id: "ABS-04", verdict: "covered", artifacts: ["src/domain/evaluation.ts", "test/evaluation.test.ts"] },
  { id: "ABS-05", verdict: "covered", artifacts: ["src/domain/evaluation.ts", "src/routes/review/reviewer.ts", "test/review-idor.test.ts", "test/review-queue-shape.test.ts"] },
  { id: "ABS-06", verdict: "covered", artifacts: ["src/routes/review/plans.ts", "test/round-criteria.test.ts"] },
  { id: "ABS-07", verdict: "covered", artifacts: ["src/domain/evaluation.ts", "test/round-criteria.test.ts"] },
  { id: "ABS-08", verdict: "covered", artifacts: ["app/src/pages/review/progress.test.ts", "src/routes/review/plans.ts"] },
  { id: "ABS-09", verdict: "covered", artifacts: ["src/routes/review/plans.ts", "test/review-remind-mailer-failure.test.ts"] },
  {
    id: "ABS-10",
    verdict: "covered",
    artifacts: ["app/src/pages/review/ResultsTable.render.test.tsx", "app/src/pages/review/ResultsTable.tsx", "src/routes/review/plans.ts"],
  },
  { id: "ABS-11", verdict: "covered", artifacts: ["src/routes/api/submissions.ts", "test/participant-attribution.test.ts"] },
  { id: "ABS-12", verdict: "covered", artifacts: ["src/db/schema/review.ts", "src/routes/review/recusals.ts", "src/routes/review/reviewer.ts", "test/review-recusal.test.ts"] },
  { id: "ABS-13", verdict: "covered", artifacts: ["app/src/pages/review/resultsCsv.test.ts", "app/src/pages/review/resultsCsv.ts", "src/routes/review/plans.ts"] },
  {
    id: "ABS-14",
    verdict: "waived",
    artifacts: [],
    reason: "WAIVED - DEC-272 (src/decisions.ts DEC_272); Chautauqua claims AI review nowhere and no external model API key is permitted in stage 1",
  },
  { id: "SPK-S1", verdict: "scenario", artifacts: ["app/src/pages/speakers/OnboardingGrid.tsx"] },
  { id: "SPK-S2", verdict: "scenario", artifacts: ["src/routes/api/contacts/import.ts", "src/routes/tasks.ts"] },
  { id: "SPK-S3", verdict: "scenario", artifacts: ["app/src/pages/speakers/overdue.ts", "src/routes/files.ts"] },
  {
    id: "SPK-01",
    verdict: "waived",
    artifacts: [],
    reason:
      "WAIVED - DEC-340: rowFilters.ts's filterOnboardingRows was deleted client-side when DEC-340 moved onboarding-grid filtering server-side into getOnboardingGrid(db, eventId, params) in src/server/repo/tasks.ts; no surviving client-side pure-filter artifact to cite",
  },
  { id: "SPK-02", verdict: "covered", artifacts: ["src/routes/api/contacts/crud.ts", "test/contacts-profile-admin.test.ts", "test/contacts.test.ts"] },
  { id: "SPK-03", verdict: "covered", artifacts: ["app/src/pages/contacts/csv.test.ts", "app/src/pages/contacts/csv.ts", "src/routes/api/contacts/import.ts", "test/contacts-import.test.ts"] },
  {
    id: "SPK-04",
    verdict: "waived",
    artifacts: [],
    reason:
      "WAIVED - DEC-340: rowFilters.ts's filterOnboardingRows was deleted client-side when DEC-340 moved onboarding-grid filtering server-side into getOnboardingGrid(db, eventId, params) in src/server/repo/tasks.ts; no surviving client-side pure-filter artifact to cite",
  },
  { id: "SPK-05", verdict: "covered", artifacts: ["src/routes/tasks.ts", "src/server/repo/tasks.ts", "test/task-assignment-kind-gates.test.ts", "test/tasks-assign-org-scope.test.ts"] },
  { id: "SPK-06", verdict: "covered", artifacts: ["src/routes/portal/index.tsx", "test/portal-signout.test.ts"] },
  { id: "SPK-07", verdict: "covered", artifacts: ["src/routes/portal/index.tsx", "test/portal.test.ts"] },
  { id: "SPK-08", verdict: "covered", artifacts: ["src/routes/portal/profile.tsx", "test/headshot-gate.test.ts", "test/profile.test.ts"] },
  { id: "SPK-09", verdict: "covered", artifacts: ["src/routes/portal/tasks.tsx", "test/portal-tasks.test.ts"] },
  { id: "SPK-10", verdict: "covered", artifacts: ["src/routes/files.ts", "test/files-library.test.ts", "test/files.test.ts"] },
  { id: "SPK-11", verdict: "covered", artifacts: ["src/routes/api/submissions.ts", "src/routes/portal/index.tsx", "test/api-participants.test.ts"] },
  { id: "SPK-12", verdict: "covered", artifacts: ["app/src/pages/speakers/overdue.test.ts", "app/src/pages/speakers/overdue.ts"] },
  { id: "SPK-13", verdict: "covered", artifacts: ["src/routes/api/contacts/bulk-email.ts", "test/contacts-bulk-email-mailer-failure.test.ts", "test/contacts-bulk-email-preview-route.test.ts"] },
  { id: "SPK-14", verdict: "covered", artifacts: ["src/mail/render.ts", "test/compose.test.ts", "test/mail.test.ts"] },
  { id: "SPK-15", verdict: "covered", artifacts: ["app/src/pages/contacts/customFields.test.ts", "app/src/pages/contacts/customFields.ts", "src/routes/api/contacts/crud.ts", "test/contacts-profile-admin.test.ts"] },
  { id: "SPK-16", verdict: "covered", artifacts: ["src/domain/reminders.ts", "src/server/scheduled.ts", "test/reminders.test.ts", "test/tasks-due-reminders.test.ts"] },
  { id: "CNT-S1", verdict: "scenario", artifacts: ["src/routes/portal/tasks.tsx", "src/routes/tasks.ts"] },
  { id: "CNT-S2", verdict: "scenario", artifacts: ["app/src/pages/content/version-chain.ts", "src/routes/files.ts"] },
  { id: "CNT-S3", verdict: "scenario", artifacts: ["src/lib/zip.ts", "src/routes/api/submissions.ts"] },
  { id: "CNT-01", verdict: "covered", artifacts: ["src/routes/tasks.ts", "test/acceptance-form-tasks.test.ts"] },
  { id: "CNT-02", verdict: "covered", artifacts: ["src/routes/portal/tasks.tsx", "test/portal-tasks.test.ts", "test/task-upload-content.test.ts"] },
  { id: "CNT-03", verdict: "covered", artifacts: ["test/reviewer-file-access.test.ts", "test/task-file-access.test.ts"] },
  { id: "CNT-04", verdict: "covered", artifacts: ["app/src/pages/content/version-chain.test.ts", "app/src/pages/content/version-chain.ts"] },
  { id: "CNT-05", verdict: "covered", artifacts: ["src/routes/files.ts", "test/files.test.ts"] },
  {
    id: "CNT-06",
    verdict: "covered",
    artifacts: ["app/src/pages/content/UploadZone.render.test.tsx", "app/src/pages/content/UploadZone.tsx", "src/domain/files.ts", "test/files.test.ts"],
  },
  { id: "CNT-07", verdict: "covered", artifacts: ["app/src/pages/content/worklist.test.ts", "app/src/pages/content/worklist.ts"] },
  { id: "CNT-08", verdict: "covered", artifacts: ["src/routes/tasks.ts", "test/tasks-due-reminders-mailer-failure.test.ts"] },
  { id: "CNT-09", verdict: "covered", artifacts: ["src/routes/api/submissions.ts", "test/api-submissions.test.ts"] },
  { id: "CNT-10", verdict: "covered", artifacts: ["src/routes/api/contacts/crud.ts", "test/contacts-profile-admin.test.ts"] },
  { id: "CNT-11", verdict: "covered", artifacts: ["src/routes/api/submissions.ts", "src/server/repo/revisions.ts", "test/submission-revisions.test.ts"] },
  { id: "CNT-12", verdict: "covered", artifacts: ["src/routes/files.ts", "src/server/repo/public/gates.ts", "test/files.test.ts", "test/public.test.ts"] },
  { id: "CNT-13", verdict: "covered", artifacts: ["app/src/pages/content/FilesLibrary.render.test.tsx", "app/src/pages/content/FilesLibrary.tsx", "src/routes/files.ts"] },
  { id: "CNT-14", verdict: "covered", artifacts: ["src/lib/zip.ts", "src/routes/files.ts", "test/files-archive-route.test.ts", "test/zip.test.ts"] },
  { id: "AIA-S1", verdict: "scenario", artifacts: ["app/src/pages/Agenda.tsx", "src/domain/schedule.ts"] },
  { id: "AIA-S2", verdict: "scenario", artifacts: ["src/routes/agenda.ts"] },
  { id: "AIA-01", verdict: "covered", artifacts: ["app/src/pages/Agenda.tsx", "app/src/pages/agenda/Agenda.render.test.tsx", "app/src/pages/agenda/DayGrid.tsx", "app/src/pages/agenda/state.test.ts"] },
  { id: "AIA-02", verdict: "covered", artifacts: ["src/routes/api/events.ts", "test/events-api.test.ts"] },
  { id: "AIA-03", verdict: "covered", artifacts: ["src/routes/agenda.ts", "test/agenda-repo.test.ts"] },
  { id: "AIA-04", verdict: "covered", artifacts: ["src/domain/schedule.ts", "test/overlap-lanes.test.ts"] },
  { id: "AIA-05", verdict: "covered", artifacts: ["src/domain/schedule.ts", "test/agenda-room-ownership.test.ts", "test/overlap-lanes.test.ts"] },
  { id: "AIA-06", verdict: "covered", artifacts: ["src/routes/agenda.ts", "test/agenda-repo.test.ts"] },
  { id: "AIA-07", verdict: "covered", artifacts: ["src/routes/agenda.ts", "test/agenda-publish.test.ts"] },
  { id: "AIA-08", verdict: "covered", artifacts: ["src/routes/agenda.ts", "test/agenda-repo.test.ts"] },
  { id: "EMB-S1", verdict: "scenario", artifacts: ["src/routes/public/sessions.tsx", "src/routes/public/speakers.tsx"] },
  { id: "EMB-S2", verdict: "scenario", artifacts: ["src/routes/public/agenda.tsx"] },
  { id: "EMB-S3", verdict: "scenario", artifacts: ["app/src/pages/settings/EmbedsPanel.tsx"] },
  { id: "EMB-01", verdict: "covered", artifacts: ["src/routes/public/cards.tsx", "src/routes/public/sessions.tsx", "test/public.test.ts"] },
  { id: "EMB-02", verdict: "covered", artifacts: ["src/routes/public/sessions.tsx", "test/public.test.ts"] },
  { id: "EMB-03", verdict: "covered", artifacts: ["src/routes/public/query.ts", "src/routes/public/sessions.tsx", "test/public.test.ts"] },
  { id: "EMB-04", verdict: "covered", artifacts: ["src/routes/public/speakers.tsx", "src/server/repo/public/speakers.ts", "test/public.test.ts"] },
  { id: "EMB-05", verdict: "covered", artifacts: ["src/routes/public/detail.tsx", "src/server/repo/public/speakers.ts", "test/public.test.ts"] },
  { id: "EMB-06", verdict: "covered", artifacts: ["src/routes/public/agenda.tsx", "test/public.test.ts"] },
  { id: "EMB-07", verdict: "covered", artifacts: ["src/routes/public/agenda.tsx", "src/routes/public/dispatch.tsx", "test/public.test.ts"] },
  { id: "EMB-08", verdict: "covered", artifacts: ["src/routes/public/detail.tsx", "src/routes/public/shell.tsx", "test/public.test.ts"] },
  { id: "EMB-09", verdict: "covered", artifacts: ["src/routes/public/agenda.tsx", "test/itinerary-roundtrip.test.ts"] },
  { id: "EMB-10", verdict: "covered", artifacts: ["src/routes/public/agenda.tsx", "test/itinerary-roundtrip.test.ts"] },
  { id: "EMB-11", verdict: "covered", artifacts: ["test/ics-download.test.ts", "test/itinerary-roundtrip.test.ts"] },
  { id: "EMB-12", verdict: "covered", artifacts: ["src/routes/public/dispatch.tsx", "test/public.test.ts"] },
  { id: "EMB-13", verdict: "covered", artifacts: ["test/public.test.ts"] },
  { id: "EMB-14", verdict: "covered", artifacts: ["test/public-invite-visibility.test.ts", "test/public.test.ts"] },
  { id: "EMB-15", verdict: "covered", artifacts: ["app/src/pages/settings/EmbedsPanel.tsx", "app/src/pages/settings/embedSnippet.test.ts", "app/src/pages/settings/embedSnippet.ts"] },
  { id: "EMB-16", verdict: "covered", artifacts: ["src/server/pubcache.ts", "test/pubcache.test.ts"] },
  { id: "CRM-S1", verdict: "scenario", artifacts: ["src/routes/api/contacts/crud.ts"] },
  { id: "CRM-S2", verdict: "scenario", artifacts: ["src/routes/api/pipeline.ts"] },
  { id: "CRM-01", verdict: "covered", artifacts: ["src/routes/api/contacts/crud.ts", "test/contacts-repo.test.ts", "test/contacts.test.ts"] },
  { id: "CRM-02", verdict: "covered", artifacts: ["app/src/pages/contacts/FilterRulesPanel.tsx", "src/domain/contacts.ts", "test/contacts-rules-param.test.ts"] },
  { id: "CRM-03", verdict: "covered", artifacts: ["src/routes/api/contacts/crud.ts", "test/contact-profile-roundtrip.test.ts"] },
  { id: "CRM-04", verdict: "covered", artifacts: ["src/routes/api/contacts/crud.ts", "test/contacts-profile-admin.test.ts"] },
  { id: "CRM-05", verdict: "covered", artifacts: ["src/routes/api/contacts/import.ts", "test/contacts-import.test.ts"] },
  { id: "CRM-06", verdict: "covered", artifacts: ["src/routes/api/contacts/merge.ts", "src/server/repo/contacts/query.ts", "test/contacts-duplicates-merge-route.test.ts"] },
  { id: "CRM-07", verdict: "covered", artifacts: ["src/routes/api/pipeline.ts", "test/pipeline-api.test.ts"] },
  { id: "CRM-08", verdict: "covered", artifacts: ["src/routes/api/pipeline.ts", "test/pipeline-api.test.ts"] },
  { id: "CRM-09", verdict: "covered", artifacts: ["app/src/pages/contacts/segments.test.ts", "src/routes/api/contacts/segments.ts"] },
  { id: "CRM-10", verdict: "covered", artifacts: ["src/routes/api/contacts/crud.ts", "test/contacts-add-to-event.test.ts"] },
  { id: "CRM-11", verdict: "covered", artifacts: ["src/routes/api/contacts/bulk-email.ts", "test/contacts-bulk-email-preview-route.test.ts"] },
  {
    id: "CRM-12",
    verdict: "covered",
    artifacts: ["app/src/pages/contacts/ContactsApp.render.test.tsx", "app/src/pages/contacts/ContactsApp.tsx", "src/routes/api/contacts/crud.ts", "test/contacts-repo.test.ts"],
  },
];

// Roots an artifact path must be rooted at to be checked for existence.
const ARTIFACT_ROOTS = ["src/", "app/src/", "test/", "scripts/", "migrations/"];

function isCheckableArtifact(a: string): boolean {
  return ARTIFACT_ROOTS.some((root) => a.startsWith(root));
}

/** Strips a trailing `:<line>` or `:<line>-<line>` suffix from a path. */
function stripLineSuffix(a: string): string {
  return a.replace(/:\d+(-\d+)?$/, "");
}

const DEC_ID_RE = /DEC-\d{3}/;

/** Pure, exported classifier: given the derived population and the ledger,
 * returns the list of problems found -- named ids/paths, never just a count,
 * so failures are actionable. Both directions are asserted here (every
 * derived id has exactly one ledger row; every ledger row names a live
 * derived id), plus artifact existence and the waiver-naming-a-DEC rule.
 * Exported so the negative-control unit tests below can feed it synthetic
 * violations directly. */
export function findRubricCoverageProblems(derivedIds: DerivedId[], ledger: LedgerEntry[]): string[] {
  const problems: string[] = [];
  const derivedIdSet = new Map<string, DerivedId>();
  for (const d of derivedIds) {
    if (derivedIdSet.has(d.id)) {
      problems.push(`duplicate derived id (broken population, not a ledger issue): ${d.id}`);
      continue;
    }
    derivedIdSet.set(d.id, d);
  }

  const ledgerIdCounts = new Map<string, number>();
  for (const entry of ledger) {
    ledgerIdCounts.set(entry.id, (ledgerIdCounts.get(entry.id) ?? 0) + 1);
  }

  // (1) every derived id has exactly one ledger row
  for (const d of derivedIds) {
    const count = ledgerIdCounts.get(d.id) ?? 0;
    if (count === 0) problems.push(`derived id with no ledger row: ${d.id}`);
    else if (count > 1) problems.push(`derived id with ${count} ledger rows (must be exactly 1): ${d.id}`);
  }

  // (2) every ledger row names a live derived id (no stale rows)
  for (const entry of ledger) {
    if (!derivedIdSet.has(entry.id)) problems.push(`stale ledger row citing a non-existent id: ${entry.id}`);
  }

  // (3) every artifact path rooted at a checkable root exists on disk
  for (const entry of ledger) {
    for (const raw of entry.artifacts) {
      const p = stripLineSuffix(raw);
      if (!isCheckableArtifact(p)) continue;
      if (!existsSync(join(ROOT, p))) {
        problems.push(`ledger row ${entry.id} cites a nonexistent artifact: ${p}`);
      }
    }
  }

  // (4) a `waived` verdict must name a DEC id in its reason
  const waivedRows = ledger.filter((e) => e.verdict === "waived");
  for (const entry of waivedRows) {
    if (!entry.reason || !DEC_ID_RE.test(entry.reason)) {
      problems.push(`waived ledger row ${entry.id} names no DEC id (/DEC-\\d{3}/) in its reason`);
    }
  }
  if (waivedRows.length > 5) {
    problems.push(`too many waived rows: ${waivedRows.length} (max 5) -- ${waivedRows.map((e) => e.id).join(", ")}`);
  }

  return problems;
}

describe("rubric-coverage-enumeration.scan (DEC-518 wave-36 amendment)", () => {
  const derivedIds = deriveIds();

  it("tripwire: derived id population re-derives to at least 116, never hardcoded", () => {
    expect(derivedIds.length).toBeGreaterThanOrEqual(116);
  });

  it("tripwire: per-file counts are re-derived from the yaml, not hardcoded (sum equals total)", () => {
    const perFile = new Map<string, number>();
    for (const d of derivedIds) perFile.set(d.file, (perFile.get(d.file) ?? 0) + 1);
    const sum = [...perFile.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(derivedIds.length);
    // Every one of the 7 rubric files contributes at least one row -- a
    // silently-empty file would mean the walk or the id regex broke.
    const files = readdirSync(RUBRIC_DIR).filter((f) => f.endsWith(".yaml"));
    expect(perFile.size).toBe(files.length);
    for (const f of files) {
      expect(perFile.get(f) ?? 0, `${f} contributed 0 ids -- population regex likely broken`).toBeGreaterThan(0);
    }
  });

  it("every derived id has exactly one ledger row, and every ledger row names a live derived id", () => {
    const problems = findRubricCoverageProblems(derivedIds, RUBRIC_COVERAGE).filter(
      (p) => p.includes("no ledger row") || p.includes("ledger rows (must be exactly 1)") || p.includes("stale ledger row") || p.includes("duplicate derived id"),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every ledger artifact rooted at src/, app/src/, test/, scripts/ or migrations/ exists on disk", () => {
    const problems = findRubricCoverageProblems(derivedIds, RUBRIC_COVERAGE).filter((p) => p.includes("nonexistent artifact"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every waived row names a DEC id in its reason, and waived rows number <= 5", () => {
    const problems = findRubricCoverageProblems(derivedIds, RUBRIC_COVERAGE).filter((p) => p.includes("names no DEC id") || p.includes("too many waived rows"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("no problems at all -- the ledger is exact in both directions against the current tree", () => {
    const problems = findRubricCoverageProblems(derivedIds, RUBRIC_COVERAGE);
    expect(problems, problems.join("\n")).toEqual([]);
  });
});

describe("findRubricCoverageProblems negative controls (DEC-518 wave-35 amendment: every scan ships one)", () => {
  const baseIds: DerivedId[] = [{ id: "ZZZ-01", file: "synthetic.yaml", weight: 1 }];
  const baseLedger: LedgerEntry[] = [{ id: "ZZZ-01", verdict: "covered", artifacts: ["src/decisions.ts"] }];

  it("compliant ledger against its matching population reports nothing (proves the scan can pass)", () => {
    expect(findRubricCoverageProblems(baseIds, baseLedger)).toEqual([]);
  });

  it("a ledger row citing a nonexistent artifact IS reported (proves the scan can fail, direction: artifact existence)", () => {
    const badLedger: LedgerEntry[] = [{ id: "ZZZ-01", verdict: "covered", artifacts: ["src/does-not-exist.ts"] }];
    const problems = findRubricCoverageProblems(baseIds, badLedger);
    expect(problems.some((p) => p.includes("src/does-not-exist.ts"))).toBe(true);
  });

  it("a derived id with no ledger row IS reported (proves the scan can fail, direction: population -> ledger)", () => {
    const idsWithExtra: DerivedId[] = [...baseIds, { id: "ZZZ-99-UNLEDGERED", file: "synthetic.yaml", weight: 1 }];
    const problems = findRubricCoverageProblems(idsWithExtra, baseLedger);
    expect(problems.some((p) => p.includes("ZZZ-99-UNLEDGERED"))).toBe(true);
  });

  it("a stale ledger row citing a dead id IS reported (direction: ledger -> population)", () => {
    const staleLedger: LedgerEntry[] = [...baseLedger, { id: "ZZZ-DEAD", verdict: "covered", artifacts: [] }];
    const problems = findRubricCoverageProblems(baseIds, staleLedger);
    expect(problems.some((p) => p.includes("ZZZ-DEAD"))).toBe(true);
  });

  it("a waived row with no DEC id in its reason IS reported", () => {
    const badWaiver: LedgerEntry[] = [{ id: "ZZZ-01", verdict: "waived", artifacts: [], reason: "no governing decision named here" }];
    const problems = findRubricCoverageProblems(baseIds, badWaiver);
    expect(problems.some((p) => p.includes("names no DEC id"))).toBe(true);
  });

  it("a waived row naming a DEC id in its reason is accepted", () => {
    const goodWaiver: LedgerEntry[] = [{ id: "ZZZ-01", verdict: "waived", artifacts: [], reason: "WAIVED - DEC-999" }];
    expect(findRubricCoverageProblems(baseIds, goodWaiver)).toEqual([]);
  });

  it("more than 5 waived rows IS reported", () => {
    const manyIds: DerivedId[] = Array.from({ length: 6 }, (_, i) => ({ id: `ZZZ-W${i}`, file: "synthetic.yaml", weight: null }));
    const manyWaived: LedgerEntry[] = manyIds.map((d) => ({ id: d.id, verdict: "waived" as const, artifacts: [], reason: "WAIVED - DEC-001" }));
    const problems = findRubricCoverageProblems(manyIds, manyWaived);
    expect(problems.some((p) => p.includes("too many waived rows"))).toBe(true);
  });

  it("an artifact path NOT rooted at a checkable root (e.g. a bare prose fragment) is never existence-checked", () => {
    const ledgerWithProse: LedgerEntry[] = [{ id: "ZZZ-01", verdict: "scenario", artifacts: ["walkthrough battery", "docs/some-other-doc.md"] }];
    // Neither artifact is rooted at src/, app/src/, test/, scripts/, or
    // migrations/, so neither is existence-checked -- this must NOT report.
    expect(findRubricCoverageProblems(baseIds, ledgerWithProse)).toEqual([]);
  });

  it("a :<line> suffix is stripped before the existence check", () => {
    const ledgerWithLine: LedgerEntry[] = [{ id: "ZZZ-01", verdict: "covered", artifacts: ["src/decisions.ts:1", "src/decisions.ts:1-5"] }];
    expect(findRubricCoverageProblems(baseIds, ledgerWithLine)).toEqual([]);
  });
});
