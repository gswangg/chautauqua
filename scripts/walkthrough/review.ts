// Reviewer/committee persona walkthrough (SPEC §9, job J4), task w8-d.
// Standalone runnable per DEC-060: `npx tsx scripts/walkthrough/review.ts
// --url http://localhost:8787` against a migrated + seeded dev server.
// Conventions match DEC-053: GET /login captures the chq_csrf cookie,
// POST /login is form-encoded carrying that cookie value, JSON mutations
// send 'x-chq-csrf: 1'; every persona gets its own cookie jar; the first
// failing check prints status+body and exits non-zero (fail loudly, no
// soft warnings).
//
// Walks, in order:
//   1. Organizer creates an evaluation plan on the seeded devflow-conf-2027
//      event: instructions, open/close dates, a two-track filter,
//      anonymization ON, a rating scale, two weighted rating criteria plus
//      a dropdown criterion, and a max-evaluations cap. Assigns the
//      reviewer persona by track (track A) and one extra per-submission
//      assignment (a submission in track B) via /api/v1/users +
//      plan_reviewer rows (DEC-043/044).
//   2. As the reviewer: the queue is exactly {track A submissions} ∪
//      {the one extra submission}; ordering is fewest-ratings-first
//      (cross-checked against the organizer's results counts); the
//      anonymized submission detail's raw JSON has no speaker-identifying
//      fields; a scorecard mixing numeric rating + dropdown + free text is
//      submitted; the max-evaluations cap rejects a second reviewer's
//      overflow evaluation once reached.
//   3. Authz: a reviewer hitting organizer-only plan settings/results ->
//      403; a second-org organizer (a throwaway org seeded directly via
//      `wrangler d1 execute --local`, since stage 1 has no signup route)
//      fetching this plan's queue/results -> 404 (DEC-039 regression).
//   4. As organizer: progress reflects per-reviewer completion counts;
//      POST /remind emails only the laggard reviewer and writes email_log
//      rows; results are sorted by weighted aggregate score descending;
//      the results CSV downloads with a matching row count.
//
// Scripts/ tooling (not src/ pure-core, DEC-002 scopes that rule to
// src/{auth,domain,forms,mail,lib}), so node: imports and direct D1 access
// via wrangler are both fine here, same as scripts/seed.ts / seed-r2.ts.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { hashPassword } from "../../src/auth/password";
import { dayLabelMs } from "../walkthrough-lib";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..");
const FIXTURE_PATH = join(REPO_ROOT, "docs", "fixtures", "sample-data.json");

const argUrl = process.argv.find((a) => a.startsWith("--url="))?.slice("--url=".length);
const urlFlagIdx = process.argv.indexOf("--url");
const BASE_URL =
  argUrl ?? (urlFlagIdx !== -1 ? process.argv[urlFlagIdx + 1] : undefined) ?? "http://localhost:8787";

const EVENT_SLUG = "devflow-conf-2027";

// Throwaway second-org fixtures for the DEC-039 cross-org IDOR check
// (stage 1 has no signup route, so a second org can only exist via direct
// D1 access — same convention as scripts/seed.ts / perf-seed.ts, scoped to
// fixed 'wk_review_org2_*' ids so re-runs are idempotent and this never
// touches the demo seed's rows).
const ORG2_ID = "wk_review_org2";
const ORG2_USER_ID = "wk_review_org2_user";
const ORG2_EMAIL = "wk-review-org2-organizer@example.test";
const ORG2_PASSWORD = "Wk-Review-Org2-Pass!1";

interface FixtureData {
  identities: {
    organizer: { email: string; password: string };
    reviewer: { email: string; password: string };
  };
}

// ---------------------------------------------------------------------------
// Fail-loudly harness
// ---------------------------------------------------------------------------

function fail(name: string, detail: string): never {
  console.error(`FAIL: ${name}`);
  console.error(detail);
  process.exit(1);
}

function assertCheck(name: string, condition: boolean, detail: string): void {
  if (!condition) fail(name, detail);
  console.log(`ok: ${name}`);
}

// ---------------------------------------------------------------------------
// Cookie-jar HTTP helpers (per DEC-053)
// ---------------------------------------------------------------------------

interface Cookies {
  chq_csrf?: string;
  chq_session?: string;
}

function parseSetCookies(res: Response, cookies: Cookies): void {
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const raw of setCookies) {
    const [pair] = raw.split(";");
    if (!pair) continue;
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const name = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (name === "chq_csrf") cookies.chq_csrf = value;
    if (name === "chq_session") cookies.chq_session = value;
  }
}

function cookieHeader(cookies: Cookies): string {
  return Object.entries(cookies)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

class Persona {
  cookies: Cookies = {};
  constructor(public readonly label: string) {}

  async login(email: string, password: string): Promise<void> {
    const getRes = await fetch(`${BASE_URL}/login`);
    if (!getRes.ok) fail(`${this.label} GET /login`, `status ${getRes.status}`);
    parseSetCookies(getRes, this.cookies);
    if (!this.cookies.chq_csrf) fail(`${this.label} GET /login`, "no chq_csrf cookie set");

    const body = new URLSearchParams({ email, password, chq_csrf: this.cookies.chq_csrf });
    const postRes = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: cookieHeader(this.cookies),
      },
      body: body.toString(),
      redirect: "manual",
    });
    if (postRes.status !== 302) fail(`${this.label} POST /login`, `expected 302, got ${postRes.status}`);
    parseSetCookies(postRes, this.cookies);
    if (!this.cookies.chq_session) fail(`${this.label} POST /login`, "no chq_session cookie set");
  }

  /** Raw fetch with this persona's cookie jar carried along. JSON mutations
   * (method !== GET) get 'x-chq-csrf: 1' per DEC-053's JSON-mutation
   * contract. */
  async request(path: string, init: RequestInit = {}): Promise<{ status: number; text: string; json: unknown }> {
    const method = (init.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = {
      cookie: cookieHeader(this.cookies),
      ...(init.headers as Record<string, string> | undefined),
    };
    if (method !== "GET") headers["x-chq-csrf"] = "1";
    const res = await fetch(`${BASE_URL}${path}`, { ...init, method, headers });
    const text = await res.text();
    let json: unknown;
    try {
      json = text.length > 0 ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    return { status: res.status, text, json };
  }

  async json<T>(name: string, path: string, init: RequestInit, expected: number[]): Promise<T> {
    const res = await this.request(path, init);
    if (!expected.includes(res.status)) {
      fail(name, `expected status ${expected.join(" or ")}, got ${res.status}: ${res.text}`);
    }
    return res.json as T;
  }
}

async function waitForHealth(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${BASE_URL}/health did not become ready within ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// Throwaway second-org seed (direct D1 access, DEC-039 IDOR check)
// ---------------------------------------------------------------------------

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

async function ensureSecondOrg(): Promise<void> {
  const passwordHash = await hashPassword(ORG2_PASSWORD);
  const now = Date.now();
  const statements = [
    `DELETE FROM user WHERE id = '${ORG2_USER_ID}';`,
    `DELETE FROM org WHERE id = '${ORG2_ID}';`,
    `INSERT INTO org (id, name, created_at, updated_at) VALUES ('${ORG2_ID}', 'Walkthrough Second Org', ${now}, ${now});`,
    `INSERT INTO user (id, org_id, email, password_hash, role, contact_id, created_at, updated_at) VALUES ('${ORG2_USER_ID}', '${ORG2_ID}', '${sqlEscape(ORG2_EMAIL)}', '${sqlEscape(passwordHash)}', 'organizer', NULL, ${now}, ${now});`,
  ];
  execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "chautauqua", "--local", "--command", statements.join(" ")],
    { cwd: REPO_ROOT, stdio: "pipe" },
  );
}

// ---------------------------------------------------------------------------
// Domain shapes (subset of the API's JSON, for typed access in this script)
// ---------------------------------------------------------------------------

interface EventRecord {
  id: string;
  slug: string;
}

interface TrackRecord {
  id: string;
  name: string;
}

interface SubmissionListItem {
  id: string;
  trackIds: string[];
}

interface PlanRecord {
  id: string;
  eventId: string;
}

interface ReviewerRow {
  id: string;
  userId: string;
  email: string;
  trackId: string | null;
  submissionId: string | null;
}

interface QueueItem {
  submissionId: string;
  ref: string;
  title: string;
  ratingsCount: number;
  alreadyRatedByMe: boolean;
}

interface ResultsRow {
  submissionId: string;
  count: number;
  average: number;
}

interface CreatedUser {
  id: string;
  email: string;
  role: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await waitForHealth();
  await ensureSecondOrg();

  const fixture: FixtureData = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));

  const organizer = new Persona("organizer");
  await organizer.login(fixture.identities.organizer.email, fixture.identities.organizer.password);

  const reviewer = new Persona("reviewer");
  await reviewer.login(fixture.identities.reviewer.email, fixture.identities.reviewer.password);

  const org2Organizer = new Persona("org2-organizer");
  await org2Organizer.login(ORG2_EMAIL, ORG2_PASSWORD);

  // -- Locate the seeded event + at least two tracks -----------------------

  const events = await organizer.json<{ items: EventRecord[] }>("locate devflow-conf-2027 event", "/api/v1/events", {}, [200]);
  const event = events.items.find((e) => e.slug === EVENT_SLUG);
  if (!event) fail("locate devflow-conf-2027 event", `no event with slug ${EVENT_SLUG} in ${JSON.stringify(events.items)}`);

  const tracks = await organizer.json<{ items: TrackRecord[] }>(
    "list event tracks",
    `/api/v1/events/${event.id}/tracks`,
    {},
    [200],
  );
  if (tracks.items.length < 2) fail("list event tracks", `expected >=2 tracks, got ${tracks.items.length}`);
  const trackA = tracks.items[0]!;
  const trackB = tracks.items[1]!;

  const trackASubs = await organizer.json<{ items: SubmissionListItem[] }>(
    "list track A submissions",
    `/api/v1/events/${event.id}/submissions?trackId=${trackA.id}&perPage=100`,
    {},
    [200],
  );
  if (trackASubs.items.length < 2) fail("list track A submissions", `expected >=2 submissions in track A, got ${trackASubs.items.length}`);

  const trackBSubs = await organizer.json<{ items: SubmissionListItem[] }>(
    "list track B submissions",
    `/api/v1/events/${event.id}/submissions?trackId=${trackB.id}&perPage=100`,
    {},
    [200],
  );
  const extraSubmission = trackBSubs.items.find((s) => !s.trackIds.includes(trackA.id));
  if (!extraSubmission) fail("list track B submissions", "expected a track B submission not also in track A");

  // DEC-175: an out-of-scope submission for the track-scoped reviewer built
  // below — not in track A (the reviewer's assigned track) and not the one
  // per-submission extra assignment (extraSubmission) either. Any other
  // track B (or trackless) submission qualifies.
  const outOfScopeSubmission = trackBSubs.items.find(
    (s) => !s.trackIds.includes(trackA.id) && s.id !== extraSubmission.id,
  );
  if (!outOfScopeSubmission) {
    fail(
      "list track B submissions for DEC-175 out-of-scope probe",
      "expected a second track-B-only submission distinct from extraSubmission",
    );
  }

  // -- (1) Organizer creates the evaluation plan ----------------------------

  // DEC-509/DEC-522: a plan's openDate/closeDate are DAY LABELS, and
  // src/routes/review/shared.ts rejects anything that is not an exact
  // ms-epoch multiple of 86_400_000. A raw `Date.now() +/- ms` offset is
  // never one, so it must go through dayLabelMs (same idiom as
  // producer.ts/speaker.ts since wave 52).
  const plan = await organizer.json<PlanRecord>(
    "create evaluation plan",
    `/api/v1/events/${event.id}/plans`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Walkthrough Committee Review",
        instructions: "Score each proposal on quality, delivery, and length fit. Be specific in free-text notes.",
        openDate: dayLabelMs(-1),
        closeDate: dayLabelMs(30),
        filters: { trackIds: [trackA.id, trackB.id] },
        anonymized: true,
        scale: { min: 1, max: 5 },
        criteria: [
          { id: "content_quality", label: "Content quality", kind: "rating", weight: 2 },
          { id: "delivery", label: "Delivery", kind: "rating", weight: 1 },
          { id: "length_fit", label: "Length fit", kind: "dropdown", options: ["Too short", "Just right", "Too long"] },
        ],
        maxEvaluations: 3,
      }),
    },
    [201],
  );

  const users = await organizer.json<{ items: { id: string; email: string; role: string }[] }>(
    "list org users",
    "/api/v1/users?role=reviewer",
    {},
    [200],
  );
  const reviewerUser = users.items.find((u) => u.email === fixture.identities.reviewer.email);
  if (!reviewerUser) fail("list org users", `reviewer ${fixture.identities.reviewer.email} not found in org user directory`);

  await organizer.json(
    "assign reviewer by track",
    `/api/v1/plans/${plan.id}/reviewers`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: reviewerUser.id, trackId: trackA.id }),
    },
    [201],
  );
  await organizer.json(
    "assign reviewer extra per-submission",
    `/api/v1/plans/${plan.id}/reviewers`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: reviewerUser.id, submissionId: extraSubmission.id }),
    },
    [201],
  );

  // A second, throwaway reviewer (DEC-043 provisioning) is assigned to one
  // track-A submission and submits an evaluation *before* the main
  // reviewer's queue is fetched, so the queue has a genuine ratings-count
  // asymmetry to order by. It's also reused for the max-evaluations
  // overflow check below.
  const created = await organizer.json<CreatedUser>(
    "provision second reviewer via /api/v1/users",
    "/api/v1/users",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "wk-review-second-reviewer@example.test", role: "reviewer" }),
    },
    [201],
  );
  const ratedTrackASubmission = trackASubs.items[0]!;
  await organizer.json(
    "assign second reviewer to one track-A submission",
    `/api/v1/plans/${plan.id}/reviewers`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: created.id, submissionId: ratedTrackASubmission.id }),
    },
    [201],
  );

  const secondReviewer = new Persona("second-reviewer");
  await secondReviewer.login(created.email, created.password);
  await secondReviewer.json(
    "second reviewer pre-rates one track-A submission",
    `/api/v1/review/plans/${plan.id}/evaluations/${ratedTrackASubmission.id}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scores: { content_quality: 4, delivery: 3, length_fit: "Just right" },
        comment: "Pre-rated to create a ratings-count asymmetry for the queue-ordering check.",
      }),
    },
    [200],
  );

  // -- (2) Reviewer: queue composition, ordering, anonymization, scorecard,
  //        max-evaluations overflow ------------------------------------

  const queue = await reviewer.json<{ items: QueueItem[] }>(
    "reviewer queue",
    `/api/v1/review/plans/${plan.id}/queue`,
    {},
    [200],
  );
  const expectedIds = new Set([...trackASubs.items.map((s) => s.id), extraSubmission.id]);
  const queueIds = queue.items.map((i) => i.submissionId);
  assertCheck(
    "queue contains exactly the reviewer's assignment (no unassigned submissions)",
    queueIds.length === expectedIds.size && queueIds.every((id) => expectedIds.has(id)),
    `expected ${JSON.stringify([...expectedIds])}, got ${JSON.stringify(queueIds)}`,
  );

  // Ground-truth ratings counts, from the organizer's results endpoint
  // (never the reviewer UI), to verify fewest-ratings-first ordering.
  const resultsForOrdering = await organizer.json<{ items: ResultsRow[] }>(
    "organizer results (for ordering cross-check)",
    `/api/v1/plans/${plan.id}/results`,
    {},
    [200],
  );
  const countBySubmission = new Map(resultsForOrdering.items.map((r) => [r.submissionId, r.count]));
  const queueCounts = queueIds.map((id) => countBySubmission.get(id) ?? 0);
  const isNonDecreasing = queueCounts.every((c, i) => i === 0 || queueCounts[i - 1]! <= c);
  assertCheck(
    "queue is sorted fewest-ratings-first",
    isNonDecreasing,
    `counts by queue order: ${JSON.stringify(queueCounts)}`,
  );
  assertCheck(
    "the pre-rated submission (1 rating) is not ordered ahead of an unrated (0-rating) peer",
    queueIds.indexOf(ratedTrackASubmission.id) > queueIds.findIndex((id) => (countBySubmission.get(id) ?? 0) === 0),
    `queue order: ${JSON.stringify(queueIds)}, counts: ${JSON.stringify(queueCounts)}`,
  );

  const detailRes = await reviewer.request(`/api/v1/review/submissions/${extraSubmission.id}?planId=${plan.id}`);
  if (detailRes.status !== 200) fail("reviewer submission detail (anonymized)", `status ${detailRes.status}: ${detailRes.text}`);
  const detailBody = detailRes.json as Record<string, unknown>;
  assertCheck(
    "anonymized submission detail has no speaker-identifying fields (raw payload check)",
    !("speakers" in detailBody) && !("speakerAnswers" in detailBody) && !detailRes.text.includes("\"speakers\""),
    `raw payload keys: ${JSON.stringify(Object.keys(detailBody))}`,
  );

  const scorecard = await reviewer.json<{ scores: Record<string, unknown> }>(
    "reviewer submits scorecard (rating + dropdown + free text)",
    `/api/v1/review/plans/${plan.id}/evaluations/${extraSubmission.id}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scores: { content_quality: 5, delivery: 4, length_fit: "Just right" },
        comment: "Strong technical depth, clear delivery; a standout in this track.",
      }),
    },
    [200],
  );
  assertCheck(
    "scorecard round-trips numeric rating, dropdown, and free text",
    scorecard.scores.content_quality === 5 && scorecard.scores.delivery === 4 && scorecard.scores.length_fit === "Just right",
    `scorecard: ${JSON.stringify(scorecard)}`,
  );

  // Complete the reviewer's whole assignment (all track-A submissions plus
  // the extra) so they read as fully caught-up for the remind() check below
  // -- only the second reviewer should remain a laggard.
  for (const sub of trackASubs.items) {
    if (sub.id === ratedTrackASubmission.id) continue; // already rated by second reviewer, not this one
    await reviewer.json(
      `reviewer rates remaining track-A submission ${sub.id}`,
      `/api/v1/review/plans/${plan.id}/evaluations/${sub.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scores: { content_quality: 3, delivery: 3, length_fit: "Just right" },
          comment: "Solid proposal.",
        }),
      },
      [200],
    );
  }
  await reviewer.json(
    "reviewer rates the pre-rated track-A submission too (own evaluation, distinct from second reviewer's)",
    `/api/v1/review/plans/${plan.id}/evaluations/${ratedTrackASubmission.id}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scores: { content_quality: 2, delivery: 2, length_fit: "Too long" },
        comment: "Needs tightening.",
      }),
    },
    [200],
  );

  // Max-evaluations overflow: lower the cap to exactly the current rating
  // count on extraSubmission (1, from the main reviewer above), then have
  // the second reviewer -- also assigned to extraSubmission -- attempt a
  // second evaluation. It must be rejected.
  await organizer.json(
    "lower max-evaluations cap to 1 for the overflow check",
    `/api/v1/plans/${plan.id}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maxEvaluations: 1 }),
    },
    [200],
  );
  await organizer.json(
    "assign second reviewer to the extra submission (for the overflow attempt)",
    `/api/v1/plans/${plan.id}/reviewers`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: created.id, submissionId: extraSubmission.id }),
    },
    [201],
  );
  const overflowRes = await secondReviewer.request(`/api/v1/review/plans/${plan.id}/evaluations/${extraSubmission.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scores: { content_quality: 5, delivery: 5, length_fit: "Just right" } }),
  });
  assertCheck(
    "max-evaluations cap rejects the overflow evaluation",
    overflowRes.status === 409,
    `expected 409, got ${overflowRes.status}: ${overflowRes.text}`,
  );

  // Restore a workable cap for the rest of the walkthrough (progress/results
  // below reflect the reviewer's full completion regardless).
  await organizer.json(
    "restore max-evaluations cap",
    `/api/v1/plans/${plan.id}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maxEvaluations: 3 }),
    },
    [200],
  );

  // -- (3) Authz -------------------------------------------------------

  const reviewerSettingsRes = await reviewer.request(`/api/v1/plans/${plan.id}`);
  assertCheck(
    "reviewer GET of admin plan settings -> 403",
    reviewerSettingsRes.status === 403,
    `expected 403, got ${reviewerSettingsRes.status}: ${reviewerSettingsRes.text}`,
  );
  const reviewerResultsRes = await reviewer.request(`/api/v1/plans/${plan.id}/results`);
  assertCheck(
    "reviewer GET of plan results -> 403",
    reviewerResultsRes.status === 403,
    `expected 403, got ${reviewerResultsRes.status}: ${reviewerResultsRes.text}`,
  );

  const org2QueueRes = await org2Organizer.request(`/api/v1/review/plans/${plan.id}/queue`);
  assertCheck(
    "second-org organizer fetching this plan's queue -> 404/403 (DEC-039)",
    org2QueueRes.status === 404 || org2QueueRes.status === 403,
    `expected 404 or 403, got ${org2QueueRes.status}: ${org2QueueRes.text}`,
  );
  const org2ResultsRes = await org2Organizer.request(`/api/v1/plans/${plan.id}/results`);
  assertCheck(
    "second-org organizer fetching this plan's results -> 404/403 (DEC-039)",
    org2ResultsRes.status === 404 || org2ResultsRes.status === 403,
    `expected 404 or 403, got ${org2ResultsRes.status}: ${org2ResultsRes.text}`,
  );

  // DEC-175: a reviewer assigned only to a track-scoped plan (track A +
  // one specific per-submission assignment) hitting an out-of-scope
  // submission's detail/evaluation on that same plan -> 404 (existence
  // hiding), NOT 403 -- distinct from the DEC-039 cross-org probes above
  // (src/routes/review.ts:570-573, 609-612).
  const outOfScopeDetailRes = await reviewer.request(
    `/api/v1/review/submissions/${outOfScopeSubmission!.id}?planId=${plan.id}`,
  );
  assertCheck(
    "DEC-175 reviewer GET of an out-of-scope submission's review detail -> 404 (not 403)",
    outOfScopeDetailRes.status === 404,
    `expected 404, got ${outOfScopeDetailRes.status}: ${outOfScopeDetailRes.text}`,
  );
  assertCheck(
    "DEC-175 out-of-scope detail probe is not 403 (existence-hiding, not authz-denial)",
    outOfScopeDetailRes.status !== 403,
    `status was 403 -- should be 404 to avoid confirming the submission's existence`,
  );

  const outOfScopeEvalRes = await reviewer.request(
    `/api/v1/review/plans/${plan.id}/evaluations/${outOfScopeSubmission!.id}`,
    { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ scores: {} }) },
  );
  assertCheck(
    "DEC-175 reviewer PUT evaluation for an out-of-scope submission -> 404 (not 403)",
    outOfScopeEvalRes.status === 404,
    `expected 404, got ${outOfScopeEvalRes.status}: ${outOfScopeEvalRes.text}`,
  );
  assertCheck(
    "DEC-175 out-of-scope evaluation probe is not 403 (existence-hiding, not authz-denial)",
    outOfScopeEvalRes.status !== 403,
    `status was 403 -- should be 404 to avoid confirming the submission's existence`,
  );

  // -- (4) Organizer: progress, remind, results, results CSV -----------

  const progress = await organizer.json<{ items: { userId: string; email: string; assigned: number; completed: number }[] }>(
    "organizer progress",
    `/api/v1/plans/${plan.id}/progress`,
    {},
    [200],
  );
  const mainProgress = progress.items.find((p) => p.userId === reviewerUser.id);
  const secondProgress = progress.items.find((p) => p.userId === created.id);
  if (!mainProgress) fail("organizer progress", `main reviewer ${reviewerUser.id} missing from progress items`);
  if (!secondProgress) fail("organizer progress", `second reviewer ${created.id} missing from progress items`);
  assertCheck(
    "progress reflects the main reviewer's full completion",
    mainProgress.completed === mainProgress.assigned,
    `main reviewer progress: ${JSON.stringify(mainProgress)}`,
  );
  assertCheck(
    "progress reflects the second reviewer's partial completion (laggard)",
    secondProgress.completed < secondProgress.assigned,
    `second reviewer progress: ${JSON.stringify(secondProgress)}`,
  );

  const remind = await organizer.json<{ reminded: string[] }>(
    "organizer sends reminders",
    `/api/v1/plans/${plan.id}/remind`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) },
    [200],
  );
  assertCheck(
    "remind sends only to the laggard reviewer",
    remind.reminded.includes(created.id) && !remind.reminded.includes(reviewerUser.id),
    `reminded: ${JSON.stringify(remind.reminded)}`,
  );

  const emailLog = await organizer.json<{ items: { toEmail: string; subject: string }[] }>(
    "email_log after remind",
    `/api/v1/events/${event.id}/email-log?q=${encodeURIComponent("Walkthrough Committee Review")}&perPage=200`,
    {},
    [200],
  );
  const reminderRows = emailLog.items.filter((r) => r.subject.startsWith("Reminder:"));
  assertCheck(
    "remind writes an email_log row for the laggard, none for the completed reviewer",
    reminderRows.some((r) => r.toEmail === created.email) && !reminderRows.some((r) => r.toEmail === reviewerUser.email),
    `reminder rows: ${JSON.stringify(reminderRows)}`,
  );

  const results = await organizer.json<{ items: ResultsRow[] }>(
    "final results",
    `/api/v1/plans/${plan.id}/results`,
    {},
    [200],
  );
  const averages = results.items.map((r) => r.average);
  const isSortedDesc = averages.every((a, i) => i === 0 || averages[i - 1]! >= a);
  assertCheck(
    "results are sorted by weighted aggregate score descending",
    isSortedDesc,
    `averages by row order: ${JSON.stringify(averages)}`,
  );

  const csvRes = await organizer.request(`/api/v1/plans/${plan.id}/results?format=csv`);
  if (csvRes.status !== 200) fail("results CSV download", `status ${csvRes.status}: ${csvRes.text}`);
  const csvLines = csvRes.text.trim().split("\n");
  assertCheck(
    "results CSV downloads with a row per result (plus header)",
    csvLines.length === results.items.length + 1,
    `expected ${results.items.length + 1} lines (header + rows), got ${csvLines.length}`,
  );

  console.log("");
  console.log("review walkthrough: OK (all checks passed)");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
