// "scale" persona walkthrough (DEC-089/DEC-086): standalone runnable —
// `npx tsx scripts/walkthrough/scale.ts --url http://localhost:8787` —
// against a migrated + seeded dev server. Exercises the wave-1 scale fixes
// (DEC-078/079 chunking, DEC-080 public chunking, DEC-081 set-based
// review, DEC-083 versioned purge) at >100-id volume: 110 fresh contacts +
// submissions + participants, one bulk accept, onboarding task-assignment
// creation, exactly-once re-accept, no-auto-email, and an immediate
// purge-refresh probe on the public sessions page.
//
// Follows the DEC-053 auth contract (GET /login captures the chq_csrf
// cookie, POST /login is form-encoded carrying that cookie value, JSON
// mutations send header 'x-chq-csrf: 1'), same cookie-jar/api helper
// pattern as scripts/walkthrough/producer.ts. Fails loudly: the first
// failing check prints status+body and exits non-zero.
//
// GAP NOTE (flagged per worker instructions, not decided here): the task
// brief for this module assumed an organizer JSON PATCH-title endpoint on
// /api/v1/submissions/:id. No such route exists anywhere in src/routes —
// grep confirms the only write path for submission.title is the speaker
// portal edit flow (POST /portal/submissions/:id/edit, DEC-041), which
// syncs its locked 'title' answer into submission.title
// (src/server/repo/portal-edit.ts). Step 6 below uses that real write path
// (public submit -> claim -> organizer accept -> speaker portal edit)
// instead of a nonexistent organizer PATCH, since DEC-083's version bump
// fires on ANY successful mutation regardless of which route performs it.
//
// Scripts/ tooling (not src/ pure-core), so node: imports and reading the
// fixture file directly are both fine here (same as producer.ts).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..");
const FIXTURE_PATH = join(REPO_ROOT, "docs", "fixtures", "sample-data.json");

const urlFlagIdx = process.argv.indexOf("--url");
const BASE_URL = urlFlagIdx !== -1 ? process.argv[urlFlagIdx + 1] : (process.env.WALKTHROUGH_URL ?? "http://localhost:8787");

const SEEDED_EVENT_SLUG = "devflow-conf-2027";
const SCALE_COUNT = 110; // >100, to exercise DEC-078/079 chunking (ID_CHUNK_SIZE=90)
const SAMPLE_SIZE = 5;
const ONBOARDING_TASK_COUNT = 5; // DEFAULT_ONBOARDING_TASKS in src/domain/acceptance.ts

interface FixtureData {
  identities: {
    organizer: { email: string; password: string };
  };
}

// ---------------------------------------------------------------------------
// Fail-loudly assertion helpers
// ---------------------------------------------------------------------------

class CheckFailure extends Error {}

function fail(name: string, detail: string): never {
  throw new CheckFailure(`FAILED: ${name}\n  ${detail}`);
}

function assertStatus(name: string, res: Response, expected: number, body: string): void {
  if (res.status !== expected) {
    fail(name, `expected status ${expected}, got ${res.status}\n  body: ${body.slice(0, 500)}`);
  }
}

function assertTrue(name: string, condition: boolean, detail: string): void {
  if (!condition) fail(name, detail);
}

function pass(step: string): void {
  console.log(`PASS ${step}`);
}

// ---------------------------------------------------------------------------
// Cookie jar (matching producer.ts's convention)
// ---------------------------------------------------------------------------

class CookieJar {
  private cookies = new Map<string, string>();

  absorb(res: Response): void {
    const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const [pair] = raw.split(";");
      if (!pair) continue;
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) continue;
      const name = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      this.cookies.set(name, value);
    }
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function jarFetch(jar: CookieJar, url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const existing = jar.header();
  if (existing) headers.set("cookie", existing);
  const res = await fetch(url, { ...init, headers, redirect: init.redirect ?? "manual" });
  jar.absorb(res);
  return res;
}

async function loginAs(email: string, password: string): Promise<CookieJar> {
  const jar = new CookieJar();
  const getRes = await jarFetch(jar, `${BASE_URL}/login`);
  assertStatus("GET /login", getRes, 200, await getRes.text());
  const csrf = jar.get("chq_csrf");
  assertTrue("GET /login sets chq_csrf cookie", Boolean(csrf), "no chq_csrf cookie in response");

  const body = new URLSearchParams({ email, password, chq_csrf: csrf! });
  const postRes = await jarFetch(jar, `${BASE_URL}/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  assertStatus("POST /login", postRes, 302, await postRes.text());
  assertTrue("POST /login sets chq_session cookie", Boolean(jar.get("chq_session")), "no chq_session cookie in response");
  return jar;
}

async function api(
  jar: CookieJar,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ res: Response; json: any; text: string }> {
  const res = await jarFetch(jar, `${BASE_URL}${path}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json", "x-chq-csrf": "1" } : { "x-chq-csrf": "1" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    // non-JSON response (e.g. HTML error page) — leave json undefined
  }
  return { res, json, text };
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
// Step 1: 110 fresh contacts + submissions + speaker participants
// ---------------------------------------------------------------------------

async function seedScaleFixture(
  organizerJar: CookieJar,
  eventId: string,
): Promise<{ submissionIds: string[]; contactIds: string[] }> {
  const stamp = Date.now();
  const submissionIds: string[] = [];
  const contactIds: string[] = [];

  for (let i = 0; i < SCALE_COUNT; i++) {
    const contactRes = await api(organizerJar, "POST", "/api/v1/contacts", {
      firstName: "Scale",
      lastName: `Speaker${i}`,
      email: `scale.speaker.${stamp}.${i}@example-scale.test`,
    });
    assertStatus(`step1: create contact ${i}`, contactRes.res, 201, contactRes.text);
    const contactId = contactRes.json.id as string;
    assertTrue(`step1: contact ${i} has an id`, Boolean(contactId), contactRes.text);
    contactIds.push(contactId);

    const submissionRes = await api(organizerJar, "POST", `/api/v1/events/${eventId}/submissions`, {
      title: `Scale walkthrough submission ${stamp}-${i}`,
      description: "Fresh submission created by the scale walkthrough.",
    });
    assertStatus(`step1: create submission ${i}`, submissionRes.res, 201, submissionRes.text);
    const submissionId = submissionRes.json.id as string;
    assertTrue(`step1: submission ${i} has an id`, Boolean(submissionId), submissionRes.text);
    submissionIds.push(submissionId);

    const participantRes = await api(organizerJar, "POST", `/api/v1/submissions/${submissionId}/participants`, {
      contactId,
      role: "speaker",
    });
    assertStatus(`step1: invite participant ${i}`, participantRes.res, 201, participantRes.text);
  }

  assertTrue("step1: created 110 fresh submissions", submissionIds.length === SCALE_COUNT, String(submissionIds.length));
  assertTrue("step1: created 110 fresh contacts", contactIds.length === SCALE_COUNT, String(contactIds.length));
  pass(`step1 (110 fresh contacts + submissions + speaker participants)`);
  return { submissionIds, contactIds };
}

// ---------------------------------------------------------------------------
// Step 2: one bulk accept POST, >100 ids (DEC-078/079 chunking)
// ---------------------------------------------------------------------------

async function bulkAccept(organizerJar: CookieJar, eventId: string, submissionIds: string[]): Promise<void> {
  const bulkRes = await api(organizerJar, "POST", `/api/v1/events/${eventId}/submissions/status`, {
    ids: submissionIds,
    status: "accepted",
  });
  assertStatus("step2: POST bulk status (110 ids, accepted)", bulkRes.res, 200, bulkRes.text);
  assertTrue("step2: bulk accept reports updated=110", bulkRes.json.updated === SCALE_COUNT, bulkRes.text);
  pass(`step2 (one bulk POST, ${SCALE_COUNT} ids, updated=${SCALE_COUNT})`);
}

// ---------------------------------------------------------------------------
// Step 3/4: onboarding task_assignments exist for sampled fresh contacts,
// and are unchanged on re-accept (exactly-once, DEC-079)
// ---------------------------------------------------------------------------

interface OnboardingGrid {
  rows: { contact: { id: string }; cells: unknown[] }[];
}

function sampleAssignmentCounts(grid: OnboardingGrid, contactIds: string[]): Map<string, number> {
  const byContact = new Map(grid.rows.map((r) => [r.contact.id, r.cells.length]));
  const counts = new Map<string, number>();
  for (const contactId of contactIds) {
    counts.set(contactId, byContact.get(contactId) ?? 0);
  }
  return counts;
}

async function checkOnboardingAssignments(
  organizerJar: CookieJar,
  eventId: string,
  sampleContactIds: string[],
): Promise<Map<string, number>> {
  const gridRes = await api(organizerJar, "GET", `/api/v1/events/${eventId}/onboarding`);
  assertStatus("step3: GET onboarding grid", gridRes.res, 200, gridRes.text);
  const grid = gridRes.json as OnboardingGrid;
  const counts = sampleAssignmentCounts(grid, sampleContactIds);
  for (const contactId of sampleContactIds) {
    const n = counts.get(contactId) ?? 0;
    assertTrue(
      `step3: sampled contact ${contactId} has onboarding task_assignments`,
      n === ONBOARDING_TASK_COUNT,
      `expected ${ONBOARDING_TASK_COUNT} task_assignment cells, got ${n}`,
    );
  }
  pass(`step3 (onboarding task_assignments exist for ${sampleContactIds.length} sampled fresh contacts)`);
  return counts;
}

async function reAcceptIsExactlyOnce(
  organizerJar: CookieJar,
  eventId: string,
  submissionIds: string[],
  sampleContactIds: string[],
  beforeCounts: Map<string, number>,
): Promise<void> {
  const bulkRes = await api(organizerJar, "POST", `/api/v1/events/${eventId}/submissions/status`, {
    ids: submissionIds,
    status: "accepted",
  });
  assertStatus("step4: re-POST identical bulk status", bulkRes.res, 200, bulkRes.text);
  assertTrue("step4: re-POST also reports updated=110", bulkRes.json.updated === SCALE_COUNT, bulkRes.text);

  const gridRes = await api(organizerJar, "GET", `/api/v1/events/${eventId}/onboarding`);
  assertStatus("step4: GET onboarding grid after re-accept", gridRes.res, 200, gridRes.text);
  const grid = gridRes.json as OnboardingGrid;
  const afterCounts = sampleAssignmentCounts(grid, sampleContactIds);
  for (const contactId of sampleContactIds) {
    const before = beforeCounts.get(contactId) ?? 0;
    const after = afterCounts.get(contactId) ?? 0;
    assertTrue(
      `step4: contact ${contactId} assignment count unchanged by re-accept (exactly-once)`,
      before === after,
      `before=${before} after=${after}`,
    );
  }
  pass("step4 (re-POST identical bulk request: assignment counts unchanged, exactly-once)");
}

// ---------------------------------------------------------------------------
// Step 5: dev mailbox message count unchanged by the bulk accept
// (DEC-009: status changes never auto-email)
// ---------------------------------------------------------------------------

async function readMailboxCount(): Promise<number> {
  const res = await fetch(`${BASE_URL}/dev/mailbox`);
  const body = await res.text();
  assertStatus("step5: GET /dev/mailbox", res, 200, body);
  const match = body.match(/(\d+) message\(s\)/);
  assertTrue("step5: mailbox page reports a message count", Boolean(match), body.slice(0, 300));
  return Number(match![1]);
}

async function assertNoAutoEmailOnAccept(organizerJar: CookieJar, eventId: string): Promise<void> {
  // Fresh submission + accept cycle, isolated from the 110-id batch above so
  // this check is self-contained and independently re-runnable.
  const contactRes = await api(organizerJar, "POST", "/api/v1/contacts", {
    firstName: "Mailbox",
    lastName: "Probe",
    email: `mailbox.probe.${Date.now()}@example-scale.test`,
  });
  assertStatus("step5: create probe contact", contactRes.res, 201, contactRes.text);

  const submissionRes = await api(organizerJar, "POST", `/api/v1/events/${eventId}/submissions`, {
    title: `Mailbox probe submission ${Date.now()}`,
    description: "Isolated probe for the no-auto-email invariant.",
  });
  assertStatus("step5: create probe submission", submissionRes.res, 201, submissionRes.text);
  const submissionId = submissionRes.json.id as string;

  const participantRes = await api(organizerJar, "POST", `/api/v1/submissions/${submissionId}/participants`, {
    contactId: contactRes.json.id,
    role: "speaker",
  });
  assertStatus("step5: invite probe participant", participantRes.res, 201, participantRes.text);

  const before = await readMailboxCount();

  const bulkRes = await api(organizerJar, "POST", `/api/v1/events/${eventId}/submissions/status`, {
    ids: [submissionId],
    status: "accepted",
  });
  assertStatus("step5: accept the probe submission", bulkRes.res, 200, bulkRes.text);
  assertTrue("step5: probe accept reports updated=1", bulkRes.json.updated === 1, bulkRes.text);

  const after = await readMailboxCount();
  assertTrue(
    "step5: dev mailbox count unchanged by status change (never auto-emails)",
    after === before,
    `mailbox count went from ${before} to ${after}`,
  );
  pass("step5 (dev mailbox message count unchanged by bulk accept)");
}

// ---------------------------------------------------------------------------
// Step 6: purge-refresh probe. No organizer JSON PATCH-title endpoint
// exists (see GAP NOTE at top of file) — this exercises the real title
// write path (public submit -> claim -> organizer accept -> speaker portal
// edit) and confirms /e/<slug>/sessions reflects a title change
// immediately (DEC-083 version purge, no 60s staleness).
// ---------------------------------------------------------------------------

function parseSelectFirstOptions(html: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const match of html.matchAll(/<select[^>]*name="(field__[a-zA-Z0-9_]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const [, name, optionsBlock] = match;
    if (!name || !optionsBlock) continue;
    const optionMatch = optionsBlock.match(/<option value="([^"]+)"/);
    if (optionMatch) values.set(name, optionMatch[1]!);
  }
  return values;
}

async function purgeRefreshProbe(organizerJar: CookieJar, eventId: string): Promise<void> {
  const stamp = Date.now();
  const originalTitle = `Scale purge probe ${stamp}`;
  const email = `scale.purge.probe.${stamp}@example-scale.test`;

  const publicJar = new CookieJar();
  const getRes = await jarFetch(publicJar, `${BASE_URL}/submit/${SEEDED_EVENT_SLUG}`);
  const getBody = await getRes.text();
  assertStatus("step6: GET /submit (seeded event)", getRes, 200, getBody);
  const csrf = publicJar.get("chq_csrf");
  assertTrue("step6: GET /submit sets chq_csrf cookie", Boolean(csrf), "no chq_csrf cookie");

  const dropdownValues = parseSelectFirstOptions(getBody);
  const trackMatch = getBody.match(/name="trackIds" value="([^"]+)"/);

  const fullForm = new FormData();
  fullForm.set("chq_csrf", csrf!);
  fullForm.set("field__title", originalTitle);
  fullForm.set("field__description", "Fresh public submission used to probe DEC-083 purge-on-publish.");
  fullForm.set("field__first_name", "Scale");
  fullForm.set("field__last_name", "Prober");
  fullForm.set("field__email", email);
  for (const [name, value] of dropdownValues) fullForm.set(name, value);
  if (trackMatch) fullForm.set("trackIds", trackMatch[1]!);

  const submitRes = await jarFetch(publicJar, `${BASE_URL}/submit/${SEEDED_EVENT_SLUG}`, {
    method: "POST",
    body: fullForm,
  });
  const submitBody = await submitRes.text();
  assertStatus("step6: POST /submit (probe submission)", submitRes, 200, submitBody);
  assertTrue("step6: probe submission confirms", submitBody.includes("Thanks for your submission"), submitBody.slice(0, 400));

  const claimMatch = submitBody.match(/href="([^"]*\/claim\/[^"]+)"/);
  assertTrue("step6: confirmation page has a claim link", Boolean(claimMatch), submitBody.slice(0, 800));
  const claimUrl = claimMatch![1]!;

  const speakerJar = new CookieJar();
  const claimGetRes = await jarFetch(speakerJar, claimUrl);
  const claimGetBody = await claimGetRes.text();
  assertStatus("step6: GET claim link", claimGetRes, 200, claimGetBody);
  const claimCsrf = speakerJar.get("chq_csrf");
  assertTrue("step6: claim page sets chq_csrf cookie", Boolean(claimCsrf), "no chq_csrf cookie");

  const claimForm = new FormData();
  claimForm.set("chq_csrf", claimCsrf!);
  claimForm.set("password", "ScaleWalkthroughClaim!2027");
  const claimPostRes = await jarFetch(speakerJar, claimUrl, { method: "POST", body: claimForm });
  assertStatus("step6: POST claim (sets password)", claimPostRes, 302, await claimPostRes.text());
  assertTrue("step6: claim sets chq_session cookie", Boolean(speakerJar.get("chq_session")), "no chq_session cookie");

  // Find the freshly-claimed submission's id via the organizer's q filter.
  const findRes = await api(
    organizerJar,
    "GET",
    `/api/v1/events/${eventId}/submissions?q=${encodeURIComponent(originalTitle)}`,
  );
  assertStatus("step6: GET submissions filtered by probe title", findRes.res, 200, findRes.text);
  const found = (findRes.json.items as any[])[0];
  assertTrue("step6: probe submission found by q filter", Boolean(found), findRes.text);
  const submissionId = found.id as string;

  // Accept it, then approve content status so it clears the public
  // visibility gate (status=accepted AND content_status=approved AND
  // participant.visible=true — src/server/repo/public.ts).
  const acceptRes = await api(organizerJar, "POST", `/api/v1/events/${eventId}/submissions/status`, {
    ids: [submissionId],
    status: "accepted",
  });
  assertStatus("step6: accept the probe submission", acceptRes.res, 200, acceptRes.text);
  assertTrue("step6: accept reports updated=1", acceptRes.json.updated === 1, acceptRes.text);

  const contentStatusRes = await api(organizerJar, "POST", `/api/v1/submissions/${submissionId}/content-status`, {
    contentStatus: "approved",
  });
  assertStatus("step6: approve content status", contentStatusRes.res, 200, contentStatusRes.text);

  const sessionsRes1 = await fetch(`${BASE_URL}/e/${SEEDED_EVENT_SLUG}/sessions?page=50`);
  const sessionsBody1 = await sessionsRes1.text();
  assertStatus("step6: GET /e/<slug>/sessions (original title)", sessionsRes1, 200, sessionsBody1);
  assertTrue(
    "step6: the accepted probe submission's current title is present",
    sessionsBody1.includes(originalTitle),
    "expected the original marker title on the public sessions page",
  );

  // Edit the title via the speaker portal (the only write path for
  // submission.title — see GAP NOTE). Accepted submissions stay editable
  // regardless of the form's close date (DEC-041 canEditSubmission).
  const editGetRes = await jarFetch(speakerJar, `${BASE_URL}/portal/submissions/${submissionId}/edit`);
  const editGetBody = await editGetRes.text();
  assertStatus("step6: GET portal edit page", editGetRes, 200, editGetBody);
  const editCsrf = speakerJar.get("chq_csrf");
  assertTrue("step6: portal edit page sets chq_csrf cookie", Boolean(editCsrf), "no chq_csrf cookie");
  assertTrue("step6: portal edit page is editable (accepted speaker)", editGetBody.includes("Save changes"), editGetBody.slice(0, 400));

  // DEC-095: the edit page renders one checkbox per track via hono/jsx, e.g.
  // <input type="checkbox" name="trackIds" value="..." checked /> (the
  // boolean `checked` attr may render as `checked` or `checked=""`). The POST
  // must include the checked track's value or validateTrackChoice 400s
  // (src/routes/portal/edit.tsx:192-219, src/lib/submit-core.ts:45). Fall
  // back to the trackMatch captured from the submit page if none is found
  // checked on the edit page.
  const editTrackMatch = editGetBody.match(/name="trackIds" value="([^"]+)"[^>]*checked/);
  const editTrackId = editTrackMatch?.[1] ?? trackMatch?.[1];
  if (!editTrackId) {
    fail("step6: portal edit page trackIds", "no checked trackIds checkbox found on edit page and no fallback trackMatch from submit page");
  }

  const markerTitle = `Scale purge marker ${stamp}`;
  const editForm = new FormData();
  editForm.set("chq_csrf", editCsrf!);
  editForm.set("field__title", markerTitle);
  editForm.set("field__description", "Fresh public submission used to probe DEC-083 purge-on-publish.");
  editForm.set("field__first_name", "Scale");
  editForm.set("field__last_name", "Prober");
  editForm.set("field__email", email);
  for (const [name, value] of dropdownValues) editForm.set(name, value);
  editForm.set("trackIds", editTrackId);

  const editPostRes = await jarFetch(speakerJar, `${BASE_URL}/portal/submissions/${submissionId}/edit`, {
    method: "POST",
    body: editForm,
  });
  assertStatus("step6: POST portal edit (title -> marker)", editPostRes, 302, await editPostRes.text());

  // No sleep: DEC-083 purges on any successful mutation, so the very next
  // GET must reflect the new title immediately, not after a 60s TTL.
  const sessionsRes2 = await fetch(`${BASE_URL}/e/${SEEDED_EVENT_SLUG}/sessions?page=50`);
  const sessionsBody2 = await sessionsRes2.text();
  assertStatus("step6: GET /e/<slug>/sessions (marker title)", sessionsRes2, 200, sessionsBody2);
  assertTrue(
    "step6: the marker title appears immediately (no 60s staleness)",
    sessionsBody2.includes(markerTitle),
    "expected the marker title on the public sessions page right after the edit",
  );

  pass("step6 (purge-refresh probe: title change reflected immediately on /e/<slug>/sessions)");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await waitForHealth();

  const fixture: FixtureData = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
  const { email, password } = fixture.identities.organizer;
  const organizerJar = await loginAs(email, password);

  const eventsRes = await api(organizerJar, "GET", "/api/v1/events");
  assertStatus("setup: GET /api/v1/events", eventsRes.res, 200, eventsRes.text);
  const seededEvent = (eventsRes.json.items as any[]).find((e) => e.slug === SEEDED_EVENT_SLUG);
  assertTrue("setup: seeded devflow-conf-2027 event exists", Boolean(seededEvent), eventsRes.text);
  const eventId = seededEvent.id as string;

  console.log("Running step 1 (110 fresh contacts + submissions + participants)...");
  const { submissionIds, contactIds } = await seedScaleFixture(organizerJar, eventId);

  console.log("Running step 2 (one bulk accept, 110 ids)...");
  await bulkAccept(organizerJar, eventId, submissionIds);

  const sampleContactIds = contactIds.slice(0, SAMPLE_SIZE);

  console.log("Running step 3 (onboarding task_assignments for a sample of fresh contacts)...");
  const beforeCounts = await checkOnboardingAssignments(organizerJar, eventId, sampleContactIds);

  console.log("Running step 4 (re-accept is exactly-once)...");
  await reAcceptIsExactlyOnce(organizerJar, eventId, submissionIds, sampleContactIds, beforeCounts);

  console.log("Running step 5 (no auto-email on status change)...");
  await assertNoAutoEmailOnAccept(organizerJar, eventId);

  console.log("Running step 6 (purge-refresh probe)...");
  await purgeRefreshProbe(organizerJar, eventId);

  console.log("");
  console.log("scale walkthrough OK");
}

main().catch((err) => {
  if (err instanceof CheckFailure) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
