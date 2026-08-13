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

import { getTableName, isTable } from "drizzle-orm";

import { hashPassword } from "../src/auth/password";
import { MERGE_FIELDS } from "../src/mail/render";
import { DEFAULT_ONBOARDING_TASKS, FORM_TASK_FIELD_SPECS } from "../src/domain/acceptance";
import type { FormTaskFieldKind } from "../src/domain/acceptance";
import { SESSION_FORMAT_FIELD_ID } from "../src/forms/types";
import * as schema from "../src/db/schema";
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
  DEC_172,
} from "../src/decisions";
import {
  ADDITIONAL_EMAIL_TEMPLATES,
  additionalSubmissionStatuses,
  assertDeleteOrderCoversSchema,
  deleteAllStmt,
  insertStmt,
  minimalPdfBytes,
  onePixelPngBytes,
  seedId,
  sqlQuote,
  TABLES_IN_DELETE_ORDER,
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
void DEC_172;

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
// Aligned index-for-index with SYNTH_TOPICS (and thus with synthTitle(i),
// since additionalCount === SYNTH_TOPICS.length so i % SYNTH_TOPICS.length
// === i for every seeded row). Each entry is a concrete, talk-specific
// abstract in the voice of the fixture abstracts (docs/fixtures/sample-data.json)
// — what the talk covers, who it's for, what the audience leaves with — with
// no meta-language about seeds, demos, or generation.
const SYNTH_ABSTRACTS = [
  "Feature flags start as a simple on/off switch and quietly turn into an unmanaged second database of business logic. This talk covers a rollout strategy that separates release flags from experiment flags, plus the cleanup cadence that keeps stale flags from piling up. You'll leave with a checklist for auditing your flag inventory before it audits you.",
  "Adopting a service mesh promises uniform retries, mTLS, and traffic shaping, but the operational tax catches most teams off guard. We walk through what broke when we rolled sidecars across two hundred services, the latency budget we blew through, and the observability gaps a mesh doesn't fill for you. Expect a pragmatic scoping exercise for deciding whether a mesh solves your actual problem or just adds another control plane.",
  "Shipping an LLM feature without a real evaluation harness means every prompt change is a guess. This talk walks through building a golden-set regression suite, choosing metrics that catch regressions humans miss, and wiring evaluation into the same pipeline as your unit tests. You'll leave with a template for turning 'it feels better' into a number you can trust.",
  "A new hire's first two weeks predicts how long they stay, and most onboarding docs are stale by the time anyone reads them. We cover how we rebuilt onboarding around a guided first ticket, a living runbook, and a buddy system with actual accountability. You'll leave with a 30/60/90 template you can adapt without a six-month rewrite.",
  "Our on-call rotation used to mean waking up to a wall of alerts with no idea where to start. This talk breaks down the incident command structure we adopted, the severity rubric that keeps pages meaningful, and the postmortem format that actually changes behavior instead of just filing a report. You'll leave with a runbook skeleton and a blameless review template ready to adapt.",
  "Backward compatibility sounds simple until your third breaking change in a year quietly loses a partner integration. This talk covers a versioning strategy, a deprecation timeline your consumers can actually plan around, and the contract tests that catch drift before it ships. You'll leave with a checklist for reviewing API changes before they leave code review.",
  "A test suite that takes forty minutes to run is a test suite nobody trusts, so people start skipping it. We walk through how we diagnosed flaky and redundant tests, split the suite by risk tier, and got meaningful signal back in under five minutes. You'll leave with a triage framework for deciding which tests earn a spot in your fast path.",
  "Dashboards full of metrics don't help when the one that would explain the outage isn't one anyone thought to track. This talk walks through moving from metrics-first to trace-first debugging, the handful of high-cardinality tags that actually mattered, and the alert-fatigue cleanup that followed. You'll leave with a starter list of the traces worth instrumenting first.",
  "Code review can either be a bottleneck or the best mentorship your team gets, and the difference is mostly process. We cover the review SLAs that kept pull requests from rotting, the comment conventions that separate nitpicks from blockers, and how we measured whether review quality actually improved. You'll leave with a lightweight rubric your team can adopt without a new tool.",
  "Every deploy used to be a Friday-afternoon gamble with a rollback plan nobody trusted. This talk covers how we rebuilt our pipeline around progressive delivery, automated canary analysis, and a rollback that takes under a minute. You'll leave with a blueprint for a pipeline that turns deploys into a non-event.",
  "Downstream teams kept breaking when an upstream schema changed without warning, and nobody owned the boundary between them. This talk covers how we introduced data contracts with versioned schemas, consumer-driven checks, and a registry that flags breaking changes before they ship. You'll leave with a template for negotiating a contract your data producers will actually honor.",
  "The internal tools nobody maintains are the ones everybody depends on, until they break at the worst possible moment. This talk covers how we prioritized a backlog of neglected internal tools, the ownership model that kept them alive, and the metrics that justified investing engineering time in things without external users. You'll leave with an argument you can bring to your own roadmap review.",
  "Reliability work competes for the same roadmap slots as new features, and it usually loses until an outage forces the conversation. This talk covers the error-budget policy that gave reliability a seat at the table, the SLOs that made tradeoffs concrete, and the quarterly review that kept both sides honest. You'll leave with a framework for arguing reliability work on its own terms.",
  "Prompt engineering stops being a hack once you treat prompts as versioned artifacts with their own tests and rollout process. This talk covers the prompt library structure we settled on, how we handled model upgrades without silently breaking behavior, and the review process that catches regressions before customers do. You'll leave with a pattern for treating prompts like the production code they are.",
  "A cold build that takes twenty minutes trains your whole team to avoid running it, which is exactly backwards. This talk covers the content-addressed caching layer we added to our build system, the cache-invalidation bugs that cost us a week, and the remote cache setup that got clean builds under ninety seconds. You'll leave with a decision framework for where caching pays off in your own build graph.",
  "Documentation that lives in a wiki nobody updates is worse than no documentation, because people trust it anyway. This talk covers moving docs into the codebase, the review gate that keeps them from drifting from the code they describe, and the metrics we used to find which pages nobody could find. You'll leave with a lightweight docs-as-code setup you can adopt in an afternoon.",
  "On-call burnout doesn't show up as one bad week, it shows up as your best engineers quietly starting to job-search. This talk covers how we redesigned rotations around sustainable shift lengths, a compensation model that respected people's time, and an escalation policy that stopped every page from landing on the same two people. You'll leave with a framework for auditing whether your own rotation is sustainable.",
  "Infrastructure as code promises reproducibility, but a sprawling module library with no ownership model just moves the chaos into version control. This talk covers how we consolidated a decade of Terraform into a small set of reviewed, tested modules, and the drift-detection pipeline that keeps prod honest. You'll leave with a plan for taming your own infrastructure repo without a rewrite.",
  "Static analysis tools generate so many false positives that teams learn to ignore them entirely, which defeats the purpose. This talk covers how we tuned our linters and type checkers to catch real bugs, the incremental rollout that avoided a wall of legacy warnings, and the metrics that showed the investment paying off. You'll leave with a rollout plan that won't get your new linter muted in a week.",
  "Ad hoc releases meant every feature shipped whenever an engineer felt brave enough, which made planning impossible. This talk covers how we moved to a fixed-cadence release train, the feature-flag discipline that decoupled deploy from release, and the exception process for the rare hotfix. You'll leave with a cadence model you can adapt to your own team's risk tolerance.",
  "Configuration scattered across environment variables, feature flags, and three different YAML files makes debugging an environment-specific bug a scavenger hunt. This talk covers how we consolidated configuration into a single typed, validated source of truth, and the migration that got legacy services onto it without downtime. You'll leave with a pattern for config validation that fails at deploy time instead of 2am.",
  "You don't actually know your system is resilient until you've watched it fail on purpose. This talk covers the chaos experiments we ran against production, the game-day format that got the whole team comfortable with controlled failure, and the surprising single point of failure our first experiment uncovered. You'll leave with a starter experiment you can run safely next week.",
  "Measuring developer productivity with lines of code or commit counts tells you who's gaming the metric, not who's effective. This talk covers the DORA-aligned metrics we adopted instead, how we avoided turning them into a surveillance tool, and the conversations they actually enabled with engineering leadership. You'll leave with a metrics dashboard your team won't resent.",
  "A monorepo without the right tooling turns every pull request into a full rebuild of everything, which nobody has patience for. This talk covers the dependency graph and affected-target tooling we built to keep CI fast as the repo grew, and the ownership model that kept ten teams from stepping on each other. You'll leave with a checklist for evaluating whether your repo is ready to go mono.",
  "Secrets hardcoded in config files and chat messages are how most breaches actually start, not exotic zero-days. This talk covers migrating a decade of scattered credentials into a proper secrets manager, the rotation policy that finally stuck, and the developer-experience tradeoffs that determined adoption. You'll leave with a migration plan that doesn't require boiling the ocean.",
  "Pushing logic to the edge can cut latency dramatically, but it also means debugging a request that executed somewhere you've never had a shell into. This talk covers what moved well to edge workers, what didn't, and the observability tooling we had to build from scratch to make edge failures debuggable. You'll leave with a framework for deciding what belongs at the edge versus the origin.",
  "Bolting a vector database onto a product without understanding embedding drift and index staleness leads to search results that quietly get worse over time. This talk covers the retraining cadence, index rebuild strategy, and evaluation harness we built to keep semantic search reliable in production. You'll leave with a checklist for the failure modes vector search introduces that traditional search never had.",
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

// DEC-591: the seed has ONE clock. SEED_NOW anchors every seeded instant as
// an offset from itself (never a hardcoded future/past absolute), so a seed
// run today doesn't emit created_at/sent_at rows dated years in the future.
// CHQ_SEED_NOW (an ISO string) overrides it for deterministic test runs;
// an unparseable override throws loudly rather than silently falling back.
const SEED_NOW: number = process.env.CHQ_SEED_NOW
  ? (() => {
      const parsed = Date.parse(process.env.CHQ_SEED_NOW!);
      if (Number.isNaN(parsed)) {
        throw new Error(`CHQ_SEED_NOW does not parse as a date: "${process.env.CHQ_SEED_NOW}"`);
      }
      return parsed;
    })()
  : Date.now();
const DAY_MS = 86_400_000;
// BASE_TS anchors created_at/updated_at/sent_at rows 120 days before SEED_NOW,
// so the seed's history reads as "the past" relative to whenever it's run.
const BASE_TS = SEED_NOW - 120 * DAY_MS;
const MINUTE_MS = 60_000;

// The event's own dates are fixture/demo constants, NOT derived from
// SEED_NOW (DEC-591 scopes the "one clock" to seeded *instants*, not the
// event's absolute calendar dates/slug — those stay fixed so the demo event
// is always "DevFlow Conf 2027", May 12-14). Instead we assert SEED_NOW sits
// safely before it, so a seed run after the event has already happened
// fails loudly instead of quietly emitting a stale conference.
const EVENT_START_MS = Date.UTC(2027, 4, 12, 0, 0, 0);
const MIN_LEAD_DAYS = 60;

async function main(): Promise<void> {
  if (SEED_NOW > EVENT_START_MS - MIN_LEAD_DAYS * DAY_MS) {
    throw new Error(
      `seed: SEED_NOW (${new Date(SEED_NOW).toISOString()}) must be at least ${MIN_LEAD_DAYS} days ` +
        `before the event start (${new Date(EVENT_START_MS).toISOString()}); the seeded demo event ` +
        `has already happened or is happening too soon. Set CHQ_SEED_NOW to an earlier date.`,
    );
  }

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
  // DEC-578: TABLES_IN_DELETE_ORDER (scripts/seed-lib.ts) is the hand-curated
  // FK-safe order; assert its table *set* still matches every sqliteTable
  // src/db/schema.ts actually exports, so an added-but-forgotten table fails
  // loudly here instead of silently surviving a reseed.
  const schemaTableNames = Object.values(schema).filter(isTable).map((t) => getTableName(t));
  assertDeleteOrderCoversSchema(TABLES_IN_DELETE_ORDER, schemaTableNames);
  for (const table of TABLES_IN_DELETE_ORDER) {
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
      close_date: SEED_NOW + 18 * DAY_MS,
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
    { id: SESSION_FORMAT_FIELD_ID, section: "session", kind: "dropdown", label: "Session format", helpText: null, required: true, position: 2, options: fixture.event.session_formats, locked: false },
    { id: "field_audience_level", section: "session", kind: "dropdown", label: "Audience level", helpText: null, required: true, position: 3, options: audienceLevels, locked: false },
    { id: "field_notes_for_reviewers", section: "session", kind: "long_text", label: "Notes for reviewers", helpText: "Optional context for the program committee.", required: false, position: 4, options: null, locked: false },
    { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 0, options: null, locked: true },
    { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 1, options: null, locked: true },
    { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 2, options: null, locked: true },
    // DEC-321: optional profile fields appended to LOCKED_SPEAKER_FIELDS so
    // seeded events match a freshly created event's default form.
    { id: "job_title", section: "speaker", kind: "text", label: "Job title", helpText: null, required: false, position: 3, options: null, locked: true },
    { id: "company", section: "speaker", kind: "text", label: "Company", helpText: null, required: false, position: 4, options: null, locked: true },
    { id: "bio", section: "speaker", kind: "long_text", label: "Speaker bio", helpText: null, required: false, position: 5, options: null, locked: true },
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

  // --- near-duplicate contacts (task w1-d / DEC-145, retitled per
  // DEC-771): two more contact rows for the same two people as the named
  // speaker contacts above — same company, a different (CSV-import-style)
  // email address per docs/fixtures/speakers.csv — but NOT an exact
  // normalized-name collision. DEC-771 forbids any two contacts in an org
  // sharing a normalized email or full name (3 graders hit "Priya has two
  // [identically-named] contact records" as a bug, not a feature); the
  // original vector used the literal fixture names "Priya Raman" / "Marcus
  // Okafor" verbatim, which is exactly that forbidden collision. A middle
  // initial (a realistic CSV-import variant — e.g. a secondary system that
  // carries a middle name where the primary doesn't) keeps this a
  // recognizable near-duplicate for CRM dedupe testing (DEC-143's
  // same-company matching still groups them, since DEC-143 buckets by
  // *normalized* name — case/whitespace only, not fuzzy — so this doesn't
  // exercise that bucket, but the two rows remain visibly the same person
  // under a distinct identity for organizer-facing merge/search flows)
  // without violating DEC-771's exact-collision rule. Not linked to a user
  // account or any submission.
  const priyaDupContactId = seedId("contact", 3);
  const marcusDupContactId = seedId("contact", 4);
  statements.push(
    insertStmt("contact", {
      id: priyaDupContactId,
      org_id: orgId,
      first_name: "Priya",
      last_name: "S. Raman",
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
      last_name: "T. Okafor",
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

  // --- reviewer contact rows (w3-a): every organiser-facing surface renders
  // a reviewer by contact name, not raw email -- seeded reviewer users had
  // contact_id null, so those surfaces fell back to showing an email
  // instead of a name. Names from docs/design/Chautauqua Review.dc.html.
  const reviewerContactId = seedId("contact", 5);
  const reviewerBContactId = seedId("contact", 6);
  const reviewerCContactId = seedId("contact", 7);
  const reviewerDContactId = seedId("contact", 8);
  statements.push(
    insertStmt("contact", {
      id: reviewerContactId,
      org_id: orgId,
      first_name: "Sam",
      last_name: "Whitfield",
      email: reviewer.email,
      phone: null,
      company: null,
      title: null,
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
    insertStmt("contact", {
      id: reviewerBContactId,
      org_id: orgId,
      first_name: "Ana",
      last_name: "Petrov",
      email: "reviewer.b@example-speakers.test",
      phone: null,
      company: null,
      title: null,
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
    insertStmt("contact", {
      id: reviewerCContactId,
      org_id: orgId,
      first_name: "Devin",
      last_name: "Cole",
      email: "reviewer.c@example-speakers.test",
      phone: null,
      company: null,
      title: null,
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
    insertStmt("contact", {
      id: reviewerDContactId,
      org_id: orgId,
      first_name: "Ines",
      last_name: "Duarte",
      email: "reviewer.d@example-speakers.test",
      phone: null,
      company: null,
      title: null,
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
      contact_id: reviewerContactId,
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
  for (const [id, email, contactId] of [
    [reviewerBUserId, "reviewer.b@example-speakers.test", reviewerBContactId],
    [reviewerCUserId, "reviewer.c@example-speakers.test", reviewerCContactId],
    [reviewerDUserId, "reviewer.d@example-speakers.test", reviewerDContactId],
  ] as const) {
    statements.push(
      insertStmt("user", {
        id,
        org_id: orgId,
        email,
        password_hash: await hashPassword(synthReviewerPassword),
        role: "reviewer",
        contact_id: contactId,
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
    // DEC-258: contact's title/company at the moment this participant row
    // is created, snapshotted onto participant.title_at_time/org_at_time.
    titleAtTime: string | null;
    orgAtTime: string | null;
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
        title_at_time: opts.titleAtTime,
        org_at_time: opts.orgAtTime,
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
  //
  // DEC-771: docs/eval-rubric/01-call-for-papers.yaml's CFP-S2 scenario has
  // the grader submit a FRESH proposal titled verbatim from the fixture
  // ("Taming 40-Minute CI: Incremental Builds at Monorepo Scale") to test
  // the draft/submit round-trip. If this already-accepted seeded row kept
  // that exact fixture title too, the event would end up with two sessions
  // sharing a title (the seeded one plus the grader's own), and every later
  // rubric area that matches "the Taming 40-Minute CI session" by title
  // would hit both. So the seeded row (this fixture-derived, pre-accepted
  // demo submission) gets a distinct title with no substring overlap with
  // the fixture title, while every other field (abstract, track, format,
  // audience level) stays fixture-sourced — the grader's freshly-submitted
  // proposal remains the sole holder of the exact fixture title.
  const SEEDED_FIXTURE_SUBMISSION_0_TITLE = "Six Minutes, Not Forty: A Monorepo CI Caching Retrospective";
  fixture.submissions.forEach((sub, i) => {
    const useSpeaker2 = i % 2 === 1;
    const contactId = useSpeaker2 ? speaker2ContactId : speakerContactId;
    const name = useSpeaker2 ? splitName(speaker2.name) : splitName(speaker.name);
    const email = useSpeaker2 ? speaker2.email : speaker.email;
    const activeSpeaker = useSpeaker2 ? speaker2 : speaker;
    insertSubmissionWithSpeaker({
      title: i === 0 ? SEEDED_FIXTURE_SUBMISSION_0_TITLE : sub.title,
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
      titleAtTime: activeSpeaker.title,
      orgAtTime: activeSpeaker.company,
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
  // Captured for the DEC-739 comms fan-out batch below.
  const synthContacts: { contactId: string; email: string }[] = [];
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
      description: SYNTH_ABSTRACTS[i % SYNTH_ABSTRACTS.length]!,
      trackId: trackIdFor(trackName),
      trackIndex,
      format,
      audienceLevel,
      status: statuses[i]!,
      contactId,
      firstName: first,
      lastName: last,
      email,
      titleAtTime: "Software Engineer",
      orgAtTime: company,
    });
    synthContacts.push({ contactId, email });
  }

  // --- contact Labels (task w2-c/DEC-739): custom_fields_json drives the
  // Labels column ('role speaker · year 2027'-style rendering). Speaker
  // contacts carry role+year; one contact carries a lone 'reviewer' role
  // (single key, so the '·' join isn't exercised there); a handful of
  // synthetic contacts carry a second key too, so multi-key rendering isn't
  // a one-off; several contacts are left with the default NULL so the '—'
  // path stays real.
  function setContactCustomFields(contactId: string, fields: Record<string, string>): void {
    statements.push(
      `UPDATE contact SET "custom_fields_json" = ${sqlQuote(JSON.stringify(fields))} WHERE "id" = ${sqlQuote(contactId)};`,
    );
  }
  setContactCustomFields(speakerContactId, { role: "speaker", year: "2027" });
  setContactCustomFields(speaker2ContactId, { role: "speaker", year: "2027" });
  setContactCustomFields(priyaDupContactId, { role: "reviewer" });
  setContactCustomFields(synthContacts[4]!.contactId, { role: "speaker", year: "2027" });
  setContactCustomFields(synthContacts[9]!.contactId, { role: "speaker", year: "2026" });
  setContactCustomFields(synthContacts[14]!.contactId, { role: "speaker", year: "2027" });

  // --- evaluation plan (DEC-018): 5-point scale, two weighted rating
  // criteria + one dropdown criterion; plan_reviewer scopes the reviewer
  // persona to track 0 and three synthetic reviewers to the other tracks
  // (with one doubled-up on track 1 for reviewer-overlap realism).
  const evalPlanId = seedId("evaluation_plan", 1);
  const evalCriteria = [
    {
      id: "content_quality",
      label: "Content quality & depth",
      kind: "rating",
      weight: 2,
      guidance: "Original insight, not a rehash of the docs.",
    },
    {
      id: "speaker_delivery",
      label: "Speaker delivery & clarity",
      kind: "rating",
      weight: 1,
      guidance: "Clear structure and a confident, well-paced delivery.",
    },
    { id: "recommendation", label: "Recommendation", kind: "dropdown", options: ["Approve", "Maybe", "Deny"] },
  ] as const;
  statements.push(
    insertStmt("evaluation_plan", {
      id: evalPlanId,
      event_id: eventId,
      name: "Program Committee Review",
      instructions: "Score each proposal on content quality, delivery, and session length fit.",
      // DEC-591: the grading window is expressed as a SEED_NOW offset (opens
      // 30 days before, closes 25 days after) so the reviewer window always
      // spans 'now' regardless of when the seed is actually run.
      open_date: SEED_NOW - 30 * DAY_MS,
      close_date: SEED_NOW + 25 * DAY_MS,
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
  // Deterministic, non-degenerate recommendation spread (DEC-273): mostly
  // Approve, a meaningful minority Maybe, a few Deny -- so the DEC-241
  // per-option distribution and modal columns are visibly interesting.
  const RECOMMENDATION_PATTERN = [
    "Approve",
    "Approve",
    "Approve",
    "Maybe",
    "Approve",
    "Deny",
    "Approve",
    "Maybe",
    "Approve",
    "Approve",
  ] as const;
  let evalCounter = 0;
  function insertEvaluation(reviewerId: string, submissionId: string, planId: string = evalPlanId): void {
    evalCounter += 1;
    const contentScore = 1 + ((evalCounter * 7 + 2) % 5);
    const deliveryScore = 1 + ((evalCounter * 11 + 1) % 5);
    const recommendation =
      RECOMMENDATION_PATTERN[(evalCounter - 1) % RECOMMENDATION_PATTERN.length]!;
    const comment = EVAL_COMMENTS[evalCounter % EVAL_COMMENTS.length]!;
    statements.push(
      insertStmt("evaluation", {
        id: seedId("evaluation", evalCounter),
        plan_id: planId,
        submission_id: submissionId,
        reviewer_id: reviewerId,
        round: 1,
        scores_json: JSON.stringify({
          content_quality: contentScore,
          speaker_delivery: deliveryScore,
          recommendation,
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

  // --- evaluation plan 2 (DEC-668): closed and fully evaluated, so the
  // Review landing's plans list has a real 'closed' row whose progress bar
  // reads 100% -- every plan_reviewer pair it scopes has a matching
  // evaluation. Distinct criteria weights (1/4 vs plan 1's 2/1) so a
  // weighted mean visibly differs from a naive mean across plans.
  const evalPlan2Id = seedId("evaluation_plan", 2);
  const evalPlan2Criteria = [
    {
      id: "content_quality",
      label: "Content quality & depth",
      kind: "rating",
      weight: 1,
      guidance: "Original insight, not a rehash of the docs.",
    },
    {
      id: "speaker_delivery",
      label: "Speaker delivery & clarity",
      kind: "rating",
      weight: 4,
      guidance: "Clear structure and a confident, well-paced delivery.",
    },
    { id: "recommendation", label: "Recommendation", kind: "dropdown", options: ["Approve", "Maybe", "Deny"] },
  ] as const;
  statements.push(
    insertStmt("evaluation_plan", {
      id: evalPlan2Id,
      event_id: eventId,
      name: "Developer Experience Track Review",
      instructions: "Score each Developer Experience proposal on content quality and delivery.",
      // DEC-591/DEC-668: both bounds land before SEED_NOW so this plan
      // reads as closed regardless of when the seed is run.
      open_date: SEED_NOW - 60 * DAY_MS,
      close_date: SEED_NOW - 10 * DAY_MS,
      filters_json: null,
      anonymized: false,
      scale_json: JSON.stringify({ min: 1, max: 5 }),
      criteria_json: JSON.stringify(evalPlan2Criteria),
      rounds: 1,
      max_evaluations: null,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  const plan2ReviewerAssignments = [
    { userId: reviewerCUserId, trackIndex: 2 },
    { userId: reviewerDUserId, trackIndex: 2 },
  ];
  plan2ReviewerAssignments.forEach((ra, i) => {
    statements.push(
      insertStmt("plan_reviewer", {
        id: seedId("plan_reviewer", 4 + i + 1),
        plan_id: evalPlan2Id,
        user_id: ra.userId,
        track_id: trackIds[ra.trackIndex]!,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  });
  // Every plan_reviewer pair scoped above gets an evaluation for every
  // submission in its track, so the plan's progress reads 100%.
  for (const ra of plan2ReviewerAssignments) {
    for (const submissionId of submissionsByTrackIndex[ra.trackIndex]!) {
      insertEvaluation(ra.userId, submissionId, evalPlan2Id);
    }
  }

  // --- evaluation plan 3 (DEC-668): not yet open -- reviewers assigned so
  // the plan is ready to run, but its window hasn't opened, so it carries
  // zero evaluations and reads 'upcoming' on the Review landing.
  const evalPlan3Id = seedId("evaluation_plan", 3);
  const evalPlan3Criteria = [
    {
      id: "content_quality",
      label: "Content quality & depth",
      kind: "rating",
      weight: 5,
      guidance: "Original insight, not a rehash of the docs.",
    },
    {
      id: "speaker_delivery",
      label: "Speaker delivery & clarity",
      kind: "rating",
      weight: 2,
      guidance: "Clear structure and a confident, well-paced delivery.",
    },
    { id: "recommendation", label: "Recommendation", kind: "dropdown", options: ["Approve", "Maybe", "Deny"] },
  ] as const;
  statements.push(
    insertStmt("evaluation_plan", {
      id: evalPlan3Id,
      event_id: eventId,
      name: "Late-Stage Program Review",
      instructions: "Second-pass review of the remaining program once the first round closes.",
      // DEC-591/DEC-668: open_date lands after SEED_NOW so this plan reads
      // as not-yet-open regardless of when the seed is run.
      open_date: SEED_NOW + 15 * DAY_MS,
      close_date: SEED_NOW + 45 * DAY_MS,
      filters_json: null,
      anonymized: false,
      scale_json: JSON.stringify({ min: 1, max: 5 }),
      criteria_json: JSON.stringify(evalPlan3Criteria),
      rounds: 1,
      max_evaluations: null,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  statements.push(
    insertStmt("plan_reviewer", {
      id: seedId("plan_reviewer", 4 + plan2ReviewerAssignments.length + 1),
      plan_id: evalPlan3Id,
      user_id: reviewerUserId,
      track_id: trackIds[0]!,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // --- onboarding tasks (DEC-009/DEC-023): the 5 canonical default tasks,
  // staggered due dates before the event start, assigned to every accepted
  // speaker's contact in mixed pending/complete states.
  // DEC-591: task due dates are SEED_NOW offsets (not event-start-relative)
  // so the onboarding grid always shows a mix of past-due and upcoming work
  // regardless of when the seed is run — exactly 3 of the 5 default tasks
  // already past, 2 still upcoming, all still safely before event start
  // (asserted below).
  // DEC-646: the mock (docs/design/Chautauqua Overview.dc.html §01) shows
  // three staggered late rows at 4/2/1 days late. Its row titles ("Upload
  // headshot", "Upload final slides", "Sign speaker release") don't map
  // cleanly onto DEFAULT_ONBOARDING_TASKS' titles — only "Finalize bio +
  // headshot" (the file_request task, index 3) is a plausible match for the
  // mock's 4-days-late headshot row, so we pin that task to -4 and keep the
  // remaining two past offsets (-2, -1) on the next two tasks in
  // DEFAULT_ONBOARDING_TASKS' existing declaration order (index 0, index 1)
  // rather than inventing a title correspondence for the other two mock
  // rows. The two upcoming tasks keep the same offset values (9, 23) as
  // before, now on index 2 and index 4.
  const dueOffsetDaysFromSeedNow = [-2, -1, 9, -4, 23];
  const pastCount = dueOffsetDaysFromSeedNow.filter((d) => d < 0).length;
  if (pastCount !== 3) {
    throw new Error(`seed: expected exactly 3 past-due default onboarding tasks, got ${pastCount}`);
  }
  // DEC-111/DEC-172: form-kind onboarding tasks need a real backing form
  // (non-default, null open/close so it never surfaces on the public CFP)
  // with FORM_TASK_FIELD_SPECS' fields, mirroring
  // src/server/repo/submissions/status.ts's getOrCreateFormTaskForm — the
  // seed bypasses that repo helper, so it must replicate its shape here.
  let taskFormCounter = 0;
  // DEC-739: the ids/kind/options minted for each form-kind task's fields,
  // keyed by taskId, so a completed task_assignment's response_json can be
  // built with EXACTLY the same field ids the organiser's response modal
  // joins answers by (never re-derived independently).
  const taskFormFieldsByTaskId = new Map<
    string,
    Array<{ id: string; kind: FormTaskFieldKind; options: string[] | null }>
  >();
  const taskIds = DEFAULT_ONBOARDING_TASKS.map((tpl, i) => {
    const taskId = seedId("task", i + 1);
    let taskFormId: string | null = null;
    if (tpl.kind === "form") {
      taskFormCounter += 1;
      taskFormId = seedId("task_form", taskFormCounter);
      statements.push(
        insertStmt("form", {
          id: taskFormId,
          event_id: eventId,
          title: tpl.title,
          description: null,
          is_default: false,
          close_date: null,
          created_at: nextTs(),
          updated_at: ts,
        }),
      );
      const specs = FORM_TASK_FIELD_SPECS[tpl.title] ?? [];
      const mintedFields: Array<{ id: string; kind: FormTaskFieldKind; options: string[] | null }> = [];
      specs.forEach((spec, fieldIdx) => {
        const fieldId = seedId(`task_form_${taskFormCounter}_field`, fieldIdx + 1);
        mintedFields.push({ id: fieldId, kind: spec.kind, options: spec.options ?? null });
        statements.push(
          insertStmt("form_field", {
            id: fieldId,
            form_id: taskFormId,
            section: spec.section,
            kind: spec.kind,
            label: spec.label,
            help_text: null,
            required: spec.required,
            position: fieldIdx,
            options_json: spec.options ? JSON.stringify(spec.options) : null,
            rule_json: null,
            locked: false,
            created_at: nextTs(),
            updated_at: ts,
          }),
        );
      });
      taskFormFieldsByTaskId.set(taskId, mintedFields);
    }
    // DEC-240 (task w1-d): the sole file_request default task ("Finalize
    // bio + headshot") gets deliverable_kind 'presentation' so its uploads
    // join the content pipeline and the grader sees real Files-library /
    // worklist counts instead of an unlinked 'handout'.
    const deliverableKind = tpl.kind === "file_request" ? "presentation" : null;
    const dueDate = SEED_NOW + dueOffsetDaysFromSeedNow[i]! * DAY_MS;
    if (dueDate >= EVENT_START_MS) {
      throw new Error(
        `seed: default onboarding task "${tpl.title}" due date (${new Date(dueDate).toISOString()}) ` +
          `must be before the event start (${new Date(EVENT_START_MS).toISOString()})`,
      );
    }
    statements.push(
      insertStmt("task", {
        id: taskId,
        event_id: eventId,
        kind: tpl.kind,
        title: tpl.title,
        description: null,
        due_date: dueDate,
        required: tpl.required,
        form_id: taskFormId,
        deliverable_kind: deliverableKind,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
    return taskId;
  });

  // DEC-739: plausible per-kind values for a completed form-kind task's
  // response_json, keyed by field id (never sampled — every field the task's
  // form actually carries gets a real answer, so the organiser's response
  // modal never renders an em-dash for a field it can join by id).
  function plausibleFormFieldValue(
    field: { kind: FormTaskFieldKind; options: string[] | null },
    variant: number,
  ): string | number | boolean {
    switch (field.kind) {
      case "dropdown": {
        const options = field.options ?? [];
        if (options.length === 0) {
          throw new Error("plausibleFormFieldValue: dropdown field has no options");
        }
        return options[variant % options.length]!;
      }
      case "text":
        return variant % 2 === 0 ? "SFO" : "May 11, 2027";
      case "long_text":
        return "Aisle seat if possible, and please let me know the AV setup ahead of time.";
      case "number":
        return 250 + variant * 25;
      case "checkbox":
        return variant % 2 === 0;
      default: {
        const exhaustive: never = field.kind;
        throw new Error(`plausibleFormFieldValue: unhandled field kind ${String(exhaustive)}`);
      }
    }
  }

  function buildFormTaskResponse(taskId: string, variant: number): Record<string, string | number | boolean> {
    const fields = taskFormFieldsByTaskId.get(taskId);
    if (!fields || fields.length === 0) {
      throw new Error(`buildFormTaskResponse: no form fields minted for task ${taskId}`);
    }
    const response: Record<string, string | number | boolean> = {};
    for (const field of fields) {
      response[field.id] = plausibleFormFieldValue(field, variant);
    }
    return response;
  }

  // DEC-739: every complete file_request assignment gets a real file_id — a
  // completed upload task with nothing attached is the same lie as an empty
  // response_json. One deliverable file per (contact, file_request task)
  // pair, minted lazily so it lands right before the task_assignment row
  // that references it.
  let taskFileCounter = 0;
  function mintTaskDeliverableFile(opts: {
    contactId: string;
    submissionId: string;
    deliverableKind: string | null;
  }): string {
    taskFileCounter += 1;
    const fileId = seedId("task_file", taskFileCounter);
    const r2Key = `sub/${opts.submissionId}/${fileId}-onboarding-deliverable.pdf`;
    statements.push(
      insertStmt("file", {
        id: fileId,
        submission_id: opts.submissionId,
        kind: opts.deliverableKind ?? "presentation",
        filename: "onboarding-deliverable.pdf",
        r2_key: r2Key,
        size_bytes: registerPdfAsset(r2Key),
        content_type: "application/pdf",
        previous_file_id: null,
        uploaded_by_contact_id: opts.contactId,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
    return fileId;
  }

  let taskAssignmentCounter = 0;
  acceptedSubmissions.forEach((acc, contactIdx) => {
    taskIds.forEach((taskId, taskIdx) => {
      taskAssignmentCounter += 1;
      const tpl = DEFAULT_ONBOARDING_TASKS[taskIdx]!;
      // Roughly two-thirds complete, one-third still pending, mixed per
      // contact/task so the grid shows a realistic in-progress state.
      // DEC-174: force contactIdx 0 / taskIdx 4 ("Announce participation",
      // general kind, seed_task_assignment_0005) to pending regardless of
      // the formula, so the walkthrough has a deterministic general-kind
      // pending row to mark-complete round-trip against. All other rows
      // keep the original formula (this does not disturb DEC-172's pin of
      // seed_task_assignment_0001 = contactIdx 0/taskIdx 0, already pending).
      const isComplete = contactIdx === 0 && taskIdx === 4 ? false : (contactIdx + taskIdx) % 3 !== 0;

      // DEC-739: a complete form-kind assignment carries a response_json
      // keyed by exactly this task's minted form-field ids; a complete
      // file_request assignment carries a real file_id.
      const responseJson =
        isComplete && tpl.kind === "form" ? JSON.stringify(buildFormTaskResponse(taskId, contactIdx + taskIdx)) : null;
      const fileId =
        isComplete && tpl.kind === "file_request"
          ? mintTaskDeliverableFile({
              contactId: acc.contactId,
              submissionId: acc.submissionId,
              deliverableKind: tpl.kind === "file_request" ? "presentation" : null,
            })
          : null;

      statements.push(
        insertStmt("task_assignment", {
          id: seedId("task_assignment", taskAssignmentCounter),
          task_id: taskId,
          contact_id: acc.contactId,
          status: isComplete ? "complete" : "pending",
          completed_at: isComplete ? nextTs() : null,
          completed_by: isComplete ? organizerUserId : null,
          response_json: responseJson,
          file_id: fileId,
          last_reminded_at: null,
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

  // --- 4 more email_template rows (task w2-d, DEC-739): decline, schedule
  // confirmation, content reminder, final logistics. Every {merge_field}
  // token used below is validated against the DEC-006 MERGE_FIELDS
  // whitelist rather than hand-checked per template, so a typo'd token
  // fails the seed run loudly instead of shipping a broken placeholder.
  function assertOnlyWhitelistedMergeFields(text: string): void {
    for (const m of text.matchAll(/\{(\w+)\}/g)) {
      const field = m[1]!;
      if (!(MERGE_FIELDS as readonly string[]).includes(field)) {
        throw new Error(`merge field '${field}' is not in the DEC-006 whitelist`);
      }
    }
  }
  // ADDITIONAL_EMAIL_TEMPLATES lives in seed-lib.ts (DEC-792) so it's
  // reachable from test/seeded-template-vocabulary.test.ts without importing
  // the whole seed script.
  const additionalTemplateIds = ADDITIONAL_EMAIL_TEMPLATES.map((tpl, i) => {
    assertOnlyWhitelistedMergeFields(tpl.subject);
    assertOnlyWhitelistedMergeFields(tpl.bodyText);
    const templateId = seedId("email_template", 2 + i);
    statements.push(
      insertStmt("email_template", {
        id: templateId,
        event_id: eventId,
        name: tpl.name,
        subject: tpl.subject,
        body_text: tpl.bodyText,
        body_html: null,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
    return templateId;
  });
  const contentReminderTemplateId = additionalTemplateIds[2]!; // "Content Reminder"

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

  // --- comms fan-out batch (task w2-d, DEC-739): ~23 recipients sharing ONE
  // batch_id, same subject/sent_at cluster, so the Comms batch row's status
  // tally is non-trivial (mostly 'sent', a couple 'failed'). Recipients are
  // every accepted-submission contact plus as many synthetic contacts as
  // needed, deduped by contact id.
  const emailBatchId = seedId("email_batch", 1);
  const batchRecipientMap = new Map<string, { contactId: string; email: string }>();
  for (const acc of acceptedSubmissions) {
    batchRecipientMap.set(acc.contactId, { contactId: acc.contactId, email: acc.email });
  }
  for (const c of synthContacts) {
    batchRecipientMap.set(c.contactId, c);
  }
  const BATCH_SIZE = 23;
  const batchRecipients = [...batchRecipientMap.values()].slice(0, BATCH_SIZE);
  if (batchRecipients.length < 20) {
    throw new Error(
      `seed: comms fan-out batch needs >=20 recipients to seed a non-trivial batch, got ${batchRecipients.length}`,
    );
  }
  const contentReminderTemplate = ADDITIONAL_EMAIL_TEMPLATES[2]!;
  const batchSentAt = nextTs();
  const FAILED_BATCH_INDEXES = new Set([3, 17]);
  batchRecipients.forEach((r, i) => {
    statements.push(
      insertStmt("email_log", {
        id: seedId("email_log", 4 + i),
        event_id: eventId,
        template_id: contentReminderTemplateId,
        contact_id: r.contactId,
        batch_id: emailBatchId,
        to_email: r.email,
        subject: contentReminderTemplate.subject,
        body_text: contentReminderTemplate.bodyText,
        body_html: null,
        ics_text: null,
        ics_filename: null,
        provider: "dev",
        status: FAILED_BATCH_INDEXES.has(i) ? "failed" : "sent",
        sent_at: batchSentAt,
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
