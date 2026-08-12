// Pure helpers for scripts/perf-seed.ts, extracted for plain-vitest testing
// (same pattern as scripts/seed-lib.ts: dependency-free, no filesystem or D1
// access, safe to import without side effects). DEC-034.

/** Fixed id for the single synthetic perf event (not padded via seedId — it
 * is a singleton, not a numbered series). Starts with 'seed_perf_' so it is
 * covered by the same idempotent-delete namespace as every other perf row. */
export const PERF_EVENT_ID = "seed_perf_event";
export const PERF_EVENT_SLUG = "perf-2k";

export const PERF_SUBMISSION_COUNT = 2000;
export const PERF_CONTACT_COUNT = 800;
export const PERF_TRACK_COUNT = 8;
export const PERF_ANSWERS_PER_SUBMISSION = 3;

/** Realistic status mix across the 2,000 perf submissions (DEC-003 literals),
 * weighted toward 'pending' the way a real, actively-triaged CFP looks. */
export const PERF_STATUS_COUNTS: Readonly<Record<string, number>> = {
  pending: 1200,
  accept_queue: 300,
  accepted: 300,
  decline_queue: 100,
  declined: 100,
};

/**
 * Deterministic status list for the perf submissions, grouped by status
 * (block-distributed, not shuffled — deterministic and trivially testable;
 * downstream track/contact assignment is index-modulo so the resulting rows
 * still spread evenly regardless of block order).
 */
export function perfSubmissionStatuses(count: number): string[] {
  const total = Object.values(PERF_STATUS_COUNTS).reduce((a, b) => a + b, 0);
  if (count !== total) {
    throw new Error(`perfSubmissionStatuses: expected count ${total}, got ${count}`);
  }
  const out: string[] = [];
  for (const [status, n] of Object.entries(PERF_STATUS_COUNTS)) {
    for (let i = 0; i < n; i++) {
      out.push(status);
    }
  }
  return out;
}

/** Total submission_answer rows for N submissions at the fixed per-submission rate. */
export function totalPerfAnswerRows(submissionCount: number): number {
  if (!Number.isInteger(submissionCount) || submissionCount < 0) {
    throw new Error(`totalPerfAnswerRows: submissionCount must be a non-negative integer, got ${submissionCount}`);
  }
  return submissionCount * PERF_ANSWERS_PER_SUBMISSION;
}

/** 0-based contact index (into the 800-contact pool) for the i-th (0-based) submission. */
export function contactIndexForSubmission(i: number): number {
  if (!Number.isInteger(i) || i < 0) {
    throw new Error(`contactIndexForSubmission: i must be a non-negative integer, got ${i}`);
  }
  return i % PERF_CONTACT_COUNT;
}

/** 0-based track index (into the 8-track pool) for the i-th (0-based) submission. */
export function trackIndexForSubmission(i: number): number {
  if (!Number.isInteger(i) || i < 0) {
    throw new Error(`trackIndexForSubmission: i must be a non-negative integer, got ${i}`);
  }
  return i % PERF_TRACK_COUNT;
}

// Topic pool for submission titles: cycling through a wide, fixed set
// (rather than every title sharing one literal string) keeps a
// realistic-search query term matching a *small minority* of the 2,000
// rows, the way an actual CFP search term would. 80 topics -> 25 matches
// each, comfortably under D1's bound-parameter ceiling on the id IN (...)
// query the match set drives (observed to error out around ~100 binds in
// local Miniflare D1) — a real product constraint this harness should
// respect with realistic data, not manufacture by giving every row the
// same searchable word.
export const PERF_TOPICS: readonly string[] = [
  "Kubernetes",
  "Observability",
  "Feature Flags",
  "Data Contracts",
  "Incident Response",
  "API Design",
  "Test Suites",
  "Code Review",
  "Edge Computing",
  "Vector Databases",
  "Build Caching",
  "On-Call Culture",
  "Prompt Engineering",
  "Static Analysis",
  "Release Trains",
  "Config Management",
  "Chaos Engineering",
  "Developer Metrics",
  "Monorepo Tooling",
  "Secrets Management",
  "Service Meshes",
  "LLM Evaluation",
  "Developer Onboarding",
  "Internal Tooling",
  "Platform Reliability",
  "Documentation Systems",
  "Infrastructure as Code",
  "Database Migrations",
  "Load Testing",
  "Zero Trust Networking",
  "GraphQL Federation",
  "Event Sourcing",
  "Distributed Tracing",
  "Container Security",
  "Serverless Cold Starts",
  "Rate Limiting",
  "Multi-Tenant Architecture",
  "Schema Evolution",
  "Blue-Green Deploys",
  "Canary Releases",
  "SLO Dashboards",
  "Capacity Planning",
  "Dependency Upgrades",
  "Accessibility Audits",
  "Design Systems",
  "Mobile CI Pipelines",
  "WebAssembly Runtimes",
  "Streaming Data Pipelines",
  "Feature Store Design",
  "Model Serving",
  "Data Lineage",
  "Cost Observability",
  "Terraform Modules",
  "Kafka Consumer Groups",
  "gRPC Contracts",
  "Postgres Tuning",
  "Redis Caching Patterns",
  "Search Relevance",
  "Notification Systems",
  "Batch Job Orchestration",
  "Zero-Downtime Migrations",
  "Compliance Automation",
  "Threat Modeling",
  "Supply Chain Security",
  "Developer Experience Metrics",
  "Internal Platforms",
  "API Gateways",
  "Service Level Objectives",
  "Progressive Delivery",
  "Data Warehousing",
  "Real-Time Analytics",
  "Edge Caching",
  "Client-Side Performance",
  "Bundler Internals",
  "Type-Safe APIs",
  "Continuous Verification",
  "Postmortem Culture",
  "Runbook Automation",
  "Multi-Region Failover",
  "Cost-Aware Scheduling",
  "Test Data Management",
  "Contract Testing",
];

/** The topic (title-search substring) for the i-th (0-based) submission. */
export function topicForSubmission(i: number): string {
  if (!Number.isInteger(i) || i < 0) {
    throw new Error(`topicForSubmission: i must be a non-negative integer, got ${i}`);
  }
  const topic = PERF_TOPICS[i % PERF_TOPICS.length];
  if (!topic) throw new Error("topicForSubmission: empty PERF_TOPICS pool");
  return topic;
}

// --------------------------------------------------------------------------
// DEC-088: schedule, evaluation plan, and 12-reviewer contract for
// DEC-086's scale probes.

export const PERF_ROOM_COUNT = 10;
export const PERF_REVIEWER_COUNT = 12;
export const PERF_PLAN_ID = "seed_perf_plan_0001";
export const PERF_REVIEWER_PASSWORD = "PerfReviewer!2027";
// DEC-347: raised from 600 so the plan's current round holds at least 5,000
// evaluation rows. 6,000 = lcm(PERF_SUBMISSION_COUNT=2000, PERF_REVIEWER_COUNT=12),
// which keeps the existing (n % submissionCount, n % reviewerCount) round-robin
// assignment shape while guaranteeing no (plan_id, submission_id, reviewer_id,
// round) collision across the full n range (the evaluation table's unique
// index) — a duplicate would require n2 = n1 + 6000, outside [0, 6000).
export const PERF_EVALUATION_COUNT = 6000;

/** 1-based (per DEC-088's "i unpadded") reviewer email, e.g.
 * perfReviewerEmail(1) === 'perf.reviewer.1@example-perf.test'. */
export function perfReviewerEmail(i: number): string {
  if (!Number.isInteger(i) || i < 1) {
    throw new Error(`perfReviewerEmail: i must be a positive integer, got ${i}`);
  }
  return `perf.reviewer.${i}@example-perf.test`;
}

export interface PerfSlotPlacement {
  day: string;
  startMin: number;
  endMin: number;
  roomIndex: number;
}

/**
 * Deterministic schedule-slot placement for the j-th (0-based) accepted
 * submission: 100 sessions/day across the event's three days
 * (2028-06-01..03), 30-minute slots starting at 09:00 (startMin 540),
 * room assigned round-robin over the 10 rooms.
 */
export function slotPlacementForAccepted(j: number): PerfSlotPlacement {
  if (!Number.isInteger(j) || j < 0) {
    throw new Error(`slotPlacementForAccepted: j must be a non-negative integer, got ${j}`);
  }
  const dayIndex = Math.floor(j / 100); // 0, 1, 2
  const dayOfMonth = 1 + dayIndex;
  const day = `2028-06-0${dayOfMonth}`;
  const withinDay = j % 100;
  const startMin = 540 + 30 * Math.floor(withinDay / 10);
  const endMin = startMin + 30;
  const roomIndex = j % PERF_ROOM_COUNT;
  return { day, startMin, endMin, roomIndex };
}

// --------------------------------------------------------------------------
// DEC-338 (companion to DEC-331): the three hot admin screens nobody
// measures — onboarding grid, reviewer queue (already covered by
// PERF_EVALUATION_COUNT above), and email log — need seeded rows at scale
// too. Onboarding tasks and their per-contact assignments, plus a large
// email_log table spread across a real trailing-30-day window so the
// email-log route's default 7-day filter is a strict, non-trivial subset.

/** 5 onboarding tasks for the perf event, one of them a file_request (the
 * kind that also drives Files-library/worklist counts, mirroring
 * scripts/seed.ts's deliverable_kind convention). */
export const PERF_TASK_COUNT = 5;

/** task_assignment rows: PERF_TASK_COUNT tasks x PERF_CONTACT_COUNT contacts. */
export const PERF_TASK_ASSIGNMENT_COUNT = PERF_TASK_COUNT * PERF_CONTACT_COUNT;

export interface PerfTaskSpec {
  kind: "general" | "file_request";
  title: string;
  deliverableKind: "presentation" | null;
}

/** Fixed 5-task set (0-based index i in [0, PERF_TASK_COUNT)); task index 0
 * is the sole file_request task, matching scripts/seed.ts's one-file-
 * request-task convention. */
export const PERF_TASKS: readonly PerfTaskSpec[] = [
  { kind: "file_request", title: "Finalize bio + headshot", deliverableKind: "presentation" },
  { kind: "general", title: "Confirm travel details", deliverableKind: null },
  { kind: "general", title: "Submit AV requirements", deliverableKind: null },
  { kind: "general", title: "Review session abstract", deliverableKind: null },
  { kind: "general", title: "Announce participation", deliverableKind: null },
];

if (PERF_TASKS.length !== PERF_TASK_COUNT) {
  throw new Error(`PERF_TASKS must have exactly ${PERF_TASK_COUNT} entries, got ${PERF_TASKS.length}`);
}

/**
 * Deterministic pending/complete split for the (taskIndex, contactIndex)
 * pair, both 0-based: index-modulo mixed the same way scripts/seed.ts mixes
 * its own onboarding grid (contactIdx + taskIdx) % 3 !== 0 => complete, so
 * every task/contact pair spreads evenly across both statuses rather than
 * every assignment landing in one bucket.
 */
export function isTaskAssignmentComplete(taskIndex: number, contactIndex: number): boolean {
  if (!Number.isInteger(taskIndex) || taskIndex < 0) {
    throw new Error(`isTaskAssignmentComplete: taskIndex must be a non-negative integer, got ${taskIndex}`);
  }
  if (!Number.isInteger(contactIndex) || contactIndex < 0) {
    throw new Error(`isTaskAssignmentComplete: contactIndex must be a non-negative integer, got ${contactIndex}`);
  }
  return (taskIndex + contactIndex) % 3 !== 0;
}

/** 5,000 email_log rows for the perf event, spread across the last 30 days
 * (from a fixed `now`) so the email-log route's default trailing-7-day
 * filter is a strict, realistically-sized subset of the full table. */
export const PERF_EMAIL_LOG_COUNT = 5000;

/** Number of the 30 trailing days considered "within the last 7 days" of `now`. */
export const PERF_EMAIL_LOG_RECENT_WINDOW_DAYS = 7;
export const PERF_EMAIL_LOG_SPREAD_DAYS = 30;

/**
 * Deterministic sent_at (ms epoch) for the n-th (0-based) email_log row,
 * index-modulo across PERF_EMAIL_LOG_SPREAD_DAYS trailing days ending at
 * `nowMs` (inclusive of day 0 = most recent), so the resulting rows spread
 * evenly across the whole window rather than clustering at one instant.
 */
export function sentAtForEmailLogRow(n: number, nowMs: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`sentAtForEmailLogRow: n must be a non-negative integer, got ${n}`);
  }
  if (!Number.isInteger(nowMs) || nowMs < 0) {
    throw new Error(`sentAtForEmailLogRow: nowMs must be a non-negative integer, got ${nowMs}`);
  }
  const dayOffset = n % PERF_EMAIL_LOG_SPREAD_DAYS; // 0..29 days back
  const minuteOfDay = (n * 7) % (24 * 60); // spreads within the day too
  const DAY_MS = 24 * 60 * 60 * 1000;
  const MINUTE_MS = 60 * 1000;
  return nowMs - dayOffset * DAY_MS - minuteOfDay * MINUTE_MS;
}

// --------------------------------------------------------------------------
// DEC-347: deliverable `file` rows at scale, so the files library (server-
// paged, DEC-344) is observable at SPEC scale. For each of the
// PERF_STATUS_COUNTS.accepted (300) accepted perf submissions: one
// `presentation` version chain of 3 rows (root -> v2 -> v3, previous_file_id
// pointing from newer to older, root NULL — same direction as
// scripts/seed.ts's own demo chain) and one single-version `handout` chain.

/** Versions in each accepted submission's `presentation` chain. */
export const PERF_FILE_PRESENTATION_VERSIONS = 3;
/** Rows contributed per accepted submission: 3 presentation versions + 1 handout. */
export const PERF_FILE_ROWS_PER_SUBMISSION = PERF_FILE_PRESENTATION_VERSIONS + 1;
/** Total deliverable `file` rows: 300 accepted submissions x 4 rows each = 1,200. */
export const PERF_FILE_COUNT = (PERF_STATUS_COUNTS.accepted ?? 0) * PERF_FILE_ROWS_PER_SUBMISSION;

export interface PerfFileRowSpec {
  /** 1-based index for seedId('perf_file', n) — unique across the whole 1,200-row set. */
  n: number;
  /** 0-based index into the accepted-submission id list this row's file belongs to. */
  acceptedIndex: number;
  kind: "presentation" | "handout";
  /** 0-based position within this row's own chain (0 = root). */
  versionIndex: number;
  /** `n` of the row this one's previous_file_id points at, or null for the chain root. */
  previousN: number | null;
}

/**
 * Deterministic, index-only spec for every perf `file` row across all
 * accepted submissions: for the j-th (0-based) accepted submission, a
 * 3-version `presentation` chain (n = base+1..base+3, previous_file_id
 * chaining newer -> older, root null) plus a 1-version `handout` chain
 * (n = base+4, previous_file_id null), where base = j * PERF_FILE_ROWS_PER_SUBMISSION.
 */
// --------------------------------------------------------------------------
// DEC-469: the two hot admin screens DEC-460 ranked most at risk that this
// harness still doesn't measure — the CRM pipeline board and the org user
// directory. Additive on top of the DEC-034/088/338/347 fixtures above;
// none of those existing row counts change.

// Mirrors src/server/repo/pipeline.ts's PIPELINE_STAGES exactly (DEC-157).
// Hardcoded locally rather than imported, matching scripts/perf-smoke.ts's
// existing DEC-089 file-disjoint-split convention of duplicating small
// literal contracts instead of reaching into src/server/repo from a second
// scripts/ file.
export const PERF_PIPELINE_STAGES = ["identified", "contacted", "interested", "confirmed", "declined"] as const;

/**
 * Pipeline-entry count: pipeline_entry has a UNIQUE(org_id, contact_id)
 * index (migrations/0012_pipeline.sql), so at most one entry can exist per
 * perf contact within the shared perf org — capping this at
 * PERF_CONTACT_COUNT (800) rather than the "roughly 1,000" target, since
 * that target isn't reachable without either adding new contacts (which
 * would grow the pinned 800-contact count another log has already
 * measured against) or violating the unique index.
 */
export const PERF_PIPELINE_ENTRY_COUNT = PERF_CONTACT_COUNT;

/** 0-based stage index (into PERF_PIPELINE_STAGES) for the i-th (0-based)
 * pipeline entry — block-distributed like perfSubmissionStatuses, so all
 * five stages get an equal (160-row) share of the 800 entries. */
export function pipelineStageIndexForEntry(i: number): number {
  if (!Number.isInteger(i) || i < 0) {
    throw new Error(`pipelineStageIndexForEntry: i must be a non-negative integer, got ${i}`);
  }
  const perStage = Math.ceil(PERF_PIPELINE_ENTRY_COUNT / PERF_PIPELINE_STAGES.length);
  return Math.min(Math.floor(i / perStage), PERF_PIPELINE_STAGES.length - 1);
}

/** Additional org `user` rows seeded on top of scripts/seed.ts's demo
 * users (7, not the ~19 estimated when this constant was scoped) + the 12
 * PERF_REVIEWER_COUNT reviewers above, for the org user directory
 * (GET /api/v1/users) perf check. Raised from a "roughly 60" starting
 * point to 85 so the shared org's total user count (7 + 12 + 85 = 104)
 * clears the 100-row exercised-scale floor this task verifies against —
 * 60 alone (7 + 12 + 60 = 79) would not have. */
export const PERF_ORG_USER_COUNT = 85;

/** 1-based (matching perfReviewerEmail's convention) email for the extra
 * org-user perf rows, distinct from both the demo seed's and the
 * PERF_REVIEWER_COUNT reviewers' emails. */
export function perfOrgUserEmail(i: number): string {
  if (!Number.isInteger(i) || i < 1) {
    throw new Error(`perfOrgUserEmail: i must be a positive integer, got ${i}`);
  }
  return `perf.orguser.${i}@example-perf.test`;
}

/**
 * Deterministic role for the i-th (0-based) extra org-user row: a
 * realistic mix skewed toward reviewer (every 5th row is an organizer —
 * 17 organizers / 68 reviewers across the 85 PERF_ORG_USER_COUNT rows),
 * the way a real org's account roster looks (few organizers, many
 * reviewers).
 */
export function perfOrgUserRole(i: number): "organizer" | "reviewer" {
  if (!Number.isInteger(i) || i < 0) {
    throw new Error(`perfOrgUserRole: i must be a non-negative integer, got ${i}`);
  }
  return i % 5 === 0 ? "organizer" : "reviewer";
}

export function perfFileSpecs(acceptedCount: number): PerfFileRowSpec[] {
  if (!Number.isInteger(acceptedCount) || acceptedCount < 0) {
    throw new Error(`perfFileSpecs: acceptedCount must be a non-negative integer, got ${acceptedCount}`);
  }
  const out: PerfFileRowSpec[] = [];
  for (let j = 0; j < acceptedCount; j++) {
    const base = j * PERF_FILE_ROWS_PER_SUBMISSION;
    let previousN: number | null = null;
    for (let v = 0; v < PERF_FILE_PRESENTATION_VERSIONS; v++) {
      const n = base + v + 1;
      out.push({ n, acceptedIndex: j, kind: "presentation", versionIndex: v, previousN });
      previousN = n;
    }
    out.push({
      n: base + PERF_FILE_PRESENTATION_VERSIONS + 1,
      acceptedIndex: j,
      kind: "handout",
      versionIndex: 0,
      previousN: null,
    });
  }
  return out;
}
