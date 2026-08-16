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
import { agendaHtmlContainsBreakLabel, breaksListContainsId, buildCreateBreakBody, dayLabelMs } from "../walkthrough-lib";

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

/** Poll /dev/mailbox until `needle` appears in the listing (mail sends are
 * best-effort side effects that can land via waitUntil a beat AFTER the
 * confirming response) — retries for up to ~6s before returning the last
 * body, so the caller's assertion still fails loudly with real content. */
async function pollMailboxFor(jar: CookieJar | null, needle: string): Promise<{ res: Response; body: string }> {
  let res!: Response;
  let body = "";
  for (let attempt = 0; attempt < 12; attempt++) {
    res = jar ? await jarFetch(jar, `${BASE_URL}/dev/mailbox`) : await fetch(`${BASE_URL}/dev/mailbox`);
    body = await res.text();
    if (res.status === 200 && body.includes(needle)) return { res, body };
    await new Promise((r) => setTimeout(r, 500));
  }
  return { res, body };
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

  // Tracks + closeDate, openDate in the future (not yet open). DEC-522:
  // whole-day offsets via dayLabelMs so the label is unambiguous across the
  // full IANA timezone offset range.
  const openDate = dayLabelMs(2); // +2 days
  const closeDate = dayLabelMs(30); // +30 days
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
    !rejectedBody.includes("Submission received"),
    "the not-yet-open POST must not have created a submission",
  );

  // Open the window (openDate now in the past) — submission should work.
  // DEC-522: whole-day offset via dayLabelMs (see openDate/closeDate above).
  const patchOpen = await api(organizerJar, "PATCH", `/api/v1/forms/${formId}`, {
    openDate: dayLabelMs(-2),
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
  // The public form renders ONE Name control (speaker_name); the POST
  // handler splits it back into the locked first_name/last_name answers.
  submitForm.set("speaker_name", "Priya Narayan");
  submitForm.set("field__email", `priya.narayan.${Date.now()}@example.com`);
  submitForm.set("trackIds", trackIds[0]!);
  const fileBlob = new Blob(["outline contents"], { type: "text/plain" });
  submitForm.set(`field__${fileField.json.id}`, fileBlob, "outline.txt");

  // The default form template evolves (it grew a required Name field and an
  // Audience-level dropdown after this fixture was hand-enumerated) — re-read
  // the form and fill, by kind, every required field the explicit sets above
  // missed, so template growth can never silently stale this fixture again.
  const finalFormRes = await api(organizerJar, "GET", `/api/v1/events/${eventId}/forms`);
  assertStatus("J1 re-GET form before the happy-path submit", finalFormRes.res, 200, finalFormRes.text);
  const templateFields = (finalFormRes.json.fields ?? []) as {
    id: string;
    kind: string;
    required: boolean;
    options?: string[];
  }[];
  for (const f of templateFields) {
    const key = `field__${f.id}`;
    if (!f.required || submitForm.has(key)) continue;
    // first_name/last_name never render as their own inputs — the single
    // speaker_name control above covers them via the handler's name split.
    if (/(^|:)(first_name|last_name)$/.test(f.id)) continue;
    if (f.kind === "dropdown") submitForm.set(key, f.options?.[0] ?? "");
    else if (f.kind === "checkbox") submitForm.set(key, "on");
    else if (f.kind === "number") submitForm.set(key, "3");
    else submitForm.set(key, "Walkthrough fixture value");
  }

  const submitRes = await jarFetch(openJar, `${BASE_URL}/submit/${slug}`, { method: "POST", body: submitForm });
  const submitBody = await submitRes.text();
  assertStatus("J1 POST /submit (open, valid)", submitRes, 200, submitBody);
  assertTrue(
    "J1 valid submission confirms",
    submitBody.includes("Submission received"),
    submitBody.slice(0, 400),
  );

  return { eventId, slug };
}

// ---------------------------------------------------------------------------
// J2: submit to the seeded event, draft, validation, confirmation + claim
// ---------------------------------------------------------------------------

async function runJ2(organizerJar: CookieJar, seededEventId: string): Promise<void> {
  const jar = new CookieJar();
  const getRes = await jarFetch(jar, `${BASE_URL}/submit/${SEEDED_EVENT_SLUG}`);
  const getBody = await getRes.text();
  assertStatus("J2 GET /submit/devflow-conf-2027", getRes, 200, getBody);
  assertTrue("J2 submit page shows event branding/name", getBody.includes("DevFlow Conf"), getBody.slice(0, 300));
  assertTrue(
    "J2 submit page shows a deadline",
    /\bcloses\b/i.test(getBody),
    "expected a 'Call for papers · closes ...' deadline line",
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
  missingForm.set("speaker_name", "Morgan Lee");
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
    !missingBody.includes("Submission received"),
    "an invalid submission must not confirm",
  );

  // Full submit -> confirmation + claim link.
  const uniqueEmail = `walkthrough.speaker.${Date.now()}@example.com`;
  const fullForm = new FormData();
  fullForm.set("chq_csrf", csrf!);
  fullForm.set("field__title", "Observability for Platform Teams");
  fullForm.set("field__description", "How we instrumented a fleet of internal platform services.");
  fullForm.set("speaker_name", "Morgan Lee");
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
  // Dropdown-kind fields render as RADIO GROUPS on the public form (the
  // single-track radio idiom, DEC-489 family) — fill each group's first
  // value too, where the select scan above found nothing.
  for (const match of getBody.matchAll(/<input type="radio" name="(field__field_[a-zA-Z0-9_]+)"[^>]*value="([^"]+)"/g)) {
    const [, name, value] = match;
    if (name && value && !fullForm.has(name)) fullForm.set(name, value);
  }
  const trackMatch = getBody.match(/name="trackIds" value="([^"]+)"/);
  if (trackMatch) fullForm.set("trackIds", trackMatch[1]!);

  const fullRes = await jarFetch(jar, `${BASE_URL}/submit/${SEEDED_EVENT_SLUG}`, { method: "POST", body: fullForm });
  const fullBody = await fullRes.text();
  assertStatus("J2 POST /submit full", fullRes, 200, fullBody);
  assertTrue(
    "J2 full submission confirms",
    fullBody.includes("Submission received"),
    fullBody.slice(0, 400),
  );
  const claimMatch = fullBody.match(/href="([^"]*\/claim\/[^"]+)"/);
  assertTrue("J2 confirmation page has a claim link", Boolean(claimMatch), fullBody.slice(0, 800));
  const claimUrl = resolveScrapedHref(claimMatch![1]!, BASE_URL);

  // Confirmation email appears in /dev/mailbox with the claim link (polled:
  // the send is a waitUntil side effect and can land just after the page;
  // the mailbox is organizer-authenticated per DEC-546, so the organizer
  // jar rides along — an unauthenticated fetch silently follows the 302 to
  // /login and "finds" nothing).
  const { res: mailboxRes, body: mailboxBody } = await pollMailboxFor(organizerJar, uniqueEmail);
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

  // -------------------------------------------------------------------
  // Password reset round trip (DEC-994), run on THIS throwaway account
  // only — never a seeded persona, whose README "For evaluators"
  // credentials are a published contract. Placed after every other use
  // of claimJar above, because completing a reset revokes ALL sessions
  // for the account (DEC-994), including the claim session just proven.
  // -------------------------------------------------------------------

  const forgotJar = new CookieJar();
  const forgotGetRes = await jarFetch(forgotJar, `${BASE_URL}/forgot`);
  const forgotGetBody = await forgotGetRes.text();
  assertStatus("J2 GET /forgot", forgotGetRes, 200, forgotGetBody);
  const forgotCsrf = forgotJar.get("chq_csrf");
  assertTrue("J2 GET /forgot sets chq_csrf cookie", Boolean(forgotCsrf), "no chq_csrf cookie");

  const forgotForm = new FormData();
  forgotForm.set("chq_csrf", forgotCsrf!);
  forgotForm.set("email", uniqueEmail);
  const forgotPostRes = await jarFetch(forgotJar, `${BASE_URL}/forgot`, { method: "POST", body: forgotForm });
  const forgotPostBody = await forgotPostRes.text();
  assertStatus("J2 POST /forgot", forgotPostRes, 200, forgotPostBody);
  assertTrue(
    "J2 POST /forgot carries the enumeration-safe sent copy",
    forgotPostBody.includes("If that address has an account, a reset link is on its way."),
    forgotPostBody.slice(0, 400),
  );

  // Mailbox listing (organizer-authenticated per DEC-546) carries a row for
  // the reset email addressed to the throwaway account; scrape its detail
  // link the same way the confirmation email's mailbox row was found above.
  const { res: resetMailboxRes, body: resetMailboxBody } = await pollMailboxFor(organizerJar, "Set a new password");
  assertStatus("J2 GET /dev/mailbox (reset email)", resetMailboxRes, 200, resetMailboxBody);
  assertTrue(
    "J2 dev mailbox lists the reset email",
    resetMailboxBody.includes(uniqueEmail),
    "expected the throwaway account's email in the mailbox listing",
  );
  const resetRow = (resetMailboxBody.match(/<tr>[\s\S]*?<\/tr>/g) ?? []).find(
    (block) => block.includes(uniqueEmail) && block.includes("Set a new password"),
  );
  assertTrue(
    "J2 dev mailbox listing has a row for the reset email",
    Boolean(resetRow),
    "expected a mailbox row addressed to the throwaway account with subject 'Set a new password'",
  );
  const resetRowHrefMatch = resetRow!.match(/href="([^"]+)"/);
  assertTrue("J2 reset email row has a detail link", Boolean(resetRowHrefMatch), resetRow!);
  const resetDetailUrl = resolveScrapedHref(resetRowHrefMatch![1]!, BASE_URL);

  // DEC-543: the list projection excludes bodies — open the detail view to
  // scrape the /reset/<token> link out of the rendered email body.
  const resetDetailRes = await jarFetch(organizerJar, resetDetailUrl);
  const resetDetailBody = await resetDetailRes.text();
  assertStatus("J2 GET /dev/mailbox/:id (reset email detail)", resetDetailRes, 200, resetDetailBody);
  const resetLinkMatch = resetDetailBody.match(/https?:\/\/[^\s"<]+\/reset\/[A-Za-z0-9_-]+/);
  assertTrue("J2 reset email detail contains a reset link", Boolean(resetLinkMatch), resetDetailBody.slice(0, 800));
  const resetUrl = resolveScrapedHref(resetLinkMatch![0]!, BASE_URL);

  const resetPageJar = new CookieJar();
  const resetGetRes = await jarFetch(resetPageJar, resetUrl);
  const resetGetBody = await resetGetRes.text();
  assertStatus("J2 GET reset link", resetGetRes, 200, resetGetBody);
  assertTrue(
    "J2 reset page names the throwaway account's email",
    resetGetBody.includes(uniqueEmail),
    resetGetBody.slice(0, 400),
  );
  const resetCsrf = resetPageJar.get("chq_csrf");
  assertTrue("J2 reset page sets chq_csrf cookie", Boolean(resetCsrf), "no chq_csrf cookie");

  const NEW_PASSWORD = "WalkthroughReset!2027";
  const resetForm = new FormData();
  resetForm.set("chq_csrf", resetCsrf!);
  resetForm.set("next", NEW_PASSWORD);
  resetForm.set("confirm", NEW_PASSWORD);
  const resetPostRes = await jarFetch(resetPageJar, resetUrl, { method: "POST", body: resetForm });
  const resetPostBody = await resetPostRes.text();
  assertStatus("J2 POST reset (sets new password)", resetPostRes, 302, resetPostBody);
  const resetLocation = resetPostRes.headers.get("location") ?? "";
  assertTrue(
    "J2 POST reset redirects to /login?password-reset=1",
    resetLocation.includes("/login?password-reset=1"),
    `Location: ${resetLocation}`,
  );

  // Replaying the same (now-consumed) token must 410, never re-run the
  // change or reveal whether the token was ever valid.
  const replayForm = new FormData();
  replayForm.set("chq_csrf", resetCsrf!);
  replayForm.set("next", "SecondAttemptPassword!2027");
  replayForm.set("confirm", "SecondAttemptPassword!2027");
  const replayRes = await jarFetch(resetPageJar, resetUrl, { method: "POST", body: replayForm });
  assertStatus("J2 second POST of consumed reset token", replayRes, 410, await replayRes.text());

  // DEC-994: completing the reset revoked every session for this user,
  // including the claim session established above.
  const staleClaimPortalRes = await jarFetch(claimJar, `${BASE_URL}/portal`);
  assertTrue(
    "J2 pre-reset claim session no longer authenticates after reset revokes all sessions",
    staleClaimPortalRes.status !== 200,
    `expected a non-200 status, got ${staleClaimPortalRes.status}`,
  );

  // A fresh sign-in with the new password reaches the portal.
  const postResetJar = await loginAs(uniqueEmail, NEW_PASSWORD);
  const postResetPortalRes = await jarFetch(postResetJar, `${BASE_URL}/portal`);
  assertStatus("J2 GET /portal after password-reset login", postResetPortalRes, 200, await postResetPortalRes.text());

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

async function runJ5(organizerJar: CookieJar, eventId: string, eventStartDate: string, capEventId: string): Promise<void> {
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

  // DEC-682 (wave-44 amendment): includeFeedback now requires a
  // feedbackPlanId naming exactly which plan+round's comments to attach —
  // create a plan on this job's own eventId (mirroring review.ts's plan
  // creation body shape) so the preview call below has one to point at.
  const feedbackPlanRes = await api(organizerJar, "POST", `/api/v1/events/${eventId}/plans`, {
    name: "Walkthrough J5 compose feedback plan",
    instructions: "Score each proposal so J5 has feedback to attach to compose previews.",
    openDate: dayLabelMs(-1),
    closeDate: dayLabelMs(30),
    filters: {},
    anonymized: true,
    scale: { min: 1, max: 5 },
    criteria: [{ id: "content_quality", label: "Content quality", kind: "rating", weight: 1 }],
  });
  assertStatus("J5 POST create feedback plan", feedbackPlanRes.res, 201, feedbackPlanRes.text);
  const feedbackPlanId = feedbackPlanRes.json.id as string;

  const previewRes = await api(organizerJar, "POST", `/api/v1/events/${eventId}/compose/preview`, {
    templateId,
    submissionIds,
    includeFeedback: true,
    feedbackPlanId,
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
    day: eventStartDate,
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
  const sentLogListItem = (sentLogRes.json.items as any[])[0];
  assertTrue("J5 email-log list has a matching row", Boolean(sentLogListItem?.id), JSON.stringify(sentLogListItem));
  // DEC-543: the LIST row is a narrow projection (id/eventName/toEmail/
  // subject/status/sentAt only) — icsText lives on the per-recipient DETAIL
  // route (GET .../email-log/:emailId), not the list.
  const sentLogDetailRes = await api(organizerJar, "GET", `/api/v1/events/${eventId}/email-log/${sentLogListItem.id}`);
  assertStatus("J5 GET email-log detail for the sent ICS message", sentLogDetailRes.res, 200, sentLogDetailRes.text);
  const sentLogItem = sentLogDetailRes.json;
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
  const dangerousListItem = (dangerousLog.json.items as any[])[0];
  assertTrue("J5 dangerous-title email_log row found", Boolean(dangerousListItem), dangerousLog.text);
  // DEC-543: bodyHtml is excluded from the LIST projection — fetch the
  // per-recipient DETAIL route to read it.
  const dangerousDetailRes = await api(organizerJar, "GET", `/api/v1/events/${eventId}/email-log/${dangerousListItem.id}`);
  assertStatus("J5 GET email-log detail for dangerous-title send", dangerousDetailRes.res, 200, dangerousDetailRes.text);
  const dangerousItem = dangerousDetailRes.json;
  assertTrue(
    "J5 body_html entity-escapes the injected markup",
    dangerousItem.bodyHtml.includes("&lt;img src=x&gt;") && !dangerousItem.bodyHtml.includes("<img src=x>"),
    dangerousItem.bodyHtml,
  );
}

// ---------------------------------------------------------------------------
// J9: break lifecycle end to end (DEC-063 amendment, wave 66) — create,
// list, render on the public agenda for an anonymous visitor, delete, and
// confirm it's gone. Walks the full lifecycle rather than just the API,
// because wave 63 shipped the API + public renderer with no way in and
// nothing caught it — no persona ever created a break and went looking.
// ---------------------------------------------------------------------------

async function runJ9(organizerJar: CookieJar, eventId: string, eventStartDate: string, eventEndDate: string): Promise<void> {
  // A label that cannot collide with the seeded 'Coffee break'/'Lunch' rows.
  const label = `Walkthrough Break ${Date.now()}`;

  // (a) create.
  const createRes = await api(
    organizerJar,
    "POST",
    `/api/v1/events/${eventId}/breaks`,
    buildCreateBreakBody(eventStartDate, label, 600, 20),
  );
  assertStatus("J9 POST /breaks", createRes.res, 201, createRes.text);
  const breakId = createRes.json.id as string;
  assertTrue("J9 created break has an id", Boolean(breakId), createRes.text);

  // (b) list, filtered to that day, contains it.
  const listRes = await api(organizerJar, "GET", `/api/v1/events/${eventId}/breaks?day=${eventStartDate}`);
  assertStatus("J9 GET /breaks?day=", listRes.res, 200, listRes.text);
  assertTrue(
    "J9 breaks list contains the created break",
    breaksListContainsId(listRes.json.items as { id: string }[], breakId),
    listRes.text,
  );

  // (c) an anonymous visitor (no cookies at all — a bare fetch, not the
  // jarFetch/CookieJar machinery the rest of this file uses for logged-in
  // personas) sees the break's LABEL TEXT on the public agenda. Assert on
  // label text only — never on a CSS class, element order, or DOM
  // structure (wave 64-b is rewriting this page's markup underneath us).
  const anonRes1 = await fetch(`${BASE_URL}/e/${SEEDED_EVENT_SLUG}/agenda?day=${eventStartDate}`);
  const anonBody1 = await anonRes1.text();
  assertStatus("J9 anonymous GET /e/.../agenda (break present)", anonRes1, 200, anonBody1);
  assertTrue(
    "J9 anonymous agenda page shows the break's label text",
    agendaHtmlContainsBreakLabel(anonBody1, label),
    anonBody1.slice(0, 2000),
  );

  // (e2) refusal leg: a day outside the event's date range 400s with
  // fields.day set (src/routes/api/breaks.ts:103-107).
  const outsideDay = "1999-01-01";
  const rejectedRes = await api(
    organizerJar,
    "POST",
    `/api/v1/events/${eventId}/breaks`,
    buildCreateBreakBody(outsideDay, `${label} (should be rejected)`),
  );
  assertStatus("J9 POST /breaks with day outside event range", rejectedRes.res, 400, rejectedRes.text);
  assertTrue(
    "J9 out-of-range day rejection sets fields.day",
    typeof rejectedRes.json?.error?.fields?.day === "string",
    rejectedRes.text,
  );
  void eventEndDate; // reserved: eventStartDate alone is already outside 1999-01-01's range

  // (d) delete.
  const deleteRes = await api(organizerJar, "DELETE", `/api/v1/breaks/${breakId}`);
  assertStatus("J9 DELETE /breaks/:id", deleteRes.res, 200, deleteRes.text);

  // (e) the same anonymous fetch again — the label is gone, and the seed
  // is left unchanged.
  const anonRes2 = await fetch(`${BASE_URL}/e/${SEEDED_EVENT_SLUG}/agenda?day=${eventStartDate}`);
  const anonBody2 = await anonRes2.text();
  assertStatus("J9 anonymous GET /e/.../agenda (break removed)", anonRes2, 200, anonBody2);
  assertTrue(
    "J9 anonymous agenda page no longer shows the break's label text",
    !agendaHtmlContainsBreakLabel(anonBody2, label),
    anonBody2.slice(0, 2000),
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
 * file-serving route) return 401 rather than leaking any data.
 *
 * DEC-268 (wave 49): immediately after confirming the door is shut for an
 * anonymous caller, confirm it actually opens for an authenticated one — the
 * two server-booting CI jobs (perf-smoke, walkthrough) now build the admin
 * SPA bundle first, and this assertion is what proves that bundle is really
 * served (status, content-type, and the built shell's `id="root"` mount
 * node from app/index.html) rather than throwing root.tsx's "Admin SPA
 * bundle missing" internal error. */
async function runAuthzProbes(organizerJar: CookieJar): Promise<void> {
  const adminRes = await fetch(`${BASE_URL}/admin`, { redirect: "manual" });
  assertStatus("DEC-175 unauthenticated GET /admin", adminRes, 302, await adminRes.text());

  const adminAuthedRes = await jarFetch(organizerJar, `${BASE_URL}/admin`);
  const adminAuthedBody = await adminAuthedRes.text();
  assertStatus("DEC-268 authenticated GET /admin", adminAuthedRes, 200, adminAuthedBody);
  const adminContentType = adminAuthedRes.headers.get("content-type") ?? "";
  assertTrue(
    "DEC-268 authenticated GET /admin is text/html",
    adminContentType.includes("text/html"),
    `content-type was "${adminContentType}"`,
  );
  assertTrue(
    "DEC-268 authenticated GET /admin serves the built SPA shell",
    adminAuthedBody.includes('id="root"'),
    adminAuthedBody,
  );

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
  await runJ2(organizerJar, seededEvent.id);
  console.log("  ok");

  console.log("Running J3 (triage at volume) against devflow-conf-2027...");
  await runJ3(organizerJar, seededEvent.id);
  console.log("  ok");

  console.log("Seeding the >100-recipient overflow fixture...");
  const capEventId = await seedOverflowEvent(organizerJar);
  console.log("  ok");

  console.log("Running J5 (compose: merge fields, cap, ICS, HTML escaping) against devflow-conf-2027...");
  await runJ5(organizerJar, seededEvent.id, seededEvent.startDate, capEventId);
  console.log("  ok");

  console.log("Running J9 (break lifecycle: create -> list -> public agenda -> delete) against devflow-conf-2027...");
  await runJ9(organizerJar, seededEvent.id, seededEvent.startDate, seededEvent.endDate);
  console.log("  ok");

  void newEventId;

  console.log("Running DEC-175 authz probes (unauthenticated requests) + DEC-268 admin SPA render...");
  await runAuthzProbes(organizerJar);
  console.log("  ok");

  console.log("");
  console.log("producer walkthrough OK (J1, J2, J3, J5, J9)");
}

main().catch((err) => {
  if (err instanceof CheckFailure) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
