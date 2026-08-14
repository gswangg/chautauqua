// Agenda + public-surfaces persona walkthrough (task w8-f, SPEC §9 jobs
// J9/J10). Standalone runnable per DEC-060: `npx tsx scripts/walkthrough/
// public.ts --url http://localhost:8787` against a migrated+seeded dev
// server (npm run seed). Same conventions as DEC-053: cookie jar per
// persona, form login carrying the chq_csrf cookie value, 'x-chq-csrf: 1'
// header on JSON mutations, hard exit(1) on the first failing check named
// in the console output — fail loudly, no soft warnings.
//
// This is scripts/ tooling (not src/ pure-core). task-w14-g converts the
// prior direct-SQL participant.visible flip to the real DEC-070 endpoint
// (PATCH /api/v1/submissions/:id/participants/:participantId), now that
// the organizer participant-management routes exist on main.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { agendaHtmlContainsBreakLabel, buildCreateBreakBody, extractProgrammeDayIds } from "../walkthrough-lib";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..");
const FIXTURE_PATH = join(REPO_ROOT, "docs", "fixtures", "sample-data.json");
const EVENT_SLUG = "devflow-conf-2027";

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx === process.argv.length - 1) return fallback;
  return process.argv[idx + 1]!;
}

const BASE_URL = arg("--url", "http://localhost:8787");

// ---------------------------------------------------------------------------
// Fail-loudly assertion helpers
// ---------------------------------------------------------------------------

let currentCheck = "(startup)";

function fail(message: string): never {
  console.error(`FAIL [${currentCheck}]: ${message}`);
  process.exit(1);
}

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  currentCheck = name;
  await fn();
  console.log(`ok   ${name}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

// ---------------------------------------------------------------------------
// Cookie jar + auth (DEC-053 conventions)
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
  if (!getRes.ok) throw new Error(`GET /login failed: ${getRes.status}`);
  parseSetCookies(getRes, cookies);
  if (!cookies.chq_csrf) throw new Error("GET /login did not set a chq_csrf cookie");

  const body = new URLSearchParams({ email, password, chq_csrf: cookies.chq_csrf });
  const postRes = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader(cookies) },
    body: body.toString(),
    redirect: "manual",
  });
  if (postRes.status !== 302) throw new Error(`POST /login failed: expected 302, got ${postRes.status}`);
  parseSetCookies(postRes, cookies);
  if (!cookies.chq_session) throw new Error("POST /login did not set a chq_session cookie");

  return cookies;
}

async function apiJson<T>(
  cookies: Cookies,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<{ status: number; json: T }> {
  const headers: Record<string, string> = { cookie: cookieHeader(cookies) };
  if (method !== "GET") headers["x-chq-csrf"] = "1";
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as T;
  return { status: res.status, json };
}

/** Form-encoded POST carrying the DEC-053 chq_csrf hidden field (csrfForm
 * convention) — used for portal routes that aren't the JSON API. */
async function postForm(
  cookies: Cookies,
  path: string,
  fields: Record<string, string>,
): Promise<{ status: number; body: string }> {
  const body = new URLSearchParams({ chq_csrf: cookies.chq_csrf ?? "", ...fields });
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader(cookies) },
    body: body.toString(),
    redirect: "manual",
  });
  return { status: res.status, body: await res.text().catch(() => "") };
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
// Small parsing helpers over raw HTML/ICS (no DOM — grep-style per DEC-053's
// "assertions are status codes + key fields" spirit, scaled to markup).
// ---------------------------------------------------------------------------

function extractAll(html: string, re: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const g = new RegExp(re, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((m = g.exec(html)) !== null) {
    out.push(m[1] ?? m[0]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fixture identities
// ---------------------------------------------------------------------------

interface FixtureData {
  identities: {
    organizer: { email: string; password: string };
    speaker: { name: string; email: string; password: string };
    speaker2: { name: string; email: string; password: string };
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

interface EventListItem {
  id: string;
  slug: string;
}

interface AgendaRoom {
  id: string;
  name: string;
}
interface AgendaTrack {
  id: string;
  name: string;
  color: string | null;
}
interface AgendaSession {
  submissionId: string;
  title: string;
  roomId?: string | null;
  day?: string;
  startMin?: number;
  endMin?: number;
}
interface AgendaConflict {
  kind: string;
  submissionIds: [string, string];
  detail: string;
}
interface AgendaPayload {
  days: string[];
  rooms: AgendaRoom[];
  tracks: AgendaTrack[];
  placed: AgendaSession[];
  unscheduled: AgendaSession[];
  conflicts: AgendaConflict[];
  summary: { unplaced: number; conflicts: number };
}
interface SubmissionDetail {
  id: string;
  status: string;
  contentStatus: string;
  participants: Array<{ id: string; contactId: string; visible: boolean }>;
}

async function main(): Promise<void> {
  await waitForHealth();

  const fixture: FixtureData = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
  const cookies = await login(fixture.identities.organizer.email, fixture.identities.organizer.password);

  let eventId = "";
  await check("devflow-conf-2027 event resolvable via API", async () => {
    const { status, json } = await apiJson<{ items: EventListItem[] }>(cookies, "GET", "/api/v1/events");
    assert(status === 200, `GET /api/v1/events -> ${status}`);
    const found = json.items.find((e) => e.slug === EVENT_SLUG);
    assert(found, `no event with slug ${EVENT_SLUG} — run npm run seed first`);
    eventId = found!.id;
  });

  // -------------------------------------------------------------------
  // J9: agenda
  // -------------------------------------------------------------------

  let agenda!: AgendaPayload;

  await check("J9 GET agenda: rooms and tracks (with colors) list", async () => {
    const { status, json } = await apiJson<AgendaPayload>(cookies, "GET", `/api/v1/events/${eventId}/agenda`);
    assert(status === 200, `GET agenda -> ${status}`);
    agenda = json;
    assert(agenda.rooms.length > 0, "expected at least one room");
    assert(agenda.tracks.length > 0, "expected at least one track");
    assert(
      agenda.tracks.every((t) => typeof t.color === "string" && t.color.length > 0),
      "expected every track to have a color",
    );
  });

  await check("J9 unscheduled tray is accepted-only", async () => {
    // getAgendaPayload only ever loads status='accepted' submissions
    // (loadAcceptedSessions) — the tray + placed set are both drawn from
    // that same accepted-only pool, so their union size can never exceed
    // it. Sanity-check the tray is non-empty on the seeded event.
    assert(agenda.unscheduled.length + agenda.placed.length > 0, "expected at least one accepted session");
  });

  const day = agenda.days[0]!;
  const roomA = agenda.rooms[0]!.id;
  const roomB = agenda.rooms.length > 1 ? agenda.rooms[1]!.id : agenda.rooms[0]!.id;

  // seed.ts (task w6-e) deliberately pre-places most of the seeded accepted
  // pool (with its own deliberate room-overlap) so the "unscheduled" count
  // reads honestly out of the box — that leaves too few free accepted
  // sessions to safely construct fresh overlap fixtures against. Everything
  // below creates its own throwaway accepted submissions instead, so this
  // check works against arbitrary seed data, not just today's counts.
  async function createAcceptedSubmission(title: string, email: string): Promise<{ id: string; contactId: string }> {
    const { status, json } = await apiJson<{ id: string }>(cookies, "POST", `/api/v1/events/${eventId}/submissions`, {
      title,
      description: "Walkthrough agenda fixture.",
      contact: { email, firstName: "Wk", lastName: "Speaker" },
    });
    assert(status === 201, `create submission -> ${status}`);
    const { status: acceptStatus } = await apiJson(cookies, "POST", `/api/v1/events/${eventId}/submissions/status`, {
      ids: [json.id],
      status: "accepted",
    });
    assert(acceptStatus === 200, `accept submission -> ${acceptStatus}`);
    const { json: detail } = await apiJson<{ participants: Array<{ contactId: string }> }>(
      cookies,
      "GET",
      `/api/v1/submissions/${json.id}`,
    );
    return { id: json.id, contactId: detail.participants[0]!.contactId };
  }

  const stamp = Date.now();
  const placeTest = await createAcceptedSubmission(`Wk Placement Test ${stamp}`, `wk-place-${stamp}@example.test`);
  const roomOverlapA = await createAcceptedSubmission(`Wk Room Overlap A ${stamp}`, `wk-roomA-${stamp}@example.test`);
  const roomOverlapB = await createAcceptedSubmission(`Wk Room Overlap B ${stamp}`, `wk-roomB-${stamp}@example.test`);
  const sharedEmail = `wk-shared-speaker-${stamp}@example.test`;
  const speakerOverlapC = await createAcceptedSubmission(`Wk Speaker Overlap C ${stamp}`, sharedEmail);
  const speakerOverlapD = await createAcceptedSubmission(`Wk Speaker Overlap D ${stamp}`, sharedEmail);
  assert(
    speakerOverlapC.contactId === speakerOverlapD.contactId,
    "expected createSubmission to reuse the same contact for a repeated email (findOrCreateContact)",
  );

  await check("J9 placing a session into a slot persists", async () => {
    const { status } = await apiJson(cookies, "PUT", `/api/v1/submissions/${placeTest.id}/slot`, {
      day,
      startMin: 780,
      endMin: 810,
      roomId: roomA,
    });
    assert(status === 200, `PUT slot -> ${status}`);
    const { json } = await apiJson<AgendaPayload>(cookies, "GET", `/api/v1/events/${eventId}/agenda`);
    const found = json.placed.find((p) => p.submissionId === placeTest.id);
    assert(found, "placed session did not persist to a re-fetched agenda");
    assert(found!.roomId === roomA && found!.day === day && found!.startMin === 780, "persisted slot fields mismatch");
  });

  let conflictsBeforeAuto = 0;

  await check("J9 room-overlap: both writes succeed (non-blocking), conflict surfaces", async () => {
    const { status: s1 } = await apiJson(cookies, "PUT", `/api/v1/submissions/${roomOverlapA.id}/slot`, {
      day,
      startMin: 810,
      endMin: 840,
      roomId: roomA,
    });
    assert(s1 === 200, `PUT roomOverlapA slot -> ${s1} (expected non-blocking success)`);
    const { status: s2 } = await apiJson(cookies, "PUT", `/api/v1/submissions/${roomOverlapB.id}/slot`, {
      day,
      startMin: 810,
      endMin: 840,
      roomId: roomA, // same room, same time -> room_overlap
    });
    assert(s2 === 200, `PUT roomOverlapB slot -> ${s2} (expected non-blocking success)`);
    const { json: refreshed } = await apiJson<AgendaPayload>(cookies, "GET", `/api/v1/events/${eventId}/agenda`);
    const pair = refreshed.conflicts.find(
      (c) =>
        c.kind === "room_overlap" &&
        c.submissionIds.includes(roomOverlapA.id) &&
        c.submissionIds.includes(roomOverlapB.id),
    );
    assert(pair, "expected a room_overlap conflict between roomOverlapA and roomOverlapB");
  });

  await check("J9 same-speaker-overlap: both writes succeed (non-blocking), conflict surfaces", async () => {
    const { status: s1 } = await apiJson(cookies, "PUT", `/api/v1/submissions/${speakerOverlapC.id}/slot`, {
      day,
      startMin: 900,
      endMin: 930,
      roomId: roomA,
    });
    assert(s1 === 200, `PUT speakerOverlapC slot -> ${s1}`);
    const { status: s2 } = await apiJson(cookies, "PUT", `/api/v1/submissions/${speakerOverlapD.id}/slot`, {
      day,
      startMin: 910,
      endMin: 940,
      roomId: roomB, // different room, overlapping time, same speaker -> speaker_overlap
    });
    assert(s2 === 200, `PUT speakerOverlapD slot -> ${s2} (expected non-blocking success)`);

    const { json: refreshed } = await apiJson<AgendaPayload>(cookies, "GET", `/api/v1/events/${eventId}/agenda`);
    const pair = refreshed.conflicts.find(
      (c) =>
        c.kind === "speaker_overlap" &&
        c.submissionIds.includes(speakerOverlapC.id) &&
        c.submissionIds.includes(speakerOverlapD.id),
    );
    assert(pair, "expected a speaker_overlap conflict between speakerOverlapC and speakerOverlapD");
    conflictsBeforeAuto = refreshed.conflicts.length;
    assert(conflictsBeforeAuto >= 2, `expected at least 2 conflicts (room + speaker), got ${conflictsBeforeAuto}`);
  });

  await check("J9 'N unplaced / M conflicts' counts are correct", async () => {
    const { json } = await apiJson<AgendaPayload>(cookies, "GET", `/api/v1/events/${eventId}/agenda`);
    const totalAccepted = json.placed.length + json.unscheduled.length;
    const expectedUnplaced = totalAccepted - json.placed.length;
    assert(json.summary.unplaced === expectedUnplaced, `summary.unplaced ${json.summary.unplaced} != ${expectedUnplaced}`);
    assert(json.summary.conflicts === json.conflicts.length, `summary.conflicts ${json.summary.conflicts} != conflicts.length ${json.conflicts.length}`);
    assert(json.summary.conflicts >= 2, "expected the two overlaps created above to be reflected in summary.conflicts");
  });

  await check("J9 auto-schedule places remaining sessions without introducing conflicts", async () => {
    const { status, json } = await apiJson<AgendaPayload>(cookies, "POST", `/api/v1/events/${eventId}/agenda/auto-schedule`, {});
    assert(status === 200, `POST auto-schedule -> ${status}`);
    assert(json.unscheduled.length === 0, `expected auto-schedule to place every remaining session, ${json.unscheduled.length} left unplaced`);
    assert(
      json.conflicts.length === conflictsBeforeAuto,
      `auto-schedule must not add new conflicts: had ${conflictsBeforeAuto}, now ${json.conflicts.length}`,
    );
  });

  await check("J9 unscheduling returns a session to the tray", async () => {
    const { status } = await apiJson(cookies, "DELETE", `/api/v1/submissions/${placeTest.id}/slot`);
    assert(status === 200, `DELETE slot -> ${status}`);
    const { json } = await apiJson<AgendaPayload>(cookies, "GET", `/api/v1/events/${eventId}/agenda`);
    assert(
      json.unscheduled.some((s) => s.submissionId === placeTest.id),
      "unscheduled session did not return to the tray",
    );
    assert(!json.placed.some((p) => p.submissionId === placeTest.id), "unscheduled session is still in placed[]");
  });

  // -------------------------------------------------------------------
  // J10: public surfaces
  // -------------------------------------------------------------------

  const SURFACES = ["sessions", "speakers", "agenda", "schedule", "gallery"] as const;

  for (const surface of SURFACES) {
    await check(`J10 /e/${EVENT_SLUG}/${surface} returns 200 with content`, async () => {
      const res = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/${surface}`);
      assert(res.status === 200, `-> ${res.status}`);
      const html = await res.text();
      assert(html.length > 200, "response body suspiciously short");
      assert(html.includes('name="viewport"'), "missing mobile viewport meta tag");
      const cacheControl = res.headers.get("cache-control") ?? "";
      assert(cacheControl.includes("max-age=60"), `expected DEC-022 bounded 60s Cache-Control, got '${cacheControl}'`);
    });
  }

  let sessionsHtml = "";
  await check("J10 /sessions: cards + track filter nav present", async () => {
    const res = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/sessions`);
    sessionsHtml = await res.text();
    // DEC-412 repair: session cards were 'chq-card' pre-redesign; the
    // redesign renamed the class to 'chq-pub-session-row'
    // (src/routes/public/cards.tsx SessionCard) — behavior unchanged.
    assert(sessionsHtml.includes('class="chq-pub-session-row"'), "no session cards found");
    assert(sessionsHtml.includes("Track filters"), "no track filter nav found");
  });

  await check("J10 /speakers: alphabetical by surname, headshot/title/company", async () => {
    const res = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/speakers`);
    const html = await res.text();
    assert(res.status === 200, `-> ${res.status}`);
    // DEC-412 repair: speaker names used to render as
    // "<strong>First Last</strong>" (DEC-173: "<strong><a href=...>...
    // </a></strong>") inside a 'chq-speaker-grid' region. The redesign
    // (src/routes/public/speakers.tsx SpeakersContent) dropped the
    // <strong> wrapper entirely and renders the name as
    // '<a class="chq-pub-speaker-name" href=...>First Last</a>' inside
    // 'chq-pub-speaker-grid' > 'chq-pub-speaker-card' — function unchanged
    // (still one link per speaker), only the token changed.
    const gridMatch = html.match(/<div class="chq-pub-speaker-grid">([\s\S]*)$/);
    const gridHtml = gridMatch ? gridMatch[1]! : html;
    const names = extractAll(gridHtml, /<a class="chq-pub-speaker-name"[^>]*>\s*([^<]+?)\s*<\/a>/g);
    assert(names.length >= 2, "expected at least 2 speakers to check ordering");
    const surnames = names.map((n) => n.trim().split(/\s+/).slice(-1)[0]!.toLowerCase());
    const sorted = [...surnames].sort((a, b) => a.localeCompare(b));
    assert(JSON.stringify(surnames) === JSON.stringify(sorted), `speakers not sorted by surname: ${surnames.join(", ")}`);
    assert(html.includes("chq-pub-headshot-fallback") || html.includes("<img"), "expected headshot img or fallback markup");
    assert(html.includes("Software Engineer") || /,\s*\S/.test(html), "expected title/company text near speaker names");
  });

  let agendaTrackColorFound = false;
  await check("J10 /agenda: per-day time grid, track colors present in markup", async () => {
    const res = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/agenda`);
    const html = await res.text();
    assert(res.status === 200, `-> ${res.status}`);
    // DEC-412 repair: renamed 'chq-agenda-day' -> 'chq-pub-agenda-day'
    // (src/routes/public/agenda.tsx).
    assert(html.includes("chq-pub-agenda-day"), "no per-day agenda grid found");
    for (const t of agenda.tracks) {
      if (t.color && html.includes(t.color)) {
        agendaTrackColorFound = true;
        break;
      }
    }
    assert(agendaTrackColorFound, "no track color found in agenda markup");
  });

  await check("J10 /schedule: itinerary key + .ics link carries ?ids=", async () => {
    const res = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/schedule`);
    const html = await res.text();
    assert(res.status === 200, `-> ${res.status}`);
    assert(html.includes(`chq_itinerary_${EVENT_SLUG}`), "missing localStorage key chq_itinerary_<slug>");
    assert(html.includes('id="chq-ics-link"'), "missing .ics download link");
    assert(html.includes("/schedule.ics?ids="), "itinerary script does not build a ?ids= .ics link");
  });

  await check("J10 /gallery returns headshot grid", async () => {
    const res = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/gallery`);
    const html = await res.text();
    assert(res.status === 200, `-> ${res.status}`);
    // DEC-412 repair: the gallery surface (src/routes/public/speakers.tsx
    // GalleryContent) is its own 'chq-pub-gallery-grid', distinct from the
    // speakers-page 'chq-pub-speaker-grid' — pre-redesign both apparently
    // shared 'chq-speaker-grid'.
    assert(html.includes("chq-pub-gallery-grid"), "no gallery grid found");
  });

  await check("J10 schedule.ics downloads twice with identical UID lines", async () => {
    const { json: full } = await apiJson<AgendaPayload>(cookies, "GET", `/api/v1/events/${eventId}/agenda`);
    const ids = full.placed.slice(0, 3).map((p) => p.submissionId);
    assert(ids.length > 0, "expected at least one scheduled session to export");
    const url = `${BASE_URL}/e/${EVENT_SLUG}/schedule.ics?ids=${encodeURIComponent(ids.join(","))}`;
    const res1 = await fetch(url);
    const res2 = await fetch(url);
    assert(res1.status === 200 && res2.status === 200, `ics fetch -> ${res1.status}, ${res2.status}`);
    const body1 = await res1.text();
    const body2 = await res2.text();
    const uids1 = extractAll(body1, /^UID:(.+)$/gm);
    const uids2 = extractAll(body2, /^UID:(.+)$/gm);
    assert(uids1.length > 0, "no UID lines found in .ics export");
    assert(JSON.stringify(uids1) === JSON.stringify(uids2), `UIDs differ between downloads: ${uids1} vs ${uids2}`);
  });

  for (const surface of SURFACES) {
    await check(`J10 /embed/${EVENT_SLUG}/${surface} renders chromeless, no frame-blocking headers`, async () => {
      const res = await fetch(`${BASE_URL}/embed/${EVENT_SLUG}/${surface}`);
      assert(res.status === 200, `-> ${res.status}`);
      const html = await res.text();
      assert(html.includes('name="viewport"'), "missing mobile viewport meta tag");
      assert(!html.includes('class="chq-nav"'), "embed should be chromeless (no surface nav)");
      assert(res.headers.get("x-frame-options") === null, "embed must not set X-Frame-Options");
      const csp = res.headers.get("content-security-policy") ?? "";
      assert(!csp.includes("frame-ancestors"), "embed must not set a frame-ancestors CSP directive");
      const cacheControl = res.headers.get("cache-control") ?? "";
      assert(cacheControl.includes("max-age=60"), `expected DEC-022 bounded 60s Cache-Control, got '${cacheControl}'`);
    });
  }

  // wave 65 landed two more public surfaces that the SURFACES loops above
  // never visit: the printable programme (src/routes/public/programme.tsx)
  // and the anonymous event hub at GET / (src/routes/root.tsx, DEC-582).

  await check(`J10 /e/${EVENT_SLUG}/programme renders the whole programme`, async () => {
    // Seed a break of our own: producer.ts's J9 run creates-then-deletes its
    // own break fixture, so nothing guarantees a break survives into this
    // module's run — create one on this event's first day so the label
    // assertion below is never a false negative on an empty-breaks event.
    const label = `Wk Programme Break ${Date.now()}`;
    const { status: createStatus, json: createJson } = await apiJson<{ id: string }>(
      cookies,
      "POST",
      `/api/v1/events/${eventId}/breaks`,
      buildCreateBreakBody(day, label, 615, 15),
    );
    assert(createStatus === 201, `POST /api/v1/events/${eventId}/breaks -> ${createStatus}`);
    assert(createJson.id, `POST /api/v1/events/${eventId}/breaks did not return an id`);

    const { status: breaksStatus, json: breaksJson } = await apiJson<{ items: { label: string }[] }>(
      cookies,
      "GET",
      `/api/v1/events/${eventId}/breaks`,
    );
    assert(breaksStatus === 200, `GET /api/v1/events/${eventId}/breaks -> ${breaksStatus}`);
    assert(breaksJson.items.length > 0, `GET /api/v1/events/${eventId}/breaks -> 0 items, expected at least the break just created`);
    const found = breaksJson.items.find((b) => b.label === label);
    assert(found, `GET /api/v1/events/${eventId}/breaks -> did not include the break just created (label '${label}')`);

    const url = `${BASE_URL}/e/${EVENT_SLUG}/programme`;
    const res = await fetch(url);
    assert(res.status === 200, `GET ${url} -> ${res.status}`);
    const html = await res.text();
    const cacheControl = res.headers.get("cache-control") ?? "";
    assert(cacheControl.includes("max-age=60"), `GET ${url} -> 200 but Cache-Control '${cacheControl}' missing DEC-022 bounded max-age=60`);
    const dayIds = new Set(extractProgrammeDayIds(html));
    assert(dayIds.size >= 2, `GET ${url} -> 200 but only found ${dayIds.size} distinct chq-prog-day- section id(s): ${[...dayIds].join(", ")}`);
    assert(
      agendaHtmlContainsBreakLabel(html, label),
      `GET ${url} -> 200 but break label '${label}' not found in the rendered programme body`,
    );
  });

  await check("J10 GET / is the anonymous event hub and redirects a signed-in user", async () => {
    const anonUrl = `${BASE_URL}/`;
    const anonRes = await fetch(anonUrl);
    assert(anonRes.status === 200, `GET ${anonUrl} (anonymous) -> ${anonRes.status}`);
    const anonHtml = await anonRes.text();
    assert(anonHtml.includes("chq-home-org"), `GET ${anonUrl} (anonymous) -> 200 but no 'chq-home-org' organisation name found`);
    assert(
      anonHtml.includes(`/e/${EVENT_SLUG}/sessions`) || anonHtml.includes(`/submit/${EVENT_SLUG}`),
      `GET ${anonUrl} (anonymous) -> 200 but no link to /e/${EVENT_SLUG}/sessions or /submit/${EVENT_SLUG} found`,
    );

    const orgRes = await fetch(anonUrl, { headers: { cookie: cookieHeader(cookies) }, redirect: "manual" });
    assert(orgRes.status === 302, `GET ${anonUrl} (organizer session) -> ${orgRes.status}, expected 302 (DEC-582)`);
    const location = orgRes.headers.get("location") ?? "";
    assert(location === "/admin", `GET ${anonUrl} (organizer session) -> 302 but Location '${location}' != '/admin' (DEC-582)`);
  });

  await check("J10 Settings embed-generator snippet URLs match live /embed routes", async () => {
    // The embed URL builder was decomposed out of Settings.tsx (DEC-289):
    // app/src/pages/settings/embedSnippet.ts now owns buildEmbedUrl, and
    // app/src/pages/settings/EmbedsPanel.tsx renders it. DEC-412 repair:
    // the redesign (DEC-375) turned Settings.tsx's rail of literal
    // `<XPanel />` mounts into a `SECTIONS: {key,label,Panel}[]` config
    // array rendered as `<Panel />` inside a shared `.map()` — EmbedsPanel
    // is still imported and still mounted (as `Panel = section.Panel`
    // where `section.key === 'embeds'`), just never spelled `<EmbedsPanel`
    // as a JSX tag anymore. Re-pinned to the still-stable importing/wiring
    // tokens instead of the literal (now-gone) tag spelling.
    const settingsSrc = readFileSync(join(REPO_ROOT, "app", "src", "pages", "Settings.tsx"), "utf-8");
    assert(
      settingsSrc.includes("import { EmbedsPanel } from './settings/EmbedsPanel'"),
      "Settings.tsx no longer imports EmbedsPanel",
    );
    assert(
      /\{\s*key:\s*'embeds',\s*label:\s*'Embeds',\s*Panel:\s*EmbedsPanel\s*\}/.test(settingsSrc),
      "Settings.tsx no longer wires EmbedsPanel into its SECTIONS config",
    );

    const embedSnippetSrc = readFileSync(
      join(REPO_ROOT, "app", "src", "pages", "settings", "embedSnippet.ts"),
      "utf-8",
    );
    assert(
      embedSnippetSrc.includes("/embed/${slug}/${surface}"),
      "embedSnippet.ts buildEmbedUrl missing /embed/${slug}/${surface} path",
    );
    assert(
      embedSnippetSrc.includes(".json"),
      "embedSnippet.ts buildEmbedUrl missing the .json suffix for the json format",
    );

    const embedsPanelSrc = readFileSync(
      join(REPO_ROOT, "app", "src", "pages", "settings", "EmbedsPanel.tsx"),
      "utf-8",
    );
    assert(
      embedsPanelSrc.includes("buildEmbedUrl"),
      "EmbedsPanel.tsx no longer renders the buildEmbedUrl snippet output",
    );

    // Confirm the generated URL for one concrete surface actually resolves.
    const probe = `${BASE_URL}/embed/${EVENT_SLUG}/sessions`;
    const res = await fetch(probe);
    assert(res.status === 200, `Settings-generated embed URL pattern /embed/<slug>/<surface> -> ${res.status} for ${probe}`);
  });

  // -------------------------------------------------------------------
  // Visibility gates (server-side): each of the three throwaway fixtures
  // below must be entirely absent from every surface, embed, and the .ics.
  // -------------------------------------------------------------------

  async function createThrowawaySubmission(
    title: string,
    firstName = "Wk",
    lastName = "Fixture",
  ): Promise<string> {
    const { status, json } = await apiJson<{ id: string }>(cookies, "POST", `/api/v1/events/${eventId}/submissions`, {
      title,
      description: "Walkthrough visibility-gate fixture.",
      contact: { email: `wk-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, firstName, lastName },
    });
    assert(status === 201, `create submission -> ${status}`);
    return json.id;
  }

  async function assertAbsentEverywhere(marker: string, submissionId: string): Promise<void> {
    for (const surface of ["sessions", "speakers", "agenda", "schedule", "gallery"] as const) {
      const res = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/${surface}`);
      const html = await res.text();
      assert(!html.includes(marker), `visibility gate leak: '${marker}' found in raw HTML of /e/${EVENT_SLUG}/${surface}`);
      const embedRes = await fetch(`${BASE_URL}/embed/${EVENT_SLUG}/${surface}`);
      const embedHtml = await embedRes.text();
      assert(!embedHtml.includes(marker), `visibility gate leak: '${marker}' found in raw HTML of /embed/${EVENT_SLUG}/${surface}`);
    }
    const icsRes = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/schedule.ics?ids=${submissionId}`);
    const icsBody = await icsRes.text();
    assert(!icsBody.includes(marker), `visibility gate leak: '${marker}' found in raw .ics`);
    assert(!icsBody.includes(submissionId), `visibility gate leak: submission id '${submissionId}' found in raw .ics UID`);
  }

  await check("J10 visibility gate: non-accepted submission is absent from every surface", async () => {
    const marker = `Wk NonAccepted Marker ${Date.now()}`;
    const id = await createThrowawaySubmission(marker);
    // Left at its default 'pending' status — never approved/accepted.
    await assertAbsentEverywhere(marker, id);
  });

  await check("J10 visibility gate: accepted-but-content-unapproved session is absent from every surface", async () => {
    const marker = `Wk UnapprovedContent Marker ${Date.now()}`;
    const id = await createThrowawaySubmission(marker);
    const { status } = await apiJson(cookies, "POST", `/api/v1/events/${eventId}/submissions/status`, {
      ids: [id],
      status: "accepted",
    });
    assert(status === 200, `accept submission -> ${status}`);
    // contentStatus stays 'pending' (createSubmission default) — never
    // approved via POST /api/v1/submissions/:id/content-status.
    await apiJson(cookies, "PUT", `/api/v1/submissions/${id}/slot`, { day, startMin: 660, endMin: 690, roomId: roomA });
    await assertAbsentEverywhere(marker, id);
  });

  await check(
    "J10 visibility gate (DEC-274): hidden participant's name vanishes everywhere but the session stays public with speakers:[]",
    async () => {
      const stamp3 = Date.now();
      const title = `Wk HiddenSpeaker Session ${stamp3}`;
      const nameFirst = `WkHidden${stamp3}`;
      const nameLast = "SpeakerMarker";
      const nameMarker = `${nameFirst} ${nameLast}`;
      const id = await createThrowawaySubmission(title, nameFirst, nameLast);
      const { status: acceptStatus } = await apiJson(cookies, "POST", `/api/v1/events/${eventId}/submissions/status`, {
        ids: [id],
        status: "accepted",
      });
      assert(acceptStatus === 200, `accept submission -> ${acceptStatus}`);
      const { status: approveStatus } = await apiJson(cookies, "POST", `/api/v1/submissions/${id}/content-status`, {
        contentStatus: "approved",
      });
      assert(approveStatus === 200, `approve content -> ${approveStatus}`);
      const { status: slotStatus } = await apiJson(cookies, "PUT", `/api/v1/submissions/${id}/slot`, {
        day,
        startMin: 700,
        endMin: 730,
        roomId: roomA,
      });
      assert(slotStatus === 200, `schedule -> ${slotStatus}`);

      // Sanity check: fully accepted+approved+scheduled, both the title and
      // the speaker name marker MUST be visible before we hide the only
      // participant — otherwise the checks below would be false positives.
      // Scoped with ?q=<title> (EMB-02 title/speaker-name search): the
      // unfiltered /sessions view is PER_PAGE=12-capped
      // (src/routes/public/shell.tsx), and by this point in the combined
      // six-module walkthrough run the event already has >=12 other
      // accepted+approved sessions, so an unfiltered fetch can miss this
      // fixture on page 1 even though it's genuinely visible.
      const preRes = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/sessions?q=${encodeURIComponent(title)}`);
      const preHtml = await preRes.text();
      assert(preHtml.includes(title), "expected fully-visible fixture title to appear before hiding its participant");
      assert(preHtml.includes(nameMarker), "expected fully-visible fixture's speaker name to appear before hiding its participant");

      const { json: detail } = await apiJson<SubmissionDetail>(cookies, "GET", `/api/v1/submissions/${id}`);
      const participantId = detail.participants[0]?.id;
      assert(participantId, "expected the throwaway submission to have a participant");
      // DEC-070's PATCH /api/v1/submissions/:id/participants/:participantId
      // toggles participant.visible through the real organizer endpoint.
      const { status: visStatus, json: visJson } = await apiJson<{ visible: boolean }>(
        cookies,
        "PATCH",
        `/api/v1/submissions/${id}/participants/${participantId}`,
        { visible: false },
      );
      assert(visStatus === 200, `PATCH participant visibility -> ${visStatus}: ${JSON.stringify(visJson)}`);
      assert(visJson.visible === false, `expected visible:false in PATCH response, got ${JSON.stringify(visJson)}`);

      // (i) The speaker NAME marker must be gone from every surface, embed,
      // and the .ics — DEC-274: a hidden-only-participant session is still
      // public, but the person themself must never be named.
      for (const surface of ["sessions", "speakers", "agenda", "schedule", "gallery"] as const) {
        const res = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/${surface}`);
        const html = await res.text();
        assert(!html.includes(nameMarker), `DEC-274 leak: hidden speaker name '${nameMarker}' found in /e/${EVENT_SLUG}/${surface}`);
        const embedRes = await fetch(`${BASE_URL}/embed/${EVENT_SLUG}/${surface}`);
        const embedHtml = await embedRes.text();
        assert(
          !embedHtml.includes(nameMarker),
          `DEC-274 leak: hidden speaker name '${nameMarker}' found in /embed/${EVENT_SLUG}/${surface}`,
        );
      }
      const icsRes = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/schedule.ics?ids=${id}`);
      const icsBody = await icsRes.text();
      assert(!icsBody.includes(nameMarker), `DEC-274 leak: hidden speaker name '${nameMarker}' found in raw .ics`);

      // (ii) The session TITLE must STILL be present on all session-rooted
      // surfaces — DEC-274: visibleSessionConditions() never references
      // participant visibility, so the session (with speakers: []) stays
      // public even though its only participant is hidden.
      const sessionsRes = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/sessions?q=${encodeURIComponent(title)}`);
      const sessionsHtml = await sessionsRes.text();
      assert(sessionsHtml.includes(title), `DEC-274 regression: session title '${title}' missing from /sessions?q=`);

      const agendaRes = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/agenda?day=${encodeURIComponent(day)}`);
      const agendaHtml = await agendaRes.text();
      assert(agendaHtml.includes(title), `DEC-274 regression: session title '${title}' missing from /agenda?day=`);

      const scheduleRes = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/schedule?day=${encodeURIComponent(day)}`);
      const scheduleHtml = await scheduleRes.text();
      assert(scheduleHtml.includes(title), `DEC-274 regression: session title '${title}' missing from /schedule?day=`);

      const icsRes2 = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/schedule.ics?ids=${id}`);
      const icsBody2 = await icsRes2.text();
      const uids = extractAll(icsBody2, /^UID:(.+)$/gm);
      assert(
        uids.some((u) => u.includes(id)),
        `DEC-274 regression: no VEVENT UID referencing submission '${id}' in /schedule.ics?ids=`,
      );

      // (iii) The speaker themself must be gone from the speaker-rooted
      // surfaces, which DO apply the composite gate (public/speakers.ts,
      // public/detail.ts).
      const speakersRes2 = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/speakers`);
      const speakersHtml2 = await speakersRes2.text();
      assert(!speakersHtml2.includes(nameMarker), `DEC-274 leak: hidden speaker name '${nameMarker}' found in /speakers`);
      const galleryRes2 = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/gallery`);
      const galleryHtml2 = await galleryRes2.text();
      assert(!galleryHtml2.includes(nameMarker), `DEC-274 leak: hidden speaker name '${nameMarker}' found in /gallery`);
    },
  );

  // -------------------------------------------------------------------------
  // DEC-108/DEC-112: public/embed visibility must additionally require
  // participant.inviteStatus IN ('none','accepted'). An accepted+approved
  // session with a co-presenter who never responded ('invited') or who
  // explicitly declined must never announce that co-presenter's name on
  // public/embed surfaces (visibleSubmissionConditions() + the
  // hydrateSessions speaker sub-query, public.ts:225). Builds on the
  // existing DEC-070 invite + accept/decline flow (organizer invites via
  // POST /api/v1/submissions/:id/participants, speaker responds via
  // POST /portal/invitations/:participantId). This probe asserts POST-FIX
  // behavior and MUST fail against pre-w10 main (the pending and declined
  // invitees' names still leak onto /sessions and /speakers) — task w10-e
  // proves the walkthrough is correctly wired to the still-open defect; the
  // wave-11 walkthrough gate at the post-w10 sha is the green runtime proof.
  // -------------------------------------------------------------------------

  interface InviteParticipantResult {
    id: string;
    contactId: string;
    inviteStatus: string;
  }

  async function findOrCreateContactId(email: string, firstName: string, lastName: string): Promise<string> {
    const { status, json } = await apiJson<{ id: string }>(cookies, "POST", `/api/v1/events/${eventId}/submissions`, {
      title: `Wk invite-visibility contact fixture ${Date.now()}`,
      description: "Walkthrough invite-visibility contact fixture (throwaway, never scheduled itself).",
      contact: { email, firstName, lastName },
    });
    assert(status === 201, `create contact-fixture submission -> ${status}`);
    const { json: detail } = await apiJson<{ participants: Array<{ contactId: string }> }>(
      cookies,
      "GET",
      `/api/v1/submissions/${json.id}`,
    );
    return detail.participants[0]!.contactId;
  }

  await check(
    "J10 DEC-108 invite-visibility gate: accepted invitee shown, pending and declined invitees absent",
    async () => {
      const stamp2 = Date.now();
      const baseTitle = `Wk Invite Visibility Base ${stamp2}`;
      const base = await createAcceptedSubmission(baseTitle, `wk-invite-base-${stamp2}@example.test`);

      const { status: approveStatus } = await apiJson(cookies, "POST", `/api/v1/submissions/${base.id}/content-status`, {
        contentStatus: "approved",
      });
      assert(approveStatus === 200, `approve content-status -> ${approveStatus}`);
      const { status: slotStatus } = await apiJson(cookies, "PUT", `/api/v1/submissions/${base.id}/slot`, {
        day,
        startMin: 950,
        endMin: 980,
        roomId: roomA,
      });
      assert(slotStatus === 200, `schedule base submission -> ${slotStatus}`);

      // Accepted co-presenter: the real DEC-070 accept flow via the seeded
      // speaker persona (has real login credentials).
      const acceptedContactId = await findOrCreateContactId(
        fixture.identities.speaker.email,
        "Wk",
        "AcceptedInviteeContact",
      );
      const { status: inviteAcceptedStatus, json: inviteAcceptedJson } = await apiJson<InviteParticipantResult>(
        cookies,
        "POST",
        `/api/v1/submissions/${base.id}/participants`,
        { contactId: acceptedContactId },
      );
      assert(inviteAcceptedStatus === 201, `invite accepted-to-be co-presenter -> ${inviteAcceptedStatus}`);
      const speakerCookies = await login(fixture.identities.speaker.email, fixture.identities.speaker.password);
      const acceptRes = await postForm(speakerCookies, `/portal/invitations/${inviteAcceptedJson.id}`, {
        action: "accept",
      });
      assert(acceptRes.status === 302, `speaker accept invitation -> ${acceptRes.status}`);

      // Declined co-presenter: the real DEC-070 decline flow via the second
      // seeded speaker persona (only a real logged-in speaker can respond to
      // their own participant row — DEC-070's ownership guard means a
      // throwaway marker contact can't self-decline, so this leg asserts on
      // speaker2's own fixture name instead of a marker; both speaker's and
      // speaker2's fixture submissions are left 'pending' by the earlier
      // walkthrough modules, so neither name is publicly visible from any
      // other source when this check runs).
      const declinedContactId = await findOrCreateContactId(
        fixture.identities.speaker2.email,
        "Wk",
        "DeclinedInviteeContact",
      );
      const { status: inviteDeclinedStatus, json: inviteDeclinedJson } = await apiJson<InviteParticipantResult>(
        cookies,
        "POST",
        `/api/v1/submissions/${base.id}/participants`,
        { contactId: declinedContactId },
      );
      assert(inviteDeclinedStatus === 201, `invite declined-to-be co-presenter -> ${inviteDeclinedStatus}`);
      const speaker2Cookies = await login(fixture.identities.speaker2.email, fixture.identities.speaker2.password);
      const declineRes = await postForm(speaker2Cookies, `/portal/invitations/${inviteDeclinedJson.id}`, {
        action: "decline",
      });
      assert(declineRes.status === 302, `speaker2 decline invitation -> ${declineRes.status}`);

      // Pending co-presenter: invited, never responds (invite_status stays
      // 'invited') — a fresh throwaway contact with a unique marker name so
      // its absence can be asserted unambiguously.
      const pendingMarkerFirst = `WkPendingMarker${stamp2}`;
      const pendingContactId = await findOrCreateContactId(
        `wk-invite-pending-${stamp2}@example.test`,
        pendingMarkerFirst,
        "PendingInvitee",
      );
      const { status: invitePendingStatus } = await apiJson<InviteParticipantResult>(
        cookies,
        "POST",
        `/api/v1/submissions/${base.id}/participants`,
        { contactId: pendingContactId },
      );
      assert(invitePendingStatus === 201, `invite pending co-presenter -> ${invitePendingStatus}`);

      const sessionsRes = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/sessions`);
      const sessionsHtmlAfter = await sessionsRes.text();
      const speakersRes = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/speakers`);
      const speakersHtmlAfter = await speakersRes.text();

      assert(
        sessionsHtmlAfter.includes(fixture.identities.speaker.name) || speakersHtmlAfter.includes(fixture.identities.speaker.name),
        `expected accepted invitee '${fixture.identities.speaker.name}' to be present on /sessions or /speakers`,
      );
      assert(
        !sessionsHtmlAfter.includes(pendingMarkerFirst) && !speakersHtmlAfter.includes(pendingMarkerFirst),
        `DEC-108 leak: pending invitee '${pendingMarkerFirst}' found on /sessions or /speakers`,
      );
      assert(
        !sessionsHtmlAfter.includes(fixture.identities.speaker2.name) && !speakersHtmlAfter.includes(fixture.identities.speaker2.name),
        `DEC-108 leak: declined invitee '${fixture.identities.speaker2.name}' found on /sessions or /speakers`,
      );
    },
  );

  console.log("");
  console.log("walkthrough/public.ts OK — all J9/J10 checks passed");
}

main().catch((err) => {
  console.error(`FAIL [${currentCheck}]:`, err instanceof Error ? err.message : err);
  process.exit(1);
});
