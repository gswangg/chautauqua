// J6/J7/J8 speaker/onboarding/content persona walkthrough (task w8-e, SPEC
// §9 jobs J6/J7/J8). Standalone runnable per DEC-060: `npx tsx
// scripts/walkthrough/speaker.ts --url http://localhost:8787` against a
// migrated+seeded dev server (npm run db:migrate && npm run seed). Same
// conventions as DEC-053: cookie jar per persona, GET /login captures the
// chq_csrf cookie, form posts carry that value as a same-named hidden
// field, JSON mutations send header 'x-chq-csrf: 1', hard exit(1) on the
// first failing check named in the console output — fail loudly, no soft
// warnings.
//
// This is scripts/ tooling (not src/ pure-core). task-w14-g converts the
// prior direct-SQL 'invited' participant-row fixture to the real DEC-070
// endpoint (POST /api/v1/submissions/:id/participants), now that the
// organizer participant-management routes exist on main.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lockedFieldName } from "../../src/forms/types";
import { dayLabelMs } from "../walkthrough-lib";

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

interface FixtureData {
  identities: {
    organizer: { email: string; password: string; name: string };
    speaker: { email: string; password: string; name: string };
    speaker2: { email: string; password: string; name: string };
  };
}

const fixture: FixtureData = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));

// ---------------------------------------------------------------------------
// Fail-loudly assertion helpers (DEC-053/060)
// ---------------------------------------------------------------------------

let currentCheck = "(startup)";

function fail(message: string): never {
  console.error(`FAIL [${currentCheck}]: ${message}`);
  process.exit(1);
}

async function check<T>(name: string, fn: () => Promise<T>): Promise<T> {
  currentCheck = name;
  const result = await fn();
  console.log(`ok   ${name}`);
  return result;
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

class Session {
  cookies: Cookies = {};

  async login(email: string, password: string): Promise<void> {
    const getRes = await fetch(`${BASE_URL}/login`);
    if (!getRes.ok) throw new Error(`GET /login failed: ${getRes.status}`);
    parseSetCookies(getRes, this.cookies);
    if (!this.cookies.chq_csrf) throw new Error("GET /login did not set a chq_csrf cookie");

    const body = new URLSearchParams({ email, password, chq_csrf: this.cookies.chq_csrf });
    const postRes = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader(this.cookies) },
      body: body.toString(),
      redirect: "manual",
    });
    if (postRes.status !== 302) {
      throw new Error(`POST /login for ${email} failed: expected 302, got ${postRes.status}`);
    }
    parseSetCookies(postRes, this.cookies);
    if (!this.cookies.chq_session) throw new Error(`POST /login for ${email} did not set a chq_session cookie`);
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return { cookie: cookieHeader(this.cookies), ...extra };
  }

  async getJson<T>(path: string): Promise<{ status: number; body: T }> {
    const res = await fetch(`${BASE_URL}${path}`, { headers: this.headers() });
    const body = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, body };
  }

  async getText(path: string): Promise<{ status: number; body: string }> {
    const res = await fetch(`${BASE_URL}${path}`, { headers: this.headers() });
    return { status: res.status, body: await res.text() };
  }

  async postJson<T>(path: string, json: unknown): Promise<{ status: number; body: T }> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: this.headers({ "content-type": "application/json", "x-chq-csrf": "1" }),
      body: JSON.stringify(json),
    });
    const body = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, body };
  }

  async patchJson<T>(path: string, json: unknown): Promise<{ status: number; body: T }> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers: this.headers({ "content-type": "application/json", "x-chq-csrf": "1" }),
      body: JSON.stringify(json),
    });
    const body = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, body };
  }

  async postForm(path: string, fields: Record<string, string>): Promise<{ status: number; body: string }> {
    const body = new URLSearchParams({ chq_csrf: this.cookies.chq_csrf ?? "", ...fields });
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: this.headers({ "content-type": "application/x-www-form-urlencoded" }),
      body: body.toString(),
      redirect: "manual",
    });
    return { status: res.status, body: await res.text().catch(() => "") };
  }

  async postMultipart(path: string, form: FormData): Promise<{ status: number; body: unknown }> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: this.headers({ "x-chq-csrf": "1" }),
      body: form,
      redirect: "manual",
    });
    const contentType = res.headers.get("content-type") ?? "";
    const body = contentType.includes("json") ? await res.json().catch(() => ({})) : await res.text();
    return { status: res.status, body };
  }

  async getBinary(path: string): Promise<{ status: number; bytes: number; contentDisposition: string | null }> {
    const res = await fetch(`${BASE_URL}${path}`, { headers: this.headers() });
    const buf = await res.arrayBuffer();
    return { status: res.status, bytes: buf.byteLength, contentDisposition: res.headers.get("content-disposition") };
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
// Shared response shapes (only the fields this script reads)
// ---------------------------------------------------------------------------

interface EventListItem {
  id: string;
  slug: string;
}
interface SubmissionListItem {
  id: string;
  status: string;
}
interface SubmissionParticipant {
  id: string;
  contactId: string;
  email: string;
  role: string;
}
interface SubmissionDetail {
  id: string;
  ref: string;
  title: string;
  status: string;
  acceptedAt: number | null;
  participants: SubmissionParticipant[];
}
interface GridTask {
  id: string;
  title: string;
  kind: string;
  required: boolean;
  dueDate: number | null;
}
interface GridCell {
  taskId: string;
  assignmentId: string;
  status: string;
}
interface GridRow {
  contact: { id: string; email: string };
  cells: GridCell[];
}
interface OnboardingGrid {
  tasks: GridTask[];
  rows: GridRow[];
}
interface FormRow {
  id: string;
  closeDate: number | null;
}
interface CfpFormField {
  id: string;
  kind: "text" | "long_text" | "dropdown" | "checkbox" | "number" | "file";
  required: boolean;
  options: string[] | null;
}
interface CfpFormWithFields extends FormRow {
  fields: CfpFormField[];
}
interface FileUploadResult {
  id: string;
  filename: string;
  kind: string;
}
interface FilesByKindResponse {
  items: Array<{ id: string; kind: string; filename: string; previousFileId: string | null }>;
}
// DEC-020: "Comments ... rows carry author name + role" — the API never
// echoes raw authorContactId/authorUserId, so assertions below key off
// authorRole (walkthrough-only fix; the product's shape is correct per DEC).
// src/server/repo/files.ts's FileCommentRow serializes authorName/authorRole
// (resolved server-side), not the raw authorUserId/authorContactId columns.
// The original w8-e version of this check asserted on fields the API never
// returns, so it could never actually fail on a broken reply.
interface CommentsResponse {
  items: Array<{ id: string; body: string; authorName: string; authorRole: string }>;
}
interface ContactDetail {
  id: string;
  bio: string | null;
}
interface CreateSubmissionResult {
  id: string;
}

async function main(): Promise<void> {
  await check("GET /health is up", waitForHealth);

  const organizer = new Session();
  await check("organizer logs in (form login, chq_csrf cookie contract)", async () => {
    await organizer.login(fixture.identities.organizer.email, fixture.identities.organizer.password);
  });

  const eventId = await check("resolve devflow-conf-2027 event id", async () => {
    const { status, body } = await organizer.getJson<{ items: EventListItem[] }>("/api/v1/events");
    assert(status === 200, `GET /api/v1/events returned ${status}`);
    const event = body.items.find((e) => e.slug === EVENT_SLUG);
    assert(event, `no event with slug '${EVENT_SLUG}' found`);
    return event!.id;
  });

  // -------------------------------------------------------------------------
  // J6: organizer accepts a pending submission -> acceptance auto-creation
  // -------------------------------------------------------------------------

  const speaker1Submission = await check(
    "find a pending fixture submission belonging to the seeded speaker",
    async () => {
      const { status, body } = await organizer.getJson<{ items: SubmissionListItem[] }>(
        `/api/v1/events/${eventId}/submissions?status=pending&q=${encodeURIComponent(fixture.identities.speaker.name)}&perPage=10`,
      );
      assert(status === 200, `GET submissions?status=pending failed: ${status}`);
      const item = body.items[0];
      assert(item, `no pending submission found for ${fixture.identities.speaker.name}`);
      return item!;
    },
  );

  const detailBefore = await check("submission detail before acceptance is 'pending'", async () => {
    const { status, body } = await organizer.getJson<SubmissionDetail>(`/api/v1/submissions/${speaker1Submission.id}`);
    assert(status === 200, `GET submission detail returned ${status}`);
    assert(body.status === "pending", `expected status 'pending', got '${body.status}'`);
    const participant = body.participants.find((p) => p.email === fixture.identities.speaker.email);
    assert(participant, "seeded speaker is not a participant on the chosen submission");
    return body;
  });

  await check("organizer accepts the submission (bulk status change)", async () => {
    const { status, body } = await organizer.postJson<{ updated: number }>(
      `/api/v1/events/${eventId}/submissions/status`,
      { ids: [speaker1Submission.id], status: "accepted" },
    );
    assert(status === 200, `POST submissions/status returned ${status}: ${JSON.stringify(body)}`);
    assert(body.updated === 1, `expected updated:1, got ${JSON.stringify(body)}`);
  });

  const detailAfter = await check(
    "same submission row is now the accepted session (same id, status flips)",
    async () => {
      const { status, body } = await organizer.getJson<SubmissionDetail>(`/api/v1/submissions/${speaker1Submission.id}`);
      assert(status === 200, `GET submission detail returned ${status}`);
      assert(body.id === detailBefore.id, "submission id changed across acceptance — should be the same row");
      assert(body.status === "accepted", `expected status 'accepted', got '${body.status}'`);
      assert(body.acceptedAt !== null, "acceptedAt should be set after acceptance");
      return body;
    },
  );

  const speakerParticipant = detailAfter.participants.find((p) => p.email === fixture.identities.speaker.email)!;

  await check("default onboarding task set was created for the speaker", async () => {
    const { status, body } = await organizer.getJson<OnboardingGrid>(`/api/v1/events/${eventId}/onboarding`);
    assert(status === 200, `GET onboarding grid returned ${status}`);
    const row = body.rows.find((r) => r.contact.id === speakerParticipant.contactId);
    assert(row, "no onboarding grid row for the newly-accepted speaker");

    const titlesForRow = row!.cells
      .map((cell) => body.tasks.find((t) => t.id === cell.taskId)?.title)
      .filter((t): t is string => Boolean(t));
    for (const title of [
      "Hotel stay requirement form",
      "Flight reimbursement form",
      "Finalize talk description",
      "Finalize bio + headshot",
      "Announce participation",
    ]) {
      assert(titlesForRow.includes(title), `onboarding tasks missing '${title}': ${titlesForRow.join(", ")}`);
    }

    const hotelTask = body.tasks.find((t) => t.title === "Hotel stay requirement form");
    const flightTask = body.tasks.find((t) => t.title === "Flight reimbursement form");
    assert(hotelTask?.kind === "form" && hotelTask.required, "Hotel task must be kind 'form' and required");
    assert(flightTask?.kind === "form" && flightTask.required, "Flight task must be kind 'form' and required");
    assert("dueDate" in (hotelTask ?? {}), "grid task is missing a dueDate field");
  });

  await check("re-accepting is idempotent (no duplicate onboarding tasks)", async () => {
    const before = await organizer.getJson<OnboardingGrid>(`/api/v1/events/${eventId}/onboarding`);
    const rowBefore = before.body.rows.find((r) => r.contact.id === speakerParticipant.contactId)!;
    const countBefore = rowBefore.cells.length;

    const { status } = await organizer.postJson<{ updated: number }>(
      `/api/v1/events/${eventId}/submissions/status`,
      { ids: [speaker1Submission.id], status: "accepted" },
    );
    assert(status === 200, `re-POST submissions/status returned ${status}`);

    const after = await organizer.getJson<OnboardingGrid>(`/api/v1/events/${eventId}/onboarding`);
    const rowAfter = after.body.rows.find((r) => r.contact.id === speakerParticipant.contactId)!;
    assert(
      rowAfter.cells.length === countBefore,
      `idempotency violated: onboarding task count changed from ${countBefore} to ${rowAfter.cells.length}`,
    );
  });

  await check("bulk remind outstanding writes email_log rows (visible in dev mailbox)", async () => {
    const { status, body } = await organizer.postJson<{ sent: number }>(
      `/api/v1/events/${eventId}/onboarding/remind`,
      {},
    );
    assert(status === 200, `POST onboarding/remind returned ${status}: ${JSON.stringify(body)}`);
    assert(body.sent >= 1, `expected at least 1 reminder sent, got ${JSON.stringify(body)}`);

    const mailbox = await organizer.getText("/dev/mailbox?perPage=50");
    assert(mailbox.status === 200, `GET /dev/mailbox returned ${mailbox.status} (DEV_MODE must be '1')`);
    assert(
      mailbox.body.includes(fixture.identities.speaker.email),
      "dev mailbox does not list a message to the seeded speaker after bulk remind",
    );
    assert(
      mailbox.body.includes("outstanding tasks"),
      "dev mailbox message does not have the expected reminder subject",
    );
  });

  // -------------------------------------------------------------------------
  // J7: speaker portal — submissions, tasks, sessions, resources, profile,
  // invitations, edit-lock
  // -------------------------------------------------------------------------

  const speaker1 = new Session();
  await check("speaker logs in", async () => {
    await speaker1.login(fixture.identities.speaker.email, fixture.identities.speaker.password);
  });

  await check("portal dashboard shows my submissions with status", async () => {
    const dashboard = await speaker1.getText("/portal");
    assert(dashboard.status === 200, `GET /portal returned ${dashboard.status}`);
    assert(dashboard.body.includes(detailAfter.ref), "portal dashboard is missing my accepted submission's ref");
  });

  await check("portal dashboard shows tasks with deadlines/required markers", async () => {
    const dashboard = await speaker1.getText("/portal");
    assert(dashboard.body.includes("Hotel stay requirement form"), "portal dashboard missing onboarding task");
    assert(dashboard.body.includes("(required)"), "portal dashboard is missing a required-task marker");
  });

  await check("same accepted submission appears as my session", async () => {
    const dashboard = await speaker1.getText("/portal");
    assert(dashboard.body.includes(detailAfter.title), "portal Sessions section is missing my accepted talk");
  });

  await check("resources page lists both a wiki page and a downloadable file resource", async () => {
    const resources = await speaker1.getText("/portal/resources");
    assert(resources.status === 200, `GET /portal/resources returned ${resources.status}`);
    assert(resources.body.includes("Speaker Handbook"), "resources page missing the seeded wiki resource");
    assert(resources.body.includes("Download"), "resources page missing a downloadable file resource");
  });

  const myAssignmentId = await check("find my own general task's assignment id via /portal/tasks", async () => {
    const tasksPage = await speaker1.getText("/portal/tasks");
    assert(tasksPage.status === 200, `GET /portal/tasks returned ${tasksPage.status}`);
    const match = tasksPage.body.match(/\/portal\/tasks\/([\w-]+)\/complete/);
    assert(match, "could not find a 'Mark complete' form action on /portal/tasks");
    return match![1]!;
  });

  await check("complete a general task via its own form action", async () => {
    const res = await speaker1.postForm(`/portal/tasks/${myAssignmentId}/complete`, {});
    assert(res.status === 302, `POST task complete expected 302, got ${res.status}`);

    const tasksPage = await speaker1.getText("/portal/tasks");
    // DEC-366: on-screen wording is frozen as "Done"/"To do" (never
    // "Completed"/"Pending") — the underlying status value stays
    // pending|complete, but only the .chq-flag label text renders.
    // src/routes/portal/tasks/views.tsx:237-238 renders a completed
    // assignment's status flag as "Done" (chq-portal-flag-done), not
    // "Completed" — this walkthrough previously asserted the wrong label.
    // Probe the class, not the bare word "Done", which appears elsewhere.
    assert(tasksPage.body.includes("chq-portal-flag-done"), "task list does not show the task as Done after marking it");
  });

  // -------------------------------------------------------------------------
  // DEC-111 (landed on main, task w11-a re-lands the DEC-112 probes per
  // DEC-113): acceptance-created 'Hotel stay requirement form' and 'Flight
  // reimbursement form' onboarding tasks (kind 'form', SPEC.md:131-132) get a
  // real backing form self-healed onto task.formId at task-creation time
  // (find-or-create by exact title, isDefault=false; getOrCreateTask in
  // src/server/repo/submissions/status.ts). Hotel is exercised as a
  // GET-only 'form present at creation' probe below (no POST — it stays
  // Pending so the ad hoc-task attach flow further down remains untouched
  // coverage of a *different* path: PATCH/attach-at-creation of an
  // organizer-authored task, not the self-healed default tasks). Flight is
  // exercised end to end (GET the self-healed form, fill it, POST, confirm
  // completion) via completeSelfHealedFormTask below.
  // -------------------------------------------------------------------------

  function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // DEC-412 repair: /portal/tasks task rows used to render as <li> inside a
  // <ul> (pre-redesign markup); the redesign (docs/design/'Chautauqua Public
  // and Portal.dc.html' lines ~179-188, sc-for over `tasks`) moved each row
  // to a top-level '<div class="chq-portal-row">' with no <li>/<ul> anywhere
  // in TaskRow (src/routes/portal/tasks.tsx) — function is unchanged, only
  // the markup token bounding "one row's worth of HTML" changed. Every
  // per-row regex below is re-pinned from the stale '</li>' boundary to the
  // start of the *next* row's div, which is the smallest stable token that
  // still scopes a match to a single row.
  // Row boundary for scoping a row-scanning regex to a single task: each
  // task row is `<div class="chq-portal-row" id="task-...">` (see
  // src/routes/portal/tasks/views.tsx TaskRow) — the id attribute is always
  // present, so a literal '<div class="chq-portal-row">' (no id=) never
  // actually appears in the markup and this negative lookahead previously
  // never fired, letting every ${NEXT_TASK_ROW}-scoped regex below scan
  // straight through row boundaries to the first match ANYWHERE later in
  // the page instead of stopping at the intended row.
  const NEXT_TASK_ROW = escapeRegex('<div class="chq-portal-row" id="');

  async function completeSelfHealedFormTask(taskTitle: string, expectedBodyText?: string): Promise<void> {
    // Look up the assignment id via the organizer's onboarding grid (DEC-023
    // owns assignment status semantics; the grid's assignmentId is stable
    // regardless of the task's current pending/complete status), rather
    // than scraping /portal/tasks for a 'Fill out form' href — the seed's
    // isComplete distribution (scripts/seed.ts) may seed some self-healed
    // form tasks as already-complete for a given contact, in which case the
    // portal page never renders that href at all.
    const assignmentId = await check(
      `find my '${taskTitle}' task's assignment id via the organizer's onboarding grid (DEC-111 self-healed form)`,
      async () => {
        const { status, body } = await organizer.getJson<OnboardingGrid>(`/api/v1/events/${eventId}/onboarding`);
        assert(status === 200, `GET onboarding grid returned ${status}`);
        const row = body.rows.find((r) => r.contact.id === speakerParticipant.contactId);
        assert(row, "no onboarding grid row for the speaker");
        const task = body.tasks.find((t) => t.title === taskTitle);
        assert(task, `no onboarding task titled '${taskTitle}' found in the grid`);
        const cell = row!.cells.find((c) => c.taskId === task!.id);
        assert(cell, `no onboarding grid cell for task '${taskTitle}' on the speaker's row`);
        return cell!.assignmentId;
      },
    );

    const dropdownFieldName = await check(
      `GET /portal/tasks/:assignmentId/form for '${taskTitle}' returns 200 (DEC-111: real formId, not 400 'not a form task')`,
      async () => {
        const res = await speaker1.getText(`/portal/tasks/${assignmentId}/form`);
        assert(
          res.status === 200,
          `GET /portal/tasks/${assignmentId}/form returned ${res.status} (expected 200 once DEC-111 self-heals task.formId): ${res.body.slice(0, 300)}`,
        );
        if (expectedBodyText) {
          assert(
            res.body.includes(expectedBodyText),
            `'${taskTitle}' form page is missing the expected field prompt '${expectedBodyText}' (DEC-111 field spec)`,
          );
        }
        const match = res.body.match(/<select[^>]*name="(field__[\w-]+)"/);
        assert(
          match,
          `'${taskTitle}' form page has no dropdown <select> field (expected the required 'Yes'/'No' dropdown per DEC-111)`,
        );
        return match![1]!;
      },
    );

    await check(`POST valid answers for '${taskTitle}' (required dropdown 'Yes', csrfForm-formatted body) completes the assignment`, async () => {
      const res = await speaker1.postForm(`/portal/tasks/${assignmentId}/form`, {
        [dropdownFieldName]: "Yes",
      });
      assert(res.status === 302, `POST /portal/tasks/${assignmentId}/form expected 302, got ${res.status}`);

      const tasksPage = await speaker1.getText("/portal/tasks");
      assert(
        !tasksPage.body.includes(`/portal/tasks/${assignmentId}/form`),
        `'${taskTitle}' still shows a 'Fill out form' link after completion`,
      );
      // DEC-366: on-screen wording is frozen as "Done"/"To do".
      // src/routes/portal/tasks/views.tsx:237-238 renders "Done"/"To do"
      // (never "Completed"/"Pending") behind the chq-flag / chq-portal-
      // flag-done classes.
      const rowMatch = tasksPage.body.match(
        new RegExp(`${escapeRegex(taskTitle)}(?:(?!${NEXT_TASK_ROW})[\\s\\S])*?(Done|To do)`),
      );
      assert(rowMatch, `could not find the '${taskTitle}' row on /portal/tasks after submission`);
      assert(
        rowMatch![1] === "Done",
        `'${taskTitle}' assignment status is '${rowMatch![1]}', expected 'Done' after submission`,
      );
    });
  }

  const hotelFormAssignmentId = await check(
    "find my 'Hotel stay requirement form' task's assignment id via /portal/tasks (DEC-111 self-healed form)",
    async () => {
      const tasksPage = await speaker1.getText("/portal/tasks");
      assert(tasksPage.status === 200, `GET /portal/tasks returned ${tasksPage.status}`);
      const match = tasksPage.body.match(
        new RegExp(
          `${escapeRegex("Hotel stay requirement form")}(?:(?!${NEXT_TASK_ROW})[\\s\\S])*?href="\\/portal\\/tasks\\/([\\w-]+)\\/form"`,
        ),
      );
      assert(match, "could not find the 'Hotel stay requirement form' task's 'Fill out form' link on /portal/tasks");
      return match![1]!;
    },
  );

  await check(
    "GET /portal/tasks/:assignmentId/form for 'Hotel stay requirement form' returns 200 (DEC-111: real formId self-healed at task creation, not a 400 'not a form task') — GET only, task is left Pending",
    async () => {
      const res = await speaker1.getText(`/portal/tasks/${hotelFormAssignmentId}/form`);
      assert(
        res.status === 200,
        `GET /portal/tasks/${hotelFormAssignmentId}/form returned ${res.status} (expected 200 once DEC-111 self-heals task.formId): ${res.body.slice(0, 300)}`,
      );
    },
  );

  await completeSelfHealedFormTask("Flight reimbursement form", "Do you need flight reimbursement?");

  // -------------------------------------------------------------------------
  // form-kind task assignment (task w10-a addition, retargeted at an ad hoc
  // task by task w10-e so it doesn't collide with the DEC-111 Hotel/Flight
  // probes above, which now own those two task titles end to end): an
  // organizer-created custom kind='form' task starts with formId set at
  // creation time (no self-heal needed — this exercises the general
  // attach-a-form-then-complete flow with the seeded CFP form's real field
  // mix, independent of DEC-111's fixed Hotel/Flight field specs).
  // -------------------------------------------------------------------------

  const cfpForm = await check("fetch the event's CFP form + fields (reused as the ad hoc task's form)", async () => {
    const { status, body } = await organizer.getJson<CfpFormWithFields>(`/api/v1/events/${eventId}/forms`);
    assert(status === 200, `GET event forms returned ${status}`);
    assert(Array.isArray(body.fields), "CFP form response is missing a fields array");
    return body;
  });

  const adHocFormTaskTitle = `Walkthrough ad hoc form task ${Date.now()}`;

  const adHocTaskId = await check(
    "organizer creates a custom kind='form' task with the CFP form attached at creation time",
    async () => {
      const { status, body } = await organizer.postJson<{ id: string }>(`/api/v1/events/${eventId}/tasks`, {
        kind: "form",
        title: adHocFormTaskTitle,
        description: null,
        dueDate: null,
        required: true,
        formId: cfpForm.id,
      });
      assert(status === 201, `create ad hoc form task returned ${status}: ${JSON.stringify(body)}`);
      return body.id;
    },
  );

  await check("organizer assigns the ad hoc form task to the speaker", async () => {
    const { status } = await organizer.postJson<unknown>(`/api/v1/tasks/${adHocTaskId}/assign`, {
      contactIds: [speakerParticipant.contactId],
    });
    assert(status === 200, `POST tasks/:id/assign returned ${status}`);
  });

  const adHocAssignmentId = await check(
    `find my '${adHocFormTaskTitle}' task's assignment id via /portal/tasks`,
    async () => {
      const tasksPage = await speaker1.getText("/portal/tasks");
      assert(tasksPage.status === 200, `GET /portal/tasks returned ${tasksPage.status}`);
      const match = tasksPage.body.match(
        new RegExp(`${escapeRegex(adHocFormTaskTitle)}(?:(?!${NEXT_TASK_ROW})[\\s\\S])*?href="\\/portal\\/tasks\\/([\\w-]+)\\/form"`),
      );
      assert(match, `could not find the '${adHocFormTaskTitle}' task's 'Fill out form' link on /portal/tasks`);
      return match![1]!;
    },
  );

  await check("complete the ad hoc form-kind task assignment (dynamic field fill from the attached CFP form)", async () => {
    const fields: Record<string, string> = {};
    for (const f of cfpForm.fields) {
      if (!f.required) continue;
      if (f.kind === "file") continue; // no file-kind fields on the seeded CFP form; not drivable via this form-encoded POST
      const name = `field__${f.id}`;
      if (f.kind === "dropdown") {
        assert(f.options && f.options.length > 0, `dropdown field ${f.id} has no options`);
        fields[name] = f.options![0]!;
      } else if (f.kind === "checkbox") {
        fields[name] = "true";
      } else if (f.kind === "number") {
        fields[name] = "1";
      } else if (lockedFieldName(f.id) === "email") {
        // The locked CFP email field is validated/normalized by
        // validateAnswers (DEC-454/DEC-455); a fabricated string fails
        // that check, so reuse the speaker persona's own real address.
        fields[name] = fixture.identities.speaker.email;
      } else {
        fields[name] = `Walkthrough answer for field ${f.id}`;
      }
    }
    const res = await speaker1.postForm(`/portal/tasks/${adHocAssignmentId}/form`, fields);
    assert(res.status === 302, `POST form-kind task completion expected 302, got ${res.status}`);

    const tasksPage = await speaker1.getText("/portal/tasks");
    assert(
      !tasksPage.body.includes(`/portal/tasks/${adHocAssignmentId}/form`),
      "the 'Fill out form' link should be gone once the form-kind task assignment is complete",
    );
  });

  // -------------------------------------------------------------------------
  // file_request-kind task assignment upload + the DEC-244 deliverable panel
  // (implements DEC-242): beyond the 302 on upload, this now exercises the
  // full portal round trip — the completed assignment's file panel on
  // /portal/tasks (filename/version/CHAIN-LATEST download link/Replace
  // form/Comments section), the dedicated GET .../file download route
  // (Content-Disposition, never the organizer /files route), posting a
  // reply via the double-submit chq_csrf FORM FIELD (not the x-chq-csrf
  // header used by JSON mutations — see docs/verification-log/
  // task-w2-e-findings-closure.md's CNT-07a note), the reply rendering back
  // on re-GET, and the MAX_COMMENT_BODY_LENGTH=4000 cap re-rendering the
  // page inline (200, draft kept) for an oversized body (DEC-244 amendment,
  // wave 56).
  // -------------------------------------------------------------------------

  // DEC-009 amendment (wave 59): the seeded 'Finalize bio + headshot'
  // default onboarding task changed kind from 'file_request' to 'general'
  // (src/domain/acceptance.ts PROFILE_TASK_TITLE) — it now completes via a
  // /portal/profile bio+headshot save, not an upload widget, and no default
  // onboarding task is 'file_request' kind anymore. This walkthrough
  // predates that amendment. Exercise the DEC-244 deliverable panel against
  // an organizer-created ad hoc file_request task instead (same idiom as
  // the ad hoc form-kind task above), which keeps the upload/version/
  // comment-thread flow covered independent of the default task set.
  const adHocFileTaskTitle = `Walkthrough ad hoc file task ${Date.now()}`;

  const adHocFileTaskId = await check(
    "organizer creates a custom kind='file_request' task",
    async () => {
      const { status, body } = await organizer.postJson<{ id: string }>(`/api/v1/events/${eventId}/tasks`, {
        kind: "file_request",
        title: adHocFileTaskTitle,
        description: null,
        dueDate: null,
        required: true,
        deliverableKind: "handout",
      });
      assert(status === 201, `create ad hoc file_request task returned ${status}: ${JSON.stringify(body)}`);
      return body.id;
    },
  );

  await check("organizer assigns the ad hoc file_request task to the speaker", async () => {
    const { status } = await organizer.postJson<unknown>(`/api/v1/tasks/${adHocFileTaskId}/assign`, {
      contactIds: [speakerParticipant.contactId],
    });
    assert(status === 200, `POST tasks/:id/assign returned ${status}`);
  });

  const bioAssignmentId = await check(
    `find my '${adHocFileTaskTitle}' task's assignment id via /portal/tasks`,
    async () => {
      const tasksPage = await speaker1.getText("/portal/tasks");
      const match = tasksPage.body.match(
        new RegExp(`${escapeRegex(adHocFileTaskTitle)}(?:(?!${NEXT_TASK_ROW})[\\s\\S])*?action="\\/portal\\/tasks\\/([\\w-]+)\\/upload"`),
      );
      assert(
        match,
        `could not find the '${adHocFileTaskTitle}' task's upload form action on /portal/tasks`,
      );
      return match![1]!;
    },
  );

  await check("upload to the file_request onboarding task assignment (assert 302 only)", async () => {
    // DEC-891 "conditional-and-quiet": a <select name="submissionId"> only
    // renders on this upload form once the speaker has 2+ eligible
    // accepted sessions (src/routes/portal/tasks/views.tsx
    // DeliverableSelect); by this point in the walkthrough the seeded
    // speaker has multiple accepted submissions, so scrape the rendered
    // option (falling back to none for the lone-candidate case) instead of
    // assuming the field is absent.
    const tasksPageForUpload = await speaker1.getText("/portal/tasks");
    const submissionIdMatch = tasksPageForUpload.body.match(
      new RegExp(`${escapeRegex(adHocFileTaskTitle)}(?:(?!${NEXT_TASK_ROW})[\\s\\S])*?<select name="submissionId"[^>]*>([\\s\\S]*?)<\\/select>`),
    );
    const chosenSubmissionId = submissionIdMatch
      ? submissionIdMatch[1]!.match(/<option value="([\w-]+)"/)?.[1]
      : undefined;

    const form = new FormData();
    form.set("chq_csrf", speaker1.cookies.chq_csrf ?? "");
    form.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])], "walkthrough-bio-photo.jpg", { type: "image/jpeg" }));
    if (chosenSubmissionId) form.set("submissionId", chosenSubmissionId);
    const res = await speaker1.postMultipart(`/portal/tasks/${bioAssignmentId}/upload`, form);
    assert(res.status === 302, `POST /portal/tasks/:assignmentId/upload expected 302, got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  await check(
    `GET /portal/tasks shows the DEC-244 deliverable panel at version 1 for the completed '${adHocFileTaskTitle}' assignment`,
    async () => {
      const tasksPage = await speaker1.getText("/portal/tasks");
      assert(tasksPage.status === 200, `GET /portal/tasks returned ${tasksPage.status}`);
      const rowMatch = tasksPage.body.match(
        new RegExp(`${escapeRegex(adHocFileTaskTitle)}(?:(?!${NEXT_TASK_ROW})[\\s\\S])*`),
      );
      assert(rowMatch, `could not find the '${adHocFileTaskTitle}' task row on /portal/tasks`);
      const row = rowMatch![0]!;
      // DEC-412 repair: the redesign added a 'chq-card' class to this
      // section for styling (src/routes/portal/tasks.tsx TaskRow), so the
      // exact-attribute-order string match below is re-pinned to just the
      // stable aria-label token rather than the full opening tag.
      assert(row.includes('aria-label="Uploaded file"'), "row is missing the Uploaded file section");
      assert(row.includes("walkthrough-bio-photo.jpg"), "row is missing the uploaded filename");
      // DEC-244 wave-28 amendment: adHocFileTaskTitle is minted at runtime
      // (Date.now(), :719) and the task is created + assigned within this
      // same run (:721-742) — no scripts/seed.ts loop can have pre-completed
      // it, so the single upload above lands at version 1. The lane itself
      // performs a second (replace) upload below to exercise version 2 and
      // the version-history chain, rather than asserting on seed state it
      // never created (DEC-244/w28 amendment).
      assert(row.includes("version 1"), "row is missing 'version 1'");
      assert(
        new RegExp(`href="\\/portal\\/tasks\\/${escapeRegex(bioAssignmentId)}\\/file"`).test(row),
        "row is missing a download link to /portal/tasks/:assignmentId/file",
      );
      assert(row.includes(">Replace file<"), "row is missing the 'Replace file' button");
      assert(row.includes('<section aria-label="Comments">'), "row is missing the Comments section");
      assert(row.includes('<section aria-label="Version history">'), "row is missing the Version history section");
      const historyMatch = row.match(/<section aria-label="Version history">[\s\S]*?<\/section>/);
      assert(historyMatch, "could not isolate the Version history section");
      const history = historyMatch![0]!;
      const versionNums = [...history.matchAll(/chq-portal-version-num">v(\d+)</g)].map((m) => m[1]);
      assert(
        versionNums.length === 1 && versionNums[0] === "1",
        `expected exactly one v1 row in Version history, got ${JSON.stringify(versionNums)}`,
      );
      assert(history.includes('chq-portal-flag-done">Current<'), "the v1 row is missing the Current marker");
    },
  );

  await check(
    "replace-upload a second file onto the same file_request assignment (assert 302)",
    async () => {
      // Same idiom as the first upload above: the panel's Replace form
      // re-posts multipart to the same endpoint (views.tsx:299), with a
      // distinct filename so the version chain and flat block can be told
      // apart on the next GET.
      const tasksPageForReupload = await speaker1.getText("/portal/tasks");
      const submissionIdMatch2 = tasksPageForReupload.body.match(
        new RegExp(`${escapeRegex(adHocFileTaskTitle)}(?:(?!${NEXT_TASK_ROW})[\\s\\S])*?<select name="submissionId"[^>]*>([\\s\\S]*?)<\\/select>`),
      );
      const chosenSubmissionId2 = submissionIdMatch2
        ? submissionIdMatch2[1]!.match(/<option value="([\w-]+)"/)?.[1]
        : undefined;

      const form2 = new FormData();
      form2.set("chq_csrf", speaker1.cookies.chq_csrf ?? "");
      form2.set(
        "file",
        new File([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])], "walkthrough-bio-photo-v2.jpg", { type: "image/jpeg" }),
      );
      if (chosenSubmissionId2) form2.set("submissionId", chosenSubmissionId2);
      const res2 = await speaker1.postMultipart(`/portal/tasks/${bioAssignmentId}/upload`, form2);
      assert(
        res2.status === 302,
        `POST /portal/tasks/:assignmentId/upload (replace) expected 302, got ${res2.status}: ${JSON.stringify(res2.body)}`,
      );
    },
  );

  await check(
    `GET /portal/tasks shows the DEC-244 deliverable panel at version 2 for the completed '${adHocFileTaskTitle}' assignment`,
    async () => {
      const tasksPage2 = await speaker1.getText("/portal/tasks");
      assert(tasksPage2.status === 200, `GET /portal/tasks returned ${tasksPage2.status}`);
      const rowMatch2 = tasksPage2.body.match(
        new RegExp(`${escapeRegex(adHocFileTaskTitle)}(?:(?!${NEXT_TASK_ROW})[\\s\\S])*`),
      );
      assert(rowMatch2, `could not find the '${adHocFileTaskTitle}' task row on /portal/tasks (second read)`);
      const row2 = rowMatch2![0]!;
      assert(row2.includes('aria-label="Uploaded file"'), "row is missing the Uploaded file section");
      assert(row2.includes("walkthrough-bio-photo-v2.jpg"), "row is missing the replaced filename");
      assert(row2.includes("version 2"), "row is missing 'version 2'");
      assert(
        new RegExp(`href="\\/portal\\/tasks\\/${escapeRegex(bioAssignmentId)}\\/file"`).test(row2),
        "row is missing a download link to /portal/tasks/:assignmentId/file",
      );
      assert(row2.includes(">Replace file<"), "row is missing the 'Replace file' button");
      assert(row2.includes('<section aria-label="Comments">'), "row is missing the Comments section");
      const historyMatch2 = row2.match(/<section aria-label="Version history">[\s\S]*?<\/section>/);
      assert(historyMatch2, "could not isolate the Version history section");
      const history2 = historyMatch2![0]!;
      const versionNums2 = [...history2.matchAll(/chq-portal-version-num">v(\d+)</g)].map((m) => m[1]);
      assert(
        versionNums2.length === 2 && versionNums2.includes("1") && versionNums2.includes("2"),
        `expected v1 and v2 rows in Version history, got ${JSON.stringify(versionNums2)}`,
      );
      const historyRows2 = [...history2.matchAll(/<li class="chq-portal-version-row">[\s\S]*?<\/li>/g)].map((m) => m[0]);
      const v1Row = historyRows2.find((r) => r.includes('version-num">v1<'));
      const v2Row = historyRows2.find((r) => r.includes('version-num">v2<'));
      assert(v2Row && v2Row.includes('chq-portal-flag-done">Current<'), "the v2 row is missing the Current marker");
      assert(
        v1Row && !v1Row.includes('chq-portal-flag-done">Current<'),
        "the v1 row unexpectedly still carries the Current marker",
      );
    },
  );

  await check("GET the uploaded deliverable via the DEC-244 portal file route (Content-Disposition)", async () => {
    const res = await speaker1.getBinary(`/portal/tasks/${bioAssignmentId}/file`);
    assert(res.status === 200, `GET /portal/tasks/:assignmentId/file returned ${res.status}`);
    assert(res.bytes > 0, "downloaded file body is empty");
    assert(
      res.contentDisposition !== null && res.contentDisposition.startsWith("attachment"),
      `expected an attachment Content-Disposition header, got '${res.contentDisposition}'`,
    );
  });

  const walkthroughCommentBody = "Walkthrough: please confirm this deck renders correctly";

  await check("POST a reply on the deliverable's comment thread (form-field chq_csrf, not the header)", async () => {
    const res = await speaker1.postForm(`/portal/tasks/${bioAssignmentId}/comments`, {
      body: walkthroughCommentBody,
    });
    assert(res.status === 302, `POST /portal/tasks/:assignmentId/comments expected 302, got ${res.status}`);
  });

  await check("re-GET /portal/tasks and see the reply rendered in the deliverable panel", async () => {
    const tasksPage = await speaker1.getText("/portal/tasks");
    assert(tasksPage.status === 200, `GET /portal/tasks returned ${tasksPage.status}`);
    assert(tasksPage.body.includes(walkthroughCommentBody), "posted comment body did not render on /portal/tasks");
    assert(tasksPage.body.includes(fixture.identities.speaker.name), "comment author name did not render on /portal/tasks");
  });

  await check(
    "POST a reply exceeding MAX_COMMENT_BODY_LENGTH (4000) re-renders inline (DEC-244 amendment, wave 56) with the typed text kept",
    async () => {
      const oversized = "x".repeat(4001);
      const res = await speaker1.postForm(`/portal/tasks/${bioAssignmentId}/comments`, {
        body: oversized,
      });
      assert(res.status === 200, `expected 200 (inline re-render) for an over-length comment body, got ${res.status}`);
      // DEC-422 unified cap grammar (src/domain/cap-copy.ts overCapSentence)
      // composes "Reply is 4,001 characters — 1 over the 4,000-character
      // limit.", never the literal "too long" this walkthrough previously
      // asserted.
      assert(res.body.includes("over the 4,000-character limit"), "expected the named-cap refusal message on the re-rendered page");
      assert(res.body.includes(oversized), "expected the typed draft body to be kept in the re-rendered textarea");
    },
  );

  // -------------------------------------------------------------------------
  // Speaker itinerary .ics route (J9/DEC-022): public route, but exercised
  // here as an authenticated speaker fetching their own accepted session's
  // calendar export.
  // -------------------------------------------------------------------------

  await check("GET the speaker itinerary .ics route for my accepted session", async () => {
    const res = await speaker1.getBinary(
      `/e/${EVENT_SLUG}/schedule.ics?ids=${encodeURIComponent(speaker1Submission.id)}`,
    );
    assert(res.status === 200, `GET schedule.ics returned ${res.status}`);
    assert(res.bytes > 0, "schedule.ics response body is empty");
  });

  // -------------------------------------------------------------------------
  // Invitation accept/decline: own participant rows only. DEC-070's
  // POST /api/v1/submissions/:id/participants invites a co-presenter onto
  // an existing submission (invite_status='invited'), so the real
  // accept/decline transitions, plus the ownership guard, are exercised
  // end to end through the actual endpoint (task w14-g; previously a
  // direct-SQL fixture insert).
  // -------------------------------------------------------------------------

  const inviteSubA = await check("create a throwaway submission to invite the speaker onto (A: will accept)", async () => {
    const { status, body } = await organizer.postJson<CreateSubmissionResult>(
      `/api/v1/events/${eventId}/submissions`,
      {
        title: `Walkthrough co-presenter invite A ${Date.now()}`,
        contact: { email: `walkthrough-invite-a-${Date.now()}@example-speakers.test`, firstName: "Invite", lastName: "FixtureA" },
      },
    );
    assert(status === 201, `create throwaway submission A returned ${status}`);
    return body.id;
  });

  const inviteSubB = await check("create a throwaway submission to invite the speaker onto (B: will decline)", async () => {
    const { status, body } = await organizer.postJson<CreateSubmissionResult>(
      `/api/v1/events/${eventId}/submissions`,
      {
        title: `Walkthrough co-presenter invite B ${Date.now()}`,
        contact: { email: `walkthrough-invite-b-${Date.now()}@example-speakers.test`, firstName: "Invite", lastName: "FixtureB" },
      },
    );
    assert(status === 201, `create throwaway submission B returned ${status}`);
    return body.id;
  });

  await check("speaker session cannot POST the invite-participant endpoint (organizer-only authz)", async () => {
    const res = await speaker1.postJson<unknown>(`/api/v1/submissions/${inviteSubA}/participants`, {
      contactId: speakerParticipant.contactId,
    });
    assert(res.status === 403, `expected 403 forbidden for a speaker session, got ${res.status}`);
  });

  interface InviteParticipantResult {
    id: string;
    contactId: string;
    inviteStatus: string;
  }

  const inviteParticipantIdA = await check(
    "organizer invites the speaker as a co-presenter on submission A (DEC-070 invite endpoint)",
    async () => {
      const { status, body } = await organizer.postJson<InviteParticipantResult>(
        `/api/v1/submissions/${inviteSubA}/participants`,
        { contactId: speakerParticipant.contactId },
      );
      assert(status === 201, `POST submissions/:id/participants (A) returned ${status}: ${JSON.stringify(body)}`);
      assert(body.inviteStatus === "invited", `expected inviteStatus 'invited', got '${body.inviteStatus}'`);
      return body.id;
    },
  );

  const inviteParticipantIdB = await check(
    "organizer invites the speaker as a co-presenter on submission B (DEC-070 invite endpoint)",
    async () => {
      const { status, body } = await organizer.postJson<InviteParticipantResult>(
        `/api/v1/submissions/${inviteSubB}/participants`,
        { contactId: speakerParticipant.contactId },
      );
      assert(status === 201, `POST submissions/:id/participants (B) returned ${status}: ${JSON.stringify(body)}`);
      assert(body.inviteStatus === "invited", `expected inviteStatus 'invited', got '${body.inviteStatus}'`);
      return body.id;
    },
  );

  await check("invitation response rejects a participant row that isn't mine (no IDOR)", async () => {
    const speaker2Probe = new Session();
    await speaker2Probe.login(fixture.identities.speaker2.email, fixture.identities.speaker2.password);
    const res = await speaker2Probe.postForm(`/portal/invitations/${inviteParticipantIdA}`, { action: "accept" });
    assert(res.status === 403, `expected 403 forbidden for a non-owning speaker, got ${res.status}`);
  });

  await check("speaker accepts invitation A (own participant row)", async () => {
    const before = await speaker1.getText("/portal");
    assert(before.body.includes("Invited to co-present"), "portal dashboard is missing the pending invitation");

    const res = await speaker1.postForm(`/portal/invitations/${inviteParticipantIdA}`, { action: "accept" });
    assert(res.status === 302, `expected 302 on invitation accept, got ${res.status}`);
  });

  await check("speaker declines invitation B (own participant row)", async () => {
    const res = await speaker1.postForm(`/portal/invitations/${inviteParticipantIdB}`, { action: "decline" });
    assert(res.status === 302, `expected 302 on invitation decline, got ${res.status}`);
  });

  await check("invitation response rejects an already-resolved participant row", async () => {
    const res = await speaker1.postForm(`/portal/invitations/${inviteParticipantIdA}`, { action: "decline" });
    assert(res.status === 400, `expected 400 invalid (already accepted, not re-transitionable), got ${res.status}`);
  });

  // -------------------------------------------------------------------------
  // DEC-108 public visibility gate (task w11-a, DEC-112/113): accept + approve
  // submissions A/B/C, then confirm the public sessions/speakers surfaces only
  // surface speaker1 where their participant row is invite_status IN
  // ('none','accepted') -- A (accepted invite), not B (declined) or C (left
  // 'invited', never answered). Proves the gate excludes 'invited' rows, not
  // just declined ones.
  // -------------------------------------------------------------------------

  const inviteSubC = await check(
    "create a throwaway submission to invite the speaker onto (C: left unanswered)",
    async () => {
      const { status, body } = await organizer.postJson<CreateSubmissionResult>(
        `/api/v1/events/${eventId}/submissions`,
        {
          title: `Walkthrough co-presenter invite C ${Date.now()}`,
          contact: {
            email: `walkthrough-invite-c-${Date.now()}@example-speakers.test`,
            firstName: "Invite",
            lastName: "FixtureC",
          },
        },
      );
      assert(status === 201, `create throwaway submission C returned ${status}`);
      return body.id;
    },
  );

  await check(
    "organizer invites the speaker as a co-presenter on submission C, left unanswered (DEC-070 invite endpoint)",
    async () => {
      const { status, body } = await organizer.postJson<InviteParticipantResult>(
        `/api/v1/submissions/${inviteSubC}/participants`,
        { contactId: speakerParticipant.contactId },
      );
      assert(status === 201, `POST submissions/:id/participants (C) returned ${status}: ${JSON.stringify(body)}`);
      assert(body.inviteStatus === "invited", `expected inviteStatus 'invited', got '${body.inviteStatus}'`);
    },
  );

  await check("organizer accepts submissions A, B and C (bulk status change)", async () => {
    const { status, body } = await organizer.postJson<{ updated: number }>(
      `/api/v1/events/${eventId}/submissions/status`,
      { ids: [inviteSubA, inviteSubB, inviteSubC], status: "accepted" },
    );
    assert(status === 200, `POST submissions/status (A/B/C) returned ${status}: ${JSON.stringify(body)}`);
    assert(body.updated === 3, `expected updated:3, got ${JSON.stringify(body)}`);
  });

  const [inviteTitleA, inviteTitleB, inviteTitleC] = await check(
    "read submission A/B/C titles and set content-status approved for all three",
    async () => {
      const titles: string[] = [];
      for (const id of [inviteSubA, inviteSubB, inviteSubC]) {
        const detail = await organizer.getJson<SubmissionDetail>(`/api/v1/submissions/${id}`);
        assert(detail.status === 200, `GET submission detail (${id}) returned ${detail.status}`);
        titles.push(detail.body.title);

        const approved = await organizer.postJson<{ contentStatus: string }>(
          `/api/v1/submissions/${id}/content-status`,
          { contentStatus: "approved" },
        );
        assert(approved.status === 200, `content-status approved (${id}) returned ${approved.status}: ${JSON.stringify(approved.body)}`);
      }
      return titles;
    },
  );

  const anon = new Session();

  const sessionCards = await check(
    "unauthenticated /e/<slug>/sessions shows cards for A, B and C, following pagination",
    async () => {
      const wanted = [inviteSubA, inviteSubB, inviteSubC];
      const found: Record<string, string> = {};
      let page = 1;
      const maxPages = 50;
      for (; page <= maxPages; page += 1) {
        const res = await anon.getText(`/e/${EVENT_SLUG}/sessions?page=${page}`);
        assert(res.status === 200, `GET /e/${EVENT_SLUG}/sessions?page=${page} returned ${res.status}`);
        for (const id of wanted) {
          if (found[id]) continue;
          // DEC-412 repair: public session cards were 'chq-card' pre-
          // redesign; the redesign renamed the class to
          // 'chq-pub-session-row' (src/routes/public/cards.tsx SessionCard)
          // and added a nested 'chq-pub-session-when'/'chq-pub-session-body'
          // div structure inside the card, so a lazy match to the FIRST
          // '</div>' no longer captures the whole card (it stops at the
          // first nested div's close). Bounded instead to the start of the
          // next card (or end of page) — same technique as the portal
          // task-row fix above.
          const match = res.body.match(
            new RegExp(
              `<div class="chq-pub-session-row" id="chq-session-${id}">(?:(?!<div class="chq-pub-session-row")[\\s\\S])*`,
            ),
          );
          if (match) found[id] = match[0]!;
        }
        if (wanted.every((id) => found[id])) break;
        const hasNextPage = res.body.includes(`page=${page + 1}`);
        if (!hasNextPage) break;
      }
      for (const id of wanted) {
        assert(found[id], `did not find chq-session-${id} card on the public sessions page across ${page} page(s)`);
      }
      return found;
    },
  );

  await check(
    "speaker1's name appears in A's public session card but not B's or C's (DEC-108 invite_status gate)",
    async () => {
      const speakerName = fixture.identities.speaker.name;
      assert(
        sessionCards[inviteSubA]!.includes(speakerName),
        `expected speaker1's name '${speakerName}' inside submission A's public session card`,
      );
      assert(
        !sessionCards[inviteSubB]!.includes(speakerName),
        `speaker1's name '${speakerName}' should be absent from submission B's public session card (declined invite)`,
      );
      assert(
        !sessionCards[inviteSubC]!.includes(speakerName),
        `speaker1's name '${speakerName}' should be absent from submission C's public session card (unanswered invite)`,
      );
    },
  );

  await check(
    "speaker1's block on /e/<slug>/speakers lists A's title but not B's or C's (DEC-108 invite_status gate)",
    async () => {
      const speakerName = fixture.identities.speaker.name;
      const res = await anon.getText(`/e/${EVENT_SLUG}/speakers`);
      assert(res.status === 200, `GET /e/${EVENT_SLUG}/speakers returned ${res.status}`);
      // DEC-412 repair: DEC-173's <strong><a href=...>Name</a></strong>
      // wrapper is gone post-redesign — src/routes/public/speakers.tsx
      // SpeakersContent now renders the name as a plain
      // '<a class="chq-pub-speaker-name" href=...>Name</a>' (no <strong>
      // anywhere on the card). The sessions list immediately after it is
      // still a <ul>...</ul>, so that boundary is unchanged.
      const blockMatch = res.body.match(
        new RegExp(
          `<a class="chq-pub-speaker-name"[^>]*>\\s*${escapeRegex(speakerName)}\\s*<\\/a>([\\s\\S]*?)<\\/ul>`,
        ),
      );
      assert(blockMatch, `could not find speaker1's chq-pub-speaker-name '${speakerName}'...</ul> block on the speakers page`);
      const block = blockMatch![1]!;
      assert(block.includes(inviteTitleA!), `speaker1's speakers-page block is missing A's title '${inviteTitleA}'`);
      assert(
        !block.includes(inviteTitleB!),
        `speaker1's speakers-page block should not include B's title '${inviteTitleB}' (declined invite)`,
      );
      assert(
        !block.includes(inviteTitleC!),
        `speaker1's speakers-page block should not include C's title '${inviteTitleC}' (unanswered invite)`,
      );
    },
  );

  // -------------------------------------------------------------------------
  // Profile edit: one record, two views (portal write, /api/v1 read)
  // -------------------------------------------------------------------------

  const newBio = `Walkthrough-updated bio ${Date.now()}`;
  await check("edit bio via the portal profile form", async () => {
    const profilePage = await speaker1.getText("/portal/profile");
    assert(profilePage.status === 200, `GET /portal/profile returned ${profilePage.status}`);

    const [firstName, ...rest] = fixture.identities.speaker.name.split(" ");
    const res = await speaker1.postForm("/portal/profile", {
      firstName: firstName ?? "Speaker",
      lastName: rest.join(" ") || "One",
      title: "Principal Engineer",
      company: "Latticework Systems",
      bio: newBio,
      twitter: "",
      linkedin: "",
      github: "",
      website: "",
    });
    // PRG redirect (src/routes/portal/profile.tsx:421-423): a successful
    // save 302s to /portal/profile?saved=1, which then renders "Profile
    // saved." from the saved=1 query param — this walkthrough previously
    // asserted the old inline 200 re-render.
    assert(res.status === 302, `POST /portal/profile expected 302 (PRG redirect), got ${res.status}`);
    const redirectRes = await speaker1.getText("/portal/profile?saved=1");
    assert(redirectRes.status === 200, `GET /portal/profile?saved=1 returned ${redirectRes.status}`);
    assert(redirectRes.body.includes("Profile saved."), "profile save did not confirm success");
  });

  await check("the bio change appears on the organizer's contact record via /api/v1", async () => {
    const { status, body } = await organizer.getJson<ContactDetail>(`/api/v1/contacts/${speakerParticipant.contactId}`);
    assert(status === 200, `GET /api/v1/contacts/:id returned ${status}`);
    assert(body.bio === newBio, `expected contact.bio to be the portal-edited value; got '${body.bio}'`);
  });

  // -------------------------------------------------------------------------
  // Close-date edit lock (src/domain/edit-lock.ts): accepted keeps editing,
  // unaccepted follows the close-date gate.
  // -------------------------------------------------------------------------

  const speaker2 = new Session();
  await check("speaker2 logs in", async () => {
    await speaker2.login(fixture.identities.speaker2.email, fixture.identities.speaker2.password);
  });

  const speaker2PendingSubmissionId = await check(
    "find speaker2's own still-pending fixture submission",
    async () => {
      const { body } = await organizer.getJson<{ items: SubmissionListItem[] }>(
        `/api/v1/events/${eventId}/submissions?status=pending&q=${encodeURIComponent(fixture.identities.speaker2.name)}&perPage=10`,
      );
      const item = body.items[0];
      assert(item, "no pending submission found for speaker2");
      return item!.id;
    },
  );

  const { formId, originalCloseDate } = await check("read the CFP form id + original close date", async () => {
    const { status, body } = await organizer.getJson<FormRow>(`/api/v1/events/${eventId}/forms`);
    assert(status === 200, `GET event forms returned ${status}`);
    return { formId: body.id, originalCloseDate: body.closeDate };
  });

  try {
    await check("organizer sets the form close date to the past", async () => {
      // DEC-522: closeDate is a DAY LABEL (a calendar date), expanded to the
      // event-local END OF DAY by isFormClosed/dayLabelEndInstant — 'now
      // minus 1 hour' is still TODAY's day label on any timezone offset up
      // to +/-23h, so isFormClosed stays false and every downstream 'is the
      // form closed' assertion in this block silently no-ops. Back up two
      // full days so the day label is unambiguously in the past regardless
      // of the event's timezone offset from UTC.
      const { status } = await organizer.patchJson<FormRow>(`/api/v1/forms/${formId}`, {
        closeDate: dayLabelMs(-2),
      });
      assert(status === 200, `PATCH form closeDate returned ${status}`);
    });

    await check("accepted speaker's portal edit still succeeds past the close date", async () => {
      const editPage = await speaker1.getText(`/portal/submissions/${speaker1Submission.id}/edit`);
      assert(editPage.status === 200, `GET edit page returned ${editPage.status}`);
      assert(!editPage.body.includes("Editing closed"), "accepted submission's edit page shows 'Editing closed'");

      const res = await speaker1.postForm(`/portal/submissions/${speaker1Submission.id}/edit`, {});
      assert(
        res.status !== 403,
        `accepted speaker's edit POST was rejected by the edit lock (403) past the close date`,
      );
    });

    await check("unaccepted speaker's portal edit is rejected server-side past the close date", async () => {
      const editPage = await speaker2.getText(`/portal/submissions/${speaker2PendingSubmissionId}/edit`);
      assert(editPage.status === 200, `GET edit page returned ${editPage.status}`);
      assert(editPage.body.includes("Editing closed"), "unaccepted submission's edit page should show 'Editing closed'");

      const res = await speaker2.postForm(`/portal/submissions/${speaker2PendingSubmissionId}/edit`, {});
      assert(res.status === 403, `expected 403 forbidden from the server-side edit lock, got ${res.status}`);
    });
  } finally {
    await check("restore the form close date (leave no side effects)", async () => {
      const { status } = await organizer.patchJson<FormRow>(`/api/v1/forms/${formId}`, {
        closeDate: originalCloseDate,
      });
      assert(status === 200, `restoring form closeDate returned ${status}`);
    });
  }

  // -------------------------------------------------------------------------
  // J8: Presentation deliverable upload, versioning, comment thread, content
  // approval gate on the public sessions surface (verify-only per w8-f).
  // -------------------------------------------------------------------------

  await check("uploading a Presentation with an unsupported extension is rejected (UI-stated allowlist)", async () => {
    const form = new FormData();
    form.set("kind", "presentation");
    form.set("file", new File([new Uint8Array([1, 2, 3])], "slides.exe", { type: "application/octet-stream" }));
    const res = await speaker1.postMultipart(`/api/v1/submissions/${speaker1Submission.id}/files`, form);
    assert(res.status === 400, `expected 400 for an unsupported extension, got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  await check("uploading a Presentation over the 25 MB document cap is rejected (UI-stated size cap)", async () => {
    const oversized = new Uint8Array(25 * 1024 * 1024 + 1);
    const form = new FormData();
    form.set("kind", "presentation");
    form.set("file", new File([oversized], "slides-too-big.pdf", { type: "application/pdf" }));
    const res = await speaker1.postMultipart(`/api/v1/submissions/${speaker1Submission.id}/files`, form);
    assert(res.status === 400, `expected 400 for an oversized document, got ${res.status}`);
  });

  const presentationV1Id = await check("upload a valid Presentation deliverable (v1)", async () => {
    const form = new FormData();
    form.set("kind", "presentation");
    form.set("file", new File([new Uint8Array([37, 80, 68, 70])], "walkthrough-slides-v1.pdf", { type: "application/pdf" }));
    const res = await speaker1.postMultipart(`/api/v1/submissions/${speaker1Submission.id}/files`, form);
    assert(res.status === 201, `expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    return (res.body as FileUploadResult).id;
  });

  const presentationV2Id = await check("re-upload chains previous_file_id (v2 replaces v1)", async () => {
    const form = new FormData();
    form.set("kind", "presentation");
    form.set("replacesFileId", presentationV1Id);
    form.set("file", new File([new Uint8Array([37, 80, 68, 70, 1])], "walkthrough-slides-v2.pdf", { type: "application/pdf" }));
    const res = await speaker1.postMultipart(`/api/v1/submissions/${speaker1Submission.id}/files`, form);
    assert(res.status === 201, `expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    return (res.body as FileUploadResult).id;
  });

  await check("the version chain + both versions are downloadable (full history)", async () => {
    const { status, body } = await speaker1.getJson<FilesByKindResponse>(
      `/api/v1/submissions/${speaker1Submission.id}/files`,
    );
    assert(status === 200, `GET submission files returned ${status}`);
    const presentations = body.items.filter((f) => f.kind === "presentation");
    const v1 = presentations.find((f) => f.id === presentationV1Id);
    assert(v1, "v1 presentation not found in the flat items list");
    const v2 = presentations.find((f) => f.id === presentationV2Id);
    assert(v2, "v2 presentation not found in the flat items list");
    assert(v2!.previousFileId === presentationV1Id, "v2's previousFileId does not chain to v1");

    const v1Download = await speaker1.getBinary(`/files/${presentationV1Id}`);
    assert(v1Download.status === 200, `downloading v1 returned ${v1Download.status}`);
    const v2Download = await speaker1.getBinary(`/files/${presentationV2Id}`);
    assert(v2Download.status === 200, `downloading v2 returned ${v2Download.status}`);
  });

  await check("producer comment + speaker reply thread round-trips", async () => {
    const producerComment = await organizer.postJson<{ id: string }>(`/api/v1/files/${presentationV2Id}/comments`, {
      body: "Walkthrough: could you increase the font size on slide 2?",
    });
    assert(producerComment.status === 201, `producer comment POST returned ${producerComment.status}`);

    const speakerReply = await speaker1.postJson<{ id: string }>(`/api/v1/files/${presentationV2Id}/comments`, {
      body: "Walkthrough: done, bumped it up.",
    });
    assert(speakerReply.status === 201, `speaker reply POST returned ${speakerReply.status}`);

    const { status, body } = await organizer.getJson<CommentsResponse>(`/api/v1/files/${presentationV2Id}/comments`);
    assert(status === 200, `GET comments returned ${status}`);
    assert(
      body.items.some((c) => c.authorRole === "organizer" && c.body.includes("font size")),
      "comment thread is missing the producer's comment",
    );
    assert(
      body.items.some((c) => c.authorRole === "speaker" && c.body.includes("bumped it up")),
      "comment thread is missing the speaker's reply",
    );
  });

  await check(
    "content approval gate: flipping content-status changes public /e/<slug>/sessions visibility (verify only)",
    async () => {
      const pending = await organizer.postJson<{ contentStatus: string }>(
        `/api/v1/submissions/${speaker1Submission.id}/content-status`,
        { contentStatus: "pending" },
      );
      assert(pending.status === 200, `content-status pending returned ${pending.status}`);

      const approved = await organizer.postJson<{ contentStatus: string }>(
        `/api/v1/submissions/${speaker1Submission.id}/content-status`,
        { contentStatus: "approved" },
      );
      assert(approved.status === 200, `content-status approved returned ${approved.status}`);
      const publicAfter = await organizer.getText(`/e/${EVENT_SLUG}/sessions`);
      assert(publicAfter.status === 200, `GET public sessions returned ${publicAfter.status}`);
      assert(
        publicAfter.body.includes(detailAfter.title),
        "approved session's title should now appear on the public sessions page",
      );

      const backToPending = await organizer.postJson<{ contentStatus: string }>(
        `/api/v1/submissions/${speaker1Submission.id}/content-status`,
        { contentStatus: "pending" },
      );
      assert(backToPending.status === 200, "restoring content-status to pending failed");
      const publicBefore = await organizer.getText(`/e/${EVENT_SLUG}/sessions`);
      assert(
        !publicBefore.body.includes(detailAfter.title),
        "unapproved session's title should be absent from the public sessions page",
      );
    },
  );

  // -------------------------------------------------------------------------
  // DEC-175: object-level authz probes — speaker2 must be turned away from
  // speaker1's objects (existence-hiding 404 on the portal submission
  // detail page, 403 on task-assignment/file object-level checks), and a
  // speaker session must be turned away from organizer-only APIs.
  // -------------------------------------------------------------------------

  await check("DEC-175 speaker2 GET speaker1's portal submission -> 404 (existence-hiding)", async () => {
    const res = await speaker2.getText(`/portal/submissions/${speaker1Submission.id}`);
    assert(res.status === 404, `expected 404, got ${res.status}`);
  });

  await check("DEC-175 speaker2 GET speaker1's task-assignment form -> 403", async () => {
    const res = await speaker2.getText(`/portal/tasks/${hotelFormAssignmentId}/form`);
    assert(res.status === 403, `expected 403, got ${res.status}`);
  });

  await check("DEC-175 speaker2 POST speaker1's task-assignment form -> 403", async () => {
    const res = await speaker2.postForm(`/portal/tasks/${hotelFormAssignmentId}/form`, {});
    assert(res.status === 403, `expected 403, got ${res.status}`);
  });

  await check("DEC-175 speaker2 POST-complete speaker1's task assignment -> 403", async () => {
    const res = await speaker2.postForm(`/portal/tasks/${hotelFormAssignmentId}/complete`, {});
    assert(res.status === 403, `expected 403, got ${res.status}`);
  });

  await check("DEC-175 speaker2 GET speaker1's uploaded file -> 403", async () => {
    const res = await speaker2.getText(`/files/${presentationV2Id}`);
    assert(res.status === 403, `expected 403, got ${res.status}`);
  });

  await check("DEC-175 speaker session on organizer API GET /api/v1/events/:id/submissions -> 403", async () => {
    const res = await speaker1.getText(`/api/v1/events/${eventId}/submissions`);
    assert(res.status === 403, `expected 403, got ${res.status}`);
  });

  await check("DEC-175 speaker session on organizer API GET /api/v1/contacts -> 403", async () => {
    const res = await speaker1.getText(`/api/v1/contacts`);
    assert(res.status === 403, `expected 403, got ${res.status}`);
  });

  await check("DEC-175 speaker session on organizer API GET /api/v1/events/:id/email-log -> 403", async () => {
    const res = await speaker1.getText(`/api/v1/events/${eventId}/email-log`);
    assert(res.status === 403, `expected 403, got ${res.status}`);
  });

  console.log("");
  console.log("walkthrough/speaker.ts: all checks passed");
}

main().catch((err) => {
  console.error(`FAIL [${currentCheck}]`);
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
