// Perf harness seed (DEC-034): mirrors scripts/seed.ts's write-SQL-file
// approach — emits .perf-seed.sql, applied via
// `wrangler d1 execute chautauqua --local --file=.perf-seed.sql` (see the
// perf:seed npm script). Reuses scripts/seed-lib.ts's seedId/insertStmt
// helpers (import only — seed-lib.ts and seed.ts are owned by an in-flight
// task and are never edited here) under a distinct 'seed_perf_' id
// namespace so this never touches the demo seed's rows.
//
// Idempotent: deletes only seed_perf_-prefixed rows (and the fixed
// seed_perf_event row) first, children before parents — never a blanket
// DELETE FROM, which would also wipe `npm run seed`'s demo data.
//
// This is scripts/ tooling, not src/ pure-core (DEC-002 scopes the
// pure-core rule to src/{auth,domain,forms,mail,lib}), so node: imports are
// fine here, same as seed.ts.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { hashPassword } from "../src/auth/password";
import { insertStmt, seedId } from "./seed-lib";
import {
  PERF_CO_SPEAKERS_PER_ACCEPTED,
  PERF_EMAIL_LOG_COUNT,
  PERF_EVALUATION_COUNT,
  PERF_ORG_USER_COUNT,
  PERF_PIPELINE_ENTRY_COUNT,
  PERF_PIPELINE_STAGES,
  PERF_PROFILES,
  PERF_SPEAKER_CONTACT_ID,
  PERF_SPEAKER_EMAIL,
  PERF_SPEAKER_PASSWORD,
  PERF_SPEAKER_USER_ID,
  PERF_TASK_COUNT,
  PERF_TASKS,
  contactIndexForSubmission,
  contactsPerTask,
  coSpeakerContactIndexesForAccepted,
  isDeliberatelyOverdueAssignment,
  isPerfSpeakerTaskAssignmentComplete,
  isTaskAssignmentComplete,
  overdueAssignmentCount,
  perfFileSpecs,
  perfOrgUserEmail,
  perfOrgUserRole,
  perfPlanId,
  perfReviewerEmail,
  perfSpeakerAcceptedIndexes,
  perfSpeakerParticipantId,
  perfSpeakerTaskAssignmentId,
  perfSubmissionStatuses,
  pipelineStageIndexForEntry,
  sentAtForEmailLogRow,
  slotPlacementForAcceptedWithConflicts,
  topicForSubmission,
  trackIndexForSubmission,
} from "./perf-seed-lib";

/** `--profile=<name>` (default: 'default'); fails loudly on an unknown name
 * rather than silently falling back — DEC-619. */
function resolveProfileName(argv: string[]): keyof typeof PERF_PROFILES {
  const flag = argv.find((a) => a.startsWith("--profile="));
  const name = flag ? flag.slice("--profile=".length) : "default";
  if (!(name in PERF_PROFILES)) {
    throw new Error(`Unknown perf profile '${name}'. Known profiles: ${Object.keys(PERF_PROFILES).join(", ")}`);
  }
  return name as keyof typeof PERF_PROFILES;
}

const PROFILE = PERF_PROFILES[resolveProfileName(process.argv.slice(2))];
const PERF_EVENT_ID = PROFILE.eventId;
const PERF_EVENT_SLUG = PROFILE.eventSlug;
const PERF_SUBMISSION_COUNT = PROFILE.submissionCount;
const PERF_CONTACT_COUNT = PROFILE.contactCount;
const PERF_TRACK_COUNT = PROFILE.trackCount;
const PERF_ANSWERS_PER_SUBMISSION = PROFILE.answersPerSubmission;
// DEC-645: agenda/review/onboarding volumes, threaded per-profile.
const PERF_ROOM_COUNT = PROFILE.roomCount;
const PERF_DAY_COUNT = PROFILE.dayCount;
const PERF_REVIEWER_COUNT = PROFILE.reviewerCount;
const PERF_PLAN_COUNT = PROFILE.planCount;
const PERF_REVIEWER_PASSWORD = PROFILE.reviewerPassword;
const PERF_TASK_ASSIGNMENT_TOTAL = PROFILE.taskCount;
const PERF_OVERDUE_TASK_FRACTION = PROFILE.overdueTaskFraction;
const PERF_DELIBERATE_CONFLICT_COUNT = PROFILE.deliberateConflictCount;

/** Every plan id this profile seeds (planIndex 1..planCount), so the
 * idempotent-delete prologue and the plan/plan_reviewer/evaluation blocks
 * below share one source of truth. */
const PROFILE_PLAN_IDS = Array.from({ length: PERF_PLAN_COUNT }, (_, i) => perfPlanId(PROFILE.planId, i + 1));
const PERF_PLAN_ID = PROFILE_PLAN_IDS[0]!;

// Every plan id across *every* profile (not just the selected one) — the
// idempotent DELETE prologue below must clean both profiles' plan-scoped
// rows so switching --profile= between runs never orphans rows (DEC-645).
const ALL_PROFILE_PLAN_IDS = Object.values(PERF_PROFILES).flatMap((p) =>
  Array.from({ length: p.planCount }, (_, i) => perfPlanId(p.planId, i + 1)),
);

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const OUTPUT_PATH = join(REPO_ROOT, ".perf-seed.sql");

// Same fixed org id scripts/seed.ts assigns its one seeded org (seedId is a
// pure, deterministic function of ('org', 1) — reusing it here, rather than
// hardcoding the string, keeps the two scripts from silently drifting).
const ORG_ID = seedId("org", 1);

const TRACK_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#059669", "#ea580c"];

// DEC-591 scopes the "seed has ONE clock" fix to scripts/seed.ts (the actual
// dev-seed script); this is a separate perf-fixture generator with its own
// fixed anchor, out of that task's scope — left as an absolute date here.
const BASE_TS = Date.UTC(2027, 0, 1, 0, 0, 0);
const MINUTE_MS = 60_000;

async function main(): Promise<void> {
  const statements: string[] = [];
  let ts = BASE_TS;
  const nextTs = (): number => {
    ts += MINUTE_MS;
    return ts;
  };

  // --- idempotent delete, children before parents; never a blanket
  // DELETE FROM (that would also wipe the demo seed's rows in these
  // shared tables) --- DEC-088 extends this with schedule/plan/reviewer
  // rows, also children-before-parents. Event-scoped deletes cover every
  // profile's event id (not just the one currently selected), so switching
  // `--profile=` between runs still cleans up the previously-seeded
  // profile's event-scoped rows instead of leaving them orphaned.
  const allPerfEventIds = Object.values(PERF_PROFILES).map((p) => `'${p.eventId}'`).join(", ");
  const allPerfPlanIdsSql = ALL_PROFILE_PLAN_IDS.map((id) => `'${id}'`).join(", ");
  statements.push(`DELETE FROM evaluation WHERE plan_id IN (${allPerfPlanIdsSql});`);
  statements.push(`DELETE FROM plan_reviewer WHERE plan_id IN (${allPerfPlanIdsSql});`);
  statements.push(`DELETE FROM evaluation_plan WHERE id IN (${allPerfPlanIdsSql});`);
  statements.push(`DELETE FROM schedule_slot WHERE submission_id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM room WHERE event_id IN (${allPerfEventIds});`);
  // DEC-347: file rows (deliverable chains) before their submission parents —
  // scoped by the seed_perf_ id namespace, never a blanket DELETE FROM.
  statements.push(`DELETE FROM file WHERE id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM submission_answer WHERE submission_id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM submission_track WHERE submission_id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM participant WHERE submission_id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM submission WHERE event_id IN (${allPerfEventIds});`);
  statements.push(`DELETE FROM track WHERE event_id IN (${allPerfEventIds});`);
  // DEC-338: task_assignment (children) before task (parent), email_log is
  // its own leaf table — both scoped to the perf id namespace/event.
  statements.push(`DELETE FROM task_assignment WHERE task_id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM task WHERE event_id IN (${allPerfEventIds});`);
  statements.push(`DELETE FROM email_log WHERE event_id IN (${allPerfEventIds});`);
  // DEC-469: pipeline_activity (child) before pipeline_entry (parent),
  // both before contact (pipeline_entry.contact_id references it) — scoped
  // by the same seed_perf_ id namespace.
  statements.push(`DELETE FROM pipeline_activity WHERE entry_id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM pipeline_entry WHERE id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM contact WHERE id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM event WHERE id IN (${allPerfEventIds});`);
  statements.push(`DELETE FROM user WHERE id LIKE 'seed_perf_%';`);

  // --- event ---
  statements.push(
    insertStmt("event", {
      id: PERF_EVENT_ID,
      org_id: ORG_ID,
      name: "Perf Harness Event",
      slug: PERF_EVENT_SLUG,
      start_date: "2028-06-01",
      end_date: "2028-06-03",
      location: "Perf Test Venue",
      timezone: "America/Los_Angeles",
      record_prefix: "PERF",
      branding_json: null,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // --- 8 tracks ---
  const trackIds: string[] = [];
  for (let i = 0; i < PERF_TRACK_COUNT; i++) {
    const trackId = seedId("perf_track", i + 1);
    trackIds.push(trackId);
    statements.push(
      insertStmt("track", {
        id: trackId,
        event_id: PERF_EVENT_ID,
        name: `Perf Track ${i + 1}`,
        color: TRACK_COLORS[i % TRACK_COLORS.length]!,
        position: i,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }

  // --- 800 contacts ---
  const contactIds: string[] = [];
  for (let i = 0; i < PERF_CONTACT_COUNT; i++) {
    const contactId = seedId("perf_contact", i + 1);
    contactIds.push(contactId);
    statements.push(
      insertStmt("contact", {
        id: contactId,
        org_id: ORG_ID,
        first_name: `Perf${i + 1}`,
        last_name: `Contact${i + 1}`,
        email: `perf.contact.${i + 1}@example-perf.test`,
        phone: null,
        company: "Perf Test Co",
        title: "Speaker",
        bio: null,
        headshot_url: null,
        social_links_json: null,
        notes: null,
        custom_fields_json: null,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }

  // --- 2,000 submissions, each with a speaker participant, one primary
  // track (via submission_track — never the frozen submission.track_id
  // column, per DEC-015/DEC-017), and 3 custom-field answers ---
  const statuses = perfSubmissionStatuses(PERF_SUBMISSION_COUNT, PROFILE.statusCounts);
  let answerCounter = 0;
  const submissionIds: string[] = [];
  const acceptedSubmissionIds: string[] = [];
  // Parallel to acceptedSubmissionIds — DEC-347's file chains need the
  // uploader contact for each accepted submission.
  const acceptedContactIds: string[] = [];
  for (let i = 0; i < PERF_SUBMISSION_COUNT; i++) {
    const submissionId = seedId("perf_submission", i + 1);
    submissionIds.push(submissionId);
    const status = statuses[i]!;
    const isAccepted = status === "accepted";
    const contactId = contactIds[contactIndexForSubmission(i, PERF_CONTACT_COUNT)]!;
    if (isAccepted) {
      acceptedSubmissionIds.push(submissionId);
      acceptedContactIds.push(contactId);
    }
    const trackId = trackIds[trackIndexForSubmission(i, PERF_TRACK_COUNT)]!;
    const topic = topicForSubmission(i);

    statements.push(
      insertStmt("submission", {
        id: submissionId,
        event_id: PERF_EVENT_ID,
        form_id: null,
        seq: i + 1,
        title: `${topic}: Perf Submission ${i + 1}`,
        description: `Synthetic perf-harness submission #${i + 1} on ${topic}, generated for local scale testing (2k rows, DEC-034).`,
        track_id: null,
        additional_track_ids_json: null,
        status,
        content_status: isAccepted ? "approved" : "pending",
        accepted_at: isAccepted ? nextTs() : null,
        ics_sequence: 0,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );

    statements.push(
      insertStmt("participant", {
        id: seedId("perf_participant", i + 1),
        submission_id: submissionId,
        contact_id: contactId,
        role: "speaker",
        order: 0,
        visible: true,
        invite_status: isAccepted ? "accepted" : "none",
        created_at: nextTs(),
        updated_at: ts,
      }),
    );

    // --- DEC-495: co-speaker participants for accepted submissions, so the
    // public speakers list fills SPEC.md's 800-speaker top end rather than
    // stalling around the 300 primary-speaker contacts alone.
    if (isAccepted) {
      const acceptedIndex = acceptedSubmissionIds.length - 1; // j, 0-based
      const coSpeakerIndexes = coSpeakerContactIndexesForAccepted(acceptedIndex);
      coSpeakerIndexes.forEach((contactIndex, k) => {
        statements.push(
          insertStmt("participant", {
            id: seedId("perf_cospeaker", acceptedIndex * PERF_CO_SPEAKERS_PER_ACCEPTED + k + 1),
            submission_id: submissionId,
            contact_id: contactIds[contactIndex]!,
            role: "speaker",
            order: k + 1,
            visible: true,
            invite_status: "accepted",
            created_at: nextTs(),
            updated_at: ts,
          }),
        );
      });
    }

    statements.push(
      insertStmt("submission_track", {
        submission_id: submissionId,
        track_id: trackId,
        created_at: nextTs(),
      }),
    );

    for (let a = 0; a < PERF_ANSWERS_PER_SUBMISSION; a++) {
      answerCounter += 1;
      statements.push(
        insertStmt("submission_answer", {
          id: seedId("perf_answer", answerCounter),
          submission_id: submissionId,
          form_field_id: `perf_custom_field_${a + 1}`,
          value_json: JSON.stringify(`Perf custom answer ${a + 1} for submission ${i + 1}`),
          created_at: nextTs(),
          updated_at: ts,
        }),
      );
    }
  }

  // --- PERF_ROOM_COUNT rooms (DEC-088; DEC-645 threads room count per-profile) ---
  const roomIds: string[] = [];
  for (let i = 0; i < PERF_ROOM_COUNT; i++) {
    const roomId = seedId("perf_room", i + 1);
    roomIds.push(roomId);
    statements.push(
      insertStmt("room", {
        id: roomId,
        event_id: PERF_EVENT_ID,
        name: `Perf Room ${i + 1}`,
        capacity: 100,
        position: i,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }

  // --- schedule_slot for every accepted submission (already content_status
  // approved + participant visible, so they are publicly visible). DEC-645:
  // the first PERF_DELIBERATE_CONFLICT_COUNT (j, j-1) pairs are deliberately
  // overlapped (see slotPlacementForAcceptedWithConflicts) — 0 for the
  // `default` profile, so this is bit-for-bit unchanged there. ---
  for (let j = 0; j < acceptedSubmissionIds.length; j++) {
    const submissionId = acceptedSubmissionIds[j]!;
    const placement = slotPlacementForAcceptedWithConflicts(
      j,
      PERF_ROOM_COUNT,
      PERF_DAY_COUNT,
      acceptedSubmissionIds.length,
      PERF_DELIBERATE_CONFLICT_COUNT,
    );
    const roomId = roomIds[placement.roomIndex]!;
    statements.push(
      insertStmt("schedule_slot", {
        id: seedId("perf_slot", j + 1),
        submission_id: submissionId,
        room_id: roomId,
        day: placement.day,
        start_min: placement.startMin,
        end_min: placement.endMin,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }

  // --- DEC-347: deliverable file chains for the files library, one
  // presentation (3 versions) + one handout (1 version) per accepted
  // submission — 300 * 4 = 1,200 rows, ids via perfFileSpecs (pure,
  // index-derived) + seedId('perf_file', n) ---
  for (const spec of perfFileSpecs(acceptedSubmissionIds.length)) {
    const submissionId = acceptedSubmissionIds[spec.acceptedIndex]!;
    const contactId = acceptedContactIds[spec.acceptedIndex]!;
    const fileId = seedId("perf_file", spec.n);
    const previousFileId = spec.previousN === null ? null : seedId("perf_file", spec.previousN);
    const filename = `${spec.kind}-v${spec.versionIndex + 1}.pdf`;
    const r2Key = `sub/${submissionId}/${fileId}-${filename}`;
    statements.push(
      insertStmt("file", {
        id: fileId,
        submission_id: submissionId,
        kind: spec.kind,
        filename,
        r2_key: r2Key,
        size_bytes: 102400,
        content_type: "application/pdf",
        // DEC-818/migration 0025: version_no is a stored identity, set at
        // INSERT time — spec.versionIndex is 0-based within each file's own
        // chain (previous_file_id chain root = versionIndex 0 = version_no
        // 1), matching the migration's backfill formula (root=1, each
        // successor=predecessor+1). Missing here meant every perf-seeded
        // file had a NULL version_no, tripping showflow.ts's fail-loudly
        // guard (task-w16-d).
        version_no: spec.versionIndex + 1,
        previous_file_id: previousFileId,
        // DEC-818: version_no is the row's own stored chain-position
        // identity, set at INSERT time by every writer (never recomputed
        // from chain position later) — spec.versionIndex is already the
        // 0-based per-chain position (matches the `v${versionIndex + 1}`
        // filename above), so the stored value is 1-based.
        version_no: spec.versionIndex + 1,
        uploaded_by_contact_id: contactId,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }

  // --- PERF_PLAN_COUNT evaluation plans (DEC-088; DEC-645 threads plan
  // count per-profile): INSERT never names current_round, so this works
  // with or without the 0009_review_rounds migration ---
  for (const planId of PROFILE_PLAN_IDS) {
    statements.push(
      insertStmt("evaluation_plan", {
        id: planId,
        event_id: PERF_EVENT_ID,
        name: planId === PERF_PLAN_ID ? "Perf Review Plan" : `Perf Review Plan (${planId})`,
        instructions: null,
        open_date: null,
        close_date: null,
        filters_json: null,
        anonymized: false,
        scale_json: JSON.stringify({ min: 1, max: 5 }),
        // DEC-125: criteria entries must carry kind:'rating' to match the
        // RatingCriterionDef union arm (src/domain/evaluation.ts:121-137);
        // without it validateEvaluationScores falls into the dropdown branch
        // and 400s every rating PUT (task-w11-d perf-smoke FAIL).
        criteria_json: JSON.stringify([{ id: "overall", label: "Overall", kind: "rating", weight: 1 }]),
        rounds: 1,
        max_evaluations: null,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }

  // --- PERF_REVIEWER_COUNT reviewer users, each joined (via plan_reviewer)
  // to every one of the PERF_PLAN_COUNT plans — DEC-088/DEC-645: hash the
  // reviewer password once, reuse for every reviewer user. Per-reviewer
  // user-then-its-plan_reviewer-rows interleaving (rather than all users
  // then all plan_reviewer rows) keeps the `default` profile's single-plan
  // statement order — and therefore its nextTs() timestamps — bit-for-bit
  // unchanged from before DEC-645. ---
  const reviewerPasswordHash = await hashPassword(PERF_REVIEWER_PASSWORD);
  const reviewerUserIds: string[] = [];
  let planReviewerCounter = 0;
  for (let i = 1; i <= PERF_REVIEWER_COUNT; i++) {
    const userId = seedId("perf_reviewer", i);
    reviewerUserIds.push(userId);
    statements.push(
      insertStmt("user", {
        id: userId,
        org_id: ORG_ID,
        email: perfReviewerEmail(i, PROFILE.reviewerEmailPrefix),
        password_hash: reviewerPasswordHash,
        role: "reviewer",
        contact_id: null,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
    for (const planId of PROFILE_PLAN_IDS) {
      planReviewerCounter += 1;
      statements.push(
        insertStmt("plan_reviewer", {
          id: seedId("perf_plan_reviewer", planReviewerCounter),
          plan_id: planId,
          user_id: userId,
          track_id: null,
          created_at: nextTs(),
          updated_at: ts,
        }),
      );
    }
  }

  // --- 600 round-1 evaluations (DEC-088): reviewers round-robin over the
  // first 600 submissions ---
  for (let n = 0; n < PERF_EVALUATION_COUNT; n++) {
    const submissionId = submissionIds[n % submissionIds.length]!;
    const reviewerId = reviewerUserIds[n % reviewerUserIds.length]!;
    statements.push(
      insertStmt("evaluation", {
        id: seedId("perf_eval", n + 1),
        plan_id: PERF_PLAN_ID,
        submission_id: submissionId,
        reviewer_id: reviewerId,
        round: 1,
        scores_json: JSON.stringify({ overall: (n % 5) + 1 }),
        comment: null,
        submitted_at: nextTs(),
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }

  // --- DEC-338/DEC-645: 5 onboarding tasks (one file_request) with a
  // task_assignment for every one of PERF_TASK_ASSIGNMENT_TOTAL /
  // PERF_TASK_COUNT contacts (PROFILE.taskCount assignments total, mixed
  // pending/complete by index modulo) — the onboarding grid's realistic
  // scale. DEC-645: task index 0 gets a past due_date whenever the profile's
  // overdueTaskFraction > 0, and the first overdueAssignmentCount of its
  // contacts are seeded deliberately pending+overdue (`default`'s
  // overdueTaskFraction is 0, so this is bit-for-bit unchanged there). ---
  const contactsPerTaskCount = contactsPerTask(PERF_TASK_ASSIGNMENT_TOTAL, PERF_TASK_COUNT);
  // task-w16-d: onboarding is a speaker-facing surface (the grid at
  // src/routes/tasks.ts's GET .../onboarding only lists contacts with a
  // participant row), but the raw `contactIds` pool head (indices
  // 0..contactsPerTaskCount-1) is NOT the same window as the accepted-
  // submission speaker contacts (`acceptedContactIds`, drawn from
  // contactIndexForSubmission's window elsewhere in this file). For
  // `default` those windows happen to fully overlap (contactsPerTaskCount
  // is 800 -- every contact in the 800-contact pool -- so every assignment
  // lands on some contact, all of whom are also union-of-speaker/non-
  // speaker; grid still shows plenty). For `aie` they do NOT overlap
  // (contactsPerTaskCount 80 vs a 250-wide speaker window elsewhere in the
  // 6,000-contact pool), so the onboarding grid never surfaces a single one
  // of the 400 seeded assignments (task-w16-d perf-smoke:aie FAIL). Draw
  // assignment contacts from the real speaker pool (acceptedContactIds)
  // whenever it's large enough to cover contactsPerTaskCount without
  // reusing a contact twice across all PERF_TASK_COUNT tasks; `default`
  // (800 > acceptedContactIds.length 300) falls through unchanged
  // (bit-for-bit) to the original contactIds pool head.
  //
  // task-w17-b reached the same conclusion independently and expressed the
  // gate as `contactsPerTaskCount >= PERF_CONTACT_COUNT ? contactIds :
  // [...new Set([...acceptedContactIds, ...contactIds])]`; that is
  // element-for-element identical to the form kept here on both shipped
  // profiles (default -> contactIds; aie -> the first contactsPerTaskCount
  // acceptedContactIds), so the merge keeps main's already-validated form.
  const taskAssignmentContactIds =
    contactsPerTaskCount <= acceptedContactIds.length ? acceptedContactIds : contactIds;
  const overdueCount = overdueAssignmentCount(PERF_TASK_ASSIGNMENT_TOTAL, PERF_OVERDUE_TASK_FRACTION);
  // Fixed, well-in-the-past anchor (not BASE_TS, which sits after "today" —
  // see the BASE_TS comment above) so seeded overdue assignments read as
  // overdue against the real wall clock whenever this fixture is queried.
  const PERF_OVERDUE_TASK_DUE_DATE = Date.UTC(2020, 0, 1);
  const taskIds: string[] = [];
  for (let i = 0; i < PERF_TASK_COUNT; i++) {
    const spec = PERF_TASKS[i]!;
    const taskId = seedId("perf_task", i + 1);
    taskIds.push(taskId);
    statements.push(
      insertStmt("task", {
        id: taskId,
        event_id: PERF_EVENT_ID,
        kind: spec.kind,
        title: spec.title,
        description: null,
        due_date: i === 0 && overdueCount > 0 ? PERF_OVERDUE_TASK_DUE_DATE : null,
        required: false,
        form_id: null,
        deliverable_kind: spec.deliverableKind,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }

  let taskAssignmentCounter = 0;
  for (let taskIdx = 0; taskIdx < PERF_TASK_COUNT; taskIdx++) {
    const taskId = taskIds[taskIdx]!;
    for (let contactIdx = 0; contactIdx < contactsPerTaskCount; contactIdx++) {
      taskAssignmentCounter += 1;
      const contactId = taskAssignmentContactIds[contactIdx]!;
      const deliberatelyOverdue = isDeliberatelyOverdueAssignment(taskIdx, contactIdx, overdueCount);
      const isComplete = deliberatelyOverdue ? false : isTaskAssignmentComplete(taskIdx, contactIdx);
      statements.push(
        insertStmt("task_assignment", {
          id: seedId("perf_task_assignment", taskAssignmentCounter),
          task_id: taskId,
          contact_id: contactId,
          status: isComplete ? "complete" : "pending",
          completed_at: isComplete ? nextTs() : null,
          completed_by: null,
          response_json: null,
          file_id: null,
          last_reminded_at: null,
          created_at: nextTs(),
          updated_at: ts,
        }),
      );
    }
  }

  // --- DEC-338 (wave-39): singleton perf speaker `user` + `contact` rows,
  // PERF_SPEAKER_SUBMISSION_COUNT extra visible-speaker `participant` rows
  // on the highest-seq accepted submissions (matching what
  // GET /api/v1/events/:id/submissions?status=accepted page 1 actually
  // returns, see perfSpeakerAcceptedIndexes' doc comment), and one
  // task_assignment per existing PERF_TASK_COUNT onboarding task (reusing
  // taskIds minted above, never a new task row) — so scripts/perf-smoke.ts's
  // second login() and the /portal/* checks are measurable end to end.
  // Both `user.id` and `contact.id` fall under the 'seed_perf_' id
  // namespace, so the idempotent DELETE prologue above (which already
  // matches `user`/`contact`/`participant`/`task_assignment` by that
  // prefix or by their perf-scoped parent id) cleans these rows too,
  // without any additional DELETE statement.
  statements.push(
    insertStmt("contact", {
      id: PERF_SPEAKER_CONTACT_ID,
      org_id: ORG_ID,
      first_name: "Perf",
      last_name: "Speaker",
      email: PERF_SPEAKER_EMAIL,
      phone: null,
      company: "Perf Test Co",
      title: "Speaker",
      bio: null,
      headshot_url: null,
      social_links_json: null,
      notes: null,
      custom_fields_json: null,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  statements.push(
    insertStmt("user", {
      id: PERF_SPEAKER_USER_ID,
      org_id: ORG_ID,
      email: PERF_SPEAKER_EMAIL,
      password_hash: await hashPassword(PERF_SPEAKER_PASSWORD),
      role: "speaker",
      contact_id: PERF_SPEAKER_CONTACT_ID,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  const perfSpeakerAcceptedIndexList = perfSpeakerAcceptedIndexes(acceptedSubmissionIds.length);
  perfSpeakerAcceptedIndexList.forEach((acceptedIndex, k) => {
    statements.push(
      insertStmt("participant", {
        id: perfSpeakerParticipantId(k + 1),
        submission_id: acceptedSubmissionIds[acceptedIndex]!,
        contact_id: PERF_SPEAKER_CONTACT_ID,
        role: "speaker",
        order: 99,
        visible: true,
        invite_status: "accepted",
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  });
  for (let taskIdx = 0; taskIdx < PERF_TASK_COUNT; taskIdx++) {
    const isComplete = isPerfSpeakerTaskAssignmentComplete(taskIdx);
    statements.push(
      insertStmt("task_assignment", {
        id: perfSpeakerTaskAssignmentId(taskIdx),
        task_id: taskIds[taskIdx]!,
        contact_id: PERF_SPEAKER_CONTACT_ID,
        status: isComplete ? "complete" : "pending",
        completed_at: isComplete ? nextTs() : null,
        completed_by: null,
        response_json: null,
        file_id: null,
        last_reminded_at: null,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }

  // --- DEC-338: 5,000 email_log rows for the perf event, sent_at spread
  // across the last 30 days so the email-log route's default trailing-7-day
  // filter is a strict, non-trivial subset of the full table ---
  const emailLogNowMs = Date.UTC(2027, 6, 1, 0, 0, 0);
  for (let n = 0; n < PERF_EMAIL_LOG_COUNT; n++) {
    const contactId = contactIds[n % contactIds.length]!;
    statements.push(
      insertStmt("email_log", {
        id: seedId("perf_email_log", n + 1),
        event_id: PERF_EVENT_ID,
        template_id: null,
        contact_id: contactId,
        to_email: `perf.contact.${(n % contactIds.length) + 1}@example-perf.test`,
        subject: `Perf harness email ${n + 1}`,
        body_text: `Synthetic perf-harness email body #${n + 1}.`,
        body_html: null,
        ics_text: null,
        ics_filename: null,
        provider: "dev",
        status: "sent",
        sent_at: sentAtForEmailLogRow(n, emailLogNowMs),
        created_at: emailLogNowMs,
      }),
    );
  }

  // --- DEC-469: pipeline_entry rows, one per perf contact (capped at
  // PERF_PIPELINE_ENTRY_COUNT === PERF_CONTACT_COUNT by pipeline_entry's
  // UNIQUE(org_id, contact_id) index — see perf-seed-lib.ts's comment),
  // spread evenly across all five PIPELINE_STAGES values, each with one
  // 'move' pipeline_activity row so the pipeline board's notes/activity
  // feed at this contact's entry isn't empty.
  const perfOrganizerAuthorId = seedId("perf_reviewer", 1); // any perf user id works as an author fk-free label
  for (let i = 0; i < PERF_PIPELINE_ENTRY_COUNT; i++) {
    const entryId = seedId("perf_pipeline_entry", i + 1);
    const contactId = contactIds[i]!;
    const stage = PERF_PIPELINE_STAGES[pipelineStageIndexForEntry(i)]!;
    statements.push(
      insertStmt("pipeline_entry", {
        id: entryId,
        org_id: ORG_ID,
        contact_id: contactId,
        stage,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
    statements.push(
      insertStmt("pipeline_activity", {
        id: seedId("perf_pipeline_activity", i + 1),
        entry_id: entryId,
        kind: "move",
        body: null,
        from_stage: "identified",
        to_stage: stage,
        author_user_id: perfOrganizerAuthorId,
        author_name: "Perf Harness",
        created_at: nextTs(),
      }),
    );
  }

  // --- DEC-469: PERF_ORG_USER_COUNT extra org `user` rows (mixed
  // reviewer/organizer) on top of the demo seed's ~19 users and the
  // PERF_REVIEWER_COUNT reviewers above, so GET /api/v1/users has a
  // realistic-scale roster to page through. Reuses the same
  // reviewerPasswordHash computed above (nobody logs in as these). ---
  for (let i = 0; i < PERF_ORG_USER_COUNT; i++) {
    statements.push(
      insertStmt("user", {
        id: seedId("perf_orguser", i + 1),
        org_id: ORG_ID,
        email: perfOrgUserEmail(i + 1),
        password_hash: reviewerPasswordHash,
        role: perfOrgUserRole(i),
        contact_id: null,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }

  const sql = statements.join("\n") + "\n";
  writeFileSync(OUTPUT_PATH, sql, "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${statements.length} statements to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
