// CRM + own-your-data persona walkthrough (SPEC §9, jobs J11/J12), per
// DEC-060: standalone runnable, `npx tsx scripts/walkthrough/data.ts --url
// http://localhost:8787`, same conventions as DEC-053 (cookie jar per
// persona, form login carrying the chq_csrf cookie value, 'x-chq-csrf: 1'
// header on JSON mutations, hard exit(1) with a named failing check — fail
// loudly, no soft warnings). Uses the seeded devflow-conf-2027 org
// (organizer/speaker fixture identities) throughout; J11/J12 exercise
// existing org data rather than a throwaway event.
//
// Scripts/ tooling (not src/ pure-core), so node: imports and reading the
// fixture file directly (like scripts/seed.ts does for the same
// credentials) are both fine here.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..");
const FIXTURE_PATH = join(REPO_ROOT, "docs", "fixtures", "sample-data.json");

function argUrl(): string {
  const idx = process.argv.indexOf("--url");
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1]!;
  return process.env.WALKTHROUGH_URL ?? "http://localhost:8787";
}

const BASE_URL = argUrl();

interface FixtureData {
  identities: {
    organizer: { email: string; password: string };
    speaker: { email: string; password: string };
  };
}

const fixture: FixtureData = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));

// ---------------------------------------------------------------------------
// Cookie jar + auth helpers (DEC-053 conventions)
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

async function login(email: string, password: string): Promise<Cookies> {
  const cookies: Cookies = {};

  const getRes = await fetch(`${BASE_URL}/login`);
  if (!getRes.ok) fail(`GET /login failed: ${getRes.status}`);
  parseSetCookies(getRes, cookies);
  if (!cookies.chq_csrf) fail("GET /login did not set a chq_csrf cookie");

  const body = new URLSearchParams({ email, password, chq_csrf: cookies.chq_csrf! });
  const postRes = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(cookies),
    },
    body: body.toString(),
    redirect: "manual",
  });
  if (postRes.status !== 302) fail(`POST /login failed for ${email}: expected 302, got ${postRes.status}`);
  parseSetCookies(postRes, cookies);
  if (!cookies.chq_session) fail(`POST /login did not set a chq_session cookie for ${email}`);

  return cookies;
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
  fail(`${BASE_URL}/health did not become ready within ${timeoutMs}ms`);
}

let currentCheck = "startup";
function fail(message: string): never {
  console.error(`WALKTHROUGH FAILED at [${currentCheck}]: ${message}`);
  process.exit(1);
}

function check(name: string): void {
  currentCheck = name;
  console.log(`-- ${name}`);
}

async function asJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : undefined;
  } catch {
    fail(`response was not valid JSON: ${text.slice(0, 300)}`);
  }
}

function assertStatus(res: Response, expected: number, label: string): void {
  if (res.status !== expected) {
    fail(`${label}: expected ${expected}, got ${res.status}`);
  }
}

// Organizer JSON call helper: cookie session + x-chq-csrf on mutations.
function orgHeaders(cookies: Cookies, mutate: boolean): Record<string, string> {
  const headers: Record<string, string> = { cookie: cookieHeader(cookies), "content-type": "application/json" };
  if (mutate) headers["x-chq-csrf"] = "1";
  return headers;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await waitForHealth();

  check("organizer login");
  const orgCookies = await login(fixture.identities.organizer.email, fixture.identities.organizer.password);

  check("fetch seeded event");
  const eventsRes = await fetch(`${BASE_URL}/api/v1/events`, { headers: orgHeaders(orgCookies, false) });
  assertStatus(eventsRes, 200, "GET /api/v1/events");
  const eventsBody = (await asJson(eventsRes)) as { items: { id: string; name: string }[] };
  const event = eventsBody.items[0];
  if (!event) fail("no seeded events found");
  const eventId = event.id;

  // -------------------------------------------------------------------
  // J11: org-level contact directory / CRM
  // -------------------------------------------------------------------

  check("J11: contact search");
  const searchRes = await fetch(`${BASE_URL}/api/v1/contacts?q=a`, { headers: orgHeaders(orgCookies, false) });
  assertStatus(searchRes, 200, "GET /api/v1/contacts?q=a");
  const searchBody = (await asJson(searchRes)) as { items: unknown[]; total: number };
  if (!Array.isArray(searchBody.items)) fail("contacts search did not return items[]");

  check("J11: create contact + custom field + note");
  const uniqueTag = `wk-${Date.now()}`;
  const createRes = await fetch(`${BASE_URL}/api/v1/contacts`, {
    method: "POST",
    headers: orgHeaders(orgCookies, true),
    body: JSON.stringify({
      firstName: "Walkthrough",
      lastName: uniqueTag,
      email: `${uniqueTag}@example.com`,
      company: `WalkCo-${uniqueTag}`,
    }),
  });
  assertStatus(createRes, 201, "POST /api/v1/contacts");
  const created = (await asJson(createRes)) as { id: string };

  const patchRes = await fetch(`${BASE_URL}/api/v1/contacts/${created.id}`, {
    method: "PATCH",
    headers: orgHeaders(orgCookies, true),
    body: JSON.stringify({
      customFields: { dietary: "vegan" },
      notes: "Met at registration desk; follow up after the CFP closes.",
    }),
  });
  assertStatus(patchRes, 200, "PATCH /api/v1/contacts/:id (custom field + note)");
  const patched = (await asJson(patchRes)) as {
    customFields: Record<string, string> | null;
    notes: string | null;
  };
  if (patched.customFields?.dietary !== "vegan") fail("custom field 'dietary' did not persist");
  if (!patched.notes || !patched.notes.includes("registration desk")) fail("note did not persist");

  check("J11: contact appears in search by unique tag");
  const searchTagRes = await fetch(`${BASE_URL}/api/v1/contacts?q=${encodeURIComponent(uniqueTag)}`, {
    headers: orgHeaders(orgCookies, false),
  });
  assertStatus(searchTagRes, 200, "GET /api/v1/contacts?q=<tag>");
  const searchTagBody = (await asJson(searchTagRes)) as { items: { id: string }[] };
  if (!searchTagBody.items.some((c) => c.id === created.id)) {
    fail("newly created contact did not show up in search results");
  }

  check("J11: CSV import with column mapping");
  const importEmail = `${uniqueTag}-import@example.com`;
  const csvText = `Email Address,First,Last,Employer\n${importEmail},Imported,Contact,ImportCo`;
  const mapping = { "Email Address": "email", First: "firstName", Last: "lastName", Employer: "company" };
  const importRes = await fetch(`${BASE_URL}/api/v1/contacts/import`, {
    method: "POST",
    headers: orgHeaders(orgCookies, true),
    body: JSON.stringify({ csvText, mapping }),
  });
  assertStatus(importRes, 200, "POST /api/v1/contacts/import");
  const importBody = (await asJson(importRes)) as { created: number; updated: number; skipped: unknown[] };
  if (importBody.created !== 1) fail(`CSV import expected created=1, got ${JSON.stringify(importBody)}`);

  const importedListRes = await fetch(`${BASE_URL}/api/v1/contacts?q=${encodeURIComponent(importEmail)}`, {
    headers: orgHeaders(orgCookies, false),
  });
  assertStatus(importedListRes, 200, "GET /api/v1/contacts?q=<imported email>");
  const importedListBody = (await asJson(importedListRes)) as { items: { id: string; email: string }[] };
  const importedContact = importedListBody.items.find((c) => c.email === importEmail);
  if (!importedContact) fail("CSV-imported contact row was not created");

  check("J11: per-contact history (find a seeded contact with submissions + emails)");
  const listRes = await fetch(`${BASE_URL}/api/v1/contacts?perPage=100&sort=recent`, {
    headers: orgHeaders(orgCookies, false),
  });
  assertStatus(listRes, 200, "GET /api/v1/contacts?perPage=100");
  const listBody = (await asJson(listRes)) as { items: { id: string }[] };

  let historyContactId: string | null = null;
  let historyPayload: { history: { submissions: unknown[]; emails: unknown[]; events: string[] } } | null = null;
  for (const c of listBody.items) {
    const detailRes = await fetch(`${BASE_URL}/api/v1/contacts/${c.id}`, { headers: orgHeaders(orgCookies, false) });
    assertStatus(detailRes, 200, `GET /api/v1/contacts/${c.id}`);
    const detail = (await asJson(detailRes)) as {
      history: { submissions: unknown[]; emails: unknown[]; events: string[] };
    };
    if (detail.history.submissions.length > 0 && detail.history.emails.length > 0) {
      historyContactId = c.id;
      historyPayload = detail;
      break;
    }
  }
  if (!historyContactId || !historyPayload) {
    fail("no seeded contact with both submission and email history was found (checked up to 100 contacts)");
  }
  if (historyPayload.history.events.length === 0) fail("contact history events[] was unexpectedly empty");

  check("J11: duplicate merge combines two contacts without losing history");
  const dupSourceId = historyContactId!;
  const dupSourceEmailRes = await fetch(`${BASE_URL}/api/v1/contacts/${dupSourceId}`, { headers: orgHeaders(orgCookies, false) });
  assertStatus(dupSourceEmailRes, 200, "GET /api/v1/contacts/:id (dup source)");
  const dupSource = (await asJson(dupSourceEmailRes)) as { email: string; firstName: string; lastName: string };

  const dupCreateRes = await fetch(`${BASE_URL}/api/v1/contacts`, {
    method: "POST",
    headers: orgHeaders(orgCookies, true),
    body: JSON.stringify({
      firstName: dupSource.firstName,
      lastName: dupSource.lastName,
      email: dupSource.email,
    }),
  });
  assertStatus(dupCreateRes, 201, "POST /api/v1/contacts (duplicate email)");
  const dupNewContact = (await asJson(dupCreateRes)) as { id: string };

  const duplicatesRes = await fetch(`${BASE_URL}/api/v1/contacts/duplicates`, { headers: orgHeaders(orgCookies, false) });
  assertStatus(duplicatesRes, 200, "GET /api/v1/contacts/duplicates");
  const duplicatesBody = (await asJson(duplicatesRes)) as { items: { contactIds: string[] }[] };
  const group = duplicatesBody.items.find((g) => g.contactIds.includes(dupSourceId) && g.contactIds.includes(dupNewContact.id));
  if (!group) fail("newly created duplicate did not appear in /contacts/duplicates");

  // Merge the (history-empty) new contact as the keeper, folding the
  // history-bearing seeded contact into it — this proves the repoint
  // actually moves submissions/emails rather than the merge being a no-op
  // because the keeper already had the data.
  const mergeRes = await fetch(`${BASE_URL}/api/v1/contacts/merge`, {
    method: "POST",
    headers: orgHeaders(orgCookies, true),
    body: JSON.stringify({ keepId: dupNewContact.id, mergeId: dupSourceId }),
  });
  assertStatus(mergeRes, 200, "POST /api/v1/contacts/merge");

  const mergedDetailRes = await fetch(`${BASE_URL}/api/v1/contacts/${dupNewContact.id}`, { headers: orgHeaders(orgCookies, false) });
  assertStatus(mergedDetailRes, 200, "GET /api/v1/contacts/:id (post-merge)");
  const mergedDetail = (await asJson(mergedDetailRes)) as {
    history: { submissions: unknown[]; emails: unknown[] };
  };
  if (mergedDetail.history.submissions.length === 0) fail("merge lost submission history");
  if (mergedDetail.history.emails.length === 0) fail("merge lost email history");

  const mergedGoneRes = await fetch(`${BASE_URL}/api/v1/contacts/${dupSourceId}`, { headers: orgHeaders(orgCookies, false) });
  assertStatus(mergedGoneRes, 404, "GET /api/v1/contacts/:id (merged-away id should 404)");

  check("J11: create segment + filter by it");
  const segmentValue = `WalkCo-${uniqueTag}`;
  const segCreateRes = await fetch(`${BASE_URL}/api/v1/segments`, {
    method: "POST",
    headers: orgHeaders(orgCookies, true),
    body: JSON.stringify({ name: `wk-segment-${uniqueTag}`, rules: [{ field: "company", op: "eq", value: segmentValue }] }),
  });
  assertStatus(segCreateRes, 201, "POST /api/v1/segments");
  const segment = (await asJson(segCreateRes)) as { id: string };

  const segFilterRes = await fetch(`${BASE_URL}/api/v1/contacts?segmentId=${segment.id}`, { headers: orgHeaders(orgCookies, false) });
  assertStatus(segFilterRes, 200, "GET /api/v1/contacts?segmentId=...");
  const segFilterBody = (await asJson(segFilterRes)) as { items: { id: string }[] };
  if (!segFilterBody.items.some((c) => c.id === created.id)) {
    fail("segment filter did not return the matching contact");
  }
  const segmentContactIds = segFilterBody.items.map((c) => c.id);

  check("J11: bulk-email the segment (logged to email_log with per-recipient rows)");
  const bulkSubject = `Walkthrough bulk email ${uniqueTag}`;
  const bulkRes = await fetch(`${BASE_URL}/api/v1/contacts/bulk-email`, {
    method: "POST",
    headers: orgHeaders(orgCookies, true),
    body: JSON.stringify({
      contactIds: segmentContactIds,
      eventId,
      subject: bulkSubject,
      bodyText: "Hello {speaker_name}, this is a walkthrough test for {event_name}. Portal: {portal_link}",
    }),
  });
  assertStatus(bulkRes, 200, "POST /api/v1/contacts/bulk-email");
  const bulkBody = (await asJson(bulkRes)) as { sent: number };
  if (bulkBody.sent !== segmentContactIds.length) fail(`bulk-email sent count mismatch: ${JSON.stringify(bulkBody)}`);

  const emailLogRes = await fetch(`${BASE_URL}/api/v1/events/${eventId}/email-log?q=${encodeURIComponent(bulkSubject)}`, {
    headers: orgHeaders(orgCookies, false),
  });
  assertStatus(emailLogRes, 200, "GET /api/v1/events/:eventId/email-log?q=<subject>");
  const emailLogBody = (await asJson(emailLogRes)) as { items: { subject: string }[]; total: number };
  if (emailLogBody.total < segmentContactIds.length) {
    fail(`expected at least ${segmentContactIds.length} per-recipient email_log rows, got ${emailLogBody.total}`);
  }

  check("J11: bulk-email cap (>100 recipients rejects)");
  const overCapIds = Array.from({ length: 101 }, (_, i) => `not-a-real-id-${i}`);
  const overCapRes = await fetch(`${BASE_URL}/api/v1/contacts/bulk-email`, {
    method: "POST",
    headers: orgHeaders(orgCookies, true),
    body: JSON.stringify({ contactIds: overCapIds, eventId, subject: "cap test", bodyText: "cap test body" }),
  });
  assertStatus(overCapRes, 400, "POST /api/v1/contacts/bulk-email (101 recipients)");

  check("J11: dashboard stats (returning speakers, top companies)");
  const statsRes = await fetch(`${BASE_URL}/api/v1/contacts/stats`, { headers: orgHeaders(orgCookies, false) });
  assertStatus(statsRes, 200, "GET /api/v1/contacts/stats");
  const stats = (await asJson(statsRes)) as { returningSpeakers: number; topCompanies: { company: string; count: number }[] };
  if (typeof stats.returningSpeakers !== "number") fail("stats.returningSpeakers missing/not a number");
  if (!Array.isArray(stats.topCompanies)) fail("stats.topCompanies missing/not an array");

  // -------------------------------------------------------------------
  // J12: own-your-data — bearer tokens, exports, docs
  // -------------------------------------------------------------------

  check("J12: mint bearer token (cookie + CSRF)");
  const mintRes = await fetch(`${BASE_URL}/api/v1/tokens`, {
    method: "POST",
    headers: orgHeaders(orgCookies, true),
    body: JSON.stringify({ name: `wk-token-${uniqueTag}` }),
  });
  assertStatus(mintRes, 201, "POST /api/v1/tokens");
  const minted = (await asJson(mintRes)) as { token: string };
  if (!minted.token.startsWith("chq_")) fail(`minted token has unexpected shape: ${minted.token.slice(0, 8)}...`);

  const tokenListRes = await fetch(`${BASE_URL}/api/v1/tokens`, { headers: orgHeaders(orgCookies, false) });
  assertStatus(tokenListRes, 200, "GET /api/v1/tokens");
  const tokenList = (await asJson(tokenListRes)) as { items: { id: string; name: string }[] };
  const tokenRow = tokenList.items.find((t) => t.name === `wk-token-${uniqueTag}`);
  if (!tokenRow) fail("minted token did not show up in GET /api/v1/tokens");

  check("J12: bearer token works cookie-less on GET /api/v1/events");
  const bearerHeaders = { authorization: `Bearer ${minted.token}` };
  const bearerEventsRes = await fetch(`${BASE_URL}/api/v1/events`, { headers: bearerHeaders });
  assertStatus(bearerEventsRes, 200, "GET /api/v1/events (bearer, no cookie)");

  check("J12: bearer token works cookie-less on GET /api/v1/events/:eventId/submissions");
  const bearerSubsRes = await fetch(`${BASE_URL}/api/v1/events/${eventId}/submissions`, { headers: bearerHeaders });
  assertStatus(bearerSubsRes, 200, "GET /api/v1/events/:eventId/submissions (bearer, no cookie)");

  check("J12: revoked token gets 401");
  const revokeRes = await fetch(`${BASE_URL}/api/v1/tokens/${tokenRow.id}`, {
    method: "DELETE",
    headers: orgHeaders(orgCookies, true),
  });
  assertStatus(revokeRes, 200, "DELETE /api/v1/tokens/:id");
  const revokedUseRes = await fetch(`${BASE_URL}/api/v1/events`, { headers: bearerHeaders });
  assertStatus(revokedUseRes, 401, "GET /api/v1/events (revoked bearer token)");

  check("J12: speaker-role session hitting an organizer endpoint gets 403");
  const speakerCookies = await login(fixture.identities.speaker.email, fixture.identities.speaker.password);
  const speakerHitsOrganizerRes = await fetch(`${BASE_URL}/api/v1/contacts`, { headers: orgHeaders(speakerCookies, false) });
  assertStatus(speakerHitsOrganizerRes, 403, "GET /api/v1/contacts (speaker session)");

  check("J12: exports (csv + json, non-empty) for each kind");
  const exportKinds = ["submissions", "speakers", "evaluations", "agenda", "email-log"] as const;
  for (const kind of exportKinds) {
    for (const format of ["csv", "json"] as const) {
      const res = await fetch(`${BASE_URL}/api/v1/events/${eventId}/export/${kind}?format=${format}`, {
        headers: orgHeaders(orgCookies, false),
      });
      assertStatus(res, 200, `GET export/${kind}?format=${format}`);
      const disposition = res.headers.get("content-disposition") ?? "";
      if (!disposition.toLowerCase().includes("attachment")) {
        fail(`export/${kind}?format=${format} missing attachment Content-Disposition (got '${disposition}')`);
      }
      if (format === "json") {
        const body = (await asJson(res)) as unknown[];
        if (!Array.isArray(body) || body.length === 0) {
          fail(`export/${kind}?format=json returned empty/non-array data on the seeded event`);
        }
      } else {
        const text = await res.text();
        const lines = text.trim().split("\n");
        if (lines.length < 2) {
          fail(`export/${kind}?format=csv had no data rows beyond the header (${lines.length} line(s))`);
        }
      }
    }
  }

  check("J12: showflow.csv fixed columns");
  const showflowRes = await fetch(`${BASE_URL}/api/v1/events/${eventId}/exports/showflow.csv`, {
    headers: orgHeaders(orgCookies, false),
  });
  assertStatus(showflowRes, 200, "GET .../exports/showflow.csv");
  const showflowText = await showflowRes.text();
  const showflowHeaderLine = showflowText.split("\n")[0]?.trim() ?? "";
  const expectedShowflowHeader = "ref,title,description,day,start,end,room,tracks,speakers,deck_file,deck_url";
  if (showflowHeaderLine !== expectedShowflowHeader) {
    fail(`showflow.csv header mismatch:\n  expected: ${expectedShowflowHeader}\n  actual:   ${showflowHeaderLine}`);
  }

  check("J12: export of another org's event 404s");
  // No second seeded org exists in the fixture data to obtain a genuine
  // cross-org eventId (the seed script creates exactly one org) — this
  // exercises the same requireOwnedEvent 'not found' branch via a
  // nonexistent id, which is the reachable half of the ownership check
  // without seed changes. Flagged for the scribe/planner: a true
  // cross-org fixture would strengthen this check.
  const foreignEventId = "00000000-0000-0000-0000-000000000000";
  const foreignExportRes = await fetch(`${BASE_URL}/api/v1/events/${foreignEventId}/export/submissions`, {
    headers: orgHeaders(orgCookies, false),
  });
  assertStatus(foreignExportRes, 404, "GET export/submissions for a foreign/nonexistent eventId");
  const foreignShowflowRes = await fetch(`${BASE_URL}/api/v1/events/${foreignEventId}/exports/showflow.csv`, {
    headers: orgHeaders(orgCookies, false),
  });
  assertStatus(foreignShowflowRes, 404, "GET showflow.csv for a foreign/nonexistent eventId");

  check("J12: GET /docs/api returns 200");
  const docsRes = await fetch(`${BASE_URL}/docs/api`);
  assertStatus(docsRes, 200, "GET /docs/api");
  const docsHtml = await docsRes.text();
  for (const mustContain of [
    "/api/v1/events/:eventId/exports/showflow.csv",
    "/api/v1/users",
    "/api/v1/tokens",
    "/api/v1/contacts",
  ]) {
    if (!docsHtml.includes(mustContain)) {
      fail(`/docs/api is missing documentation for '${mustContain}'`);
    }
  }

  console.log("");
  console.log("walkthrough:data OK — J11/J12 checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
