// Pure helpers for scripts/walkthrough.ts, extracted for plain-vitest
// testing (dependency-free, no node:child_process/filesystem access — same
// pattern as scripts/perf-smoke-lib.ts / scripts/bundle-check-lib.ts).
// DEC-062.

/**
 * Fixed sequential order of the DEC-060 walkthrough modules. producer must
 * run first (it seeds the event other personas depend on), then review,
 * speaker, public, data, scale — in that order. The orchestrator
 * (DEC-062) is the sole place this order is defined; module files must not
 * reorder themselves. "scale" (DEC-089) runs last: it exercises >100-id
 * volume paths (bulk accept, chunking, purge refresh) against the same
 * seeded event the earlier areas already populated.
 */
export const WALKTHROUGH_AREAS = ["producer", "review", "speaker", "public", "data", "scale"] as const;

export type WalkthroughArea = (typeof WALKTHROUGH_AREAS)[number];

/** scripts/walkthrough/<area>.ts, relative to the repo root. */
export function modulePath(area: WalkthroughArea): string {
  return `scripts/walkthrough/${area}.ts`;
}

/**
 * Build the argv for `npx tsx scripts/walkthrough/<area>.ts --url <url>`,
 * as an array suitable for node:child_process spawn (no shell quoting
 * concerns).
 */
export function buildSpawnArgs(area: WalkthroughArea, url: string): string[] {
  return ["tsx", modulePath(area), "--url", url];
}

/** Parse `--url <value>` out of argv (process.argv.slice(2)); falls back
 * to defaultUrl if absent. Throws if `--url` is given with no value. */
export function parseUrlArg(argv: readonly string[], defaultUrl: string): string {
  const idx = argv.indexOf("--url");
  if (idx === -1) return defaultUrl;
  const value = argv[idx + 1];
  if (value === undefined) {
    throw new Error("walkthrough: --url flag given with no value");
  }
  return value;
}

export function formatAreaPass(area: WalkthroughArea): string {
  return `PASS ${area}`;
}

export function formatFailureMessage(area: WalkthroughArea): string {
  return `WALKTHROUGH FAILED at ${area}`;
}

export function formatMissingModulesMessage(missing: readonly string[]): string {
  return `walkthrough: missing module file(s): ${missing.join(", ")}`;
}

/** A single area's outcome from an orchestrator run (DEC-407): every area
 * runs regardless of an earlier failure, so the summary can report all
 * five/six personas rather than aborting at the first non-zero exit. */
export interface WalkthroughAreaResult {
  area: string;
  status: "PASS" | "FAIL";
}

/**
 * Render a per-area summary table for the end of a walkthrough run. One
 * line per result, in the order given, `PASS`/`FAIL` right after the area
 * name.
 */
export function formatSummaryTable(results: readonly WalkthroughAreaResult[]): string {
  return results.map((r) => `  ${r.status} ${r.area}`).join("\n");
}

// ---------------------------------------------------------------------------
// Task w2-e: findings-closure reusable steps (additive, dependency-free pure
// helpers per the same pattern as above — request/body construction and
// response-shape validators, callable from a driver script or a future
// scripts/walkthrough/*.ts module without pulling in node:/fetch here).
// ---------------------------------------------------------------------------

/** B1: POST /api/v1/plans/:id/reviewers body — assigns a reviewer either by
 * track or by a single submission (mutually exclusive per the API). */
export function buildReviewerAssignmentBody(
  userId: string,
  scope: { trackId: string } | { submissionId: string },
): Record<string, string> {
  return "trackId" in scope
    ? { userId, trackId: scope.trackId }
    : { userId, submissionId: scope.submissionId };
}

/** B1: does a GET /api/v1/users?role=reviewer item carry an `id` usable as
 * the userId in buildReviewerAssignmentBody? */
export function userListItemHasId(item: unknown): item is { id: string } {
  return (
    typeof item === "object" &&
    item !== null &&
    "id" in item &&
    typeof (item as { id: unknown }).id === "string" &&
    (item as { id: string }).id.length > 0
  );
}

/** B2 (DEC-239): does a GET /api/v1/review/plans/:id/queue item expose
 * `submissionId` (the SPA-contract key), as opposed to a raw `id`? */
export function queueItemHasSubmissionId(item: unknown): item is { submissionId: string } {
  return (
    typeof item === "object" &&
    item !== null &&
    "submissionId" in item &&
    typeof (item as { submissionId: unknown }).submissionId === "string" &&
    (item as { submissionId: string }).submissionId.length > 0
  );
}

/** B3: POST /api/v1/contacts/merge body. */
// DEC-629: POST /contacts/merge is set-based -- {keepId, mergeIds}.
export function buildContactsMergeBody(keepId: string, mergeId: string): { keepId: string; mergeIds: string[] } {
  return { keepId, mergeIds: [mergeId] };
}

/** B3: is the (idA, idB) pair still reported as a duplicate group by GET
 * /api/v1/contacts/duplicates after a merge? Order-independent. */
export function duplicatePairStillOpen(
  duplicateGroups: readonly { contactIds: readonly string[] }[],
  idA: string,
  idB: string,
): boolean {
  return duplicateGroups.some((g) => g.contactIds.includes(idA) && g.contactIds.includes(idB));
}

/** CNT-07: does GET /api/v1/events/:id/files include a deliverable chain
 * whose latest file id matches the just-uploaded file, for the given
 * submission? */
export function eventFilesContainsUpload(
  files: readonly { submissionId: string; latestFileId: string }[],
  submissionId: string,
  uploadedFileId: string,
): boolean {
  return files.some((f) => f.submissionId === submissionId && f.latestFileId === uploadedFileId);
}

/** CFP-06 / DEC-243: resolve a submission's trackIds to display names via
 * the event's track list, mirroring app/src/pages/submissions/
 * SubmissionsTable.tsx's trackNames() for the purpose of an independent
 * server-side check (no shared import — app/ is a separate build target). */
export function resolveTrackNames(trackIds: readonly string[], tracks: readonly { id: string; name: string }[]): string[] {
  const byId = new Map(tracks.map((t) => [t.id, t.name] as const));
  return trackIds.map((id) => byId.get(id) ?? id);
}

/** CFP-06 / DEC-243: does this form's field list contain a dropdown field
 * whose label is exactly (case-insensitively) "Format"? Independent
 * reimplementation of app/src/pages/submissions/columns.ts's
 * findFormatField, for a server-side/API-only check (no app/ import from
 * scripts/, separate build target). */
export function hasExactFormatDropdownField(
  fields: readonly { kind: string; label: string }[],
): boolean {
  return fields.some((f) => f.kind === "dropdown" && f.label.trim().toLowerCase() === "format");
}

/**
 * w25-a: resolve the seeded event from a GET /api/v1/events `items` array
 * by slug, not by list position — `desc(startDate), asc(id)` ordering means
 * items[0] is whichever event has the latest startDate, which is NOT
 * necessarily the seeded fixture event (e.g. a throwaway event created by
 * an earlier-running walkthrough module can sort first). Throws loudly,
 * naming both the slug sought and the slugs actually present, so a probe
 * of the wrong (empty) event fails at the point of misresolution rather
 * than downstream as a mysterious "no data rows" failure.
 */
export function findEventBySlug<T extends { slug: string }>(items: T[], slug: string): T {
  const found = items.find((item) => item.slug === slug);
  if (!found) {
    const seen = items.map((item) => item.slug).join(", ") || "(none)";
    throw new Error(`findEventBySlug: no event with slug '${slug}' found; saw slugs: ${seen}`);
  }
  return found;
}

/** ABS-10 / DEC-241: a results row's dropdown criterion id must appear only
 * under perDropdown, never as a key in perCriterion (which feeds the
 * rating-only `average`). */
export function dropdownCriterionExcludedFromAverage(
  row: { perCriterion: Record<string, unknown>; perDropdown: Record<string, unknown> },
  dropdownCriterionId: string,
): boolean {
  return dropdownCriterionId in row.perDropdown && !(dropdownCriterionId in row.perCriterion);
}

// ---------------------------------------------------------------------------
// w66-d: J9 break-lifecycle (DEC-063 amendment) — request/body builders and
// response-shape validators for POST/GET/DELETE .../breaks and the
// anonymous public agenda fetch, kept dependency-free per DEC-062.
// ---------------------------------------------------------------------------

export interface CreateBreakRequestBody {
  day: string;
  label: string;
  startMin: number;
  durationMin: number;
}

/** POST /api/v1/events/:eventId/breaks body (src/routes/api/breaks.ts). */
export function buildCreateBreakBody(
  day: string,
  label: string,
  startMin = 0,
  durationMin = 15,
): CreateBreakRequestBody {
  return { day, label, startMin, durationMin };
}

/** Does a GET /api/v1/events/:eventId/breaks?day=... envelope's `items`
 * contain a break with this id? Mirrors the DEC-461(a) list envelope shape
 * (items/total/page/perPage) already used elsewhere in this file. */
export function breaksListContainsId(items: readonly { id: string }[], breakId: string): boolean {
  return items.some((b) => b.id === breakId);
}

// ---------------------------------------------------------------------------
// w37-d: PUBLIC_BASE_URL / --url origin pre-flight (DEC-296, DEC-069).
//
// src/server/origin.ts's resolveBaseUrl (:104-133) only applies DEC-296's
// dev-loopback exception when a loopback origin is observable ON THE
// REQUEST (firstLoopbackCandidate, :152-163) — request URL origin, `Origin`
// header, or `Referer`. A scripted fetch against `wrangler dev` with
// wrangler.jsonc route shadowing presents none of the three, so a
// gitignored `.dev.vars` PUBLIC_BASE_URL default (commonly the
// .dev.vars.example loopback default, http://localhost:8787) wins outright
// while the gate drives a per-worktree port via --url. This has cost two
// walkthrough gates a full run each (see
// docs/verification-log/index/0163-...-walkthrough-73f380f2.md and
// 0190-...-task-w36-b-walkthrough-f5783479.md, both aborting at
// producer/J2 on an off-origin scraped reset link). These helpers catch
// the mismatch in five seconds instead of forty steps in; the underlying
// origin.ts gap is NOT fixed here (frozen wave, scripts/**+test/**+docs/**
// only) — filed as an open item for wave-38.
//
// Kept dependency-free (no node: imports) per this file's header
// convention; scripts/walkthrough.ts does the actual node:fs reads and
// passes the resulting text/value in here.
// ---------------------------------------------------------------------------

/** Same loopback-hostname set as src/server/origin.ts's LOOPBACK_HOSTNAMES
 * (deliberately re-declared, not imported — that module is not node:-free
 * and this file must stay pure/dependency-free for plain-vitest testing). */
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function isLoopbackOriginString(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return LOOPBACK_HOSTNAMES.has(url.hostname);
}

/**
 * Parses ONLY the `PUBLIC_BASE_URL=` line out of a `.dev.vars`-format text
 * blob (KEY=VALUE per line, `#`-prefixed comment lines ignored). Returns
 * null if the key is absent. Must never return or log any other key's
 * value: scripts/ensure-dev-vars.ts forbids reading/logging `.dev.vars`
 * contents generally; DEC-296's wave-37 amendment sanctions exactly this
 * one key for exactly this pre-flight purpose.
 */
export function extractPublicBaseUrl(devVarsText: string): string | null {
  for (const rawLine of devVarsText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const match = line.match(/^PUBLIC_BASE_URL=(.*)$/);
    if (match && match[1] !== undefined) {
      const value = match[1].trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

/**
 * Compares a configured PUBLIC_BASE_URL against the walkthrough's --url
 * target and reports a DEC-296 dev-loopback mismatch, or null if there is
 * none. Per resolveBaseUrl's precedence (src/server/origin.ts:104-118), a
 * configured NON-loopback PUBLIC_BASE_URL always wins outright regardless
 * of the request — that is correct/intended behavior, not a mismatch, so
 * this only flags the case that actually poisons a dev-mode run: a
 * loopback-configured value whose origin differs from --url's origin.
 * Returns null (not a mismatch) if `configured` is null, not a parseable
 * absolute URL, non-loopback, or already matches `targetUrl`'s origin.
 */
export function baseUrlMismatch(
  configured: string | null,
  targetUrl: string,
): { configuredOrigin: string; targetOrigin: string } | null {
  if (configured === null) return null;

  let configuredOrigin: string;
  try {
    configuredOrigin = new URL(configured).origin;
  } catch {
    return null;
  }

  if (!isLoopbackOriginString(configuredOrigin)) return null;

  let targetOrigin: string;
  try {
    targetOrigin = new URL(targetUrl).origin;
  } catch {
    return null;
  }

  if (configuredOrigin === targetOrigin) return null;

  return { configuredOrigin, targetOrigin };
}

/**
 * Renders the pre-flight failure message: names both origins and the
 * exact remediation (set PUBLIC_BASE_URL, wipe .wrangler/state, re-migrate
 * + re-seed, restart the server) — the same fix already applied by hand at
 * docs/verification-log/index/0163-... and 0190-...-task-w36-b-....
 */
export function formatBaseUrlMismatchMessage(m: { configuredOrigin: string; targetOrigin: string }): string {
  return [
    `walkthrough pre-flight: PUBLIC_BASE_URL mismatch (DEC-296).`,
    `  configured origin (.dev.vars / wrangler.jsonc): ${m.configuredOrigin}`,
    `  --url target origin:                            ${m.targetOrigin}`,
    `resolveBaseUrl's dev-loopback exception (src/server/origin.ts:104-133) only`,
    `fires when a loopback origin is observable on the request; a scripted fetch`,
    `against route-shadowed wrangler dev has none, so the configured origin above`,
    `wins outright and every mailed link (e.g. /claim/<token>) will point at`,
    `${m.configuredOrigin} instead of ${m.targetOrigin} — producer/J2 will scrape an`,
    `off-origin link and abort.`,
    `Fix: set PUBLIC_BASE_URL=${m.targetOrigin} in .dev.vars, wipe .wrangler/state,`,
    `re-migrate + re-seed, and restart the server, then re-run the walkthrough.`,
  ].join("\n");
}

/** Does the anonymous /e/:slug/agenda?day=... HTML contain this break's
 * rendered label text? Assert on the label text only — never on a CSS
 * class, element order, or DOM structure (a concurrently-landing markup
 * rewrite must not break this check). */
export function agendaHtmlContainsBreakLabel(html: string, label: string): boolean {
  return html.includes(label);
}

// ---------------------------------------------------------------------------
// w68-d: J10 printable programme + anonymous event hub (DEC-063 amendment,
// wave 68) — pure markup helper, kept dependency-free per DEC-062.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// w52-a: DEC-522 amendment — day-label-safe offset clock for walkthrough
// openDate/closeDate PATCHes.
// ---------------------------------------------------------------------------

/**
 * A day-label column (openDate/closeDate) is expanded event-local by
 * dayLabelStartInstant/dayLabelEndInstant (DEC-522). IANA timezone offsets
 * from UTC range from -12h to +14h, so any sub-day offset from `Date.now()`
 * (e.g. "-60s" or "+1h") can still resolve to TODAY's UTC calendar date for
 * part of every UTC day, making the label a no-op — flooring to UTC midnight
 * and stepping by WHOLE days is the only offset that is unambiguous across
 * that entire offset range. Always use this helper (never a raw
 * `Date.now() +/- ms` expression) to build an openDate/closeDate value.
 */
export function dayLabelMs(offsetDays: number): number {
  return Math.floor(Date.now() / 86_400_000) * 86_400_000 + offsetDays * 86_400_000;
}

/** Extracts every `id="chq-prog-day-<day>"` section id out of the printable
 * programme's HTML (src/routes/public/programme.tsx ProgrammeDay), in
 * document order, duplicates included — callers that only care about
 * distinctness should wrap the result in a Set. Matches on the id attribute
 * text only, never on surrounding markup, so a concurrently-landing style
 * rewrite of the programme surface can't break this check. */
export function extractProgrammeDayIds(html: string): string[] {
  const out: string[] = [];
  const re = /id="(chq-prog-day-[^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push(m[1]!);
  }
  return out;
}
