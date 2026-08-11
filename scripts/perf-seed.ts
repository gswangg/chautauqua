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
  PERF_ANSWERS_PER_SUBMISSION,
  PERF_CONTACT_COUNT,
  PERF_EMAIL_LOG_COUNT,
  PERF_EVALUATION_COUNT,
  PERF_EVENT_ID,
  PERF_EVENT_SLUG,
  PERF_PLAN_ID,
  PERF_REVIEWER_COUNT,
  PERF_REVIEWER_PASSWORD,
  PERF_ROOM_COUNT,
  PERF_SUBMISSION_COUNT,
  PERF_TASK_COUNT,
  PERF_TASKS,
  PERF_TRACK_COUNT,
  contactIndexForSubmission,
  isTaskAssignmentComplete,
  perfFileSpecs,
  perfReviewerEmail,
  perfSubmissionStatuses,
  sentAtForEmailLogRow,
  slotPlacementForAccepted,
  topicForSubmission,
  trackIndexForSubmission,
} from "./perf-seed-lib";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const OUTPUT_PATH = join(REPO_ROOT, ".perf-seed.sql");

// Same fixed org id scripts/seed.ts assigns its one seeded org (seedId is a
// pure, deterministic function of ('org', 1) — reusing it here, rather than
// hardcoding the string, keeps the two scripts from silently drifting).
const ORG_ID = seedId("org", 1);

const TRACK_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#059669", "#ea580c"];

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
  // rows, also children-before-parents.
  statements.push(`DELETE FROM evaluation WHERE plan_id = '${PERF_PLAN_ID}';`);
  statements.push(`DELETE FROM plan_reviewer WHERE plan_id = '${PERF_PLAN_ID}';`);
  statements.push(`DELETE FROM evaluation_plan WHERE id = '${PERF_PLAN_ID}';`);
  statements.push(`DELETE FROM schedule_slot WHERE submission_id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM room WHERE event_id = 'seed_perf_event';`);
  // DEC-347: file rows (deliverable chains) before their submission parents —
  // scoped by the seed_perf_ id namespace, never a blanket DELETE FROM.
  statements.push(`DELETE FROM file WHERE id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM submission_answer WHERE submission_id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM submission_track WHERE submission_id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM participant WHERE submission_id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM submission WHERE event_id = 'seed_perf_event';`);
  statements.push(`DELETE FROM track WHERE event_id = 'seed_perf_event';`);
  // DEC-338: task_assignment (children) before task (parent), email_log is
  // its own leaf table — both scoped to the perf id namespace/event.
  statements.push(`DELETE FROM task_assignment WHERE task_id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM task WHERE event_id = 'seed_perf_event';`);
  statements.push(`DELETE FROM email_log WHERE event_id = 'seed_perf_event';`);
  statements.push(`DELETE FROM contact WHERE id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM event WHERE id = 'seed_perf_event';`);
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
  const statuses = perfSubmissionStatuses(PERF_SUBMISSION_COUNT);
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
    const contactId = contactIds[contactIndexForSubmission(i)]!;
    if (isAccepted) {
      acceptedSubmissionIds.push(submissionId);
      acceptedContactIds.push(contactId);
    }
    const trackId = trackIds[trackIndexForSubmission(i)]!;
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

  // --- 10 rooms (DEC-088) ---
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
  // approved + participant visible, so they are publicly visible) ---
  for (let j = 0; j < acceptedSubmissionIds.length; j++) {
    const submissionId = acceptedSubmissionIds[j]!;
    const placement = slotPlacementForAccepted(j);
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
        previous_file_id: previousFileId,
        uploaded_by_contact_id: contactId,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }

  // --- one evaluation plan (DEC-088): INSERT never names current_round, so
  // this works with or without the 0009_review_rounds migration ---
  statements.push(
    insertStmt("evaluation_plan", {
      id: PERF_PLAN_ID,
      event_id: PERF_EVENT_ID,
      name: "Perf Review Plan",
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

  // --- 12 reviewer users + 12 all-scope plan_reviewer rows (DEC-088): hash
  // the reviewer password once, reuse for all 12 users ---
  const reviewerPasswordHash = await hashPassword(PERF_REVIEWER_PASSWORD);
  const reviewerUserIds: string[] = [];
  for (let i = 1; i <= PERF_REVIEWER_COUNT; i++) {
    const userId = seedId("perf_reviewer", i);
    reviewerUserIds.push(userId);
    statements.push(
      insertStmt("user", {
        id: userId,
        org_id: ORG_ID,
        email: perfReviewerEmail(i),
        password_hash: reviewerPasswordHash,
        role: "reviewer",
        contact_id: null,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
    statements.push(
      insertStmt("plan_reviewer", {
        id: seedId("perf_plan_reviewer", i),
        plan_id: PERF_PLAN_ID,
        user_id: userId,
        track_id: null,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
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

  // --- DEC-338: 5 onboarding tasks (one file_request) with a task_assignment
  // for every one of the 800 contacts (4,000 assignments total), mixed
  // pending/complete by index modulo — the onboarding grid's realistic scale
  // (800 speakers x 5 tasks), which nothing exercised before this ---
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
        due_date: null,
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
    for (let contactIdx = 0; contactIdx < PERF_CONTACT_COUNT; contactIdx++) {
      taskAssignmentCounter += 1;
      const contactId = contactIds[contactIdx]!;
      const isComplete = isTaskAssignmentComplete(taskIdx, contactIdx);
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
