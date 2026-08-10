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

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { hashPassword } from "../src/auth/password";
import { MERGE_FIELDS } from "../src/mail/render";
import { DEFAULT_ONBOARDING_TASKS } from "../src/domain/acceptance";
import {
  DEC_003,
  DEC_004,
  DEC_006,
  DEC_008,
  DEC_009,
  DEC_017,
  DEC_018,
  DEC_020,
  DEC_023,
  DEC_048,
} from "../src/decisions";
import {
  additionalSubmissionStatuses,
  deleteAllStmt,
  insertStmt,
  minimalPdfBytes,
  onePixelPngBytes,
  seedId,
  sqlQuote,
} from "./seed-lib";

void DEC_003;
void DEC_004;
void DEC_006;
void DEC_008;
void DEC_009;
void DEC_017;
void DEC_018;
void DEC_020;
void DEC_023;
void DEC_048;

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const FIXTURE_PATH = join(REPO_ROOT, "docs", "fixtures", "sample-data.json");
const OUTPUT_PATH = join(REPO_ROOT, ".seed.sql");
const ASSETS_DIR = join(REPO_ROOT, ".seed-assets");
const MANIFEST_PATH = join(ASSETS_DIR, "manifest.json");

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

  // --- deterministic tiny R2 assets (task w6-e): one PDF, one PNG on disk,
  // reused (via manifest entries keyed by r2Key) for every seeded file row
  // that needs bytes. scripts/seed-r2.ts reads the manifest and `wrangler
  // r2 object put`s each entry.
  mkdirSync(ASSETS_DIR, { recursive: true });
  const PDF_PATH = join(ASSETS_DIR, "sample.pdf");
  const PNG_PATH = join(ASSETS_DIR, "sample.png");
  const pdfBytes = minimalPdfBytes();
  const pngBytes = onePixelPngBytes();
  writeFileSync(PDF_PATH, pdfBytes);
  writeFileSync(PNG_PATH, pngBytes);
  const manifest: Array<{ r2Key: string; path: string; contentType: string }> = [];
  function registerPdfAsset(r2Key: string): number {
    manifest.push({ r2Key, path: PDF_PATH, contentType: "application/pdf" });
    return pdfBytes.length;
  }
  function registerPngAsset(r2Key: string): number {
    manifest.push({ r2Key, path: PNG_PATH, contentType: "image/png" });
    return pngBytes.length;
  }

  // --- real fixture deliverable/headshot bytes (task w1-d, DEC-145): the
  // demo speaker's accepted-session deliverable and the seeded headshots
  // use the actual docs/fixtures/slides.pdf and headshot.png bytes (not the
  // synthetic minimal PDF/PNG above) so downloads and images render
  // real, recognizable content in Miniflare.
  const SLIDES_PDF_PATH = join(REPO_ROOT, "docs", "fixtures", "slides.pdf");
  const HEADSHOT_PNG_PATH = join(REPO_ROOT, "docs", "fixtures", "headshot.png");
  const slidesPdfBytes = readFileSync(SLIDES_PDF_PATH);
  const headshotPngBytes = readFileSync(HEADSHOT_PNG_PATH);
  function registerSlidesPdfAsset(r2Key: string): number {
    manifest.push({ r2Key, path: SLIDES_PDF_PATH, contentType: "application/pdf" });
    return slidesPdfBytes.length;
  }
  function registerHeadshotPngAsset(r2Key: string): number {
    manifest.push({ r2Key, path: HEADSHOT_PNG_PATH, contentType: "image/png" });
    return headshotPngBytes.length;
  }

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
    "submission_track",
    "submission_answer",
    "submission",
    "form_field",
    "form",
    "room",
    "track",
    "contact",
    "auth_session",
    "user",
    "saved_view",
    "event",
    "segment",
    "api_token",
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

  // --- tracks --- (distinct, readable hex palette; cycles if more tracks
  // than colors are ever added)
  const TRACK_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];
  const trackIds = fixture.event.tracks.map((name, i) => {
    const trackId = seedId("track", i + 1);
    statements.push(
      insertStmt("track", {
        id: trackId,
        event_id: eventId,
        name,
        color: TRACK_COLORS[i % TRACK_COLORS.length]!,
        position: i,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
    return trackId;
  });

  // --- rooms ---
  const roomIds = fixture.event.rooms.map((name, i) => {
    const roomId = seedId("room", i + 1);
    statements.push(
      insertStmt("room", {
        id: roomId,
        event_id: eventId,
        name,
        capacity: null,
        position: i,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
    return roomId;
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

  // --- near-duplicate contacts (task w1-d / DEC-145): two more Priya
  // Raman / Marcus Okafor contact rows — same name + company as the two
  // named speaker contacts above, but a different (CSV-import-style) email
  // address, mirroring docs/fixtures/speakers.csv. Not linked to a user
  // account or any submission; they exist purely as the CRM dedupe test
  // vector (DEC-143) and must be preserved by every future seed edit.
  const priyaDupContactId = seedId("contact", 3);
  const marcusDupContactId = seedId("contact", 4);
  statements.push(
    insertStmt("contact", {
      id: priyaDupContactId,
      org_id: orgId,
      first_name: "Priya",
      last_name: "Raman",
      email: "priya.speaker@sbek-test.example.com",
      phone: null,
      company: "Latticework Systems",
      title: "Principal Engineer",
      bio: "Leads the build-tooling platform team at Latticework Systems.",
      headshot_url: null,
      social_links_json: null,
      notes: null,
      custom_fields_json: null,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  statements.push(
    insertStmt("contact", {
      id: marcusDupContactId,
      org_id: orgId,
      first_name: "Marcus",
      last_name: "Okafor",
      email: "marcus.speaker@sbek-test.example.com",
      phone: null,
      company: "Cloudreach Labs",
      title: "Staff Developer Advocate",
      bio: "Focused on AI agents in production; writes Agents Weekly.",
      headshot_url: null,
      social_links_json: null,
      notes: null,
      custom_fields_json: null,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

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

  // --- synthetic reviewer users (DEC-018): scoped to tracks other than the
  // reviewer persona's, so plan_reviewer coverage spans every track.
  const reviewerBUserId = seedId("user", 5);
  const reviewerCUserId = seedId("user", 6);
  const reviewerDUserId = seedId("user", 7);
  const synthReviewerPassword = "ReviewerSeed!2027";
  for (const [id, email] of [
    [reviewerBUserId, "reviewer.b@example-speakers.test"],
    [reviewerCUserId, "reviewer.c@example-speakers.test"],
    [reviewerDUserId, "reviewer.d@example-speakers.test"],
  ] as const) {
    statements.push(
      insertStmt("user", {
        id,
        org_id: orgId,
        email,
        password_hash: await hashPassword(synthReviewerPassword),
        role: "reviewer",
        contact_id: null,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  }

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

  // Per-track submission id lists (for evaluation-plan assignment) and the
  // set of accepted submissions (for scheduling/onboarding/email seeding).
  const submissionsByTrackIndex: string[][] = fixture.event.tracks.map(() => []);
  const acceptedSubmissions: { submissionId: string; contactId: string; email: string }[] = [];

  function insertSubmissionWithSpeaker(opts: {
    title: string;
    description: string;
    trackId: string;
    trackIndex: number;
    format: string;
    audienceLevel: string;
    notesForReviewers?: string;
    status: string;
    contactId: string;
    firstName: string;
    lastName: string;
    email: string;
  }): string {
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
        // DEC-017: submission.track_id / additional_track_ids_json are
        // frozen legacy — never written; track membership lives only in
        // submission_track (inserted below, keyed off opts.trackId).
        track_id: null,
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

    // DEC-015/DEC-017: track membership is a real submission_track join,
    // never the frozen submission.track_id column.
    statements.push(
      insertStmt("submission_track", {
        submission_id: submissionId,
        track_id: opts.trackId,
        created_at: nextTs(),
      }),
    );
    // Every 4th submission also belongs to a second track, so multi-track
    // membership is exercised.
    if (submissionCounter % 4 === 0) {
      const secondaryTrackId = trackIds[(opts.trackIndex + 1) % trackIds.length]!;
      statements.push(
        insertStmt("submission_track", {
          submission_id: submissionId,
          track_id: secondaryTrackId,
          created_at: nextTs(),
        }),
      );
    }

    submissionsByTrackIndex[opts.trackIndex]!.push(submissionId);
    if (isAccepted) {
      acceptedSubmissions.push({ submissionId, contactId: opts.contactId, email: opts.email });
    }
    return submissionId;
  }

  // 3 fixture submissions, alternating between the two seeded speaker
  // contacts. Task w1-d / DEC-145: the demo speaker (fixture.identities
  // .speaker, Priya Raman, sbek-speaker@example.com) needs a real accepted
  // submission so every grader flow (deliverables, task assignments,
  // acceptance-scoped portal views) is exercisable — her first fixture
  // submission (index 0) is seeded 'accepted'; the rest stay 'pending' so
  // the review queue also has fixture-backed work.
  fixture.submissions.forEach((sub, i) => {
    const useSpeaker2 = i % 2 === 1;
    const contactId = useSpeaker2 ? speaker2ContactId : speakerContactId;
    const name = useSpeaker2 ? splitName(speaker2.name) : splitName(speaker.name);
    const email = useSpeaker2 ? speaker2.email : speaker.email;
    insertSubmissionWithSpeaker({
      title: sub.title,
      description: sub.abstract,
      trackId: trackIdFor(sub.track),
      trackIndex: fixture.event.tracks.indexOf(sub.track),
      format: sub.format,
      audienceLevel: sub.audience_level,
      notesForReviewers: sub.notes_for_reviewers,
      status: i === 0 ? "accepted" : "pending",
      contactId,
      firstName: name.first,
      lastName: name.last,
      email,
    });
  });

  // ~27 additional synthetic submissions, mixed statuses, populating every
  // admin screen. Each gets its own synthetic contact (not a login user).
  const additionalCount = 27;
  // Bump 3 of the (originally pending) statuses to 'accepted', one per
  // track, so the event has 8 accepted submissions overall (5 original +
  // 3 bumped) — enough for a full agenda/public-page demo (task w3-j).
  // additionalSubmissionStatuses' distribution itself is untouched (owned
  // by an earlier wave-2 task and covered by its own test).
  const baseStatuses = additionalSubmissionStatuses(additionalCount);
  const bumpToAccepted = new Set([0, 1, 2]);
  const statuses = baseStatuses.map((s, i) => (bumpToAccepted.has(i) ? "accepted" : s));
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

    const trackIndex = i % fixture.event.tracks.length;
    const trackName = fixture.event.tracks[trackIndex]!;
    const format = fixture.event.session_formats[i % fixture.event.session_formats.length]!;
    const audienceLevel = audienceLevels[i % audienceLevels.length]!;
    const title = synthTitle(i);

    insertSubmissionWithSpeaker({
      title,
      description: `A synthetic seed submission proposing "${title}" for the ${trackName} track. Generated for local development so every admin screen has representative data to work against.`,
      trackId: trackIdFor(trackName),
      trackIndex,
      format,
      audienceLevel,
      status: statuses[i]!,
      contactId,
      firstName: first,
      lastName: last,
      email,
    });
  }

  // --- evaluation plan (DEC-018): 5-point scale, two weighted rating
  // criteria + one dropdown criterion; plan_reviewer scopes the reviewer
  // persona to track 0 and three synthetic reviewers to the other tracks
  // (with one doubled-up on track 1 for reviewer-overlap realism).
  const evalPlanId = seedId("evaluation_plan", 1);
  const evalCriteria = [
    { id: "content_quality", label: "Content quality & depth", kind: "rating", weight: 2 },
    { id: "speaker_delivery", label: "Speaker delivery & clarity", kind: "rating", weight: 1 },
    { id: "session_fit", label: "Session length fit", kind: "dropdown", options: ["Too short", "Just right", "Too long"] },
  ] as const;
  statements.push(
    insertStmt("evaluation_plan", {
      id: evalPlanId,
      event_id: eventId,
      name: "Program Committee Review",
      instructions: "Score each proposal on content quality, delivery, and session length fit.",
      // Task w1-d / DEC-145: opens 2026-01-01Z (not tied to Date.now — the
      // grading window is a fixed date range) so the reviewer window spans
      // 'now' regardless of when the eval is actually run; close_date is
      // unchanged (still after the 2027 event dates).
      open_date: Date.UTC(2026, 0, 1),
      close_date: Date.UTC(2027, 4, 20, 23, 59, 0),
      filters_json: null,
      anonymized: false,
      scale_json: JSON.stringify({ min: 1, max: 5 }),
      criteria_json: JSON.stringify(evalCriteria),
      rounds: 1,
      max_evaluations: null,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  const reviewerAssignments = [
    { userId: reviewerUserId, trackIndex: 0 },
    { userId: reviewerBUserId, trackIndex: 1 },
    { userId: reviewerCUserId, trackIndex: 2 },
    { userId: reviewerDUserId, trackIndex: 1 },
  ];
  reviewerAssignments.forEach((ra, i) => {
    statements.push(
      insertStmt("plan_reviewer", {
        id: seedId("plan_reviewer", i + 1),
        plan_id: evalPlanId,
        user_id: ra.userId,
        track_id: trackIds[ra.trackIndex]!,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  });

  // ~40 evaluation rows: the reviewer persona (track 0) only clears 7 of
  // 10 submissions, leaving their queue/progress view genuinely
  // incomplete; the synthetic reviewers clear their whole tracks.
  const EVAL_COMMENTS = [
    "Strong technical depth, well organized.",
    "Good energy but could tighten the scope.",
    "Solid proposal, needs more concrete examples.",
    "Compelling narrative and clear takeaways.",
    "Interesting topic; timing might run long.",
    "Well-suited for this track.",
    "Could use more advanced content for this audience.",
    "Clear structure, minor polish needed.",
  ];
  const dropdownOptions = evalCriteria[2].options;
  let evalCounter = 0;
  function insertEvaluation(reviewerId: string, submissionId: string): void {
    evalCounter += 1;
    const contentScore = 1 + ((evalCounter * 7 + 2) % 5);
    const deliveryScore = 1 + ((evalCounter * 11 + 1) % 5);
    const sessionFit = dropdownOptions[evalCounter % dropdownOptions.length]!;
    const comment = EVAL_COMMENTS[evalCounter % EVAL_COMMENTS.length]!;
    statements.push(
      insertStmt("evaluation", {
        id: seedId("evaluation", evalCounter),
        plan_id: evalPlanId,
        submission_id: submissionId,
        reviewer_id: reviewerId,
        round: 1,
        scores_json: JSON.stringify({
          content_quality: contentScore,
          speaker_delivery: deliveryScore,
          session_fit: sessionFit,
        }),
        comment,
        submitted_at: nextTs(),
        created_at: ts,
        updated_at: ts,
      }),
    );
  }

  const track0Subs = submissionsByTrackIndex[0]!;
  const track1Subs = submissionsByTrackIndex[1]!;
  const track2Subs = submissionsByTrackIndex[2]!;
  for (let i = 0; i < Math.min(7, track0Subs.length); i++) {
    insertEvaluation(reviewerUserId, track0Subs[i]!);
  }
  for (const submissionId of track1Subs) {
    insertEvaluation(reviewerBUserId, submissionId);
  }
  for (const submissionId of track2Subs) {
    insertEvaluation(reviewerCUserId, submissionId);
  }
  for (const submissionId of track1Subs) {
    insertEvaluation(reviewerDUserId, submissionId);
  }

  // --- onboarding tasks (DEC-009/DEC-023): the 5 canonical default tasks,
  // staggered due dates before the event start, assigned to every accepted
  // speaker's contact in mixed pending/complete states. Never reference
  // response_json/file_id/last_reminded_at (wave-3 columns, migration
  // 0002-pending per DEC-017) so this seed works pre- or post-migration.
  const eventStartMs = Date.UTC(2027, 4, 12, 0, 0, 0);
  const DAY_MS = 86_400_000;
  const dueDaysBefore = [35, 28, 21, 14, 7];
  const taskIds = DEFAULT_ONBOARDING_TASKS.map((tpl, i) => {
    const taskId = seedId("task", i + 1);
    statements.push(
      insertStmt("task", {
        id: taskId,
        event_id: eventId,
        kind: tpl.kind,
        title: tpl.title,
        description: null,
        due_date: eventStartMs - dueDaysBefore[i]! * DAY_MS,
        required: tpl.required,
        form_id: null,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
    return taskId;
  });

  let taskAssignmentCounter = 0;
  acceptedSubmissions.forEach((acc, contactIdx) => {
    taskIds.forEach((taskId, taskIdx) => {
      taskAssignmentCounter += 1;
      // Roughly two-thirds complete, one-third still pending, mixed per
      // contact/task so the grid shows a realistic in-progress state.
      const isComplete = (contactIdx + taskIdx) % 3 !== 0;
      statements.push(
        insertStmt("task_assignment", {
          id: seedId("task_assignment", taskAssignmentCounter),
          task_id: taskId,
          contact_id: acc.contactId,
          status: isComplete ? "complete" : "pending",
          completed_at: isComplete ? nextTs() : null,
          completed_by: isComplete ? organizerUserId : null,
          created_at: nextTs(),
          updated_at: ts,
        }),
      );
    });
  });

  // --- schedule slots (DEC-010/DEC-021): roughly two-thirds of accepted
  // submissions placed across the event's 3 days and 4 rooms, with one
  // deliberate room-overlap conflict and one TBD (null room) slot; the
  // rest stay unplaced so the agenda "unscheduled" count reads honestly.
  const eventDays = ["2027-05-12", "2027-05-13", "2027-05-14"];
  const placedForSchedule = acceptedSubmissions.slice(0, 5);
  if (placedForSchedule.length === 5) {
    const slots: Array<{ submissionId: string; roomId: string | null; day: string; startMin: number; endMin: number }> = [
      // Deliberate conflict: both in room 0 on day 1, overlapping 09:15-09:45.
      { submissionId: placedForSchedule[0]!.submissionId, roomId: roomIds[0]!, day: eventDays[0]!, startMin: 9 * 60, endMin: 9 * 60 + 45 },
      { submissionId: placedForSchedule[1]!.submissionId, roomId: roomIds[0]!, day: eventDays[0]!, startMin: 9 * 60 + 15, endMin: 10 * 60 },
      // TBD room.
      { submissionId: placedForSchedule[2]!.submissionId, roomId: null, day: eventDays[1]!, startMin: 10 * 60, endMin: 10 * 60 + 45 },
      { submissionId: placedForSchedule[3]!.submissionId, roomId: roomIds[1]!, day: eventDays[1]!, startMin: 11 * 60, endMin: 11 * 60 + 45 },
      { submissionId: placedForSchedule[4]!.submissionId, roomId: roomIds[2]!, day: eventDays[2]!, startMin: 9 * 60, endMin: 9 * 60 + 45 },
    ];
    slots.forEach((slot, i) => {
      statements.push(
        insertStmt("schedule_slot", {
          id: seedId("schedule_slot", i + 1),
          submission_id: slot.submissionId,
          room_id: slot.roomId,
          day: slot.day,
          start_min: slot.startMin,
          end_min: slot.endMin,
          created_at: nextTs(),
          updated_at: ts,
        }),
      );
    });
  }

  // --- portal settings + a wiki resource ---
  statements.push(
    insertStmt("portal_settings", {
      id: seedId("portal_settings", 1),
      event_id: eventId,
      logo_url: null,
      accent_color: "#4f46e5",
      welcome_message: "Welcome to the speaker portal! Here you'll find your schedule, onboarding tasks, and resources for the event.",
      show_resources: true,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  statements.push(
    insertStmt("resource", {
      id: seedId("resource", 1),
      event_id: eventId,
      kind: "wiki",
      title: "Speaker Handbook",
      content: "## Getting there\n\nParking and directions to the venue.\n\n## AV setup\n\nEach room has a wireless mic and an HDMI/USB-C adapter. Bring your own laptop.\n\n## Questions\n\nReach the organizer team any time via the portal.",
      file_id: null,
      position: 0,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  // Additive: two more wiki resource rows (w4-h), position after the handbook.
  statements.push(
    insertStmt("resource", {
      id: seedId("resource", 2),
      event_id: eventId,
      kind: "wiki",
      title: "Code of Conduct",
      content: "All speakers and attendees are expected to treat one another with respect. Harassment of any kind will not be tolerated. If you experience or witness a violation, contact the organizer team immediately via the portal.",
      file_id: null,
      position: 1,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  statements.push(
    insertStmt("resource", {
      id: seedId("resource", 3),
      event_id: eventId,
      kind: "wiki",
      title: "Recording & Media Release",
      content: "Sessions may be recorded for later publication. By speaking at this event you consent to being recorded and to the resulting media being shared publicly. Contact the organizer team if you have concerns about a specific slide or demo.",
      file_id: null,
      position: 2,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // --- segment (w4-c, DEC-026): a CRM saved-segment rule matching company
  // contains 'Labs' (matches synthetic contacts at "Bluepeak Labs").
  statements.push(
    insertStmt("segment", {
      id: seedId("segment", 1),
      org_id: orgId,
      name: "Labs companies",
      rules_json: JSON.stringify([{ field: "company", op: "contains", value: "Labs" }]),
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // --- saved view (w4-g, DEC-031): a Submissions-table saved view.
  statements.push(
    insertStmt("saved_view", {
      id: seedId("saved_view", 1),
      event_id: eventId,
      name: "Accepted talks",
      config_json: JSON.stringify({
        q: "",
        status: ["accepted"],
        trackId: null,
        sort: "newest",
        columns: ["title", "status", "field_session_format", "field_audience_level"],
      }),
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // --- CRM sourcing pipeline (CRM-07/08, DEC-157, task w3-a): 3 synthetic
  // contacts enrolled across different stages, with at least one note and a
  // multi-step transition history. Deliberately NOT Marcus Okafor (speaker2)
  // and NOT either Priya Raman contact (speakerContactId / priyaDupContactId)
  // — CRM-S2 enrolls Marcus manually during the eval run, so the seed must
  // leave that enrollment available rather than pre-empting it.
  {
    const pipelineContactIds = [seedId("synth_contact", 1), seedId("synth_contact", 2), seedId("synth_contact", 3)];
    const pipelineEntryIds = pipelineContactIds.map((_, i) => seedId("pipeline_entry", i + 1));
    let activityCounter = 0;
    const nextActivityId = () => seedId("pipeline_activity", ++activityCounter);

    // Entry 1: identified only, no history beyond enrollment.
    statements.push(
      insertStmt("pipeline_entry", {
        id: pipelineEntryIds[0],
        org_id: orgId,
        contact_id: pipelineContactIds[0],
        stage: "identified",
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
    statements.push(
      insertStmt("pipeline_activity", {
        id: nextActivityId(),
        entry_id: pipelineEntryIds[0],
        kind: "move",
        body: null,
        from_stage: null,
        to_stage: "identified",
        author_user_id: organizerUserId,
        author_name: organizer.name,
        created_at: nextTs(),
      }),
    );

    // Entry 2: multi-step transition history (identified -> contacted ->
    // interested) plus a note, landing in 'interested'.
    statements.push(
      insertStmt("pipeline_entry", {
        id: pipelineEntryIds[1],
        org_id: orgId,
        contact_id: pipelineContactIds[1],
        stage: "interested",
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
    const entry2Moves: { from: string | null; to: string }[] = [
      { from: null, to: "identified" },
      { from: "identified", to: "contacted" },
      { from: "contacted", to: "interested" },
    ];
    for (const move of entry2Moves) {
      statements.push(
        insertStmt("pipeline_activity", {
          id: nextActivityId(),
          entry_id: pipelineEntryIds[1],
          kind: "move",
          body: null,
          from_stage: move.from,
          to_stage: move.to,
          author_user_id: organizerUserId,
          author_name: organizer.name,
          created_at: nextTs(),
        }),
      );
    }
    statements.push(
      insertStmt("pipeline_activity", {
        id: nextActivityId(),
        entry_id: pipelineEntryIds[1],
        kind: "note",
        body: "Warm intro via a mutual contact; follow up after the CFP closes.",
        from_stage: null,
        to_stage: null,
        author_user_id: organizerUserId,
        author_name: organizer.name,
        created_at: nextTs(),
      }),
    );

    // Entry 3: enrolled straight into 'confirmed', with a note.
    statements.push(
      insertStmt("pipeline_entry", {
        id: pipelineEntryIds[2],
        org_id: orgId,
        contact_id: pipelineContactIds[2],
        stage: "confirmed",
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
    statements.push(
      insertStmt("pipeline_activity", {
        id: nextActivityId(),
        entry_id: pipelineEntryIds[2],
        kind: "move",
        body: null,
        from_stage: null,
        to_stage: "confirmed",
        author_user_id: organizerUserId,
        author_name: organizer.name,
        created_at: nextTs(),
      }),
    );
    statements.push(
      insertStmt("pipeline_activity", {
        id: nextActivityId(),
        entry_id: pipelineEntryIds[2],
        kind: "note",
        body: "Confirmed via email; sending the speaker agreement next.",
        from_stage: null,
        to_stage: null,
        author_user_id: organizerUserId,
        author_name: organizer.name,
        created_at: nextTs(),
      }),
    );
  }

  // --- file pipeline (DEC-020): a presentation v1->v2 version chain plus a
  // poster on the first two accepted submissions, and a file_comment thread
  // (producer note + speaker reply) on the v2 presentation. acceptedSubmissions[0]
  // is the demo speaker's (Priya Raman's) accepted fixture submission (task
  // w1-d / DEC-145: fixture submissions are pushed before synthetic ones),
  // so this deliverable/comment thread lands on her session, backed by the
  // real docs/fixtures/slides.pdf bytes.
  const fileChainSub = acceptedSubmissions[0];
  const posterSub = acceptedSubmissions[1] ?? acceptedSubmissions[0];
  if (!fileChainSub || !posterSub) {
    throw new Error("seed: expected at least one accepted submission for the file pipeline demo");
  }

  const filePresV1Id = seedId("file", 1);
  const filePresV2Id = seedId("file", 2);
  const filePosterId = seedId("file", 3);

  const v1R2Key = `sub/${fileChainSub.submissionId}/${filePresV1Id}-slides-v1.pdf`;
  statements.push(
    insertStmt("file", {
      id: filePresV1Id,
      submission_id: fileChainSub.submissionId,
      kind: "presentation",
      filename: "slides-v1.pdf",
      r2_key: v1R2Key,
      size_bytes: registerSlidesPdfAsset(v1R2Key),
      content_type: "application/pdf",
      previous_file_id: null,
      uploaded_by_contact_id: fileChainSub.contactId,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  const v2R2Key = `sub/${fileChainSub.submissionId}/${filePresV2Id}-slides-v2.pdf`;
  statements.push(
    insertStmt("file", {
      id: filePresV2Id,
      submission_id: fileChainSub.submissionId,
      kind: "presentation",
      filename: "slides-v2.pdf",
      r2_key: v2R2Key,
      size_bytes: registerSlidesPdfAsset(v2R2Key),
      content_type: "application/pdf",
      previous_file_id: filePresV1Id,
      uploaded_by_contact_id: fileChainSub.contactId,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  const posterR2Key = `sub/${posterSub.submissionId}/${filePosterId}-poster.png`;
  statements.push(
    insertStmt("file", {
      id: filePosterId,
      submission_id: posterSub.submissionId,
      kind: "poster",
      filename: "poster.png",
      r2_key: posterR2Key,
      size_bytes: registerPngAsset(posterR2Key),
      content_type: "image/png",
      previous_file_id: null,
      uploaded_by_contact_id: posterSub.contactId,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  statements.push(
    insertStmt("file_comment", {
      id: seedId("file_comment", 1),
      file_id: filePresV2Id,
      author_contact_id: null,
      author_user_id: organizerUserId,
      body: "Looks great — could you bump the font size on slide 4 for readability from the back of the room?",
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  statements.push(
    insertStmt("file_comment", {
      id: seedId("file_comment", 2),
      file_id: filePresV2Id,
      author_contact_id: fileChainSub.contactId,
      author_user_id: null,
      body: "Good catch — done, re-uploaded with the larger font.",
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // --- resource file (DEC-047): a file row kind 'resource' (submission_id
  // null), exposed via a resource row kind 'file'.
  const resourceFileId = seedId("file", 4);
  const resourceR2Key = `resource/${resourceFileId}-speaker-slide-template.pdf`;
  statements.push(
    insertStmt("file", {
      id: resourceFileId,
      submission_id: null,
      kind: "resource",
      filename: "speaker-slide-template.pdf",
      r2_key: resourceR2Key,
      size_bytes: registerPdfAsset(resourceR2Key),
      content_type: "application/pdf",
      previous_file_id: null,
      uploaded_by_contact_id: null,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  statements.push(
    insertStmt("resource", {
      id: seedId("resource", 4),
      event_id: eventId,
      kind: "file",
      title: "Speaker slide template",
      content: null,
      file_id: resourceFileId,
      position: 3,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // --- headshots (DEC-028): headshot file rows for several seeded contacts,
  // with contact.headshot_url following the '/headshots/<fileId>' convention
  // set by src/server/repo/profile.ts's setContactHeadshot. Task w1-d /
  // DEC-145: bytes come from the real docs/fixtures/headshot.png fixture (not
  // the synthetic 1x1 PNG), and headshots go on contacts with accepted
  // sessions so the public speakers directory/gallery (which only lists
  // accepted+visible participants — src/server/repo/public.ts) actually
  // renders these images.
  function seedHeadshot(contactId: string, n: number): void {
    const fileId = seedId("file", 10 + n);
    const r2Key = `headshot/${contactId}/${fileId}-headshot.png`;
    statements.push(
      insertStmt("file", {
        id: fileId,
        submission_id: null,
        kind: "headshot",
        filename: "headshot.png",
        r2_key: r2Key,
        size_bytes: registerHeadshotPngAsset(r2Key),
        content_type: "image/png",
        previous_file_id: null,
        uploaded_by_contact_id: contactId,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
    statements.push(
      `UPDATE contact SET "headshot_url" = ${sqlQuote(`/headshots/${fileId}`)} WHERE "id" = ${sqlQuote(contactId)};`,
    );
  }
  seedHeadshot(speakerContactId, 1);
  seedHeadshot(speaker2ContactId, 2);
  // Two accepted synthetic speakers (synth_contact indices 0 and 19, i.e.
  // seed indices bumped/originally 'accepted' — see additionalCount loop
  // above) so the public directory/gallery show more than the two named
  // fixture speakers with real headshots.
  seedHeadshot(seedId("synth_contact", 1), 3);
  seedHeadshot(seedId("synth_contact", 20), 4);

  // --- fixture 'Acceptance Notification' email template (DEC-006 merge fields) ---
  for (const field of ["speaker_name", "talk_title"] as const) {
    if (!MERGE_FIELDS.includes(field)) {
      throw new Error(`merge field '${field}' is not in the DEC-006 whitelist`);
    }
  }
  const emailTemplateId = seedId("email_template", 1);
  statements.push(
    insertStmt("email_template", {
      id: emailTemplateId,
      event_id: eventId,
      name: "Acceptance Notification",
      subject: fixture.communications.acceptance_subject,
      body_text: fixture.communications.acceptance_body,
      body_html: null,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // --- email log (dev sink history, DEC-006): a few 'sent' acceptance
  // notifications so Comms history renders with real rows.
  acceptedSubmissions.slice(0, 3).forEach((acc, i) => {
    statements.push(
      insertStmt("email_log", {
        id: seedId("email_log", i + 1),
        event_id: eventId,
        template_id: emailTemplateId,
        contact_id: acc.contactId,
        to_email: acc.email,
        subject: fixture.communications.acceptance_subject,
        body_text: fixture.communications.acceptance_body,
        body_html: null,
        ics_text: null,
        ics_filename: null,
        provider: "dev",
        status: "sent",
        sent_at: nextTs(),
        created_at: ts,
      }),
    );
  });

  const sql = statements.join("\n") + "\n";
  writeFileSync(OUTPUT_PATH, sql, "utf-8");
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${statements.length} statements to ${OUTPUT_PATH}`);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${manifest.length} asset manifest entries to ${MANIFEST_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
