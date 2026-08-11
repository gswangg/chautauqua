// Producer persona walkthrough (SPEC §9, jobs J1/J2/J3/J5), per DEC-060:
// standalone runnable — `npx tsx scripts/walkthrough/producer.ts --url
// http://localhost:8787` — against a migrated + seeded dev server. Follows
// the DEC-053 auth contract (GET /login captures the chq_csrf cookie,
// POST /login is form-encoded carrying that cookie value, JSON mutations
// send header 'x-chq-csrf: 1'), fails loudly: the first failing check
// prints status+body and exits non-zero.
//
// Scripts/ tooling (not src/ pure-core), so node: imports and reading the
// fixture file directly (like scripts/seed.ts / perf-smoke.ts do for the
// seeded organizer credentials) are both fine here.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..");
const FIXTURE_PATH = join(REPO_ROOT, "docs", "fixtures", "sample-data.json");

const urlFlagIdx = process.argv.indexOf("--url");
const BASE_URL = urlFlagIdx !== -1 ? process.argv[urlFlagIdx + 1] : (process.env.WALKTHROUGH_URL ?? "http://localhost:8787");

const SEEDED_EVENT_SLUG = "devflow-conf-2027";

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

// ---------------------------------------------------------------------------
// Cookie jar (per-persona, matching DEC-053's cookie-jar convention)
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

// DEC-252: same-origin hrefs scraped from rendered pages (e.g. the
// confirmation page's claim link) are relative — resolve against --url.
// If a scraped href IS absolute, it must be same-origin with --url; an
// off-origin absolute href (e.g. production chautauqua.cc leaking into a
// local dev run) must fail loudly rather than the gate silently hitting a
// live deployment.
function resolveScrapedHref(href: string, baseUrl: string): string {
  const resolved = new URL(href, baseUrl);
  const base = new URL(baseUrl);
  if (resolved.origin !== base.origin) {
    throw new Error(
      `resolveScrapedHref: scraped href ${JSON.stringify(href)} resolved to origin ${resolved.origin}, ` +
        `which is off-origin from --url's ${base.origin}. Refusing to fetch an off-origin URL.`,
    );
  }
  return resolved.toString();
}

/** GET /login to seed the chq_csrf cookie, then form-POST /login carrying
 * that cookie value (DEC-053 auth contract). Returns the authenticated jar. */
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

/** Authenticated JSON API call (organizer session): x-chq-csrf header per
 * DEC-053/DEC-060. */
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
// J1: launch a CFP (new event, form config, window enforcement)
// ---------------------------------------------------------------------------

async function runJ1(organizerJar: CookieJar): Promise<{ eventId: string; slug: string }> {
  const slug = `wk-${Date.now()}`;

  const created = await api(organizerJar, "POST", "/api/v1/events", {
    name: "Producer Walkthrough Event",
    slug,
    startDate: "2027-09-01",
    endDate: "2027-09-03",
    timezone: "America/Los_Angeles",
  });
  assertStatus("J1 POST /api/v1/events", created.res, 201, created.text);
  const eventId = created.json.id as string;
  assertTrue("J1 created event has an id", Boolean(eventId), created.text);

  // Two tracks, so the form has something real to offer.
  const trackA = await api(organizerJar, "POST", `/api/v1/events/${eventId}/tracks`, { name: "Talks" });
  assertStatus("J1 POST track A", trackA.res, 201, trackA.text);
  const trackB = await api(organizerJar, "POST", `/api/v1/events/${eventId}/tracks`, { name: "Workshops" });
  assertStatus("J1 POST track B", trackB.res, 201, trackB.text);
  const trackIds = [trackA.json.id as string, trackB.json.id as string];

  const formRes = await api(organizerJar, "GET", `/api/v1/events/${eventId}/forms`);
  assertStatus("J1 GET default form", formRes.res, 200, formRes.text);
  const formId = formRes.json.id as string;

  // One field of each kind (DEC-008 kinds: text, long_text, dropdown,
  // checkbox, number, file), with required flags + help text.
  const textField = await api(organizerJar, "POST", `/api/v1/forms/${formId}/fields`, {
    section: "session",
    kind: "text",
    label: "One-line pitch",
    helpText: "A single sentence describing the talk.",
    required: true,
  });
  assertStatus("J1 create text field", textField.res, 201, textField.text);

  const longTextField = await api(organizerJar, "POST", `/api/v1/forms/${formId}/fields`, {
    section: "session",
    kind: "long_text",
    label: "Extended abstract",
    helpText: "Optional — more detail than the description.",
    required: false,
  });
  assertStatus("J1 create long_text field", longTextField.res, 201, longTextField.text);

  const formatField = await api(organizerJar, "POST", `/api/v1/forms/${formId}/fields`, {
    section: "session",
    kind: "dropdown",
    label: "Session format",
    helpText: "How long is this session?",
    required: true,
    options: ["Talk", "Workshop", "Panel"],
  });
  assertStatus("J1 create dropdown field", formatField.res, 201, formatField.text);
  const formatFieldId = formatField.json.id as string;

  const checkboxField = await api(organizerJar, "POST", `/api/v1/forms/${formId}/fields`, {
    section: "session",
    kind: "checkbox",
    label: "First-time speaker",
    required: false,
  });
  assertStatus("J1 create checkbox field", checkboxField.res, 201, checkboxField.text);

  const numberField = await api(organizerJar, "POST", `/api/v1/forms/${formId}/fields`, {
    section: "session",
    kind: "number",
    label: "Years of experience with the topic",
    required: false,
  });
  assertStatus("J1 create number field", numberField.res, 201, numberField.text);

  const fileField = await api(organizerJar, "POST", `/api/v1/forms/${formId}/fields`, {
    section: "session",
    kind: "file",
    label: "Slides or outline (optional)",
    required: false,
  });
  assertStatus("J1 create file field", fileField.res, 201, fileField.text);

  // One conditional rule: show a "workshop prerequisites" field only when
  // format = Workshop (kept optional so the happy-path submit below doesn't
  // need to satisfy it regardless of the chosen format).
  const conditionalField = await api(organizerJar, "POST", `/api/v1/forms/${formId}/fields`, {
    section: "session",
    kind: "text",
    label: "Workshop prerequisites",
    required: false,
    rule: { fieldId: formatFieldId, op: "eq", value: "Workshop" },
  });
  assertStatus("J1 create conditional field", conditionalField.res, 201, conditionalField.text);
  assertTrue(
    "J1 conditional field rule persisted",
    conditionalField.json.rule?.fieldId === formatFieldId && conditionalField.json.rule?.value === "Workshop",
    JSON.stringify(conditionalField.json),
  );

  // Tracks + closeDate, openDate in the future (not yet open).
  const openDate = Date.now() + 24 * 60 * 60 * 1000; // +1 day
  const closeDate = Date.now() + 30 * 24 * 60 * 60 * 1000; // +30 days
  const patchNotYetOpen = await api(organizerJar, "PATCH", `/api/v1/forms/${formId}`, {
    tracks: trackIds,
    openDate,
    closeDate,
  });
  assertStatus("J1 PATCH form (not-yet-open window)", patchNotYetOpen.res, 200, patchNotYetOpen.text);

  // GET /submit/<slug> shows a not-yet-open state (DEC-036).
  const publicJar = new CookieJar();
  const notYetOpenRes = await jarFetch(publicJar, `${BASE_URL}/submit/${slug}`);
  const notYetOpenBody = await notYetOpenRes.text();
  assertStatus("J1 GET /submit (not yet open)", notYetOpenRes, 200, notYetOpenBody);
  assertTrue(
    "J1 not-yet-open page communicates the window state",
    /not yet open|opens? /i.test(notYetOpenBody),
    notYetOpenBody.slice(0, 300),
  );
  assertTrue(
    "J1 not-yet-open page has no submit form",
    !notYetOpenBody.includes('name="field__title"'),
    "expected no submission form fields while the window is not yet open",
  );

  // POST is rejected while not yet open (DEC-036). The not-yet-open page
  // itself never mints a chq_csrf cookie (no form to submit) — the
  // double-submit cookie is a site-wide concern (Path=/), so mint one via
  // any other page's GET (here, /login) to exercise the window gate.
  const csrfNotYetOpenGet = await jarFetch(publicJar, `${BASE_URL}/login`);
  await csrfNotYetOpenGet.text();
  const csrfNotYetOpen = publicJar.get("chq_csrf");
  assertTrue("J1 a chq_csrf cookie is available for the not-yet-open POST", Boolean(csrfNotYetOpen), "no chq_csrf cookie");
  const rejectedSubmitForm = new FormData();
  rejectedSubmitForm.set("chq_csrf", csrfNotYetOpen!);
  rejectedSubmitForm.set("field__title", "Should not be accepted");
  rejectedSubmitForm.set("field__description", "This submission should be rejected by the window gate.");
  rejectedSubmitForm.set("field__first_name", "No");
  rejectedSubmitForm.set("field__last_name", "Body");
  rejectedSubmitForm.set("field__email", "nobody@example.com");
  const rejectedRes = await jarFetch(publicJar, `${BASE_URL}/submit/${slug}`, {
    method: "POST",
    body: rejectedSubmitForm,
  });
  const rejectedBody = await rejectedRes.text();
  assertTrue(
    "J1 POST /submit rejected while not yet open",
    rejectedRes.status !== 200 || /not yet open|opens? /i.test(rejectedBody),
    `expected a not-yet-open response, got status ${rejectedRes.status}: ${rejectedBody.slice(0, 300)}`,
  );
  assertTrue(
    "J1 rejected submission did not confirm",
    !rejectedBody.includes("Thanks for your submission"),
    "the not-yet-open POST must not have created a submission",
  );

  // Open the window (openDate now in the past) — submission should work.
  const patchOpen = await api(organizerJar, "PATCH", `/api/v1/forms/${formId}`, {
    openDate: Date.now() - 60_000,
  });
  assertStatus("J1 PATCH form (open window)", patchOpen.res, 200, patchOpen.text);

  const openJar = new CookieJar();
  const openPageRes = await jarFetch(openJar, `${BASE_URL}/submit/${slug}`);
  const openPageBody = await openPageRes.text();
  assertStatus("J1 GET /submit (open)", openPageRes, 200, openPageBody);
  assertTrue(
    "J1 open submit page has the submission form",
    openPageBody.includes('name="field__title"'),
    "expected the submission form once the window is open",
  );
  const openCsrf = openJar.get("chq_csrf");
  assertTrue("J1 open page set a chq_csrf cookie", Boolean(openCsrf), "no chq_csrf cookie");

  const submitForm = new FormData();
  submitForm.set("chq_csrf", openCsrf!);
  submitForm.set("field__title", "Shipping Fast Without Breaking Things");
  submitForm.set("field__description", "A talk about disciplined incremental delivery.");
  submitForm.set(`field__${textField.json.id}`, "Practical lessons from shipping weekly.");
  submitForm.set(`field__${formatFieldId}`, "Talk");
  submitForm.set("field__first_name", "Priya");
  submitForm.set("field__last_name", "Narayan");
  submitForm.set("field__email", `priya.narayan.${Date.now()}@example.com`);
  submitForm.set("trackIds", trackIds[0]!);
  const fileBlob = new Blob(["outline contents"], { type: "text/plain" });
  submitForm.set(`field__${fileField.json.id}`, fileBlob, "outline.txt");

  const submitRes = await jarFetch(openJar, `${BASE_URL}/submit/${slug}`, { method: "POST", body: submitForm });
  const submitBody = await submitRes.text();
  assertStatus("J1 POST /submit (open, valid)", submitRes, 200, submitBody);
  assertTrue(
    "J1 valid submission confirms",
    submitBody.includes("Thanks for your submission"),
    submitBody.slice(0, 400),
  );

  return { eventId, slug };
}

// ---------------------------------------------------------------------------
// J2: submit to the seeded event, draft, validation, confirmation + claim
// ---------------------------------------------------------------------------

async function runJ2(seededEventId: string): Promise<void> {
  const jar = new CookieJar();
  const getRes = await jarFetch(jar, `${BASE_URL}/submit/${SEEDED_EVENT_SLUG}`);
  const getBody = await getRes.text();
  assertStatus("J2 GET /submit/devflow-conf-2027", getRes, 200, getBody);
  assertTrue("J2 submit page shows event branding/name", getBody.includes("DevFlow Conf"), getBody.slice(0, 300));
  assertTrue(
    "J2 submit page shows a deadline",
    /Submissions close/i.test(getBody),
    "expected a 'Submissions close ...' deadline line",
  );
  assertTrue(
    "J2 submit page shows tracks",
    getBody.includes("AI Engineering") || getBody.includes("Platform") || getBody.includes("Developer Experience"),
    "expected at least one seeded track name on the submit page",
  );
  const csrf = jar.get("chq_csrf");
  assertTrue("J2 GET /submit sets chq_csrf cookie", Boolean(csrf), "no chq_csrf cookie");

  // Save a draft (title only).
  const draftForm = new FormData();
  draftForm.set("chq_csrf", csrf!);
  draftForm.set("field__title", "Draft: Observability for Platform Teams");
  const draftRes = await jarFetch(jar, `${BASE_URL}/submit/${SEEDED_EVENT_SLUG}/save-draft`, {
    method: "POST",
    body: draftForm,
  });
  assertStatus("J2 POST save-draft", draftRes, 302, await draftRes.text());

  // Re-fetch the page: the draft should resume.
  const resumedRes = await jarFetch(jar, `${BASE_URL}/submit/${SEEDED_EVENT_SLUG}`);
  const resumedBody = await resumedRes.text();
  assertStatus("J2 GET /submit (resumed draft)", resumedRes, 200, resumedBody);
  assertTrue(
    "J2 resumed page shows the draft banner",
    /Resuming your saved draft/i.test(resumedBody),
    resumedBody.slice(0, 300),
  );

  // Submit missing a required field (description) -> field error, no confirmation.
  const missingForm = new FormData();
  missingForm.set("chq_csrf", csrf!);
  missingForm.set("field__title", "Observability for Platform Teams");
  missingForm.set("field__first_name", "Morgan");
  missingForm.set("field__last_name", "Lee");
  missingForm.set("field__email", "morgan.lee.walkthrough@example.com");
  const missingRes = await jarFetch(jar, `${BASE_URL}/submit/${SEEDED_EVENT_SLUG}`, {
    method: "POST",
    body: missingForm,
  });
  const missingBody = await missingRes.text();
  assertStatus("J2 POST /submit missing required field", missingRes, 400, missingBody);
  assertTrue(
    "J2 missing-field response shows a field error",
    missingBody.includes("field-error"),
    missingBody.slice(0, 400),
  );
  assertTrue(
    "J2 missing-field response did not confirm",
    !missingBody.includes("Thanks for your submission"),
    "an invalid submission must not confirm",
  );

  // Full submit -> confirmation + claim link.
  const uniqueEmail = `walkthrough.speaker.${Date.now()}@example.com`;
  const fullForm = new FormData();
  fullForm.set("chq_csrf", csrf!);
  fullForm.set("field__title", "Observability for Platform Teams");
  fullForm.set("field__description", "How we instrumented a fleet of internal platform services.");
  fullForm.set("field__first_name", "Morgan");
  fullForm.set("field__last_name", "Lee");
  fullForm.set("field__email", uniqueEmail);
  // Seeded devflow-conf-2027's default form ships custom dropdown fields
  // (session format, audience level) that are required — fill each with its
  // first real (non-empty) <option> so a genuinely required custom field
  // doesn't 400 us.
  for (const match of getBody.matchAll(/<select[^>]*name="(field__field_[a-zA-Z0-9_]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const [, name, optionsBlock] = match;
    if (!name || !optionsBlock) continue;
    const optionMatch = optionsBlock.match(/<option value="([^"]+)"/);
    if (optionMatch) fullForm.set(name, optionMatch[1]!);
  }
  const trackMatch = getBody.match(/name="trackIds" value="([^"]+)"/);
  if (trackMatch) fullForm.set("trackIds", trackMatch[1]!);

  const fullRes = await jarFetch(jar, `${BASE_URL}/submit/${SEEDED_EVENT_SLUG}`, { method: "POST", body: fullForm });
  const fullBody = await fullRes.text();
  assertStatus("J2 POST /submit full", fullRes, 200, fullBody);
  assertTrue(
    "J2 full submission confirms",
    fullBody.includes("Thanks for your submission"),
    fullBody.slice(0, 400),
  );
  const claimMatch = fullBody.match(/href="([^"]*\/claim\/[^"]+)"/);
  assertTrue("J2 confirmation page has a claim link", Boolean(claimMatch), fullBody.slice(0, 800));
  const claimUrl = resolveScrapedHref(claimMatch![1]!, BASE_URL);

  // Confirmation email appears in /dev/mailbox with the claim link.
  const mailboxRes = await fetch(`${BASE_URL}/dev/mailbox`);
  const mailboxBody = await mailboxRes.text();
  assertStatus("J2 GET /dev/mailbox", mailboxRes, 200, mailboxBody);
  assertTrue(
    "J2 dev mailbox lists the confirmation email",
    mailboxBody.includes(uniqueEmail),
    "expected the new speaker's email in the mailbox listing",
  );

  // Claim: sets a password and reaches /portal.
  const claimJar = new CookieJar();
  const claimGetRes = await jarFetch(claimJar, claimUrl);
  const claimGetBody = await claimGetRes.text();
  assertStatus("J2 GET claim link", claimGetRes, 200, claimGetBody);
  const claimCsrf = claimJar.get("chq_csrf");
  assertTrue("J2 claim page sets chq_csrf cookie", Boolean(claimCsrf), "no chq_csrf cookie");

  const claimForm = new FormData();
  claimForm.set("chq_csrf", claimCsrf!);
  claimForm.set("password", "WalkthroughClaim!2027");
  const claimPostRes = await jarFetch(claimJar, claimUrl, { method: "POST", body: claimForm });
  assertStatus("J2 POST claim (sets password)", claimPostRes, 302, await claimPostRes.text());
  assertTrue("J2 claim sets chq_session cookie", Boolean(claimJar.get("chq_session")), "no chq_session cookie");

  const portalRes = await jarFetch(claimJar, `${BASE_URL}/portal`);
  assertStatus("J2 GET /portal after claim", portalRes, 200, await portalRes.text());

  void seededEventId; // reserved for future assertions against this event
}

// ---------------------------------------------------------------------------
// J3: triage at volume — list filters/pagination, bulk status, clone, manual create
// ---------------------------------------------------------------------------

async function runJ3(organizerJar: CookieJar, eventId: string): Promise<void> {
  const listRes = await api(organizerJar, "GET", `/api/v1/events/${eventId}/submissions?perPage=5`);
  assertStatus("J3 GET submissions list", listRes.res, 200, listRes.text);
  assertTrue("J3 list has items/total/page/perPage envelope", Array.isArray(listRes.json.items) && typeof listRes.json.total === "number", listRes.text);

  const qRes = await api(organizerJar, "GET", `/api/v1/events/${eventId}/submissions?q=Chaos`);
  assertStatus("J3 GET submissions q filter", qRes.res, 200, qRes.text);

  const statusRes = await api(organizerJar, "GET", `/api/v1/events/${eventId}/submissions?status=accepted`);
  assertStatus("J3 GET submissions status filter", statusRes.res, 200, statusRes.text);
  assertTrue(
    "J3 status filter only returns accepted",
    statusRes.json.items.every((s: any) => s.status === "accepted"),
    statusRes.text,
  );

  const tracksRes = await api(organizerJar, "GET", `/api/v1/events/${eventId}/tracks`);
  assertStatus("J3 GET tracks (for filter)", tracksRes.res, 200, tracksRes.text);
  const trackId = tracksRes.json.items[0]?.id;
  assertTrue("J3 event has at least one track to filter by", Boolean(trackId), tracksRes.text);
  const trackFilterRes = await api(organizerJar, "GET", `/api/v1/events/${eventId}/submissions?trackId=${trackId}`);
  assertStatus("J3 GET submissions track filter", trackFilterRes.res, 200, trackFilterRes.text);

  const pageRes = await api(organizerJar, "GET", `/api/v1/events/${eventId}/submissions?page=2&perPage=3`);
  assertStatus("J3 GET submissions pagination", pageRes.res, 200, pageRes.text);
  assertTrue("J3 pagination echoes page/perPage", pageRes.json.page === 2 && pageRes.json.perPage === 3, pageRes.text);

  // Bulk status change pending -> accept_queue; email_log count must be UNCHANGED.
  const pendingRes = await api(organizerJar, "GET", `/api/v1/events/${eventId}/submissions?status=pending&perPage=1`);
  assertStatus("J3 GET a pending submission", pendingRes.res, 200, pendingRes.text);
  const pendingId = pendingRes.json.items[0]?.id;
  assertTrue("J3 there is a pending submission to bulk-transition", Boolean(pendingId), pendingRes.text);

  const beforeLog = await api(organizerJar, "GET", `/api/v1/events/${eventId}/email-log?perPage=1`);
  assertStatus("J3 GET email-log (before bulk status)", beforeLog.res, 200, beforeLog.text);
  const beforeCount = beforeLog.json.total as number;

  const bulkRes = await api(organizerJar, "POST", `/api/v1/events/${eventId}/submissions/status`, {
    ids: [pendingId],
    status: "accept_queue",
  });
  assertStatus("J3 POST bulk status change", bulkRes.res, 200, bulkRes.text);
  assertTrue("J3 bulk status change reports 1 updated", bulkRes.json.updated === 1, bulkRes.text);

  const afterLog = await api(organizerJar, "GET", `/api/v1/events/${eventId}/email-log?perPage=1`);
  assertStatus("J3 GET email-log (after bulk status)", afterLog.res, 200, afterLog.text);
  const afterCount = afterLog.json.total as number;
  assertTrue(
    "J3 status change never auto-emails (email_log count unchanged)",
    afterCount === beforeCount,
    `email_log total went from ${beforeCount} to ${afterCount}`,
  );

  // Clone.
  const detailRes = await api(organizerJar, "GET", `/api/v1/submissions/${pendingId}`);
  assertStatus("J3 GET submission detail (pre-clone)", detailRes.res, 200, detailRes.text);
  const cloneRes = await api(organizerJar, "POST", `/api/v1/submissions/${pendingId}/clone`, {});
  assertStatus("J3 POST clone", cloneRes.res, 201, cloneRes.text);
  assertTrue("J3 clone has a new id", cloneRes.json.id && cloneRes.json.id !== pendingId, cloneRes.text);
  assertTrue(
    "J3 clone carries the title forward",
    typeof cloneRes.json.title === "string" && cloneRes.json.title.startsWith(detailRes.json.title),
    cloneRes.text,
  );

  // Manual create.
  const manualRes = await api(organizerJar, "POST", `/api/v1/events/${eventId}/submissions`, {
    title: "Manually Entered Session",
    description: "Added by the organizer directly, not via public submit.",
    contact: { email: `manual.entry.${Date.now()}@example.com`, firstName: "Casey", lastName: "Orr" },
  });
  assertStatus("J3 POST manual create", manualRes.res, 201, manualRes.text);
  assertTrue("J3 manual create defaults to pending", manualRes.json.status === "pending", manualRes.text);
}

// ---------------------------------------------------------------------------
// J5: compose — templates, merge fields, 100-cap, real send + ICS, HTML escaping
// ---------------------------------------------------------------------------

async function runJ5(organizerJar: CookieJar, eventId: string, capEventId: string): Promise<void> {
  // Template with the merge fields under test.
  const templateRes = await api(organizerJar, "POST", `/api/v1/events/${eventId}/templates`, {
    name: "Walkthrough acceptance note",
    subject: "Re: {talk_title}",
    bodyText: "Hi {speaker_name},\n\n{feedback}\n\nSee you at {event_name}.",
  });
  assertStatus("J5 POST template", templateRes.res, 201, templateRes.text);
  const templateId = templateRes.json.id as string;

  const acceptedRes = await api(organizerJar, "GET", `/api/v1/events/${eventId}/submissions?status=accepted&perPage=2`);
  assertStatus("J5 GET accepted submissions", acceptedRes.res, 200, acceptedRes.text);
  const accepted = acceptedRes.json.items as any[];
  assertTrue("J5 event has at least one accepted submission", accepted.length >= 1, acceptedRes.text);
  const submissionIds = accepted.map((s) => s.id);

  const previewRes = await api(organizerJar, "POST", `/api/v1/events/${eventId}/compose/preview`, {
    templateId,
    submissionIds,
    includeFeedback: true,
  });
  assertStatus("J5 POST compose/preview (template)", previewRes.res, 200, previewRes.text);
  const previewItems = previewRes.json.items as any[];
  assertTrue("J5 preview has one item per selected submission's recipients", previewItems.length >= submissionIds.length, previewRes.text);
  for (const item of previewItems) {
    assertTrue(
      `J5 preview item for ${item.email} has no unresolved merge placeholders`,
      !/\{[a-zA-Z0-9_]+\}/.test(item.subject) && !/\{[a-zA-Z0-9_]+\}/.test(item.text),
      JSON.stringify(item),
    );
    assertTrue(
      `J5 preview item for ${item.email} merges the talk title into the subject`,
      item.subject.includes("Re:") && item.subject.length > "Re: ".length,
      JSON.stringify(item),
    );
    assertTrue(
      `J5 preview item for ${item.email} renders a feedback line`,
      item.text.includes("No reviewer feedback was recorded.") || item.text.split("\n\n").length >= 2,
      JSON.stringify(item),
    );
  }

  // >100 recipients rejects atomically (DEC-019), using the throwaway event
  // seeded with 101 single-participant submissions below.
  const overflowIdsRes = await api(organizerJar, "GET", `/api/v1/events/${capEventId}/submissions?perPage=200`);
  assertStatus("J5 GET overflow event submissions", overflowIdsRes.res, 200, overflowIdsRes.text);
  const overflowIds = (overflowIdsRes.json.items as any[]).map((s) => s.id);
  assertTrue("J5 overflow event has >100 submissions to test the cap", overflowIds.length > 100, `only ${overflowIds.length}`);

  const overflowPreview = await api(organizerJar, "POST", `/api/v1/events/${capEventId}/compose/preview`, {
    subject: "x",
    bodyText: "x",
    submissionIds: overflowIds,
  });
  assertStatus("J5 POST compose/preview (>100 recipients rejects)", overflowPreview.res, 400, overflowPreview.text);

  const overflowSend = await api(organizerJar, "POST", `/api/v1/events/${capEventId}/compose/send`, {
    subject: "x",
    bodyText: "x",
    submissionIds: overflowIds,
  });
  assertStatus("J5 POST compose/send (>100 recipients rejects atomically)", overflowSend.res, 400, overflowSend.text);

  // A real send writes per-recipient email_log rows.
  const targetSubmissionId = submissionIds[0]!;
  const beforeLog = await api(organizerJar, "GET", `/api/v1/events/${eventId}/email-log?perPage=1`);
  const beforeTotal = beforeLog.json.total as number;

  // Schedule the target submission (attachIcs preflight requires a slot,
  // DEC-051) so the send below can carry a calendar invite.
  const slotRes = await api(organizerJar, "PUT", `/api/v1/submissions/${targetSubmissionId}/slot`, {
    day: "2027-09-01",
    startMin: 540,
    endMin: 600,
  });
  assertStatus("J5 PUT schedule slot (for ICS)", slotRes.res, 200, slotRes.text);

  const beforeDetail = await api(organizerJar, "GET", `/api/v1/submissions/${targetSubmissionId}`);
  const sequenceAfterSchedule = beforeDetail.json.icsSequence as number;

  // Preview never bumps the sequence (DEC-051).
  const icsPreview1 = await api(organizerJar, "POST", `/api/v1/events/${eventId}/compose/preview`, {
    subject: "Room details for {talk_title}",
    bodyText: "Hi {speaker_name}, see you soon for {talk_title}.",
    submissionIds: [targetSubmissionId],
    attachIcs: true,
  });
  assertStatus("J5 POST compose/preview with attachIcs", icsPreview1.res, 200, icsPreview1.text);
  assertTrue(
    "J5 preview does not bump ics_sequence",
    icsPreview1.json.items[0].ics.sequence === sequenceAfterSchedule,
    icsPreview1.text,
  );
  const secondPreviewCheck = await api(organizerJar, "GET", `/api/v1/submissions/${targetSubmissionId}`);
  assertTrue(
    "J5 preview leaves the stored ics_sequence unchanged",
    secondPreviewCheck.json.icsSequence === sequenceAfterSchedule,
    secondPreviewCheck.text,
  );

  // Real send bumps the sequence exactly once.
  const sendRes = await api(organizerJar, "POST", `/api/v1/events/${eventId}/compose/send`, {
    subject: "Room details for {talk_title}",
    bodyText: "Hi {speaker_name}, see you soon for {talk_title}.",
    submissionIds: [targetSubmissionId],
    attachIcs: true,
  });
  assertStatus("J5 POST compose/send with attachIcs", sendRes.res, 200, sendRes.text);
  assertTrue("J5 send reports at least one sent email", sendRes.json.sent >= 1, sendRes.text);

  const afterSendDetail = await api(organizerJar, "GET", `/api/v1/submissions/${targetSubmissionId}`);
  assertTrue(
    "J5 send bumps ics_sequence exactly once",
    afterSendDetail.json.icsSequence === sequenceAfterSchedule + 1,
    `expected ${sequenceAfterSchedule + 1}, got ${afterSendDetail.json.icsSequence}`,
  );

  const afterLog = await api(organizerJar, "GET", `/api/v1/events/${eventId}/email-log?perPage=1`);
  const afterTotal = afterLog.json.total as number;
  assertTrue(
    "J5 real send writes a per-recipient email_log row",
    afterTotal > beforeTotal,
    `email_log total went from ${beforeTotal} to ${afterTotal}`,
  );

  const targetTitleRes = await api(organizerJar, "GET", `/api/v1/submissions/${targetSubmissionId}`);
  const targetTitle = targetTitleRes.json.title as string;
  const sentLogRes = await api(
    organizerJar,
    "GET",
    `/api/v1/events/${eventId}/email-log?perPage=5&q=${encodeURIComponent(targetTitle.slice(0, 20))}`,
  );
  assertStatus("J5 GET email-log for the sent ICS message", sentLogRes.res, 200, sentLogRes.text);
  const sentLogItem = (sentLogRes.json.items as any[])[0];
  assertTrue("J5 sent email_log row has an ICS body", Boolean(sentLogItem?.icsText), JSON.stringify(sentLogItem));
  const uidMatch = sentLogItem.icsText.match(/UID:([^\r\n]+)/);
  const sequenceMatch = sentLogItem.icsText.match(/SEQUENCE:(\d+)/);
  assertTrue("J5 ICS carries a UID", Boolean(uidMatch), sentLogItem.icsText);
  assertTrue(
    "J5 ICS UID is stable (references the submission id)",
    uidMatch[1].includes(targetSubmissionId),
    uidMatch[1],
  );
  assertTrue(
    "J5 ICS SEQUENCE matches the pre-bump stored value used for this send",
    Number(sequenceMatch?.[1]) === sequenceAfterSchedule,
    sentLogItem.icsText,
  );

  // HTML-escaping: a talk title containing <img src=x> must arrive
  // entity-escaped in body_html (DEC-037).
  const dangerousTitle = `Dangerous Title <img src=x> Test ${Date.now()}`;
  const dangerousSubmission = await api(organizerJar, "POST", `/api/v1/events/${eventId}/submissions`, {
    title: dangerousTitle,
    description: "Regression check for DEC-037 HTML escaping.",
    contact: { email: `xss.check.${Date.now()}@example.com`, firstName: "XSS", lastName: "Check" },
  });
  assertStatus("J5 create submission with dangerous title", dangerousSubmission.res, 201, dangerousSubmission.text);
  const dangerousId = dangerousSubmission.json.id as string;

  const dangerousSend = await api(organizerJar, "POST", `/api/v1/events/${eventId}/compose/send`, {
    subject: "Re: {talk_title}",
    bodyText: "Hi {speaker_name}, re {talk_title}.",
    submissionIds: [dangerousId],
  });
  assertStatus("J5 send to submission with dangerous title", dangerousSend.res, 200, dangerousSend.text);

  const dangerousLog = await api(
    organizerJar,
    "GET",
    `/api/v1/events/${eventId}/email-log?perPage=5&q=${encodeURIComponent("Dangerous Title")}`,
  );
  assertStatus("J5 GET email-log for dangerous-title send", dangerousLog.res, 200, dangerousLog.text);
  const dangerousItem = (dangerousLog.json.items as any[])[0];
  assertTrue("J5 dangerous-title email_log row found", Boolean(dangerousItem), dangerousLog.text);
  assertTrue(
    "J5 body_html entity-escapes the injected markup",
    dangerousItem.bodyHtml.includes("&lt;img src=x&gt;") && !dangerousItem.bodyHtml.includes("<img src=x>"),
    dangerousItem.bodyHtml,
  );
}

// ---------------------------------------------------------------------------
// Cap-test fixture: 101 single-participant submissions in a throwaway event
// ---------------------------------------------------------------------------

async function seedOverflowEvent(organizerJar: CookieJar): Promise<string> {
  const slug = `wk-cap-${Date.now()}`;
  const created = await api(organizerJar, "POST", "/api/v1/events", {
    name: "Producer Walkthrough Overflow Event",
    slug,
    startDate: "2027-09-01",
    endDate: "2027-09-03",
    timezone: "America/Los_Angeles",
  });
  assertStatus("J5 setup: create overflow event", created.res, 201, created.text);
  const eventId = created.json.id as string;

  for (let i = 0; i < 101; i++) {
    const res = await api(organizerJar, "POST", `/api/v1/events/${eventId}/submissions`, {
      title: `Overflow submission ${i}`,
      contact: { email: `overflow.${i}.${Date.now()}@example.com`, firstName: "Overflow", lastName: `Speaker${i}` },
    });
    assertStatus(`J5 setup: create overflow submission ${i}`, res.res, 201, res.text);
  }

  return eventId;
}

// ---------------------------------------------------------------------------
// DEC-175: unauthenticated authz probes
// ---------------------------------------------------------------------------

/** DEC-175: unauthenticated requests must be turned away at the door —
 * /admin redirects to /login, and JSON APIs (including the root-mounted
 * file-serving route) return 401 rather than leaking any data. */
async function runAuthzProbes(): Promise<void> {
  const adminRes = await fetch(`${BASE_URL}/admin`, { redirect: "manual" });
  assertStatus("DEC-175 unauthenticated GET /admin", adminRes, 302, await adminRes.text());

  const contactsRes = await fetch(`${BASE_URL}/api/v1/contacts`);
  assertStatus("DEC-175 unauthenticated GET /api/v1/contacts", contactsRes, 401, await contactsRes.text());

  const plansRes = await fetch(`${BASE_URL}/api/v1/review/plans`);
  assertStatus("DEC-175 unauthenticated GET /api/v1/review/plans", plansRes, 401, await plansRes.text());

  // A known /files/:id — the auth check runs before any file lookup, so an
  // arbitrary (even non-existent) id still exercises the 401 boundary.
  const filesRes = await fetch(`${BASE_URL}/files/seed_file_0001`);
  assertStatus("DEC-175 unauthenticated GET /files/:id", filesRes, 401, await filesRes.text());
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await waitForHealth();

  const fixture: FixtureData = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
  const { email, password } = fixture.identities.organizer;
  const organizerJar = await loginAs(email, password);

  const seededEventsRes = await api(organizerJar, "GET", "/api/v1/events");
  assertStatus("setup: GET /api/v1/events", seededEventsRes.res, 200, seededEventsRes.text);
  const seededEvent = (seededEventsRes.json.items as any[]).find((e) => e.slug === SEEDED_EVENT_SLUG);
  assertTrue("setup: seeded devflow-conf-2027 event exists", Boolean(seededEvent), seededEventsRes.text);

  console.log("Running J1 (launch a CFP)...");
  const { eventId: newEventId } = await runJ1(organizerJar);
  console.log("  ok");

  console.log("Running J2 (public submit + claim) against devflow-conf-2027...");
  await runJ2(seededEvent.id);
  console.log("  ok");

  console.log("Running J3 (triage at volume) against devflow-conf-2027...");
  await runJ3(organizerJar, seededEvent.id);
  console.log("  ok");

  console.log("Seeding the >100-recipient overflow fixture...");
  const capEventId = await seedOverflowEvent(organizerJar);
  console.log("  ok");

  console.log("Running J5 (compose: merge fields, cap, ICS, HTML escaping) against devflow-conf-2027...");
  await runJ5(organizerJar, seededEvent.id, capEventId);
  console.log("  ok");

  void newEventId;

  console.log("Running DEC-175 authz probes (unauthenticated requests)...");
  await runAuthzProbes();
  console.log("  ok");

  console.log("");
  console.log("producer walkthrough OK (J1, J2, J3, J5)");
}

main().catch((err) => {
  if (err instanceof CheckFailure) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
