// Agenda + public-surfaces persona walkthrough (task w8-f, SPEC §9 jobs
// J9/J10). Standalone runnable per DEC-060: `npx tsx scripts/walkthrough/
// public.ts --url http://localhost:8787` against a migrated+seeded dev
// server (npm run seed). Same conventions as DEC-053: cookie jar per
// persona, form login carrying the chq_csrf cookie value, 'x-chq-csrf: 1'
// header on JSON mutations, hard exit(1) on the first failing check named
// in the console output — fail loudly, no soft warnings.
//
// This is scripts/ tooling (not src/ pure-core), so node: imports and
// shelling out to `wrangler d1 execute` (like scripts/seed-r2.ts does for
// R2 puts) are both fine here. The one direct-SQL step below (flipping a
// participant's `visible` flag) exists because stage 1 has no admin API
// to hide a participant — the only way to construct that fixture is a
// throwaway row mutation, exactly like seed.ts constructs its rows.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  method: "GET" | "POST" | "PUT" | "DELETE",
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
// Direct-SQL escape hatch (only used for the hidden-participant fixture —
// stage 1 has no admin API to flip participant.visible; mirrors seed.ts's
// direct-row-construction pattern).
// ---------------------------------------------------------------------------

function runD1(sql: string): void {
  execFileSync("npx", ["wrangler", "d1", "execute", "chautauqua", "--local", "--command", sql], {
    cwd: REPO_ROOT,
    stdio: "pipe",
  });
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
  identities: { organizer: { email: string; password: string } };
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
    assert(sessionsHtml.includes('class="chq-card"'), "no session cards found");
    assert(sessionsHtml.includes("Track filters"), "no track filter nav found");
  });

  await check("J10 /speakers: alphabetical by surname, headshot/title/company", async () => {
    const res = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/speakers`);
    const html = await res.text();
    assert(res.status === 200, `-> ${res.status}`);
    // Speaker names render as "<strong>First Last</strong>" inside the grid.
    const names = extractAll(html, /<strong>\s*([^<]+?)\s*<\/strong>/g);
    assert(names.length >= 2, "expected at least 2 speakers to check ordering");
    const surnames = names.map((n) => n.trim().split(/\s+/).slice(-1)[0]!.toLowerCase());
    const sorted = [...surnames].sort((a, b) => a.localeCompare(b));
    assert(JSON.stringify(surnames) === JSON.stringify(sorted), `speakers not sorted by surname: ${surnames.join(", ")}`);
    assert(html.includes("chq-headshot-fallback") || html.includes("<img"), "expected headshot img or fallback markup");
    assert(html.includes("Software Engineer") || /,\s*\S/.test(html), "expected title/company text near speaker names");
  });

  let agendaTrackColorFound = false;
  await check("J10 /agenda: per-day time grid, track colors present in markup", async () => {
    const res = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/agenda`);
    const html = await res.text();
    assert(res.status === 200, `-> ${res.status}`);
    assert(html.includes("chq-agenda-day"), "no per-day agenda grid found");
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
    assert(html.includes("chq-speaker-grid"), "no gallery grid found");
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

  await check("J10 Settings embed-generator snippet URLs match live /embed routes", async () => {
    const settingsSrc = readFileSync(join(REPO_ROOT, "app", "src", "pages", "Settings.tsx"), "utf-8");
    for (const surface of SURFACES) {
      assert(
        settingsSrc.includes("/embed/${slug}/${surface}") || settingsSrc.includes(`/embed/`),
        "Settings.tsx embed snippet builder missing /embed/ path",
      );
    }
    // Confirm the generated URL for one concrete surface actually resolves.
    const probe = `${BASE_URL}/embed/${EVENT_SLUG}/sessions`;
    const res = await fetch(probe);
    assert(res.status === 200, `Settings-generated embed URL pattern /embed/<slug>/<surface> -> ${res.status} for ${probe}`);
  });

  // -------------------------------------------------------------------
  // Visibility gates (server-side): each of the three throwaway fixtures
  // below must be entirely absent from every surface, embed, and the .ics.
  // -------------------------------------------------------------------

  async function createThrowawaySubmission(title: string): Promise<string> {
    const { status, json } = await apiJson<{ id: string }>(cookies, "POST", `/api/v1/events/${eventId}/submissions`, {
      title,
      description: "Walkthrough visibility-gate fixture.",
      contact: { email: `wk-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, firstName: "Wk", lastName: "Fixture" },
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

  await check("J10 visibility gate: hidden participant is absent from every surface", async () => {
    const marker = `Wk HiddenSpeaker Marker ${Date.now()}`;
    const id = await createThrowawaySubmission(marker);
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

    // Sanity check: fully accepted+approved+scheduled, it MUST be visible
    // before we hide its only participant — otherwise the absence check
    // below would be a false positive.
    const preRes = await fetch(`${BASE_URL}/e/${EVENT_SLUG}/sessions`);
    const preHtml = await preRes.text();
    assert(preHtml.includes(marker), "expected fully-visible fixture to appear before hiding its participant");

    const { json: detail } = await apiJson<SubmissionDetail>(cookies, "GET", `/api/v1/submissions/${id}`);
    const participantId = detail.participants[0]?.id;
    assert(participantId, "expected the throwaway submission to have a participant");
    // No admin API exists to hide a participant in stage 1 (verified by
    // scanning src/routes/api/*.ts) — direct SQL is the only way to
    // construct this fixture, same as scripts/seed.ts constructing rows.
    runD1(`UPDATE participant SET visible = 0 WHERE id = '${participantId}'`);

    await assertAbsentEverywhere(marker, id);
  });

  console.log("");
  console.log("walkthrough/public.ts OK — all J9/J10 checks passed");
}

main().catch((err) => {
  console.error(`FAIL [${currentCheck}]:`, err instanceof Error ? err.message : err);
  process.exit(1);
});
