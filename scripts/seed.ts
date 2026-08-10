// Seed script (DEC-001): reads docs/fixtures/sample-data.json (fixture
// values live ONLY here — never in src/, per the field guide's no-eval-
// gaming rule) and emits .seed.sql, a set of DELETE + INSERT statements
// matching src/db/schema.ts, executed via `npm run seed` by
// `wrangler d1 execute chautauqua --local --file=.seed.sql`.
//
// Idempotent: starts with DELETE-all statements so reseeding is stable.
// IDs are deterministic (seeded from a counter, via seedId in seed-lib.ts).
//
// This is scripts/ tooling, not src/ pure-core, so node: imports are fine
// (DEC-002's pure-core rule scopes to src/{auth,domain,forms,mail,lib}).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { hashPassword } from "../src/auth/password";
import { MERGE_FIELDS } from "../src/mail/render";
import { DEC_003, DEC_004, DEC_006, DEC_008 } from "../src/decisions";
import {
  additionalSubmissionStatuses,
  deleteAllStmt,
  insertStmt,
  seedId,
} from "./seed-lib";

void DEC_003;
void DEC_004;
void DEC_006;
void DEC_008;

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const FIXTURE_PATH = join(REPO_ROOT, "docs", "fixtures", "sample-data.json");
const OUTPUT_PATH = join(REPO_ROOT, ".seed.sql");

interface FixtureData {
  event: {
    name: string;
    tagline: string;
    location: string;
    description: string;
    tracks: string[];
    session_formats: string[];
    rooms: string[];
  };
  identities: {
    organizer: { name: string; email: string; password: string; role: string };
    speaker: {
      name: string;
      email: string;
      password: string;
      title: string;
      company: string;
      bio: string;
      twitter?: string;
      linkedin?: string;
    };
    speaker2: {
      name: string;
      email: string;
      password: string;
      title: string;
      company: string;
      bio: string;
    };
    reviewer: { name: string; email: string; password: string; role: string };
  };
  submissions: Array<{
    title: string;
    format: string;
    track: string;
    abstract: string;
    audience_level: string;
    notes_for_reviewers?: string;
  }>;
  communications: { acceptance_subject: string; acceptance_body: string };
}

// Synthetic (non-fixture) data pools for the ~27 additional plausible
// submissions, so admin screens are populated beyond the 3 seeded fixture
// talks. These are invented in the seed script, not read from fixtures —
// per the field-guide rule, product code never sees fixture values, and
// synthetic filler data belongs only here too.
const SYNTH_TITLE_TEMPLATES = [
  "Rethinking {topic}: Lessons from Production",
  "A Practical Guide to {topic}",
  "{topic} at Scale: What We Learned",
  "Beyond the Hype: {topic} in Practice",
  "Building Resilient {topic} Pipelines",
  "The Hidden Costs of {topic}",
  "From Zero to {topic}: A Field Guide",
  "{topic} Anti-Patterns We Finally Fixed",
  "Designing for Failure: {topic} Edition",
  "What Nobody Tells You About {topic}",
];
const SYNTH_TOPICS = [
  "Feature Flags",
  "Service Meshes",
  "LLM Evaluation",
  "Developer Onboarding",
  "Incident Response",
  "API Design",
  "Test Suites",
  "Observability",
  "Code Review",
  "Deployment Pipelines",
  "Data Contracts",
  "Internal Tooling",
  "Platform Reliability",
  "Prompt Engineering",
  "Build Caching",
  "Documentation Systems",
  "On-Call Culture",
  "Infrastructure as Code",
  "Static Analysis",
  "Release Trains",
  "Config Management",
  "Chaos Engineering",
  "Developer Metrics",
  "Monorepo Tooling",
  "Secrets Management",
  "Edge Computing",
  "Vector Databases",
];
const SYNTH_FIRST_NAMES = [
  "Alex", "Bailey", "Casey", "Devon", "Elliot", "Frankie", "Gale", "Harper",
  "Indigo", "Jules", "Kai", "Lane", "Morgan", "Nico", "Oakley", "Parker",
  "Quinn", "Reese", "Sasha", "Toni", "Uma", "Val", "Wren", "Xan", "Yael",
  "Zion", "River",
];
const SYNTH_LAST_NAMES = [
  "Anders", "Brightwell", "Chen", "Delgado", "Ekström", "Fontaine", "Grover",
  "Haddad", "Ionescu", "Jarvis", "Kowalski", "Lindqvist", "Moreau", "Nakamura",
  "Ostrowski", "Pereira", "Quraishi", "Ruiz", "Sandoval", "Tanaka", "Ueda",
  "Vasquez", "Whitcombe", "Xiong", "Yilmaz", "Zabala", "Abernathy",
];
const SYNTH_COMPANIES = [
  "Northwind Systems", "Bluepeak Labs", "Cartwheel Software", "Driftline",
  "Eastbrook Digital", "Fernway Technologies", "Greenlight Data",
  "Harborline Cloud", "Ironwood Analytics", "Junction Point",
];

function synthName(i: number): { first: string; last: string } {
  const first = SYNTH_FIRST_NAMES[i % SYNTH_FIRST_NAMES.length]!;
  const last = SYNTH_LAST_NAMES[(i * 7 + 3) % SYNTH_LAST_NAMES.length]!;
  return { first, last };
}

function synthTitle(i: number): string {
  const template = SYNTH_TITLE_TEMPLATES[i % SYNTH_TITLE_TEMPLATES.length]!;
  const topic = SYNTH_TOPICS[i % SYNTH_TOPICS.length]!;
  return template.replace("{topic}", topic);
}

const BASE_TS = Date.UTC(2027, 0, 15, 12, 0, 0); // 2027-01-15T12:00:00Z anchor
const MINUTE_MS = 60_000;

async function main(): Promise<void> {
  const fixture: FixtureData = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));

  const statements: string[] = [];
  let ts = BASE_TS;
  const nextTs = (): number => {
    ts += MINUTE_MS;
    return ts;
  };

  // --- DELETE statements first (idempotent reseed), children before parents ---
  const tablesInDeleteOrder = [
    "email_log",
    "email_template",
    "file_comment",
    "file",
    "resource",
    "portal_settings",
    "task_assignment",
    "task",
    "schedule_slot",
    "evaluation",
    "plan_reviewer",
    "evaluation_plan",
    "participant",
    "submission_answer",
    "submission",
    "form_field",
    "form",
    "room",
    "track",
    "contact",
    "auth_session",
    "user",
    "event",
    "org",
  ];
  for (const table of tablesInDeleteOrder) {
    statements.push(deleteAllStmt(table));
  }

  // --- org ---
  const orgId = seedId("org", 1);
  statements.push(
    insertStmt("org", {
      id: orgId,
      name: "Chautauqua Demo Org",
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // --- event ---
  const eventId = seedId("event", 1);
  statements.push(
    insertStmt("event", {
      id: eventId,
      org_id: orgId,
      name: fixture.event.name,
      slug: "devflow-conf-2027",
      start_date: "2027-05-12",
      end_date: "2027-05-14",
      location: fixture.event.location,
      timezone: "America/Los_Angeles",
      record_prefix: "SES",
      branding_json: null,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // --- tracks ---
  const trackIds = fixture.event.tracks.map((name, i) => {
    const trackId = seedId("track", i + 1);
    statements.push(
      insertStmt("track", {
        id: trackId,
        event_id: eventId,
        name,
        color: null,
        position: i,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
    return trackId;
  });

  // --- rooms ---
  fixture.event.rooms.forEach((name, i) => {
    statements.push(
      insertStmt("room", {
        id: seedId("room", i + 1),
        event_id: eventId,
        name,
        capacity: null,
        position: i,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  });

  // --- default CFP form ---
  const formId = seedId("form", 1);
  statements.push(
    insertStmt("form", {
      id: formId,
      event_id: eventId,
      title: "Call for Proposals",
      description: "Default CFP form for " + fixture.event.name,
      is_default: true,
      close_date: Date.UTC(2027, 2, 1, 23, 59, 0),
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  const audienceLevels = ["Beginner", "Intermediate", "Advanced"];

  // Locked built-ins (DEC-008): field ids match the LOCKED_SESSION_FIELDS /
  // LOCKED_SPEAKER_FIELDS constants in src/forms/types.ts, non-removable,
  // always required.
  const formFields: Array<{
    id: string;
    section: "session" | "speaker";
    kind: string;
    label: string;
    helpText: string | null;
    required: boolean;
    position: number;
    options: string[] | null;
    locked: boolean;
  }> = [
    { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, options: null, locked: true },
    { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, options: null, locked: true },
    { id: "field_session_format", section: "session", kind: "dropdown", label: "Session format", helpText: null, required: true, position: 2, options: fixture.event.session_formats, locked: false },
    { id: "field_audience_level", section: "session", kind: "dropdown", label: "Audience level", helpText: null, required: true, position: 3, options: audienceLevels, locked: false },
    { id: "field_notes_for_reviewers", section: "session", kind: "long_text", label: "Notes for reviewers", helpText: "Optional context for the program committee.", required: false, position: 4, options: null, locked: false },
    { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 0, options: null, locked: true },
    { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 1, options: null, locked: true },
    { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 2, options: null, locked: true },
  ];
  for (const field of formFields) {
    statements.push(
      insertStmt("form_field", {
        id: field.id,
        form_id: formId,
        section: field.section,
        kind: field.kind,
        label: field.label,
        help_text: field.helpText,
        required: field.required,
        position: field.position,
        options_json: field.options ? JSON.stringify(field.options) : null,
        rule_json: null,
        locked: field.locked,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }

  // --- users (personas) ---
  const organizer = fixture.identities.organizer;
  const speaker = fixture.identities.speaker;
  const speaker2 = fixture.identities.speaker2;
  const reviewer = fixture.identities.reviewer;

  function splitName(full: string): { first: string; last: string } {
    const parts = full.trim().split(/\s+/);
    return { first: parts[0]!, last: parts.slice(1).join(" ") || parts[0]! };
  }

  const speakerContactId = seedId("contact", 1);
  const speaker2ContactId = seedId("contact", 2);

  {
    const { first, last } = splitName(speaker.name);
    statements.push(
      insertStmt("contact", {
        id: speakerContactId,
        org_id: orgId,
        first_name: first,
        last_name: last,
        email: speaker.email,
        phone: null,
        company: speaker.company,
        title: speaker.title,
        bio: speaker.bio,
        headshot_url: null,
        social_links_json: JSON.stringify({ twitter: speaker.twitter, linkedin: speaker.linkedin }),
        notes: null,
        custom_fields_json: null,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }
  {
    const { first, last } = splitName(speaker2.name);
    statements.push(
      insertStmt("contact", {
        id: speaker2ContactId,
        org_id: orgId,
        first_name: first,
        last_name: last,
        email: speaker2.email,
        phone: null,
        company: speaker2.company,
        title: speaker2.title,
        bio: speaker2.bio,
        headshot_url: null,
        social_links_json: null,
        notes: null,
        custom_fields_json: null,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }

  const organizerUserId = seedId("user", 1);
  const speakerUserId = seedId("user", 2);
  const speaker2UserId = seedId("user", 3);
  const reviewerUserId = seedId("user", 4);

  statements.push(
    insertStmt("user", {
      id: organizerUserId,
      org_id: orgId,
      email: organizer.email,
      password_hash: await hashPassword(organizer.password),
      role: "organizer",
      contact_id: null,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  statements.push(
    insertStmt("user", {
      id: speakerUserId,
      org_id: orgId,
      email: speaker.email,
      password_hash: await hashPassword(speaker.password),
      role: "speaker",
      contact_id: speakerContactId,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  statements.push(
    insertStmt("user", {
      id: speaker2UserId,
      org_id: orgId,
      email: speaker2.email,
      password_hash: await hashPassword(speaker2.password),
      role: "speaker",
      contact_id: speaker2ContactId,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  statements.push(
    insertStmt("user", {
      id: reviewerUserId,
      org_id: orgId,
      email: reviewer.email,
      password_hash: await hashPassword(reviewer.password),
      role: "reviewer",
      contact_id: null,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // --- submissions: 3 fixture (status 'pending', seq 1..3) + ~27 synthetic ---
  function trackIdFor(name: string): string {
    const i = fixture.event.tracks.indexOf(name);
    if (i === -1) {
      throw new Error(`fixture submission references unknown track '${name}'`);
    }
    const trackId = trackIds[i];
    if (!trackId) throw new Error(`no track id at index ${i}`);
    return trackId;
  }

  function insertSubmissionAnswer(submissionId: string, fieldId: string, value: unknown): void {
    statements.push(
      insertStmt("submission_answer", {
        id: seedId("answer", statements.length),
        submission_id: submissionId,
        form_field_id: fieldId,
        value_json: JSON.stringify(value),
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }

  let seq = 0;
  let submissionCounter = 0;

  function insertSubmissionWithSpeaker(opts: {
    title: string;
    description: string;
    trackId: string;
    format: string;
    audienceLevel: string;
    notesForReviewers?: string;
    status: string;
    contactId: string;
    firstName: string;
    lastName: string;
    email: string;
  }): void {
    seq += 1;
    submissionCounter += 1;
    const submissionId = seedId("submission", submissionCounter);
    const isAccepted = opts.status === "accepted";
    statements.push(
      insertStmt("submission", {
        id: submissionId,
        event_id: eventId,
        form_id: formId,
        seq,
        title: opts.title,
        description: opts.description,
        track_id: opts.trackId,
        additional_track_ids_json: null,
        status: opts.status,
        content_status: isAccepted ? "approved" : "pending",
        accepted_at: isAccepted ? nextTs() : null,
        ics_sequence: 0,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );

    insertSubmissionAnswer(submissionId, "title", opts.title);
    insertSubmissionAnswer(submissionId, "description", opts.description);
    insertSubmissionAnswer(submissionId, "field_session_format", opts.format);
    insertSubmissionAnswer(submissionId, "field_audience_level", opts.audienceLevel);
    if (opts.notesForReviewers) {
      insertSubmissionAnswer(submissionId, "field_notes_for_reviewers", opts.notesForReviewers);
    }
    insertSubmissionAnswer(submissionId, "first_name", opts.firstName);
    insertSubmissionAnswer(submissionId, "last_name", opts.lastName);
    insertSubmissionAnswer(submissionId, "email", opts.email);

    statements.push(
      insertStmt("participant", {
        id: seedId("participant", submissionCounter),
        submission_id: submissionId,
        contact_id: opts.contactId,
        role: "speaker",
        order: 0,
        visible: true,
        invite_status: isAccepted ? "accepted" : "none",
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }

  // 3 fixture submissions, alternating between the two seeded speaker contacts.
  fixture.submissions.forEach((sub, i) => {
    const useSpeaker2 = i % 2 === 1;
    const contactId = useSpeaker2 ? speaker2ContactId : speakerContactId;
    const name = useSpeaker2 ? splitName(speaker2.name) : splitName(speaker.name);
    const email = useSpeaker2 ? speaker2.email : speaker.email;
    insertSubmissionWithSpeaker({
      title: sub.title,
      description: sub.abstract,
      trackId: trackIdFor(sub.track),
      format: sub.format,
      audienceLevel: sub.audience_level,
      notesForReviewers: sub.notes_for_reviewers,
      status: "pending",
      contactId,
      firstName: name.first,
      lastName: name.last,
      email,
    });
  });

  // ~27 additional synthetic submissions, mixed statuses, populating every
  // admin screen. Each gets its own synthetic contact (not a login user).
  const additionalCount = 27;
  const statuses = additionalSubmissionStatuses(additionalCount);
  for (let i = 0; i < additionalCount; i++) {
    const { first, last } = synthName(i);
    const email = `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, "")}@example-speakers.test`;
    const contactId = seedId("synth_contact", i + 1);
    const company = SYNTH_COMPANIES[i % SYNTH_COMPANIES.length]!;
    statements.push(
      insertStmt("contact", {
        id: contactId,
        org_id: orgId,
        first_name: first,
        last_name: last,
        email,
        phone: null,
        company,
        title: "Software Engineer",
        bio: null,
        headshot_url: null,
        social_links_json: null,
        notes: null,
        custom_fields_json: null,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );

    const trackName = fixture.event.tracks[i % fixture.event.tracks.length]!;
    const format = fixture.event.session_formats[i % fixture.event.session_formats.length]!;
    const audienceLevel = audienceLevels[i % audienceLevels.length]!;
    const title = synthTitle(i);

    insertSubmissionWithSpeaker({
      title,
      description: `A synthetic seed submission proposing "${title}" for the ${trackName} track. Generated for local development so every admin screen has representative data to work against.`,
      trackId: trackIdFor(trackName),
      format,
      audienceLevel,
      status: statuses[i]!,
      contactId,
      firstName: first,
      lastName: last,
      email,
    });
  }

  // --- fixture 'Acceptance Notification' email template (DEC-006 merge fields) ---
  for (const field of ["speaker_name", "talk_title"] as const) {
    if (!MERGE_FIELDS.includes(field)) {
      throw new Error(`merge field '${field}' is not in the DEC-006 whitelist`);
    }
  }
  statements.push(
    insertStmt("email_template", {
      id: seedId("email_template", 1),
      event_id: eventId,
      name: "Acceptance Notification",
      subject: fixture.communications.acceptance_subject,
      body_text: fixture.communications.acceptance_body,
      body_html: null,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  const sql = statements.join("\n") + "\n";
  writeFileSync(OUTPUT_PATH, sql, "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${statements.length} statements to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
