// Executable gate for docs/mandates/scale-mandate.md's "Functional bars"
// section (task w9-g / DEC-654). Pure evaluators only — no fetch, no
// node: imports, so this module is trivially unit-testable
// (test/stress-bars.test.ts) and importable from both the walkthrough
// runner (scripts/walkthrough/stress.ts) and tests without booting a
// server. Each evaluator takes an already-gathered observation object
// (the caller is responsible for producing it via real HTTP calls against
// a running `--profile=aie` seeded server) and returns
// `{ ok, detail }`, with `detail` always naming the observed numbers so a
// failure is diagnosable from the printed line alone.
//
// Constants are IMPORTED from their binding source rather than
// hand-copied (field guide: "hand-copied vocabularies drift -- IMPORT
// them"), even though this list crosses into app/ and src/ — both of
// those modules are themselves dependency-free/pure, so importing them
// does not violate this file's own purity.

import { BULK_STATUS_CHUNK_SIZE } from "../app/src/pages/submissions/bulk";
import { MAX_REMINDER_BATCH } from "../src/domain/reminders";

export interface BarResult {
  ok: boolean;
  detail: string;
}

// ---------------------------------------------------------------------------
// bulkStatus500
// ---------------------------------------------------------------------------

// GAP NOTE (flagged per worker instructions, not decided here): the scale
// mandate's prose says bulk status is "chunked at 100", but the binding
// decision (DEC-193, app/src/pages/submissions/bulk.ts) chunks client-side
// requests at BULK_STATUS_CHUNK_SIZE=500, not 100. DEC-193 is the binding
// decisions/ doc; this evaluator uses the imported constant rather than the
// mandate doc's literal, per "decisions in decisions/ are binding".
export interface BulkStatus500Observation {
  /** Number of submission ids selected for the bulk status change. */
  selected: number;
  /** `updated` reported back after all chunked requests completed. */
  updated: number;
  /** Number of sequential chunked POST requests issued. */
  requestCount: number;
  /** True if any already-committed chunk was later reported as undone
   * (DEC-193: "no client rollback lie" — committed batches stay committed
   * even if a later batch fails). */
  rolledBack: boolean;
}

export function bulkStatus500(obs: BulkStatus500Observation): BarResult {
  const expectedRequestCount = Math.ceil(obs.selected / BULK_STATUS_CHUNK_SIZE);
  const ok = obs.updated === obs.selected && obs.requestCount === expectedRequestCount && !obs.rolledBack;
  return {
    ok,
    detail: `selected=${obs.selected} updated=${obs.updated} requestCount=${obs.requestCount} (expected ${expectedRequestCount} at chunk size ${BULK_STATUS_CHUNK_SIZE}) rolledBack=${obs.rolledBack}`,
  };
}

// ---------------------------------------------------------------------------
// autoSchedule320
// ---------------------------------------------------------------------------

export interface AutoSchedule320Observation {
  /** POST /agenda/auto-schedule response's summary.unplaced (counts ALL
   * unplaced accepted sessions — src/server/repo/agenda.ts). */
  unplacedTotal: number;
  /** POST /agenda/auto-schedule response's unplacedReasons[].detail
   * strings (src/domain/schedule.ts describeUnplaced, via
   * src/server/repo/agenda.ts's DescribedUnplaced). */
  reasons: string[];
}

export function autoSchedule320(obs: AutoSchedule320Observation): BarResult {
  const countMatches = obs.reasons.length === obs.unplacedTotal;
  const noneEmpty = obs.reasons.every((r) => r.trim().length > 0);
  const ok = countMatches && noneEmpty;
  return {
    ok,
    detail: `unplacedTotal=${obs.unplacedTotal} reasons.length=${obs.reasons.length} emptyReasons=${obs.reasons.filter((r) => r.trim().length === 0).length}`,
  };
}

// ---------------------------------------------------------------------------
// remindersHonesty
// ---------------------------------------------------------------------------

export interface RemindersHonestyObservation {
  /** Distinct contacts with an outstanding (non-complete) task assignment
   * at request time, independently counted by the caller (not taken from
   * the response under test). */
  due: number;
  /** POST /onboarding/remind response fields (src/server/repo/tasks/reminders.ts remindNow). */
  sent: number;
  skipped: number;
  remaining: number;
}

export function remindersHonesty(obs: RemindersHonestyObservation): BarResult {
  const accounted = obs.sent + obs.skipped + obs.remaining;
  const ok = accounted === obs.due && obs.sent <= MAX_REMINDER_BATCH;
  return {
    ok,
    detail: `due=${obs.due} sent=${obs.sent} skipped=${obs.skipped} remaining=${obs.remaining} accounted=${accounted} MAX_REMINDER_BATCH=${MAX_REMINDER_BATCH}`,
  };
}

// ---------------------------------------------------------------------------
// overviewRowCap
// ---------------------------------------------------------------------------

// Mirrors src/server/repo/overview.ts's private ROW_CAP=5 (not exported;
// this task's OWN list does not include overview.ts, so the value is
// asserted here per the task's literal "each Overview list length <= 5"
// rather than imported).
export const OVERVIEW_ROW_CAP = 5;

export interface OverviewSectionObservation {
  /** Section name, e.g. "overdueTasks", "triage", "contentApproval",
   * "agendaWork.conflicts", "agendaWork.unplaced". */
  name: string;
  rowsLength: number;
  total: number;
}

export type OverviewRowCapObservation = OverviewSectionObservation[];

export function overviewRowCap(obs: OverviewRowCapObservation): BarResult {
  // Only sections whose reported total exceeds the cap are meaningful
  // probes of the cap (a section with total <= cap is allowed to render
  // every row) — the mandate's bar is specifically "capped while over".
  const overCapSections = obs.filter((s) => s.total > OVERVIEW_ROW_CAP);
  const violations = overCapSections.filter((s) => s.rowsLength > OVERVIEW_ROW_CAP);
  const ok = overCapSections.length > 0 && violations.length === 0;
  return {
    ok,
    detail:
      `sections=${obs.length} overCapSections=${overCapSections.map((s) => `${s.name}(total=${s.total},rows=${s.rowsLength})`).join(",")} ` +
      `violations=${violations.map((s) => s.name).join(",") || "none"}`,
  };
}

// ---------------------------------------------------------------------------
// duplicatesLatency
// ---------------------------------------------------------------------------

// Scale mandate: "contacts/duplicates grouping stays sub-second at 6,000
// contacts (it is O(n) hashing -- verify, don't assume)."
export const DUPLICATES_LATENCY_CEILING_MS = 1000;

export interface DuplicatesLatencyObservation {
  /** Wall-clock ms for one GET /api/v1/contacts/duplicates round trip. */
  ms: number;
}

export function duplicatesLatency(obs: DuplicatesLatencyObservation): BarResult {
  const ok = obs.ms < DUPLICATES_LATENCY_CEILING_MS;
  return {
    ok,
    detail: `ms=${obs.ms} ceilingMs=${DUPLICATES_LATENCY_CEILING_MS}`,
  };
}

// ---------------------------------------------------------------------------
// Bar registry — enumerated, not hand-counted at call sites (field guide:
// "hand-listed manifests desync -- enumerate in a test").
// ---------------------------------------------------------------------------

export const STRESS_BAR_IDS = [
  "bulkStatus500",
  "autoSchedule320",
  "remindersHonesty",
  "overviewRowCap",
  "duplicatesLatency",
] as const;

export type StressBarId = (typeof STRESS_BAR_IDS)[number];

export interface StressObservations {
  bulkStatus500: BulkStatus500Observation;
  autoSchedule320: AutoSchedule320Observation;
  remindersHonesty: RemindersHonestyObservation;
  overviewRowCap: OverviewRowCapObservation;
  duplicatesLatency: DuplicatesLatencyObservation;
}

export const STRESS_BAR_EVALUATORS: { [K in StressBarId]: (obs: StressObservations[K]) => BarResult } = {
  bulkStatus500,
  autoSchedule320,
  remindersHonesty,
  overviewRowCap,
  duplicatesLatency,
};
