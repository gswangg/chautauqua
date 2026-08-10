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

import { insertStmt, seedId } from "./seed-lib";
import {
  PERF_ANSWERS_PER_SUBMISSION,
  PERF_CONTACT_COUNT,
  PERF_EVENT_ID,
  PERF_EVENT_SLUG,
  PERF_SUBMISSION_COUNT,
  PERF_TRACK_COUNT,
  contactIndexForSubmission,
  perfSubmissionStatuses,
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

function main(): void {
  const statements: string[] = [];
  let ts = BASE_TS;
  const nextTs = (): number => {
    ts += MINUTE_MS;
    return ts;
  };

  // --- idempotent delete, children before parents; never a blanket
  // DELETE FROM (that would also wipe the demo seed's rows in these
  // shared tables) ---
  statements.push(`DELETE FROM submission_answer WHERE submission_id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM submission_track WHERE submission_id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM participant WHERE submission_id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM submission WHERE event_id = 'seed_perf_event';`);
  statements.push(`DELETE FROM track WHERE event_id = 'seed_perf_event';`);
  statements.push(`DELETE FROM contact WHERE id LIKE 'seed_perf_%';`);
  statements.push(`DELETE FROM event WHERE id = 'seed_perf_event';`);

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
  for (let i = 0; i < PERF_SUBMISSION_COUNT; i++) {
    const submissionId = seedId("perf_submission", i + 1);
    const status = statuses[i]!;
    const isAccepted = status === "accepted";
    const contactId = contactIds[contactIndexForSubmission(i)]!;
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

  const sql = statements.join("\n") + "\n";
  writeFileSync(OUTPUT_PATH, sql, "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${statements.length} statements to ${OUTPUT_PATH}`);
}

main();
