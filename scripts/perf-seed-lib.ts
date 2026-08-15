// Pure helpers for scripts/perf-seed.ts, extracted for plain-vitest testing
// (same pattern as scripts/seed-lib.ts: dependency-free, no filesystem or D1
// access, safe to import without side effects). DEC-034.


/**
 * A named scale profile for the perf seeder (DEC-619): every volume the
 * seeder needs to build its core submission/contact/track/answer/status
 * rows, so `perf-seed --profile=<name>` can target a different scale
 * without a second seeder script (scale-mandate: "Scale is a PROFILE
 * threaded through the seeder, not a second seeder").
 */
export interface PerfProfile {
  name: string;
  eventId: string;
  eventSlug: string;
  submissionCount: number;
  contactCount: number;
  trackCount: number;
  answersPerSubmission: number;
  statusCounts: Readonly<Record<string, number>>;
  // DEC-645: the remaining scale-mandate volumes (agenda/review/onboarding
  // surfaces), threaded per-profile so `--profile=aie` builds those surfaces
  // at mandate scale too, not just submissions/contacts/tracks/answers.
  /** Rooms in the event's schedule grid. */
  roomCount: number;
  /** Days the accepted-session schedule spans. */
  dayCount: number;
  /** Reviewer users created for the review plan(s). */
  reviewerCount: number;
  /** Evaluation plans created for the event. */
  planCount: number;
  /** Base id for this profile's first evaluation plan (see perfPlanId). */
  planId: string;
  /** Email local-part prefix for this profile's reviewer users. */
  reviewerEmailPrefix: string;
  /** Shared login password for this profile's reviewer users. */
  reviewerPassword: string;
  /** Total task_assignment ("speaker task") rows seeded for the event. */
  taskCount: number;
  /** Fraction (0..1) of taskCount rows seeded as already-overdue (pending, past due_date). */
  overdueTaskFraction: number;
  /** Deliberately-overlapping schedule_slot pairs seeded (room + speaker conflicts). */
  deliberateConflictCount: number;
}

/**
 * `default`: today's perf-2k numbers, unchanged bit-for-bit (2000
 * submissions / 800 contacts / 8 tracks / 3 answers each, the same
 * 'pending'-heavy status mix as before DEC-619).
 *
 * `aie`: docs/mandates/scale-mandate.md's "stress test at AI Engineer
 * scale" volumes — 2,500 submissions across 20 tracks, ~10% accepted,
 * 6,000 contacts. Distinct event id/slug so it can never collide with the
 * `default` profile's seed_perf_event singleton; still inside the
 * seed_perf_ id namespace so the idempotent delete catches it too.
 */
export const PERF_PROFILES: Record<"default" | "aie", PerfProfile> = {
  default: {
    name: "default",
    eventId: "seed_perf_event",
    eventSlug: "perf-2k",
    submissionCount: 2000,
    contactCount: 800,
    trackCount: 8,
    answersPerSubmission: 3,
    statusCounts: {
      pending: 1200,
      accept_queue: 300,
      accepted: 300,
      decline_queue: 100,
      declined: 100,
    },
    // DEC-088/DEC-338 literals, unchanged bit-for-bit.
    roomCount: 10,
    dayCount: 3,
    reviewerCount: 12,
    planCount: 1,
    planId: "seed_perf_plan_0001",
    reviewerEmailPrefix: "perf.reviewer",
    reviewerPassword: "PerfReviewer!2027",
    taskCount: 4000, // 5 tasks x 800 contacts, today's PERF_TASK_ASSIGNMENT_COUNT
    overdueTaskFraction: 0,
    deliberateConflictCount: 0,
  },
  aie: {
    name: "aie",
    eventId: "seed_perf_aie_event",
    eventSlug: "perf-aie",
    submissionCount: 2500,
    contactCount: 6000,
    trackCount: 20,
    answersPerSubmission: 3,
    // ~10% accepted (250 / 2500), same pending-heavy shape as `default`.
    statusCounts: {
      pending: 1500,
      accept_queue: 375,
      accepted: 250,
      decline_queue: 250,
      declined: 125,
    },
    // DEC-645 (docs/mandates/scale-mandate.md): agenda/review/onboarding
    // surfaces at AI Engineer scale.
    roomCount: 10,
    dayCount: 4,
    reviewerCount: 15,
    planCount: 3,
    planId: "seed_perf_aie_plan_0001",
    reviewerEmailPrefix: "perf.aie.reviewer",
    reviewerPassword: "PerfReviewer!2027",
    taskCount: 400, // "400 speaker tasks"
    overdueTaskFraction: 0.15, // "~15% overdue"
    deliberateConflictCount: 12, // ">=12 deliberate conflicts"
  },
};

/** Fixed id for the single synthetic perf event (not padded via seedId — it
 * is a singleton, not a numbered series). Starts with 'seed_perf_' so it is
 * covered by the same idempotent-delete namespace as every other perf row.
 * Kept as the `default` profile's own id/slug for existing call sites. */
export const PERF_EVENT_ID = PERF_PROFILES.default.eventId;
export const PERF_EVENT_SLUG = PERF_PROFILES.default.eventSlug;

/**
 * Deterministic status list for `count` perf submissions, grouped by status
 * (block-distributed, not shuffled — deterministic and trivially testable;
 * downstream track/contact assignment is index-modulo so the resulting rows
 * still spread evenly regardless of block order).
 */
export function perfSubmissionStatuses(count: number, statusCounts: Readonly<Record<string, number>>): string[] {
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  if (count !== total) {
    throw new Error(`perfSubmissionStatuses: expected count ${total}, got ${count}`);
  }
  const out: string[] = [];
  for (const [status, n] of Object.entries(statusCounts)) {
    for (let i = 0; i < n; i++) {
      out.push(status);
    }
  }
  return out;
}

/** Total submission_answer rows for N submissions at the given per-submission rate. */
export function totalPerfAnswerRows(submissionCount: number, answersPerSubmission: number): number {
  if (!Number.isInteger(submissionCount) || submissionCount < 0) {
    throw new Error(`totalPerfAnswerRows: submissionCount must be a non-negative integer, got ${submissionCount}`);
  }
  if (!Number.isInteger(answersPerSubmission) || answersPerSubmission < 0) {
    throw new Error(
      `totalPerfAnswerRows: answersPerSubmission must be a non-negative integer, got ${answersPerSubmission}`,
    );
  }
  return submissionCount * answersPerSubmission;
}

/** 0-based contact index (into the contactCount-sized contact pool) for the i-th (0-based) submission. */
export function contactIndexForSubmission(i: number, contactCount: number): number {
  if (!Number.isInteger(i) || i < 0) {
    throw new Error(`contactIndexForSubmission: i must be a non-negative integer, got ${i}`);
  }
  if (!Number.isInteger(contactCount) || contactCount <= 0) {
    throw new Error(`contactIndexForSubmission: contactCount must be a positive integer, got ${contactCount}`);
  }
  return i % contactCount;
}

/** 0-based track index (into the trackCount-sized track pool) for the i-th (0-based) submission. */
export function trackIndexForSubmission(i: number, trackCount: number): number {
  if (!Number.isInteger(i) || i < 0) {
    throw new Error(`trackIndexForSubmission: i must be a non-negative integer, got ${i}`);
  }
  if (!Number.isInteger(trackCount) || trackCount <= 0) {
    throw new Error(`trackIndexForSubmission: trackCount must be a positive integer, got ${trackCount}`);
  }
  return i % trackCount;
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

// Derived from PERF_PROFILES.default rather than hand-copied literals, so
// this module has exactly one source of truth for the `default` profile's
// DEC-088/DEC-338 volumes (a hand-copied vocabulary drifts).
export const PERF_ROOM_COUNT = PERF_PROFILES.default.roomCount;
export const PERF_REVIEWER_COUNT = PERF_PROFILES.default.reviewerCount;
export const PERF_PLAN_ID = PERF_PROFILES.default.planId;
export const PERF_REVIEWER_PASSWORD = PERF_PROFILES.default.reviewerPassword;
// DEC-347: raised from 600 so the plan's current round holds at least 5,000
// evaluation rows. 6,000 = lcm(PERF_SUBMISSION_COUNT=2000, PERF_REVIEWER_COUNT=12),
// which keeps the existing (n % submissionCount, n % reviewerCount) round-robin
// assignment shape while guaranteeing no (plan_id, submission_id, reviewer_id,
// round) collision across the full n range (the evaluation table's unique
// index) — a duplicate would require n2 = n1 + 6000, outside [0, 6000).
// DEC-645 scopes evaluation-row count out of the profile-threaded set (only
// the round-robin plan/reviewer *identity* changes per profile); every
// profile's evaluations are still seeded against the profile's first plan.
export const PERF_EVALUATION_COUNT = 6000;

/** 1-based (per DEC-088's "i unpadded") reviewer email, e.g.
 * perfReviewerEmail(1) === 'perf.reviewer.1@example-perf.test'. `prefix`
 * defaults to the `default` profile's own prefix so existing call sites are
 * unaffected — DEC-645 threads a per-profile prefix through the seeder. */
export function perfReviewerEmail(i: number, prefix: string = PERF_PROFILES.default.reviewerEmailPrefix): string {
  if (!Number.isInteger(i) || i < 1) {
    throw new Error(`perfReviewerEmail: i must be a positive integer, got ${i}`);
  }
  if (!prefix) {
    throw new Error(`perfReviewerEmail: prefix must be non-empty, got ${JSON.stringify(prefix)}`);
  }
  return `${prefix}.${i}@example-perf.test`;
}

/**
 * DEC-645: this profile's evaluation-plan id for the planIndex-th (1-based)
 * plan. planIndex 1 always returns `basePlanId` unchanged (so the `default`
 * profile's single plan keeps today's exact literal id, e.g.
 * 'seed_perf_plan_0001'); planIndex > 1 (only reachable for planCount > 1
 * profiles like `aie`) suffixes `_<planIndex>`.
 */
export function perfPlanId(basePlanId: string, planIndex: number): string {
  if (!basePlanId) {
    throw new Error(`perfPlanId: basePlanId must be non-empty, got ${JSON.stringify(basePlanId)}`);
  }
  if (!Number.isInteger(planIndex) || planIndex < 1) {
    throw new Error(`perfPlanId: planIndex must be a positive integer, got ${planIndex}`);
  }
  return planIndex === 1 ? basePlanId : `${basePlanId}_${planIndex}`;
}

export interface PerfSlotPlacement {
  day: string;
  startMin: number;
  endMin: number;
  roomIndex: number;
}

/**
 * Deterministic schedule-slot placement for the j-th (0-based) accepted
 * submission: `acceptedCount` sessions spread evenly (ceil-divided) across
 * `dayCount` days starting 2028-06-01, 30-minute slots starting at 09:00
 * (startMin 540), room assigned round-robin over `roomCount` rooms.
 * DEC-645: parameterized (was module-constant PERF_ROOM_COUNT / a hardcoded
 * 3-day, 100-sessions/day contract) so `--profile=aie` can place its 4-day,
 * 10-room schedule through the same helper. For the `default` profile's own
 * numbers (roomCount=10, dayCount=3, acceptedCount=300) this reproduces
 * today's placements bit-for-bit (sessionsPerDay = ceil(300/3) = 100, same
 * as the old hardcoded 100).
 */
export function slotPlacementForAccepted(
  j: number,
  roomCount: number,
  dayCount: number,
  acceptedCount: number,
): PerfSlotPlacement {
  if (!Number.isInteger(j) || j < 0) {
    throw new Error(`slotPlacementForAccepted: j must be a non-negative integer, got ${j}`);
  }
  if (!Number.isInteger(roomCount) || roomCount < 1) {
    throw new Error(`slotPlacementForAccepted: roomCount must be a positive integer, got ${roomCount}`);
  }
  if (!Number.isInteger(dayCount) || dayCount < 1) {
    throw new Error(`slotPlacementForAccepted: dayCount must be a positive integer, got ${dayCount}`);
  }
  if (!Number.isInteger(acceptedCount) || acceptedCount < 1) {
    throw new Error(`slotPlacementForAccepted: acceptedCount must be a positive integer, got ${acceptedCount}`);
  }
  const sessionsPerDay = Math.ceil(acceptedCount / dayCount);
  const dayIndex = Math.floor(j / sessionsPerDay);
  const dayOfMonth = 1 + dayIndex;
  const day = `2028-06-${String(dayOfMonth).padStart(2, "0")}`;
  const withinDay = j % sessionsPerDay;
  const startMin = 540 + 30 * Math.floor(withinDay / roomCount);
  const endMin = startMin + 30;
  const roomIndex = j % roomCount;
  return { day, startMin, endMin, roomIndex };
}

/**
 * DEC-645: sibling of slotPlacementForAccepted that deliberately overlaps
 * the first `deliberateConflictCount` (j, j-1) pairs (j odd, j < 2 *
 * deliberateConflictCount) onto the exact same day/room/time as their
 * even-indexed partner — a guaranteed room + speaker double-booking, so
 * findConflicts (src/domain/schedule.ts) always reports at least
 * `deliberateConflictCount` real conflicts. `deliberateConflictCount === 0`
 * (the `default` profile) always falls through to the normal placement,
 * bit-for-bit unchanged.
 */
export function slotPlacementForAcceptedWithConflicts(
  j: number,
  roomCount: number,
  dayCount: number,
  acceptedCount: number,
  deliberateConflictCount: number,
): PerfSlotPlacement {
  if (!Number.isInteger(deliberateConflictCount) || deliberateConflictCount < 0) {
    throw new Error(
      `slotPlacementForAcceptedWithConflicts: deliberateConflictCount must be a non-negative integer, got ${deliberateConflictCount}`,
    );
  }
  const conflictSpan = deliberateConflictCount * 2;
  if (deliberateConflictCount > 0 && j < conflictSpan && j % 2 === 1) {
    return slotPlacementForAccepted(j - 1, roomCount, dayCount, acceptedCount);
  }
  return slotPlacementForAccepted(j, roomCount, dayCount, acceptedCount);
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

/** task_assignment rows for the `default` profile: PERF_TASK_COUNT tasks x
 * the `default` profile's contact count — equal to
 * PERF_PROFILES.default.taskCount (DEC-645 threads taskCount per-profile;
 * this constant is kept for existing call sites/tests and always matches
 * the default profile's own taskCount by construction). File/pipeline/
 * co-speaker fixtures below stay pinned to the `default` profile's scale
 * regardless of which profile is seeded (DEC-619's original scope; DEC-645
 * doesn't extend to those). */
export const PERF_TASK_ASSIGNMENT_COUNT = PERF_TASK_COUNT * PERF_PROFILES.default.contactCount;

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

/**
 * DEC-645: number of contacts assigned every one of the PERF_TASK_COUNT
 * task templates for a `taskCount`-sized task_assignment table (taskCount
 * must be an exact multiple of taskDefCount — both profiles' taskCount
 * values are constructed to divide evenly by PERF_TASK_COUNT).
 */
export function contactsPerTask(taskCount: number, taskDefCount: number): number {
  if (!Number.isInteger(taskCount) || taskCount < 0) {
    throw new Error(`contactsPerTask: taskCount must be a non-negative integer, got ${taskCount}`);
  }
  if (!Number.isInteger(taskDefCount) || taskDefCount < 1) {
    throw new Error(`contactsPerTask: taskDefCount must be a positive integer, got ${taskDefCount}`);
  }
  if (taskCount % taskDefCount !== 0) {
    throw new Error(`contactsPerTask: taskCount (${taskCount}) must be an exact multiple of taskDefCount (${taskDefCount})`);
  }
  return taskCount / taskDefCount;
}

/** DEC-645: round(taskCount * overdueTaskFraction) — how many of a
 * profile's task_assignment rows should be seeded already-overdue
 * (pending, past due_date). `overdueTaskFraction` must be in [0, 1]. */
export function overdueAssignmentCount(taskCount: number, overdueTaskFraction: number): number {
  if (!Number.isInteger(taskCount) || taskCount < 0) {
    throw new Error(`overdueAssignmentCount: taskCount must be a non-negative integer, got ${taskCount}`);
  }
  if (!Number.isFinite(overdueTaskFraction) || overdueTaskFraction < 0 || overdueTaskFraction > 1) {
    throw new Error(`overdueAssignmentCount: overdueTaskFraction must be within [0, 1], got ${overdueTaskFraction}`);
  }
  return Math.round(taskCount * overdueTaskFraction);
}

/**
 * DEC-645: whether the (taskIndex, contactIndexWithinTask) assignment
 * (both 0-based) should be deliberately seeded overdue. Block-distributed
 * onto task index 0 only (the first `overdueCount` of its contacts) —
 * task 0 is given a past due_date by the seeder whenever overdueCount > 0,
 * so this set of assignments (seeded `pending`, never `complete`) is
 * genuinely overdue by the product's own overdue rule (status <> complete
 * AND task.due_date < now — src/server/repo/overview.ts). `overdueCount
 * === 0` (the `default` profile) always returns false, so
 * isTaskAssignmentComplete's existing mod-3 split governs every row
 * unchanged.
 */
export function isDeliberatelyOverdueAssignment(
  taskIndex: number,
  contactIndexWithinTask: number,
  overdueCount: number,
): boolean {
  if (!Number.isInteger(taskIndex) || taskIndex < 0) {
    throw new Error(`isDeliberatelyOverdueAssignment: taskIndex must be a non-negative integer, got ${taskIndex}`);
  }
  if (!Number.isInteger(contactIndexWithinTask) || contactIndexWithinTask < 0) {
    throw new Error(
      `isDeliberatelyOverdueAssignment: contactIndexWithinTask must be a non-negative integer, got ${contactIndexWithinTask}`,
    );
  }
  if (!Number.isInteger(overdueCount) || overdueCount < 0) {
    throw new Error(`isDeliberatelyOverdueAssignment: overdueCount must be a non-negative integer, got ${overdueCount}`);
  }
  return taskIndex === 0 && contactIndexWithinTask < overdueCount;
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
export const PERF_FILE_COUNT = (PERF_PROFILES.default.statusCounts.accepted ?? 0) * PERF_FILE_ROWS_PER_SUBMISSION;

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
export const PERF_PIPELINE_ENTRY_COUNT = PERF_PROFILES.default.contactCount;

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

// --------------------------------------------------------------------------
// DEC-495: fill the top of SPEC.md:73-76's 200-800-speaker range. Today only
// the 300 accepted submissions' primary speakers are publicly visible
// (docs/verification-log/task-w23-f-public-ceiling-measured-stage1.md:58-66),
// topping the public speakers list out around ~300 distinct contacts. Adding
// co-speaker `participant` rows to each accepted submission spreads visible
// contacts across the full 800-contact pool without growing
// PERF_SUBMISSION_COUNT or the 300-accepted count.

/** Extra visible speaker participants attached to each accepted submission,
 * beyond its primary speaker (DEC-495). */
export const PERF_CO_SPEAKERS_PER_ACCEPTED = 2;

// perfSubmissionStatuses block-distributes by status (pending, then
// accept_queue, then accepted, ...), so the accepted submissions are a
// single contiguous 300-wide block of global submission indexes starting
// right after the pending + accept_queue counts. contactIndexForSubmission
// is `i % PERF_CONTACT_COUNT`, so that block's *primary* speaker contacts
// are themselves one contiguous (circularly-wrapping) window of the
// 800-contact pool. The co-speaker pool below is that window's exact
// complement — always contiguous too, for any window narrower than the
// full contact pool — so co-speaker contacts never collide with a primary
// speaker's contact by construction (no runtime check needed).
const DEFAULT_STATUS_COUNTS = PERF_PROFILES.default.statusCounts;
const DEFAULT_CONTACT_COUNT = PERF_PROFILES.default.contactCount;
const ACCEPTED_WINDOW_START =
  (DEFAULT_STATUS_COUNTS.pending! + DEFAULT_STATUS_COUNTS.accept_queue!) % DEFAULT_CONTACT_COUNT;
const ACCEPTED_WINDOW_SIZE = DEFAULT_STATUS_COUNTS.accepted!;
const CO_SPEAKER_POOL_START = (ACCEPTED_WINDOW_START + ACCEPTED_WINDOW_SIZE) % DEFAULT_CONTACT_COUNT;
const CO_SPEAKER_POOL_SIZE = DEFAULT_CONTACT_COUNT - ACCEPTED_WINDOW_SIZE;

/**
 * Deterministic 0-based contact indexes (into the PERF_CONTACT_COUNT pool)
 * for the co-speakers of the j-th (0-based) accepted submission. Drawn from
 * CO_SPEAKER_POOL_START.. (the contact-pool complement of every accepted
 * submission's primary-speaker window, see above), a simple sequential walk
 * so the co-speaker assignments across all 300 accepted submissions sweep
 * the entire pool at least once, rather than any one contact absorbing a
 * disproportionate share of co-speaker slots. Together with the 300 (always
 * distinct) primary-speaker contacts, this puts every one of the 800
 * PERF_CONTACT_COUNT contacts on at least one publicly visible participant
 * row somewhere across the accepted submissions (SPEC.md:73-76's top end).
 */
export function coSpeakerContactIndexesForAccepted(
  j: number,
  coSpeakerCount: number = PERF_CO_SPEAKERS_PER_ACCEPTED,
): number[] {
  if (!Number.isInteger(j) || j < 0) {
    throw new Error(`coSpeakerContactIndexesForAccepted: j must be a non-negative integer, got ${j}`);
  }
  if (!Number.isInteger(coSpeakerCount) || coSpeakerCount < 0) {
    throw new Error(`coSpeakerContactIndexesForAccepted: coSpeakerCount must be a non-negative integer, got ${coSpeakerCount}`);
  }
  const out: number[] = [];
  for (let k = 0; k < coSpeakerCount; k++) {
    const step = j * coSpeakerCount + k;
    const idx = (CO_SPEAKER_POOL_START + (step % CO_SPEAKER_POOL_SIZE)) % DEFAULT_CONTACT_COUNT;
    out.push(idx);
  }
  return out;
}

// --------------------------------------------------------------------------
// DEC-338 (wave-35 amendment): a single deterministic perf speaker user so
// the speaker portal (/portal/*) is measurable by this harness — until now
// perf-smoke.ts's `login()` only ever authenticated the seeded ORGANIZER
// (docs/fixtures/sample-data.json's `identities.organizer`), so DEC-777's
// wave-33 GET /portal/submissions/:id two-wave split and wave-34's
// GET /portal/tasks rewrite were unmeasurable by construction. Singleton ids
// (not a numbered series, mirroring PERF_EVENT_ID above), shared across
// every profile — perf-smoke.ts never needs a profile-specific speaker
// identity, only a profile-specific accepted-submission id to view.
//
// Emitted here (this module), NOT written into docs/fixtures/sample-data.json
// — that file is the demo seed's own fixture output (task-w28-c recorded the
// login trap depending on it); the perf speaker's credentials live only in
// this perf-profile module, imported directly by both scripts/perf-seed.ts
// (to mint the row) and scripts/perf-smoke.ts (to log in), the same way the
// PERF_PROFILES.default.reviewerEmailPrefix/reviewerPassword pair above is
// already threaded end to end without ever touching sample-data.json.

/** Fixed id for the singleton perf speaker `user` row. */
export const PERF_SPEAKER_USER_ID = "seed_perf_speaker_user";
/** Fixed id for the singleton perf speaker's own `contact` row. */
export const PERF_SPEAKER_CONTACT_ID = "seed_perf_speaker_contact";
/** Login email for the singleton perf speaker. */
export const PERF_SPEAKER_EMAIL = "perf.speaker@example-perf.test";
/** Login password for the singleton perf speaker, hashed the same way
 * scripts/seed.ts hashes every seeded user's password (src/auth/password.ts's
 * hashPassword). */
export const PERF_SPEAKER_PASSWORD = "PerfSpeaker!2027";

/** Extra visible-speaker `participant` rows attached to the perf speaker's
 * contact, one per accepted submission in the bounded subset below — keeps
 * /portal's session/submission reads non-empty at perf scale without
 * growing a profile's own acceptedCount or touching every accepted
 * submission's existing primary-speaker participant row. */
export const PERF_SPEAKER_SUBMISSION_COUNT = 5;

/** Deterministic id for the perf speaker's i-th (1-based) extra participant row. */
export function perfSpeakerParticipantId(i: number): string {
  if (!Number.isInteger(i) || i < 1) {
    throw new Error(`perfSpeakerParticipantId: i must be a positive integer, got ${i}`);
  }
  return `seed_perf_speaker_participant_${String(i).padStart(4, "0")}`;
}

/**
 * Deterministic, bounded 0-based indexes (into a profile's own
 * acceptedSubmissionIds array, in ASCENDING seed order — index 0 is the
 * lowest-seq accepted submission) of the accepted submissions the perf
 * speaker is attached to as an extra participant: the `count` (default
 * PERF_SPEAKER_SUBMISSION_COUNT) HIGHEST-seq accepted submissions, capped
 * at `acceptedCount` so this never overruns a profile seeded with fewer
 * accepted submissions than requested.
 *
 * wave-39 correction: GET /api/v1/events/:id/submissions?status=accepted's
 * default (and only, per perf-smoke.ts) sort is "newest"
 * (src/server/repo/submissions/list.ts's orderByForSort: createdAt desc,
 * seq desc) — page 1 returns the HIGHEST-seq accepted submissions first,
 * not the lowest. This function's returned array is therefore ordered
 * acceptedCount-1, acceptedCount-2, ... so index 0 of the RETURNED array
 * is always the highest-seq accepted submission — the same id
 * fetchAcceptedSubmissionIds/icsIds[0] resolves first in perf-smoke.ts —
 * so the perf speaker can always view it via GET /portal/submissions/:id
 * with no separate id resolution.
 */
export function perfSpeakerAcceptedIndexes(
  acceptedCount: number,
  count: number = PERF_SPEAKER_SUBMISSION_COUNT,
): number[] {
  if (!Number.isInteger(acceptedCount) || acceptedCount < 0) {
    throw new Error(`perfSpeakerAcceptedIndexes: acceptedCount must be a non-negative integer, got ${acceptedCount}`);
  }
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`perfSpeakerAcceptedIndexes: count must be a non-negative integer, got ${count}`);
  }
  const bounded = Math.min(count, acceptedCount);
  return Array.from({ length: bounded }, (_, i) => acceptedCount - 1 - i);
}

/**
 * task_assignment rows for the perf speaker's contact: one per existing
 * PERF_TASK_COUNT onboarding task template (the same 5 tasks every profile
 * already seeds via PERF_TASKS above — this reuses those task ids, it does
 * not mint new ones), so GET /portal/tasks has a real, bounded, deterministic
 * worklist for the perf speaker regardless of profile scale.
 */
export function perfSpeakerTaskAssignmentId(taskIndex: number): string {
  if (!Number.isInteger(taskIndex) || taskIndex < 0) {
    throw new Error(`perfSpeakerTaskAssignmentId: taskIndex must be a non-negative integer, got ${taskIndex}`);
  }
  return `seed_perf_speaker_task_assignment_${String(taskIndex + 1).padStart(4, "0")}`;
}

/** Deterministic pending/complete status for the perf speaker's taskIndex-th
 * (0-based) task assignment — reuses isTaskAssignmentComplete's existing
 * mod-3 split at a fixed synthetic contactIndex (0) so the perf speaker's
 * own worklist mixes pending/complete the same way every other seeded
 * onboarding assignment does, rather than landing every row in one bucket. */
export function isPerfSpeakerTaskAssignmentComplete(taskIndex: number): boolean {
  return isTaskAssignmentComplete(taskIndex, 0);
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
