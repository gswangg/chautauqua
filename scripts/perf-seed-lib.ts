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
export const PERF_EVALUATION_COUNT = 600;

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
