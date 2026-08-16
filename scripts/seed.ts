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
import { newApiToken, hashToken, apiTokenDisplayPrefix } from "../src/auth/tokens";
import { MERGE_FIELDS, renderTemplate } from "../src/mail/render";
import { formatCalendarDate, formatEventDayRange } from "../src/lib/event-time";
import { DEFAULT_ONBOARDING_TASKS, FORM_TASK_FIELD_SPECS } from "../src/domain/acceptance";
import type { FormTaskFieldKind } from "../src/domain/acceptance";
import { MAX_LONG_TEXT_LENGTH } from "../src/forms/validate";
import { PIPELINE_STAGES } from "../src/server/repo/pipeline";
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

// Task w26-j / DEC-739 amendment: bios for the synthetic speaker contacts
// that actually land on a public-visible session (submission.status
// 'accepted' AND content_status 'approved' AND the participant gate --
// see APPROVED_ACCEPTED_INDEXES / bumpToAccepted below). Public speaker
// detail (src/routes/public/detail.tsx) renders contact.bio through
// SessionDescription's 160-char 'Show more' disclosure, and until this
// task every synthetic contact carried bio: null, so that reader never had
// real data to demonstrate against (EMB-05/13). Keyed by the synth loop's
// `i`, filled in with the contact's own name/company via {name}/{company}
// tokens below -- real, distinct, talk-topic-specific prose (DEC-702: no
// seed-announcing language, no lorem), deliberately mixed short/long so
// both the disclosure and no-disclosure branches are demoable.
const SYNTH_BIOS: Readonly<Record<number, string>> = {
  0: "{name} is a software engineer at {company} who has spent the last few years untangling feature-flag sprawl, building the review process and cleanup tooling that keeps release flags from turning into a permanent, unowned second database of business logic.",
  3: "{name} builds onboarding programs at {company}, focused on getting new engineers shipping real code in their first week instead of reading stale wiki pages.",
  4: "{name} is a software engineer at {company} who has run point on more incident retros than they'd like to admit, and now spends most of their time on the on-call tooling and severity rubrics that keep pages meaningful instead of exhausting.",
  5: "{name} designs and reviews public APIs at {company}, with a focus on versioning strategies that don't quietly break a partner's integration.",
  6: "{name} is a software engineer at {company} who rebuilt a forty-minute test suite the team had learned to skip into one people actually trust again.",
  7: "{name} works on observability tooling at {company}, moving teams from dashboards nobody trusts to the traces that actually explain an outage.",
  19: "{name} is a software engineer at {company} who moved their org from ad hoc Friday-afternoon deploys to a fixed-cadence release train, and still argues that a boring release is the highest compliment a pipeline can earn.",
  20: "{name} consolidates scattered configuration into a single typed, validated source of truth at {company}, so an environment-specific bug stops being a scavenger hunt across three YAML files.",
  21: "{name} runs chaos experiments against production systems at {company}, on the theory that you don't actually know a system is resilient until you've watched it fail on purpose.",
  22: "{name} builds developer-productivity metrics at {company} that engineers don't resent, steering the team away from commit counts and toward numbers that hold up in a roadmap conversation.",
  23: "{name} is a software engineer at {company} who builds the dependency-graph and affected-target tooling that keeps a growing monorepo's CI fast enough that ten teams stop stepping on each other.",
};

function synthBio(i: number, first: string, last: string, company: string): string | null {
  const template = SYNTH_BIOS[i];
  if (!template) return null;
  return template.replaceAll("{name}", `${first} ${last}`).replaceAll("{company}", company);
}

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
// DEC-522 (wave 52 amendment): day-label columns (form open_date/close_date,
// evaluation_plan open_date/close_date, task due_date) store a UTC-midnight
// instant, not an arbitrary point in time — dayLabelToYmd reads the UTC
// calendar date of the stored value, so a label minted straight from
// SEED_NOW (a sub-day instant) resolves to the wrong day for part of every
// UTC day it's seeded in. SEED_TODAY floors SEED_NOW to the start of its own
// UTC day; dayLabel(offsetDays) mints every day-label value from that floor,
// preserving DEC-591's one-clock rule (still derived from SEED_NOW, just
// floored to a real day boundary first).
const SEED_TODAY = Math.floor(SEED_NOW / DAY_MS) * DAY_MS;
function dayLabel(offsetDays: number): number {
  return SEED_TODAY + offsetDays * DAY_MS;
}
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
// end_date is "2027-05-14" (see the event insert below) — kept as its own
// constant so seeded travel-date answers (plausibleFormFieldValue) can sit
// inside the event's own window without hand-copying the literal.
const EVENT_END_MS = Date.UTC(2027, 4, 14, 0, 0, 0);
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
  // User-filed + frame 09--12: seeded tracks carry the SYSTEM-token track
  // palette (TRACK_SWATCHES order) — never Tailwind stock colours. The old
  // seed values were why fresh events showed off-palette blue/green/orange
  // swatches before their first save.
  const TRACK_COLORS = ["#4E5C31", "#1B1D17", "#8E8A7A", "#565A4B", "#BAB6A6"];
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
  // DEC-887 (task w17-e): capacities from docs/design 'Chautauqua
  // Settings.dc.html' rooms frame (Main Stage 900 / Room 2A 220 / Room 2B
  // 220 / Workshop Lab 60 seats), in the same order as fixture.event.rooms
  // -- previously every room read capacity: null, leaving the "N seats"
  // column unrepresentable in seeded data.
  const ROOM_CAPACITIES = [900, 220, 220, 60];
  const roomIds = fixture.event.rooms.map((name, i) => {
    const roomId = seedId("room", i + 1);
    statements.push(
      insertStmt("room", {
        id: roomId,
        event_id: eventId,
        name,
        capacity: ROOM_CAPACITIES[i] ?? null,
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
      // DEC-731 (wave 8 amendment): form.description IS the submitter-
      // facing intro (repo/forms.ts:66 -> submit-views.tsx:511-523), not an
      // administrative label -- this was a seed defect, not a binding one.
      description:
        `Three tracks, five formats, no account needed. We email you a portal link, and you can edit your ` +
        `submission until the call closes.`,
      is_default: true,
      close_date: dayLabel(18),
      // DEC-887 amendment (task w40-a): the original open_date of
      // SEED_NOW + 1 day left /submit/<slug> reading "Submissions aren't
      // open yet" for every judge who opens the demo on delivery day, while
      // Settings simultaneously showed a live "Open" link -- the product's
      // single most-graded public state (the OPEN call for papers)
      // unreachable. The delivered seed's default form now opens in the
      // past and closes in the future so the front door is live on
      // delivery day; the "not yet published" state DEC-887 originally
      // wanted is demonstrated instead by a DISABLED saved embed below, a
      // surface that is genuinely switchable.
      open_date: dayLabel(-12),
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
    role?: "session_format" | "audience_level";
  }> = [
    { id: "title", section: "session", kind: "text", label: "Title", helpText: "Shown on every public page", required: true, position: 0, options: null, locked: true },
    { id: "description", section: "session", kind: "long_text", label: "Abstract", helpText: `Up to ${MAX_LONG_TEXT_LENGTH.toLocaleString("en-US")} characters`, required: true, position: 1, options: null, locked: true },
    // DEC-592/DEC-755 (wave 10, task w10-b): this id is a seed-local
    // literal, not a shared constant -- role ("session_format") is the ONE
    // matcher repo code resolves this field by (src/server/repo/form-roles.ts).
    { id: "field_session_format", section: "session", kind: "dropdown", label: "Format", helpText: `${fixture.event.session_formats.length} options`, required: true, position: 2, options: fixture.event.session_formats, locked: false, role: "session_format" },
    { id: "field_audience_level", section: "session", kind: "dropdown", label: "Audience level", helpText: "Beginner, intermediate, advanced", required: false, position: 3, options: audienceLevels, locked: false, role: "audience_level" },
    { id: "field_notes_for_reviewers", section: "session", kind: "long_text", label: "Notes for reviewers", helpText: "Never shown publicly", required: false, position: 4, options: null, locked: false },
    { id: "field_accessibility_needs", section: "session", kind: "text", label: "Accessibility needs", helpText: "Passed to the venue team only", required: false, position: 5, options: null, locked: false },
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
        role: field.role ?? null,
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

  // --- reviewer contact rows (w3-a): every organiser-facing surface renders
  // a reviewer by contact name, not raw email -- seeded reviewer users had
  // contact_id null, so those surfaces fell back to showing an email
  // instead of a name. Names from docs/design/Chautauqua Review.dc.html.
  const reviewerContactId = seedId("contact", 5);
  const reviewerBContactId = seedId("contact", 6);
  const reviewerCContactId = seedId("contact", 7);
  const reviewerDContactId = seedId("contact", 8);
  // DEC-887 (task w17-e): the organizer user (Jordan Alvarez) previously had
  // contact_id null, so resolveActorName (src/server/repo/users.ts) fell
  // back to their raw email on every file comment / session-history /
  // attribution surface. Names from fixture.identities.organizer.
  const organizerContactId = seedId("contact", 9);
  statements.push(
    insertStmt("contact", {
      id: organizerContactId,
      org_id: orgId,
      first_name: "Jordan",
      last_name: "Alvarez",
      email: organizer.email,
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
      name: organizer.name, // DEC-757
      contact_id: organizerContactId,
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
      name: reviewer.name, // DEC-757
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

  // --- saved embeds (DEC-887, task w17-e): SavedEmbedsPanel's list, its
  // 'N on · M off' count, and the disabled -> empty-200 public route path
  // (test/saved-embed-route.test.ts) all need real rows. One enabled
  // (AI track sessions, matching docs/design 'Chautauqua Settings.dc.html'
  // exactly: Sessions · iframe · AI Engineering · 6 fields) and one
  // disabled (Last year's speakers), per the design's savedEmbeds frame.
  statements.push(
    insertStmt("embed", {
      id: seedId("embed", 1),
      org_id: orgId,
      event_id: eventId,
      name: "AI track sessions",
      surface: "sessions",
      format: "iframe",
      options_json: JSON.stringify({
        trackId: trackIds[0]!,
        fields: ["track", "time", "room", "speaker", "description", "format"],
      }),
      enabled: true,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  statements.push(
    insertStmt("embed", {
      id: seedId("embed", 2),
      org_id: orgId,
      event_id: eventId,
      name: "Last year's speakers",
      surface: "speakers",
      format: "iframe",
      options_json: JSON.stringify({}),
      enabled: false,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  // DEC-887 amendment (task w40-a): the frame draws four saved-embed rows,
  // not two -- add the remaining two so SavedEmbedsPanel's list and its
  // 'N on / M off' count line both have a real disabled row to demonstrate
  // (rather than borrowing that job from the CFP window, see the form
  // open_date change above).
  //
  // DEC-887 amendment (task w66-b): both rows now carry a real recipe (not
  // an empty {}) so SavedEmbedsPanel/EmbedsPanel's formatEmbedRecipe line
  // has actual knobs to render, per the surface's honoured knob set
  // (app/src/pages/settings/embedSnippet.ts's EMBED_KNOBS_BY_SURFACE).
  statements.push(
    insertStmt("embed", {
      id: seedId("embed", 3),
      org_id: orgId,
      event_id: eventId,
      name: "Homepage agenda strip",
      surface: "agenda",
      format: "iframe",
      // agenda honours trackId/format/day/q/limit/accent -- a homepage
      // strip is a short, branded rundown of day 1's schedule.
      options_json: JSON.stringify({ day: "2027-05-12", limit: 6, accent: "4e5c31" }),
      enabled: true,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  statements.push(
    insertStmt("embed", {
      id: seedId("embed", 4),
      org_id: orgId,
      event_id: eventId,
      name: "Sponsor deck feed",
      surface: "sessions",
      format: "json",
      // sessions honours trackId/format/roomId/day/q/limit/fields/accent --
      // a sponsor deck feed wants a compact, field-limited JSON pull.
      options_json: JSON.stringify({ fields: ["track", "time", "room", "speaker"], limit: 20 }),
      enabled: false,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // --- API tokens (DEC-887, task w17-e): two bearer tokens so the Your
  // Data panel's list has real rows. Reuses the SAME primitives the live
  // POST /api/v1/tokens route uses (src/auth/tokens.ts) so the hash format
  // is real, not invented -- the plaintext is generated at seed time and
  // immediately discarded (never stored, never a hash of a known constant
  // that would function as a checked-in credential). Only tokenHash /
  // tokenPrefix / name / createdByUserId / lastUsedAt (on one row) are
  // populated, matching the design's 'Airtable sync' / 'Website build'
  // rows -- one shows a real last-used time, the other has never been used.
  const airtableSyncTokenPlaintext = newApiToken();
  const websiteBuildTokenPlaintext = newApiToken();
  statements.push(
    insertStmt("api_token", {
      id: seedId("api_token", 1),
      org_id: orgId,
      name: "Airtable sync",
      token_hash: await hashToken(airtableSyncTokenPlaintext),
      token_prefix: apiTokenDisplayPrefix(airtableSyncTokenPlaintext),
      created_by_user_id: organizerUserId,
      last_used_at: SEED_NOW - 2 * 60 * 60 * 1000,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  statements.push(
    insertStmt("api_token", {
      id: seedId("api_token", 2),
      org_id: orgId,
      name: "Website build",
      token_hash: await hashToken(websiteBuildTokenPlaintext),
      token_prefix: apiTokenDisplayPrefix(websiteBuildTokenPlaintext),
      created_by_user_id: organizerUserId,
      last_used_at: null,
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
  // DEC-986: the public CFP now picks ONE track (radios, not checkboxes),
  // so a modulo rule that implied a fraction of submissions arrived
  // multi-track via that form would misstate what the surface that
  // created them can produce. An explicit, exactly-two set keeps the
  // many-to-many model, the admin multi-track rendering and the public
  // track facets all exercised against real data without implying the
  // public form is capable of it — these rows are only reachable via
  // /portal/edit's checkbox group or an admin composition path.
  const MULTI_TRACK_SUBMISSION_COUNTERS = new Set([5, 15]);

  // Per-track submission id lists (for evaluation-plan assignment) and the
  // set of accepted submissions (for scheduling/onboarding/email seeding).
  const submissionsByTrackIndex: string[][] = fixture.event.tracks.map(() => []);
  const acceptedSubmissions: {
    submissionId: string;
    contactId: string;
    email: string;
    title: string;
    speakerName: string;
    // DEC-258 snapshot fields, carried alongside the lead contact so a later
    // co-presenter row copied off this same contact (wave-29 amendment,
    // DEC-974) can reuse the real title_at_time/org_at_time rather than
    // inventing a second value for the same person.
    titleAtTime: string | null;
    orgAtTime: string | null;
  }[] = [];

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
    // DEC-836: an accepted submission defaults to content_status
    // 'approved' below; a caller may override it (only meaningful when
    // status is 'accepted') so the seed can demonstrate a real spread of
    // content statuses instead of every accepted session reading
    // pre-approved.
    contentStatusOverride?: "pending" | "approved" | "changes_requested";
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
        content_status: opts.contentStatusOverride ?? (isAccepted ? "approved" : "pending"),
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
    // Exactly two submissions also belong to a second track, so multi-track
    // membership stays exercised.
    if (MULTI_TRACK_SUBMISSION_COUNTERS.has(submissionCounter)) {
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
      acceptedSubmissions.push({
        submissionId,
        contactId: opts.contactId,
        email: opts.email,
        title: opts.title,
        speakerName: `${opts.firstName} ${opts.lastName}`.trim(),
        titleAtTime: opts.titleAtTime,
        orgAtTime: opts.orgAtTime,
      });
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
  //
  // DEC-887 amendment (task w66-b): index 3 is a 4th bump, per that task's
  // "MAY promote AT MOST ONE additional seeded pending submission" allowance
  // — the public agenda's auto-fit grid needs a real 4-up (four different
  // rooms, one start time) case, and the approved-content pool without it is
  // one short of covering 4-up + 2-up + solo while still leaving >=1
  // approved submission genuinely unplaced (see the schedule-slot plan
  // below). That was the ONLY extra promotion FOR THAT TASK.
  //
  // DEC-854 amendment (wave 5, task w5-j): gate-4 measured day 1 of the
  // public agenda rendering "1 session · 0 rooms" — day 1 only ever carried
  // the admin-only same-room conflict pair (non-approved content) plus one
  // TBD-room solo session, so no real room and no multi-block time row was
  // ever demoable/measurable there, even though day 2 (4-up) and day 3
  // (2-up) both had real concurrency. Indices 4-7 are four MORE bumps
  // (originally 'pending'), spent entirely on giving day 1 its own real
  // multi-room, multi-block-row shape in the schedule-slot plan below —
  // this is the day-1 fix the wave-5 amendment calls for, not a general
  // re-opening of "grow the accepted set" scope.
  const baseStatuses = additionalSubmissionStatuses(additionalCount);
  const bumpToAccepted = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
  const statuses = baseStatuses.map((s, i) => (bumpToAccepted.has(i) ? "accepted" : s));
  // Captured for the DEC-739 comms fan-out batch below.
  const synthContacts: { contactId: string; email: string; speakerName: string }[] = [];
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
        bio: synthBio(i, first, last, company),
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

    // DEC-836: of the 3 statuses bumped to 'accepted' above, the 2nd and
    // 3rd (i === 1, i === 2) carry an explicit content-status override so
    // the accepted set isn't uniformly pre-approved — see
    // insertSubmissionWithSpeaker's contentStatusOverride doc comment.
    const contentStatusOverride =
      i === 1 ? ("changes_requested" as const) : i === 2 ? ("pending" as const) : undefined;

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
      contentStatusOverride,
    });
    synthContacts.push({ contactId, email, speakerName: `${first} ${last}`.trim() });
  }

  // --- DUPLICATE FIXTURE SET (task w7-c / DEC-823): the Duplicates tab and
  // the whole merge flow need real findDuplicateGroups() hits to demo
  // against. DEC-771's collision ban only ever applied to IDENTITY contacts
  // (personas, reviewers, anything a seeded user account points at via
  // user.contact_id) -- it never promised the synthetic CRM directory itself
  // would be collision-free, and a directory with zero duplicates is exactly
  // what made the Duplicates tab and merge flow demo empty. These three
  // extra contact rows are deliberately built to COLLIDE with three of the
  // ~27 synthetic directory contacts seeded above (never a fixture persona,
  // never a reviewer, never a contact any user account is linked to), each
  // one exercising a distinct DEC-800 duplicate reason:
  //   - dupEmailContact shares a normalized email with synth index 2 (Casey
  //     Quraishi) but a different display name -- reason 'email' (a CSV
  //     import that carried a different name spelling against the same
  //     inbox).
  //   - dupNameCompanyContact shares a normalized name AND company with
  //     synth index 15 (Parker Anders, Fernway Technologies) but a
  //     different email -- reason 'name_and_company'.
  //   - dupNameOnlyContact shares only a normalized name with synth index 8
  //     (Indigo Fontaine) at a different company -- reason 'name' (the
  //     "changed employers" case).
  {
    const baseEmailIdx = 2;
    const baseEmail = synthName(baseEmailIdx);
    const dupEmailContactId = seedId("dup_contact", 1);
    statements.push(
      insertStmt("contact", {
        id: dupEmailContactId,
        org_id: orgId,
        first_name: "C.",
        last_name: `${baseEmail.last}-Imported`,
        email: `${baseEmail.first.toLowerCase()}.${baseEmail.last.toLowerCase().replace(/[^a-z]/g, "")}@example-speakers.test`,
        phone: null,
        company: SYNTH_COMPANIES[baseEmailIdx % SYNTH_COMPANIES.length]!,
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

    const baseNameCompanyIdx = 15;
    const baseNameCompany = synthName(baseNameCompanyIdx);
    const dupNameCompanyContactId = seedId("dup_contact", 2);
    statements.push(
      insertStmt("contact", {
        id: dupNameCompanyContactId,
        org_id: orgId,
        first_name: baseNameCompany.first.toUpperCase(),
        last_name: baseNameCompany.last.toLowerCase(),
        email: "parker.anders.dup@example-speakers.test",
        phone: null,
        company: SYNTH_COMPANIES[baseNameCompanyIdx % SYNTH_COMPANIES.length]!,
        title: "Senior Engineer",
        bio: null,
        headshot_url: null,
        social_links_json: null,
        notes: null,
        custom_fields_json: null,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );

    const baseNameOnlyIdx = 8;
    const baseNameOnly = synthName(baseNameOnlyIdx);
    const dupNameOnlyContactId = seedId("dup_contact", 3);
    statements.push(
      insertStmt("contact", {
        id: dupNameOnlyContactId,
        org_id: orgId,
        first_name: baseNameOnly.first,
        last_name: baseNameOnly.last,
        email: "indigo.fontaine.newco@example-speakers.test",
        phone: null,
        // Deliberately NOT SYNTH_COMPANIES[baseNameOnlyIdx % ...] -- a
        // different company is the whole point of the 'name' reason (a
        // person who changed employers).
        company: SYNTH_COMPANIES[(baseNameOnlyIdx + 3) % SYNTH_COMPANIES.length]!,
        title: "Engineering Manager",
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
  // DEC-823 wave-70 amendment: re-homed off the deleted priyaDupContactId
  // near-duplicate vestige onto synth index 5 (not part of any
  // findDuplicateGroups fixture pair -- see the DUPLICATE FIXTURE SET
  // comment below) so the lone single-key Labels rendering case survives.
  setContactCustomFields(synthContacts[5]!.contactId, { role: "reviewer" });
  setContactCustomFields(synthContacts[4]!.contactId, { role: "speaker", year: "2027" });
  setContactCustomFields(synthContacts[9]!.contactId, { role: "speaker", year: "2026" });
  setContactCustomFields(synthContacts[14]!.contactId, { role: "speaker", year: "2027" });

  // --- evaluation plan (DEC-018): 5-point scale, two weighted rating
  // criteria + one dropdown criterion; plan_reviewer scopes the reviewer
  // persona to track 0 and three synthetic reviewers to the other tracks
  // (with one doubled-up on track 1 for reviewer-overlap realism).
  const evalPlanId = seedId("evaluation_plan", 1);
  // DEC-875 (wave 42 amendment): content_quality:speaker_delivery weighted
  // 5:1 (not 2:1) so a single evaluation's weighted score (5c+d)/6 is
  // INJECTIVE over the full 1..5 x 1..5 score grid (25 distinct values,
  // verified by enumeration in the tie-elimination pass below) -- a 2:1
  // weighting only yields 13 distinct sums for 25 combos, which pigeonholes
  // the ~17 single-evaluation submissions in this plan's results into
  // unavoidable adjacent ties no amount of nudging can separate.
  const evalCriteria = [
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
      open_date: dayLabel(-30),
      close_date: dayLabel(25),
      filters_json: null,
      anonymized: false,
      scale_json: JSON.stringify({ min: 1, max: 5 }),
      criteria_json: JSON.stringify(evalCriteria),
      rounds: 1,
      // DEC-875: capped at 3 so the "Reviews per talk" field and the
      // "· N reviews each" subtitles/distribute summary have a real
      // maxEvaluations to read instead of null. Track 0 tops out at 1 (7 of
      // 10 submissions get exactly one evaluation), track 2 at 1, and track
      // 1 at 2 (reviewerB + reviewerD each evaluate every track-1
      // submission once) -- so no submission on THIS plan ever reaches the
      // cap of 3; needsMoreRatings (`ratingsCount < cap`,
      // src/domain/evaluation.ts) removes nothing from any reviewer's queue
      // here. DEC-707's cap-saturation branch is instead exercised on plan 4
      // below (deliberately cap-saturated there).
      max_evaluations: 3,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // DEC-702 (amendment, wave 10): plan_reviewer ids are minted sequentially
  // across every plan below (rather than each section hand-computing its own
  // offset into a shared id space) now that plan 1's own row count varies
  // with the floor-of-two narrowing -- a hand-computed offset is exactly the
  // kind of thing that silently collides when an earlier section's row count
  // changes.
  let planReviewerSeq = 0;
  function nextPlanReviewerId(): string {
    planReviewerSeq += 1;
    return seedId("plan_reviewer", planReviewerSeq);
  }

  // DEC-702 (amendment, wave 10): every reviewer's whole-track (track_id
  // non-null) scope is held to a floor of two plans -- plan 3 (DEC-854's
  // four-distinct-reviewer fixture, which has no 5th persona to substitute)
  // plus each reviewer's own load-bearing plan. reviewerUserId's own plan is
  // plan 1 (its "partial 7-of-10 queue" persona story), so plan 1 only
  // whole-track-scopes reviewerUserId here -- reviewerB/C/D's own
  // load-bearing plans are elsewhere (plan 4's DEC-707 cap-saturation pair
  // for B/C, plan 2's fully-closed plan for D; see those sections below).
  const reviewerAssignments = [{ userId: reviewerUserId, trackIndex: 0 }];
  reviewerAssignments.forEach((ra) => {
    statements.push(
      insertStmt("plan_reviewer", {
        id: nextPlanReviewerId(),
        plan_id: evalPlanId,
        user_id: ra.userId,
        track_id: trackIds[ra.trackIndex]!,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  });
  // DEC-702 (amendment, wave 10): reviewerB gets a PLAN-WIDE (track_id NULL,
  // per migrations/0004's documented plan_reviewer scope semantics -- null
  // track_id + null submission_id = all plan submissions) presence row here
  // rather than a second whole-track row, so it does not count toward its
  // own <=2 whole-track-scope floor (reviewerB's two whole-track plans are
  // plan 3 and plan 4, below) while still giving
  // test/seed-coherence.test.ts's DEC-836 "at least one reviewer scoped to
  // every open plan" check a reviewer present on all three simultaneously
  // open plans (1, 3, 4) -- narrowing every reviewer's WHOLE-TRACK scope to
  // two plans each means no single reviewer is whole-track-scoped to all
  // three anymore, so that invariant needs a non-whole-track row to still
  // hold.
  statements.push(
    insertStmt("plan_reviewer", {
      id: nextPlanReviewerId(),
      plan_id: evalPlanId,
      user_id: reviewerBUserId,
      track_id: null,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // ~40 evaluation rows: the reviewer persona (track 0) only clears 7 of
  // 10 submissions, leaving their queue/progress view genuinely
  // incomplete; the synthetic reviewers clear their whole tracks.
  // DEC-702 (amendment): 12 entries, comfortably above the largest observed
  // per-(reviewer, plan) evaluation count (10, on the two 10-submission
  // tracks) -- insertEvaluation below throws rather than silently wrapping
  // if a future fixture grows past this pool, instead of quietly repeating
  // a comment under one reviewer's name again.
  const EVAL_COMMENTS = [
    "Strong technical depth, well organized.",
    "Good energy but could tighten the scope.",
    "Solid proposal, needs more concrete examples.",
    "Compelling narrative and clear takeaways.",
    "Interesting topic; timing might run long.",
    "Well-suited for this track.",
    "Could use more advanced content for this audience.",
    "Clear structure, minor polish needed.",
    "Thoughtful framing; the middle section could be trimmed.",
    "Practical takeaways an attendee could apply right away.",
    "Ambitious scope for the slot -- consider narrowing.",
    "Confident premise, would benefit from a concrete case study.",
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
  // DEC-942: a deterministic, reproducible string hash (djb2) reduced into
  // the 1..5 scale. Deriving both scores from evalCounter alone (the prior
  // `1 + ((n*7+2)%5)` / `1 + ((n*11+1)%5)` scheme) cycles with period 5, so
  // 31 evaluations collapsed to five distinct score pairs and the RANK
  // table's order was arbitrary. Hashing the (reviewerId, submissionId) pair
  // instead spreads scores across the full seeded set while staying
  // reproducible across runs (no Math.random / no wall-clock input).
  function djb2Hash(input: string): number {
    let h = 5381;
    for (let i = 0; i < input.length; i++) {
      h = (h * 33 + input.charCodeAt(i)) | 0;
    }
    return h >>> 0;
  }
  function hashedScore(reviewerId: string, submissionId: string, salt: string): number {
    const h = djb2Hash(`${reviewerId}::${submissionId}::${salt}`);
    return 1 + (h % 5);
  }
  let evalCounter = 0;
  // DEC-702 (amendment): comment text must be indexed by the (reviewer, plan)
  // pair an evaluation belongs to, never by a single global emission counter
  // -- a global counter cycling through EVAL_COMMENTS.length (8) means any
  // reviewer whose own call-count gap across the run is a multiple of 8 gets
  // byte-identical prose signed under their name (confirmed:
  // seed_evaluation_0002/0058, both seed_user_0004). evalCounter is kept
  // purely for id minting (seedId("evaluation", ...)); it no longer drives
  // the comment index.
  const commentIndexByReviewerPlan = new Map<string, number>();
  function insertEvaluation(
    reviewerId: string,
    submissionId: string,
    planId: string = evalPlanId,
    scoreOverride?: { content_quality: number; speaker_delivery: number },
  ): void {
    evalCounter += 1;
    const contentScore = scoreOverride?.content_quality ?? hashedScore(reviewerId, submissionId, "content_quality");
    const deliveryScore = scoreOverride?.speaker_delivery ?? hashedScore(reviewerId, submissionId, "speaker_delivery");
    const recommendation =
      RECOMMENDATION_PATTERN[(evalCounter - 1) % RECOMMENDATION_PATTERN.length]!;
    const reviewerPlanKey = `${reviewerId}::${planId}`;
    const reviewerPlanIndex = commentIndexByReviewerPlan.get(reviewerPlanKey) ?? 0;
    commentIndexByReviewerPlan.set(reviewerPlanKey, reviewerPlanIndex + 1);
    if (reviewerPlanIndex >= EVAL_COMMENTS.length) {
      throw new Error(
        `seed: reviewer ${reviewerId} would sign a repeated comment on plan ${planId} ` +
          `(evaluation #${reviewerPlanIndex + 1} for this pair, only ${EVAL_COMMENTS.length} distinct comments seeded) -- ` +
          "add more EVAL_COMMENTS entries instead of letting the index wrap.",
      );
    }
    const comment = EVAL_COMMENTS[reviewerPlanIndex]!;
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

  // DEC-875 (wave 42 amendment): plan 1's weighted averages (2*content +
  // 1*delivery)/evalCount only land on ~13 distinct values across ~17
  // single-evaluation submissions, so hashing alone (however well spread)
  // is pigeonholed into adjacent ties on the RANKED RESULTS table -- the
  // one surface whose entire point is rank order. Build every plan-1
  // (reviewer, submission) pair up front, compute the hashed scores in
  // memory, then run a deterministic minimal-nudge pass (content/delivery
  // +-1, clamped to the 1..5 scale) until no two submissions, sorted by
  // average descending, are adjacent-tied -- before any row is turned into
  // SQL. Order of insertion (and therefore evalCounter/comment/
  // recommendation cycling) is unchanged; only the two score fields move.
  const plan1Pairs: { reviewerId: string; submissionId: string }[] = [];
  for (let i = 0; i < Math.min(7, track0Subs.length); i++) {
    plan1Pairs.push({ reviewerId: reviewerUserId, submissionId: track0Subs[i]! });
  }
  for (const submissionId of track1Subs) {
    plan1Pairs.push({ reviewerId: reviewerBUserId, submissionId });
  }
  for (const submissionId of track2Subs) {
    plan1Pairs.push({ reviewerId: reviewerCUserId, submissionId });
  }
  for (const submissionId of track1Subs) {
    plan1Pairs.push({ reviewerId: reviewerDUserId, submissionId });
  }

  const plan1Scores = plan1Pairs.map((pair) => ({
    content_quality: hashedScore(pair.reviewerId, pair.submissionId, "content_quality"),
    speaker_delivery: hashedScore(pair.reviewerId, pair.submissionId, "speaker_delivery"),
  }));
  const plan1PairIndicesBySubmission = new Map<string, number[]>();
  plan1Pairs.forEach((pair, idx) => {
    const list = plan1PairIndicesBySubmission.get(pair.submissionId) ?? [];
    list.push(idx);
    plan1PairIndicesBySubmission.set(pair.submissionId, list);
  });
  const PLAN1_CONTENT_WEIGHT = 5;
  const PLAN1_DELIVERY_WEIGHT = 1;
  const PLAN1_TOTAL_WEIGHT = PLAN1_CONTENT_WEIGHT + PLAN1_DELIVERY_WEIGHT;
  function plan1Average(submissionId: string): number {
    const indices = plan1PairIndicesBySubmission.get(submissionId)!;
    const sum = indices.reduce((acc, idx) => {
      const s = plan1Scores[idx]!;
      return (
        acc + (PLAN1_CONTENT_WEIGHT * s.content_quality + PLAN1_DELIVERY_WEIGHT * s.speaker_delivery) / PLAN1_TOTAL_WEIGHT
      );
    }, 0);
    return sum / indices.length;
  }
  {
    // With PLAN1_CONTENT_WEIGHT=5, PLAN1_DELIVERY_WEIGHT=1, a single
    // evaluation's raw weighted sum k=5*content+delivery is INJECTIVE over
    // content,delivery in [1,5] AND its 25 possible values are exactly the
    // 25 consecutive integers 6..30 (a bijection onto that range, verified
    // by enumeration below). That gives a clean, guaranteed-collision-free
    // way to lay out distinct averages directly instead of nudging
    // hash-derived scores toward each other (which can oscillate forever,
    // as the two-directional nudge-in-place version of this pass did):
    // walk the submissions in their original hash-ranked order and hand
    // each one the next still-unused, strictly-lower slot -- single-eval
    // submissions draw an unused k in [6,30] (avg = k/6), two-eval
    // submissions (track 1) draw an unused sum of two such k's in [12,60]
    // (avg = sum/12, a strictly finer grid, so it never collides with a
    // single-eval average once both grids' slots are tracked separately
    // and every assignment is strictly decreasing across BOTH grids by
    // construction).
    const seenSums = new Set<number>();
    for (let c = 1; c <= 5; c++) {
      for (let d = 1; d <= 5; d++) seenSums.add(5 * c + d);
    }
    if (seenSums.size !== 25 || Math.min(...seenSums) !== 6 || Math.max(...seenSums) !== 30) {
      throw new Error("seed: plan-1 weighted-sum injectivity assumption (5:1 weights, 1..5 scale) no longer holds");
    }
    function decomposeSum(k: number): { content_quality: number; speaker_delivery: number } {
      const d = ((k - 1) % 5) + 1;
      const c = (k - d) / 5;
      return { content_quality: c, speaker_delivery: d };
    }

    const initialOrder = [...plan1PairIndicesBySubmission.keys()].sort((a, b) => {
      const da = plan1Average(a);
      const db = plan1Average(b);
      if (db !== da) return db - da;
      return a < b ? -1 : 1;
    });
    // A single evaluation's average k/6 equals a two-evaluation average
    // total/12 exactly when total === 2*k -- so both grids are tracked in
    // one combined set, expressed in twelfths (single -> 2*k, double ->
    // total), to guarantee no cross-grid collision either.
    const usedTwelfths = new Set<number>();
    let ceiling = Number.POSITIVE_INFINITY;
    for (const submissionId of initialOrder) {
      const indices = plan1PairIndicesBySubmission.get(submissionId)!;
      if (indices.length === 1) {
        let k = Math.min(30, Math.floor(ceiling * PLAN1_TOTAL_WEIGHT - 1e-6));
        while (k >= 6 && usedTwelfths.has(k * 2)) k -= 1;
        if (k < 6) {
          throw new Error(`seed: ran out of distinct single-evaluation score slots for ${submissionId}`);
        }
        usedTwelfths.add(k * 2);
        Object.assign(plan1Scores[indices[0]!]!, decomposeSum(k));
        ceiling = k / PLAN1_TOTAL_WEIGHT;
      } else if (indices.length === 2) {
        let total = Math.min(60, Math.floor(ceiling * PLAN1_TOTAL_WEIGHT * 2 - 1e-6));
        while (total >= 12 && usedTwelfths.has(total)) total -= 1;
        if (total < 12) {
          throw new Error(`seed: ran out of distinct two-evaluation score slots for ${submissionId}`);
        }
        usedTwelfths.add(total);
        const k1 = Math.max(6, Math.min(30, total - 6));
        const k2 = total - k1;
        Object.assign(plan1Scores[indices[0]!]!, decomposeSum(k1));
        Object.assign(plan1Scores[indices[1]!]!, decomposeSum(k2));
        ceiling = total / (PLAN1_TOTAL_WEIGHT * 2);
      } else {
        throw new Error(`seed: plan 1 tie-elimination only supports 1 or 2 evaluations per submission, got ${indices.length}`);
      }
    }
  }
  plan1Pairs.forEach((pair, idx) => {
    insertEvaluation(pair.reviewerId, pair.submissionId, evalPlanId, plan1Scores[idx]!);
  });

  // DEC-271/DEC-942: a recusal for the demo reviewer persona on a submission
  // in plan 1 (track 0, their own scope) that they have NOT already
  // evaluated (the loop above only covers track0Subs[0..6]), so the queue's
  // RECUSED row, its shrunk actionable count, and the weighted-mean
  // exclusion all render against real seed data instead of never firing.
  const recusedSubmissionId = track0Subs[7]!;
  statements.push(
    insertStmt("review_recusal", {
      id: seedId("review_recusal", 1),
      plan_id: evalPlanId,
      submission_id: recusedSubmissionId,
      user_id: reviewerUserId,
      reason: "Co-authored an earlier draft of this proposal with the submitter.",
      created_at: nextTs(),
    }),
  );

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
      open_date: dayLabel(-60),
      close_date: dayLabel(-10),
      filters_json: null,
      anonymized: false,
      scale_json: JSON.stringify({ min: 1, max: 5 }),
      criteria_json: JSON.stringify(evalPlan2Criteria),
      rounds: 1,
      // DEC-875 (wave 42 amendment): the "Reviews per talk" field/subtitle
      // read path is restored on every plan, not just the open one -- null
      // read as blank here too. The scoped plan_reviewer pair (reviewerD,
      // on track 2) evaluates every track-2 submission exactly once, so the
      // max per-submission count under this plan is 1; a cap of 3 is a
      // real, non-degenerate number that still removes nothing from any
      // queue (needsMoreRatings, src/domain/evaluation.ts).
      //
      // DEC-702 (amendment, wave 1a): reviewerC was scoped here too, but
      // reviewerC is also DEC-854's plan-3 fixture AND (below) plan 4's
      // cap-saturation observer -- a third plan for the same identity is
      // exactly the noise DEC-702 prosecutes, so reviewerC's redundant
      // scope on THIS plan is the one dropped (reviewerD's evaluations
      // alone already satisfy the "every scoped pair reads 100%" invariant
      // below).
      max_evaluations: 3,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  const plan2ReviewerAssignments = [{ userId: reviewerDUserId, trackIndex: 2 }];
  plan2ReviewerAssignments.forEach((ra, i) => {
    statements.push(
      insertStmt("plan_reviewer", {
        id: nextPlanReviewerId(),
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

  // --- evaluation plan 3 (DEC-668/DEC-836): a SECOND plan open at SEED_NOW
  // alongside plan 1 -- the Review landing needs more than one open row so
  // the multi-plan reviewer queue and the per-plan scoping DEC-831 is about
  // are both reachable from seeded data. Zero evaluations are seeded here on
  // purpose -- an open plan mid-progress (0/N), distinct from plan 1's
  // partially-worked queue and plan 2's fully-closed one.
  //
  // DEC-702 (amendment, wave 1a): reviewerUserId (the demo reviewer persona)
  // is scoped to track 1 here -- DIFFERENT from plan 1's track 0 -- rather
  // than the track 0 it previously shared with plan 1. DEC-854 below still
  // needs reviewerUserId as one of plan 3's four distinct reviewer ids (a
  // seed-coherence test enumerates that count directly and there is no 5th
  // reviewer persona to substitute), and
  // test/seed-coherence.test.ts's "(DEC-848) the reviewer persona has two
  // simultaneously open, differently-track-scoped queues" requires their
  // open-plan track scopes to differ -- so plan 3's track can no longer
  // match plan 1's without failing that test. Scoping reviewerUserId here
  // (instead of plan 4, DEC-707's cap-saturation fixture) lets reviewerUserId
  // drop from three whole-track-scoped plans to two (plan 1 + plan 3);
  // plan 4's pair is now reviewerB + reviewerC instead (see below).
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
      // DEC-591/DEC-836: bounds straddle SEED_NOW (distinct from plan 1's
      // -30/+25 window) so this plan reads as open regardless of when the
      // seed is run, giving the Review landing a second open row.
      open_date: dayLabel(-10),
      close_date: dayLabel(40),
      filters_json: null,
      anonymized: false,
      scale_json: JSON.stringify({ min: 1, max: 5 }),
      criteria_json: JSON.stringify(evalPlan3Criteria),
      rounds: 1,
      // DEC-875 (wave 42 amendment): zero evaluations are seeded on this
      // plan (see the comment above), so any positive cap is safe against
      // needsMoreRatings -- 2 is an arbitrary non-degenerate value (plan 4's
      // own cap, below, is now 1 and deliberately saturated -- unrelated to
      // this plan's choice of 2).
      max_evaluations: 2,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  // DEC-875 (wave 42 amendment): reviewerUserId is scoped to track 1 here
  // (see the comment above the plan's declaration) -- track_id differs from
  // reviewerB/reviewerC below (track 0), so this row alone still keeps
  // plan 0003 at >=2 distinct tracks even though reviewerUserId no longer
  // shares Sam-Ana-Devin's "same track" grouping from the original DEC-854
  // mock (see that comment below).
  statements.push(
    insertStmt("plan_reviewer", {
      id: nextPlanReviewerId(),
      plan_id: evalPlan3Id,
      user_id: reviewerUserId,
      track_id: trackIds[1]!,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  // DEC-875 (wave 42 amendment): a second, distinct reviewer scoped to the
  // same track/plan so the multi-reviewer distribute preview has >=2
  // reviewer identities to distribute across on this plan (reviewerB's other
  // scopes are plan 1's plan-wide presence row and plan 4/track 1, so
  // reusing them here on track 0 doesn't collide with any other
  // plan_reviewer row).
  statements.push(
    insertStmt("plan_reviewer", {
      id: nextPlanReviewerId(),
      plan_id: evalPlan3Id,
      user_id: reviewerBUserId,
      track_id: trackIds[0]!,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  // DEC-854 amendment (wave 5, task w5-j): docs/design/Chautauqua
  // Review.dc.html's distribute-preview frame ("frame 03") shows FOUR named
  // reviewers (Sam Whitfield, Ana Petrov, Devin Cole all scoped to the same
  // track, plus Ines Duarte scoped to a DIFFERENT track -- the mock's
  // "unchanged · wrong track" delta case) -- gate-4 found plan 0003 only
  // ever carried 2 of those 4, so the four-row distribute table was
  // unreproducible. reviewerC (Devin) joins on the same track as Ana;
  // reviewerD (Ines) is deliberately scoped to a different track, matching
  // the mock's mismatched-track row.
  //
  // DEC-702 amendment (wave 1a): reviewerUserId (Sam) moved from track 0 to
  // track 1 above (now sharing reviewerD's track instead of Ana/Devin's) so
  // that reviewerUserId's whole-track footprint could drop from three plans
  // to two elsewhere (see the comment above the plan's declaration) --
  // test/seed-coherence.test.ts's DEC-854 assertion only checks for >=4
  // distinct reviewer ids on this plan, not the exact track grouping, and
  // test/seed.test.ts's "two reviewer scopes on distinct tracks" assertion
  // only checks for >=2 distinct tracks, both of which still hold. The
  // *exact* four-way "3 same track + 1 different" grouping the original
  // mock frame shows is no longer reproduced (it is now 2 same track + 2 on
  // a second track); a 5th reviewer persona would be needed to restore the
  // exact grouping while also satisfying DEC-702 -- flagged for a future
  // wave rather than decided here.
  statements.push(
    insertStmt("plan_reviewer", {
      id: nextPlanReviewerId(),
      plan_id: evalPlan3Id,
      user_id: reviewerCUserId,
      track_id: trackIds[0]!,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  statements.push(
    insertStmt("plan_reviewer", {
      id: nextPlanReviewerId(),
      plan_id: evalPlan3Id,
      user_id: reviewerDUserId,
      track_id: trackIds[1]!,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // --- evaluation plan 4 (DEC-848): a SECOND plan simultaneously open
  // alongside plan 1 (distinct from plan 3) so the scoped review queue is
  // exercised. Only a minority (2) of this plan's in-track submissions are
  // scored, mirroring plan 1's own partial (7-of-10) progress, so the new
  // queue reads genuinely incomplete rather than trivially empty or
  // complete.
  //
  // DEC-707 (wave-79 amendment): this plan's cap is set to 1 (not 2) and a
  // second reviewer is scoped to the same track/plan below -- deliberately
  // cap-saturated so DEC-707's assignedExcludingSaturated
  // (src/domain/evaluation/queue.ts) has a seed-reachable case: the 2
  // track-1 submissions the scoring reviewer evaluates below each collect
  // exactly 1 evaluation (the cap), so they must fall out of the other
  // reviewer's "assigned" denominator on GET /plans/:id/progress, while the
  // rest of track 1 stays in it. Before this amendment, every seeded plan's
  // cap sat strictly above every seeded per-submission count, so only a
  // hand-built mock harness (test/reviewer-progress-cap-denominator.test.ts)
  // ever exercised this branch.
  //
  // DEC-702 amendment (wave 1a): reviewerUserId used to be the scoring
  // reviewer here (paired with reviewerB), but that was reviewerUserId's
  // THIRD whole-track-scoped plan (plan 1, plan 3, this one) -- reviewerC
  // takes over the scoring role instead (identity is irrelevant to
  // test/reviewer-progress-cap-denominator-seed.test.ts, which resolves
  // "the scoring reviewer" and "the second reviewer" from the SQL rows
  // rather than hardcoding either), letting reviewerUserId drop this plan
  // and hold whole-track scope on only plan 1 + plan 3.
  const evalPlan4Id = seedId("evaluation_plan", 4);
  const evalPlan4Criteria = [
    {
      id: "content_quality",
      label: "Content quality & depth",
      kind: "rating",
      weight: 3,
      guidance: "Original insight, not a rehash of the docs.",
    },
    {
      id: "speaker_delivery",
      label: "Speaker delivery & clarity",
      kind: "rating",
      weight: 5,
      guidance: "Clear structure and a confident, well-paced delivery.",
    },
    { id: "recommendation", label: "Recommendation", kind: "dropdown", options: ["Approve", "Maybe", "Deny"] },
  ] as const;
  statements.push(
    insertStmt("evaluation_plan", {
      id: evalPlan4Id,
      event_id: eventId,
      name: "Workshops Second Look",
      instructions: "Focused re-review of the workshop track ahead of scheduling.",
      // DEC-591/DEC-848: bounds straddle SEED_NOW, distinct from plan 1's
      // -30/+25 and plan 3's -10/+40 windows, so this plan too reads as
      // open regardless of when the seed is run.
      open_date: dayLabel(-5),
      close_date: dayLabel(35),
      filters_json: null,
      anonymized: false,
      scale_json: JSON.stringify({ min: 1, max: 5 }),
      criteria_json: JSON.stringify(evalPlan4Criteria),
      rounds: 1,
      // DEC-707 (wave-79 amendment): capped at 1, not 2 -- reviewerC
      // evaluates 2 of track 1's submissions once each (see below), so at a
      // cap of 1 those two submissions are exactly saturated the moment
      // they're scored, giving assignedExcludingSaturated a real,
      // seed-reachable submission to exclude from the SECOND track-1
      // reviewer's (reviewerB, added below) denominator.
      max_evaluations: 1,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  // DEC-702 amendment (wave 1a): reviewerC (not reviewerUserId) is the
  // scoring reviewer here -- reviewerUserId's own whole-track budget is
  // already spent on plan 1 + plan 3 (see above); reviewerC is otherwise
  // only scoped to plan 1/track 2 and plan 3/track 0, both different
  // tracks, so this row doesn't collide with any existing plan_reviewer
  // pair.
  statements.push(
    insertStmt("plan_reviewer", {
      id: nextPlanReviewerId(),
      plan_id: evalPlan4Id,
      user_id: reviewerCUserId,
      track_id: trackIds[1]!,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  // DEC-707 (wave-79 amendment): a second reviewer scoped to the SAME
  // plan/track as reviewerC above, so the two track-1 submissions
  // reviewerC saturates (cap of 1, see above) are genuinely "assigned but
  // unreachable" for THIS reviewer -- the seed-reachable case for
  // assignedExcludingSaturated. reviewerB is not otherwise scoped to plan
  // 4/track 1 (their other scoping is plan 1's plan-wide presence row and
  // plan 3/track 0), so this row doesn't collide with any existing
  // plan_reviewer pair. Ids are minted sequentially via nextPlanReviewerId()
  // now, so there is no hand-computed offset to keep in sync here.
  statements.push(
    insertStmt("plan_reviewer", {
      id: nextPlanReviewerId(),
      plan_id: evalPlan4Id,
      user_id: reviewerBUserId,
      track_id: trackIds[1]!,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  if (track1Subs.length < 3) {
    throw new Error(
      `seed: expected track 1 to have at least 3 submissions to demonstrate a partially scored plan-4 queue, got ${track1Subs.length}`,
    );
  }
  for (const submissionId of track1Subs.slice(0, 2)) {
    insertEvaluation(reviewerCUserId, submissionId, evalPlan4Id);
  }

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
  // headshot" (index 3, general kind since the DEC-009 wave-59 amendment)
  // is a plausible match for the
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
    Array<{ id: string; kind: FormTaskFieldKind; label: string; options: string[] | null }>
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
      const mintedFields: Array<{ id: string; kind: FormTaskFieldKind; label: string; options: string[] | null }> = [];
      specs.forEach((spec, fieldIdx) => {
        const fieldId = seedId(`task_form_${taskFormCounter}_field`, fieldIdx + 1);
        mintedFields.push({ id: fieldId, kind: spec.kind, label: spec.label, options: spec.options ?? null });
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
    // DEC-240 (task w1-d): a file_request default task would get
    // deliverable_kind 'presentation' so its uploads join the content
    // pipeline. DEC-009 amendment (wave 59): none of DEFAULT_ONBOARDING_TASKS
    // is kind='file_request' any more (the former "Finalize bio + headshot"
    // task is now 'general', completed via the portal profile save path, not
    // a deliverable upload) — this stays defensive for any future
    // file_request default task.
    const deliverableKind = tpl.kind === "file_request" ? "presentation" : null;
    const dueDate = dayLabel(dueOffsetDaysFromSeedNow[i]!);
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

  // DEC-739 amendment (task w11-b): one event-specific file_request task —
  // as an organizer would create it, NOT a new default (DEFAULT_ONBOARDING_
  // TASKS stays untouched per DEC-009's wave-59 amendment) — so the upload-
  // deliverable path (Speakers grid upload cell, portal deliverable panel,
  // DEC-549 deliverable_kind, getFileScope's task-upload population) has a
  // real task to render against. Due date offset matches the existing
  // "Announce participation" default's (-4 days) so this doesn't introduce
  // a fourth distinct past-due offset for the DEC-646 staggered-lateness
  // proof, which enumerates exactly {1, 2, 4} days late.
  const deliverableTaskId = seedId("task", DEFAULT_ONBOARDING_TASKS.length + 1);
  const deliverableTaskDueDate = dayLabel(-4);
  if (deliverableTaskDueDate >= EVENT_START_MS) {
    throw new Error(
      `seed: file_request deliverable task due date (${new Date(deliverableTaskDueDate).toISOString()}) ` +
        `must be before the event start (${new Date(EVENT_START_MS).toISOString()})`,
    );
  }
  statements.push(
    insertStmt("task", {
      id: deliverableTaskId,
      event_id: eventId,
      kind: "file_request",
      title: "Upload your slide deck",
      description: null,
      due_date: deliverableTaskDueDate,
      required: true,
      form_id: null,
      deliverable_kind: "presentation",
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // DEC-739: plausible per-kind values for a completed form-kind task's
  // response_json, keyed by field id (never sampled — every field the task's
  // form actually carries gets a real answer, so the organiser's response
  // modal never renders an em-dash for a field it can join by id).
  // DEC-739 amendment (task w45-c): a `text` field's plausible value must
  // match what its own LABEL asks for, not just its kind — a kind-only
  // dispatch put "SFO" in "Check-out date". Date-shaped labels get a real
  // date inside the seeded event's own window, rendered through the app's
  // own day-range formatter (formatEventDayRange with equal start/end —
  // "11 May 2027" grammar, never a hand-written literal); airport/city/
  // airline-shaped labels get a place; everything else keeps a generic
  // sentence. Deterministic in `variant` only (no Math.random) so the seed
  // stays reproducible.
  function plausibleTextValue(label: string, variant: number): string {
    const lower = label.toLowerCase();
    const isArrival = /check-?in|arrival/.test(lower);
    const isDeparture = /check-?out|departure/.test(lower);
    const isDate = isArrival || isDeparture || /\bdate\b/.test(lower);
    if (isDate) {
      // Arrival the day before the event starts, departure the day before
      // it ends — plausible travel dates that still sit inside the event's
      // own window. A bare "date" field (matches neither arrival nor
      // departure wording) alternates between the two by variant, staying
      // deterministic.
      const ms = isArrival
        ? EVENT_START_MS - DAY_MS
        : isDeparture
          ? EVENT_END_MS - DAY_MS
          : variant % 2 === 0
            ? EVENT_START_MS - DAY_MS
            : EVENT_END_MS - DAY_MS;
      return formatEventDayRange(ms, ms);
    }
    if (/airport|city|airline/.test(lower)) {
      const places = ["SFO", "Portland, OR", "Alaska Airlines"];
      return places[variant % places.length]!;
    }
    return "Aisle seat if possible, and please let me know the AV setup ahead of time.";
  }

  function plausibleFormFieldValue(
    field: { kind: FormTaskFieldKind; label: string; options: string[] | null },
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
        return plausibleTextValue(field.label, variant);
      case "long_text":
        return "Aisle seat if possible, and please let me know the AV setup ahead of time.";
      case "number":
        return 250 + variant * 25;
      case "checkbox":
        return variant % 2 === 0;
      case "file":
        // DEC-040 amendment (wave 70): buildFormTaskResponse below branches
        // on kind === "file" BEFORE calling this function (a real file row
        // needs assignmentId/contactId this helper doesn't have) — reaching
        // this case would mean that branch was bypassed.
        throw new Error("plausibleFormFieldValue: 'file' kind must be handled by the caller, not here");
      default: {
        const exhaustive: never = field.kind;
        throw new Error(`plausibleFormFieldValue: unhandled field kind ${String(exhaustive)}`);
      }
    }
  }

  // DEC-040 amendment (wave 70): a 'file' field spec has no plausible
  // scalar value — its seeded answer is a REAL file row (mirrors the portal
  // task-form upload route's own kind='handout'/submissionId=null shape),
  // never a fixture-only placeholder string.
  let taskFormFileCounter = 0;
  function mintTaskFormFileAnswer(assignmentId: string, contactId: string): string {
    taskFormFileCounter += 1;
    const fileId = seedId("task_form_file", taskFormFileCounter);
    const r2Key = `task/${assignmentId}/${fileId}-receipt.pdf`;
    statements.push(
      insertStmt("file", {
        id: fileId,
        submission_id: null,
        kind: "handout",
        filename: "receipt.pdf",
        r2_key: r2Key,
        size_bytes: registerPdfAsset(r2Key),
        content_type: "application/pdf",
        previous_file_id: null,
        version_no: 1,
        uploaded_by_contact_id: contactId,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
    return fileId;
  }

  function buildFormTaskResponse(
    taskId: string,
    assignmentId: string,
    contactId: string,
    variant: number,
  ): Record<string, string | number | boolean> {
    const fields = taskFormFieldsByTaskId.get(taskId);
    if (!fields || fields.length === 0) {
      throw new Error(`buildFormTaskResponse: no form fields minted for task ${taskId}`);
    }
    const response: Record<string, string | number | boolean> = {};
    for (const field of fields) {
      if (field.kind === "file") {
        response[field.id] = mintTaskFormFileAnswer(assignmentId, contactId);
      } else {
        response[field.id] = plausibleFormFieldValue(field, variant);
      }
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
        version_no: 1,
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
      const assignmentId = seedId("task_assignment", taskAssignmentCounter);

      // DEC-739: a complete form-kind assignment carries a response_json
      // keyed by exactly this task's minted form-field ids; a complete
      // file_request assignment carries a real file_id.
      const responseJson =
        isComplete && tpl.kind === "form"
          ? JSON.stringify(buildFormTaskResponse(taskId, assignmentId, acc.contactId, contactIdx + taskIdx))
          : null;
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
          id: assignmentId,
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

    // DEC-009 amendment (wave 59)/DEC-854 (task w11-e): the pre-amendment
    // seed got most of its Files-library/worklist coverage from the (now
    // removed) file_request "Finalize bio + headshot" default task's
    // completed uploads. That task is kind='general' now and never carries
    // a deliverable file, so the same >=2/3-of-accepted-submissions file
    // floor is minted here directly against the submission instead —
    // preserving the SAME contactIdx%3!==0 distribution the old
    // taskIdx===3/file_request branch used, so this is a like-for-like
    // replacement of the coverage source, not a new invented fixture.
    if (contactIdx % 3 !== 0) {
      mintTaskDeliverableFile({ contactId: acc.contactId, submissionId: acc.submissionId, deliverableKind: "presentation" });
    }
  });

  // DEC-739 amendment (task w11-b): fan the file_request task out to the
  // accepted roster in a SEPARATE loop (after the loop above, which already
  // consumed taskAssignmentCounter for the DEFAULT_ONBOARDING_TASKS x
  // acceptedSubmissions grid) so no existing seed_task_assignment_* id
  // shifts — DEC-172/DEC-174 pin seed_task_assignment_0001 and _0005 by
  // name. Roughly one third complete (each carrying a real minted file per
  // DEC-739), the rest pending.
  acceptedSubmissions.forEach((acc, contactIdx) => {
    taskAssignmentCounter += 1;
    const isComplete = contactIdx % 3 === 0;
    const assignmentId = seedId("task_assignment", taskAssignmentCounter);
    const fileId = isComplete
      ? mintTaskDeliverableFile({
          contactId: acc.contactId,
          submissionId: acc.submissionId,
          deliverableKind: "presentation",
        })
      : null;
    statements.push(
      insertStmt("task_assignment", {
        id: assignmentId,
        task_id: deliverableTaskId,
        contact_id: acc.contactId,
        status: isComplete ? "complete" : "pending",
        completed_at: isComplete ? nextTs() : null,
        completed_by: isComplete ? organizerUserId : null,
        response_json: null,
        file_id: fileId,
        last_reminded_at: null,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  });

  // --- schedule slots (DEC-010/DEC-021, DEC-887 amendment task w66-b,
  // DEC-854 amendment task w5-j): a placement plan over the event's 3 days
  // and 4 rooms that gives the public agenda's per-time-slot auto-fit grid
  // real concurrency to render, not five lonely full-width blocks.
  // acceptedSubmissions is [fixture-approved, i0-approved,
  // i1-changes_requested, i2-pending, i3-approved, i4..i7-approved(NEW,
  // DEC-854 amendment above), i19..i23-approved] — indices
  // [0,1,4,5,6,7,8,9,10,11,12,13] carry content_status 'approved' (the
  // publicly-renderable set), [2,3] don't.
  //
  //   - [2],[3] (non-approved content, so this is an admin-only-visible
  //     demo, never a public one): the deliberate same-room overlap
  //     conflict on day 1, room 0, overlapping 09:00-09:45 / 09:15-10:00.
  //   - [5],[6]: day 1's own real multi-block time row -- one start time
  //     (day 1, 09:30), two different real rooms (room 1, room 2), so day 1
  //     stops reading as "1 session · 0 rooms" (gate-4 finding, DEC-854
  //     amendment).
  //   - [7],[8]: a second day-1 time row, 14:00, rooms 3 and 1 -- day 1 now
  //     carries two distinct multi-block rows across 3 distinct real rooms
  //     (room 0 stays reserved for the admin-only conflict above so it
  //     never triple-books).
  //   - [12]: the TBD (room_id: null) slot, alone at its start time on day 1
  //     -- doubles as the public agenda's 1-up ("solo") layout case, since
  //     it's the only approved+scheduled session at 11:00 that day.
  //   - [0],[1],[4],[9]: a real 4-up case -- one start time (day 2, 09:30),
  //     four different rooms.
  //   - [10],[11]: a real 2-up case -- one start time (day 3, 09:30), two
  //     different rooms.
  //   - [13]: deliberately left UNPLACED so the agenda "N unplaced" count
  //     stays honest even though every other approved submission is placed.
  //
  // Every placement sits clear of both seeded breaks (coffee 10:15-10:30,
  // lunch 12:00-13:00) so the public agenda's spanning break rows explain
  // real gaps instead of colliding with a block.
  const eventDays = ["2027-05-12", "2027-05-13", "2027-05-14"];
  const APPROVED_ACCEPTED_INDEXES = [0, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  if (acceptedSubmissions.length < 14) {
    throw new Error(
      `seed: schedule-slot concurrency plan needs 14 accepted submissions (11 approved placed + 1 approved held back + 2 conflict), got ${acceptedSubmissions.length}`,
    );
  }
  for (const idx of APPROVED_ACCEPTED_INDEXES) {
    if (acceptedSubmissions[idx] === undefined) {
      throw new Error(`seed: schedule-slot concurrency plan expected acceptedSubmissions[${idx}] to exist`);
    }
  }
  if (roomIds.length < 4) {
    throw new Error(`seed: schedule-slot concurrency plan needs 4 rooms for the 4-up case, got ${roomIds.length}`);
  }
  const sub = (idx: number): string => acceptedSubmissions[idx]!.submissionId;
  const slots: Array<{ submissionId: string; roomId: string | null; day: string; startMin: number; endMin: number }> = [
    // Deliberate same-room conflict, day 1 (admin-only demo -- these two
    // carry non-approved content_status, see comment above). Room 0 stays
    // reserved for this pair on day 1 so no approved placement triple-books it.
    { submissionId: sub(2), roomId: roomIds[0]!, day: eventDays[0]!, startMin: 9 * 60, endMin: 9 * 60 + 45 },
    { submissionId: sub(3), roomId: roomIds[0]!, day: eventDays[0]!, startMin: 9 * 60 + 15, endMin: 10 * 60 },
    // Day 1's first real multi-block row: one start time, two real rooms.
    { submissionId: sub(5), roomId: roomIds[1]!, day: eventDays[0]!, startMin: 9 * 60 + 30, endMin: 10 * 60 },
    { submissionId: sub(6), roomId: roomIds[2]!, day: eventDays[0]!, startMin: 9 * 60 + 30, endMin: 10 * 60 },
    // TBD room, day 1 -- alone at 11:00, doubling as the public agenda's
    // 1-up ("solo") layout case.
    { submissionId: sub(12), roomId: null, day: eventDays[0]!, startMin: 11 * 60, endMin: 11 * 60 + 45 },
    // Day 1's second real multi-block row, in the afternoon (clear of lunch).
    { submissionId: sub(7), roomId: roomIds[3]!, day: eventDays[0]!, startMin: 14 * 60, endMin: 14 * 60 + 45 },
    { submissionId: sub(8), roomId: roomIds[1]!, day: eventDays[0]!, startMin: 14 * 60, endMin: 14 * 60 + 45 },
    // 4-up case: one start time, four different rooms, day 2.
    { submissionId: sub(0), roomId: roomIds[0]!, day: eventDays[1]!, startMin: 9 * 60 + 30, endMin: 10 * 60 },
    { submissionId: sub(1), roomId: roomIds[1]!, day: eventDays[1]!, startMin: 9 * 60 + 30, endMin: 10 * 60 },
    { submissionId: sub(4), roomId: roomIds[2]!, day: eventDays[1]!, startMin: 9 * 60 + 30, endMin: 10 * 60 },
    { submissionId: sub(9), roomId: roomIds[3]!, day: eventDays[1]!, startMin: 9 * 60 + 30, endMin: 10 * 60 },
    // 2-up case: one start time, two different rooms, day 3.
    { submissionId: sub(10), roomId: roomIds[0]!, day: eventDays[2]!, startMin: 9 * 60 + 30, endMin: 10 * 60 },
    { submissionId: sub(11), roomId: roomIds[1]!, day: eventDays[2]!, startMin: 9 * 60 + 30, endMin: 10 * 60 },
    // acceptedSubmissions[13] is deliberately left unplaced.
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

  // --- cross-room co-presenter double-booking (wave-29 amendment, DEC-974
  // / DEC-854): [5]/[6] above sit at the SAME start time (day 1, 09:30) in
  // two DIFFERENT real rooms and both carry content_status 'approved'.
  // Without a participant row placing one real person in both sessions,
  // the co-presenter-aware branch of findConflicts (kind:'speaker_overlap')
  // never fires against seeded data — a same-room-only conflict (see [2]/
  // [3] above) can never exercise it, since two different rooms at the same
  // time is exactly the case room_overlap does NOT catch. This row makes
  // acceptedSubmissions[5]'s lead contact a co-presenter on
  // acceptedSubmissions[6] as well, so both sessions' speaker sets share a
  // contact and findConflicts emits exactly one speaker_overlap conflict
  // naming both submission ids. invite_status 'accepted' (an
  // ACTIVE_INVITE_STATUS, DEC-974) so it counts for the admin agenda's
  // conflict detection; visible true so it's a normal, not hidden,
  // co-presentation. seedId('participant', 9999) is far outside the
  // 1..30 range insertSubmissionWithSpeaker's submissionCounter produces
  // (30 accepted+pending submissions total, see test/seed-coherence.test.ts),
  // so it cannot collide with a generated participant row.
  const coPresenterLead = acceptedSubmissions[5]!;
  const coPresenterHostSubmissionId = acceptedSubmissions[6]!.submissionId;
  statements.push(
    insertStmt("participant", {
      id: seedId("participant", 9999),
      submission_id: coPresenterHostSubmissionId,
      contact_id: coPresenterLead.contactId,
      role: "co-presenter",
      order: 1,
      visible: true,
      invite_status: "accepted",
      title_at_time: coPresenterLead.titleAtTime,
      org_at_time: coPresenterLead.orgAtTime,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // --- schedule breaks (DEC-022 amendment, wave 63): a coffee break and a
  // lunch break per day. Deliberately NOT keyed to any submission/room --
  // see src/server/repo/breaks.ts's header for the hard boundary. These
  // fill the gap the schedule_slot rows above leave around midday, which
  // otherwise reads as missing data on the public agenda.
  const breaks: Array<{ day: string; label: string; location: string | null; startMin: number; durationMin: number }> =
    eventDays.flatMap((day) => [
      { day, label: "Coffee break", location: null, startMin: 10 * 60 + 15, durationMin: 15 },
      { day, label: "Lunch", location: "Foyer", startMin: 12 * 60, durationMin: 60 },
    ]);
  breaks.forEach((brk, i) => {
    statements.push(
      insertStmt("schedule_break", {
        id: seedId("schedule_break", i + 1),
        event_id: eventId,
        day: brk.day,
        label: brk.label,
        location: brk.location,
        start_min: brk.startMin,
        duration_min: brk.durationMin,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
  });

  // --- portal settings + a wiki resource ---
  statements.push(
    insertStmt("portal_settings", {
      id: seedId("portal_settings", 1),
      event_id: eventId,
      logo_url: null,
      accent_color: "#4E5C31",
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

  // --- CRM sourcing pipeline (CRM-07/08, DEC-157, task w3-a; expanded per
  // DEC-739 amendment task w44-f): 20 synthetic contacts enrolled across
  // EVERY pipeline stage (including 'contacted' and 'declined', which a
  // 3-contact seed left permanently empty on the board), with varied fit
  // scores, a distinct one-sentence rationale each, and activity timestamps
  // spread across real staleness buckets (days / weeks / months ago) rather
  // than the seed's monotonic minute-clock, which would cluster every card
  // at "moments ago". The pipeline draws only from the synth_contact pool
  // (indices 1-20), so it never enrolls Marcus Okafor (speaker2ContactId) or
  // Priya Raman (speakerContactId) regardless -- CRM-S2 enrolls Marcus
  // manually during the eval run, so the seed must leave that enrollment
  // available rather than pre-empting it.
  {
    const pipelineCount = 20;
    const pipelineContactIds = Array.from({ length: pipelineCount }, (_, i) => seedId("synth_contact", i + 1));
    const pipelineEntryIds = pipelineContactIds.map((_, i) => seedId("pipeline_entry", i + 1));
    let activityCounter = 0;
    const nextActivityId = () => seedId("pipeline_activity", ++activityCounter);

    // Staleness buckets: offsets are days-ago from SEED_NOW (not the running
    // seed clock), so the board shows a real spread. 1/3 land in "days ago"
    // (<7d), 9/20 in "weeks ago" (7-29d), 45/75 in "months ago" (>=30d).
    const STALENESS_OFFSETS_DAYS = [1, 3, 9, 20, 45, 75] as const;

    /** `count` ascending timestamps (oldest first) ending at SEED_NOW minus
     * `finalOffsetDays`, each earlier step pushed 2 days further back, so a
     * multi-move history reads as a real timeline rather than simultaneous. */
    function movesEndingAt(finalOffsetDays: number, count: number): number[] {
      const out: number[] = [];
      for (let k = count - 1; k >= 0; k--) out.push(SEED_NOW - (finalOffsetDays + k * 2) * DAY_MS);
      return out;
    }

    /** The move-activity path (stage sequence, first entry always
     * 'identified') that lands an entry on `stage`. 'declined' is reached
     * via 'contacted' rather than the full ladder, matching how a real
     * sourcing conversation ends early. */
    function pathForStage(stage: (typeof PIPELINE_STAGES)[number]): (typeof PIPELINE_STAGES)[number][] {
      if (stage === "declined") return ["identified", "contacted", "declined"];
      const idx = PIPELINE_STAGES.indexOf(stage);
      return PIPELINE_STAGES.slice(0, idx + 1) as (typeof PIPELINE_STAGES)[number][];
    }

    const RATIONALES = [
      "Deep expertise in the track's core topic; hasn't spoken at this event before.",
      "Confirmed fast, strong audience draw from a past talk elsewhere.",
      "Recommended by two past speakers independently; worth a direct outreach.",
      "Published a widely-shared piece on this exact subject last quarter.",
      "Runs a well-attended meetup on the topic; likely to draw a local crowd.",
      "Strong reviews from a sibling conference's program committee.",
      "A first-time speaker candidate with a compelling personal case study.",
      "Active in the community Slack, already fielding related questions daily.",
      "Former colleague vouched for their delivery style and depth.",
      "Company blog post on this topic got significant engagement.",
      "Panel moderator experience suggests a strong stage presence.",
      "Referral from the track chair, unprompted.",
      "Keynoted a smaller regional event on an adjacent topic last year.",
      "Built the open-source tool half the track already uses.",
      "Wrote the internal postmortem this talk is clearly based on.",
      "Long-time attendee, first time being considered as a speaker.",
      "Co-authored the paper this year's CFP theme is drawing from.",
      "Mentioned by name in three separate CFP reviewer comments.",
      "Leads a working group on the exact standard this talk covers.",
      "Gave a lightning-talk version of this at a local meetup to strong response.",
    ] as const;

    const NOTES = [
      "Warm intro via a mutual contact; follow up after the CFP closes.",
      "Confirmed via email; sending the speaker agreement next.",
      "Left a voicemail; no callback yet, trying email next.",
      "Asked for the speaker prospectus before committing to anything.",
      "Wants to co-present with a colleague; confirming headcount.",
      "Flagged a scheduling conflict with the first day; checking the agenda.",
      "Requested reimbursement details before saying yes.",
    ] as const;

    const DECLINE_REASONS = [
      "Scheduling conflict with another commitment during the event dates.",
      "Company travel freeze this quarter ruled out in-person speaking.",
      "Topic overlapped too closely with an already-accepted session.",
      "Never responded after three follow-up attempts.",
    ] as const;

    // A minority stay deliberately unrated so the dashed "Unrated" fit pill
    // still renders on the board (DEC-821/DEC-942), while the rest carry a
    // varied 1-5 fit_score + distinct rationale.
    const UNRATED_INDICES = new Set([1, 7, 14]);

    for (let i = 0; i < pipelineCount; i++) {
      const stage = PIPELINE_STAGES[i % PIPELINE_STAGES.length]!;
      const contactId = pipelineContactIds[i]!;
      const entryId = pipelineEntryIds[i]!;
      const path = pathForStage(stage);
      const finalOffsetDays = STALENESS_OFFSETS_DAYS[i % STALENESS_OFFSETS_DAYS.length]!;
      const moveTimes = movesEndingAt(finalOffsetDays, path.length);

      const rated = !UNRATED_INDICES.has(i);
      const fitScore = rated ? (i % 5) + 1 : null;
      const rationale = rated ? RATIONALES[i % RATIONALES.length]! : null;

      statements.push(
        insertStmt("pipeline_entry", {
          id: entryId,
          org_id: orgId,
          contact_id: contactId,
          stage,
          fit_score: fitScore,
          rationale,
          created_at: moveTimes[0],
          updated_at: moveTimes[moveTimes.length - 1],
        }),
      );

      for (let step = 0; step < path.length; step++) {
        const fromStage = step === 0 ? null : path[step - 1]!;
        const toStage = path[step]!;
        statements.push(
          insertStmt("pipeline_activity", {
            id: nextActivityId(),
            entry_id: entryId,
            kind: "move",
            body: toStage === "declined" ? DECLINE_REASONS[i % DECLINE_REASONS.length]! : null,
            from_stage: fromStage,
            to_stage: toStage,
            author_user_id: organizerUserId,
            author_name: organizer.name,
            created_at: moveTimes[step],
          }),
        );
      }

      // Every third entry also carries a note, mirroring the original mix.
      if (i % 3 === 1) {
        statements.push(
          insertStmt("pipeline_activity", {
            id: nextActivityId(),
            entry_id: entryId,
            kind: "note",
            body: NOTES[i % NOTES.length]!,
            from_stage: null,
            to_stage: null,
            author_user_id: organizerUserId,
            author_name: organizer.name,
            created_at: moveTimes[moveTimes.length - 1]! + 5 * 60_000,
          }),
        );
      }
    }
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

  // DEC-836: acceptedSubmissions[2]/[3] were seeded above with an explicit
  // content_status override ('changes_requested'/'pending' respectively —
  // see the synthetic-submission loop's contentStatusOverride) so the
  // accepted set isn't uniformly pre-approved; acceptedSubmissions[0]'s
  // v1->v2 chain (fileChainSub, asserted by id in test/seed.test.ts) stays
  // the default 'approved' and untouched.
  const changesRequestedSub = acceptedSubmissions[2];
  const pendingDecisionSub = acceptedSubmissions[3];
  if (!changesRequestedSub || !pendingDecisionSub) {
    throw new Error("seed: expected at least 4 accepted submissions for the content-status spread demo");
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
      version_no: 1,
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
      version_no: 2,
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
      version_no: 1,
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

  // DEC-836: a third accepted submission carries a deliverable, this one
  // still under review (content_status 'changes_requested' above) — so the
  // Content worklist's needs-a-decision row has a real file to open, not
  // just an empty state.
  const fileChangesRequestedId = seedId("file", 5);
  const changesRequestedR2Key = `sub/${changesRequestedSub.submissionId}/${fileChangesRequestedId}-slides.pdf`;
  statements.push(
    insertStmt("file", {
      id: fileChangesRequestedId,
      submission_id: changesRequestedSub.submissionId,
      kind: "presentation",
      filename: "slides.pdf",
      r2_key: changesRequestedR2Key,
      size_bytes: registerPdfAsset(changesRequestedR2Key),
      content_type: "application/pdf",
      previous_file_id: null,
      version_no: 1,
      uploaded_by_contact_id: changesRequestedSub.contactId,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );

  // --- second re-upload chain (DEC-887 amendment, task w40-a): a v1->v2
  // presentation deliverable on pendingDecisionSub (content_status
  // 'pending', not 'approved') -- the existing fileChainSub chain above
  // lands on an approved submission, and worklistStatusLabel's precedence
  // (approved always wins) means that chain never renders the
  // 'Re-uploaded' tag even though it already feeds the header's
  // reuploadedCount. This second chain gives the Content worklist's
  // RE-UPLOADED tag and Overview section 03's 're-uploaded' row (both
  // scoped to accepted + content_status pending) a real live row.
  const filePendingV1Id = seedId("file", 6);
  const filePendingV2Id = seedId("file", 7);
  const pendingV1R2Key = `sub/${pendingDecisionSub.submissionId}/${filePendingV1Id}-deck-v1.pdf`;
  statements.push(
    insertStmt("file", {
      id: filePendingV1Id,
      submission_id: pendingDecisionSub.submissionId,
      kind: "presentation",
      filename: "deck-v1.pdf",
      r2_key: pendingV1R2Key,
      size_bytes: registerPdfAsset(pendingV1R2Key),
      content_type: "application/pdf",
      previous_file_id: null,
      version_no: 1,
      uploaded_by_contact_id: pendingDecisionSub.contactId,
      created_at: nextTs(),
      updated_at: ts,
    }),
  );
  const pendingV2R2Key = `sub/${pendingDecisionSub.submissionId}/${filePendingV2Id}-deck-v2.pdf`;
  statements.push(
    insertStmt("file", {
      id: filePendingV2Id,
      submission_id: pendingDecisionSub.submissionId,
      kind: "presentation",
      filename: "deck-v2.pdf",
      r2_key: pendingV2R2Key,
      size_bytes: registerPdfAsset(pendingV2R2Key),
      content_type: "application/pdf",
      previous_file_id: filePendingV1Id,
      version_no: 2,
      uploaded_by_contact_id: pendingDecisionSub.contactId,
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
      version_no: 1,
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
        version_no: 1,
        uploaded_by_contact_id: contactId,
        created_at: nextTs(),
        updated_at: ts,
      }),
    );
    statements.push(
      `UPDATE contact SET "headshot_url" = ${sqlQuote(`/headshots/${fileId}`)}, "headshot_file_id" = ${sqlQuote(fileId)} WHERE "id" = ${sqlQuote(contactId)};`,
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

  // DEC-796: a plausible dev portal link — the actual claim-token/portal
  // resolution (resolvePortalLink) needs a live KV + account lookup neither
  // of which exist at seed time, so the seed renders a fixed, readable
  // placeholder URL rather than a real one. Never a raw '{portal_link}'
  // token — this is history text, not a template.
  const SEED_PORTAL_LINK = "http://localhost:8787/portal";

  // --- email log (dev sink history, DEC-006/DEC-796): a few 'sent'
  // acceptance notifications so Comms history renders with real rows. Each
  // row renders the ACTUAL text that would have been sent to that
  // recipient (their own speaker name + talk title), never the raw
  // '{merge_field}' template text — a seeded history row is a record of
  // what was sent, not the template it was sent from.
  acceptedSubmissions.slice(0, 3).forEach((acc, i) => {
    const vars = {
      speaker_name: acc.speakerName,
      talk_title: acc.title,
      event_name: fixture.event.name,
      portal_link: SEED_PORTAL_LINK,
    };
    statements.push(
      insertStmt("email_log", {
        id: seedId("email_log", i + 1),
        event_id: eventId,
        template_id: emailTemplateId,
        contact_id: acc.contactId,
        to_email: acc.email,
        subject: renderTemplate(fixture.communications.acceptance_subject, vars),
        body_text: renderTemplate(fixture.communications.acceptance_body, vars),
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
  const batchRecipientMap = new Map<string, { contactId: string; email: string; speakerName: string }>();
  for (const acc of acceptedSubmissions) {
    batchRecipientMap.set(acc.contactId, { contactId: acc.contactId, email: acc.email, speakerName: acc.speakerName });
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
  // DEC-796: the batch is a Content Reminder fan-out, so {task_list}/
  // {due_date} must name real outstanding onboarding tasks — reuse the
  // seed's own already-computed DEFAULT_ONBOARDING_TASKS titles/due dates
  // (the two still-upcoming default tasks, index 2 and 4 of
  // dueOffsetDaysFromSeedNow, per the DEC-591/DEC-646 block above) rather
  // than inventing new task names, so this batch stays consistent with the
  // task/task_assignment rows the same seed writes.
  const UPCOMING_TASK_INDEXES = [2, 4];
  const upcomingTaskTitles = UPCOMING_TASK_INDEXES.map((idx) => DEFAULT_ONBOARDING_TASKS[idx]!.title);
  const nearestUpcomingDueDate = Math.min(
    ...UPCOMING_TASK_INDEXES.map((idx) => dayLabel(dueOffsetDaysFromSeedNow[idx]!)),
  );
  const batchTaskList = upcomingTaskTitles.join(", ");
  const batchDueDate = formatCalendarDate(nearestUpcomingDueDate);
  batchRecipients.forEach((r, i) => {
    const vars = {
      speaker_name: r.speakerName,
      task_list: batchTaskList,
      // DEC-792 amendment (wave 45): task_due_date is the canonical merge
      // vars key the ADDITIONAL_EMAIL_TEMPLATES Content Reminder template
      // now spells ({task_due_date}); {due_date} keeps resolving as a
      // permanent alias but this seed demonstrates the canonical name.
      task_due_date: batchDueDate,
      portal_link: SEED_PORTAL_LINK,
    };
    statements.push(
      insertStmt("email_log", {
        id: seedId("email_log", 4 + i),
        event_id: eventId,
        template_id: contentReminderTemplateId,
        contact_id: r.contactId,
        batch_id: emailBatchId,
        to_email: r.email,
        subject: renderTemplate(contentReminderTemplate.subject, vars),
        body_text: renderTemplate(contentReminderTemplate.bodyText, vars),
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
