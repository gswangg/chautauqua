// w10-f (DEC-008 amendment, wave 10): a standing no-seed conformance guard.
// The session-format defect (w10-a/w10-b's retired global-PK literal field
// ids, only ever minted by scripts/seed.ts, since replaced by the role
// column resolved via src/server/repo/form-roles.ts) survived many green
// suites because every CFP test reached for the seeded demo event, where
// those literal field ids happened to already exist. This
// file never imports scripts/seed.ts, never reads docs/fixtures, and never
// uses a fixture persona name or a seed_* id -- every id here is minted at
// runtime (newId()) exactly the way a brand-new customer's first event
// would be, so a defect that only "works" because a row was seeded shows up
// here as a real failure, not a false green.
//
// Harness: the same real in-memory SQLite-through-drizzle-sqlite-proxy
// technique test/content-reupload-reopens.test.ts and
// test/cross-org-event-scope-probe.test.ts already use -- DDL concatenated
// from every migrations/*.sql file on disk, so this exercises the real
// schema/constraints, not a hand-rolled subset.
//
// Chain walked, all from minted ids:
//   1) create org + organiser user -> create event (two tracks, a real IANA
//      timezone) -- no seed script involved.
//   2) getOrCreateForm(db, eventId) -- assert the eight DEC-008 locked
//      fields exist, each with a per-form-prefixed id (lockedFieldId,
//      DEC-050: `${formId}:${name}`), and that lockedFieldName resolves
//      each id back to its short name. This is exactly the invariant that
//      silently failed to generalize for the role-tagged session_format/
//      audience_level fields -- those are NOT locked fields (DEC-592/
//      DEC-986 name them as seed-only globals), and this test does not
//      touch them; see OUT OF SCOPE below.
//   3) GET the public CFP page (/submit/:eventSlug) for the fresh event's
//      real slug -- assert it renders the locked controls (title,
//      description, the single Name control, email) and the track chooser
//      listing both minted track names.
//   4) POST the public CFP with a valid answer set and one selected track
//      -- assert the submission row, its participant/contact, and its
//      submission_track row all land in the real db.
//   5) Move the submission to 'accepted' through the real status repo
//      (updateSubmissionStatuses) -- assert a task_assignment row is
//      planned for the speaker's contact (DEC-009 acceptance planner).
//   6) Read the public sessions list (/e/:eventSlug/sessions) -- assert the
//      session, its speaker's name, and its track are visible. (The
//      content-approval gate (visibleSessionConditions: status='accepted'
//      AND content_status='approved') is satisfied via the real
//      updateContentStatus repo writer -- content review is a distinct
//      DEC-020 axis from acceptance and is not itself the subject of this
//      test, so it is driven directly rather than through a route.)
//
// OUT OF SCOPE THIS WAVE: this file deliberately does NOT assert session
// format or audience level (the role-tagged session_format /
// audience_level fields) -- w10-a/w10-b own that surface and land their own no-seed
// assertions in test/session-format-any-event.test.ts. A future wave
// extending no-seed coverage of the format/audience-level surface should
// add to that file, not duplicate this harness.
//
// No product defect found while building this file (unlike w10-a..e): the
// DEC-008 locked-field chain -- unlike the seed-only format/audience-level
// fields -- is entirely self-minting (createDefaultForm, lockedFieldId) and
// carries no dependency on any seed script or fixture literal.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import type { Db } from "../src/server/context";
import { newId } from "../src/domain/ids";
import {
  LOCKED_SESSION_FIELDS,
  LOCKED_SPEAKER_FIELDS,
  lockedFieldId,
  lockedFieldName,
} from "../src/forms/types";
import * as formsRepo from "../src/server/repo/forms";
import { updateContentStatus } from "../src/server/repo/files-content-status";
import { updateSubmissionStatuses } from "../src/server/repo/submissions/status";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { publicRoutes } from "../src/routes/public";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

function makeTestDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  }
  const db = drizzle(
    async (sqlText, params, method) => {
      const stmt = sqlite.prepare(sqlText);
      stmt.setReturnArrays(true);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      const rows = stmt.all(...params) as unknown[];
      return { rows };
    },
    { schema },
  );
  return { db: db as unknown as Db, sqlite };
}

function fakeKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function fakeFilesBucket() {
  return {
    async put() {
      return undefined;
    },
    async get() {
      return null;
    },
    async head() {
      return null;
    },
    async delete() {
      return undefined;
    },
  };
}

// publicRoutes.use("/e/*", publicCacheMiddleware(...)) reads the Worker
// `caches.default` global -- not present under vitest's node environment.
// Same fake install as test/public-day-filter.test.ts and siblings.
function installFakeCaches(): void {
  (globalThis as unknown as { caches: unknown }).caches = {
    default: {
      async match() {
        return undefined;
      },
      async put() {
        /* no-op */
      },
    },
  };
}

function extractCookieValue(setCookieHeader: string | null, name: string): string | null {
  if (!setCookieHeader) return null;
  const match = new RegExp(`${name}=([^;]+)`).exec(setCookieHeader);
  return match ? match[1]! : null;
}

// A brand-new customer's first org/event -- every id minted at runtime, no
// seed script, no fixture literal.
async function buildFreshOrgAndEvent(db: Db): Promise<{
  orgId: string;
  userId: string;
  eventId: string;
  eventSlug: string;
  trackAId: string;
  trackBId: string;
}> {
  const now = new Date();
  const orgId = newId();
  const userId = newId();
  const eventId = newId();
  const trackAId = newId();
  const trackBId = newId();
  const eventSlug = `event-${newId()}`;

  await db.insert(schema.org).values({ id: orgId, name: "A Brand New Organiser", createdAt: now, updatedAt: now });
  await db.insert(schema.user).values({
    id: userId,
    orgId,
    email: `organiser-${newId()}@example.test`,
    passwordHash: "not-a-real-hash",
    role: "organizer",
    contactId: null,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.event).values({
    id: eventId,
    orgId,
    name: "A Brand New Conference",
    slug: eventSlug,
    startDate: "2027-05-01",
    endDate: "2027-05-03",
    location: null,
    timezone: "America/Chicago",
    recordPrefix: "SES",
    brandingJson: null,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.track).values([
    { id: trackAId, eventId, name: "Runtime Track One", color: null, position: 0, externalRef: null, createdAt: now, updatedAt: now },
    { id: trackBId, eventId, name: "Runtime Track Two", color: null, position: 1, externalRef: null, createdAt: now, updatedAt: now },
  ]);

  return { orgId, userId, eventId, eventSlug, trackAId, trackBId };
}

describe("fresh-event-no-seed (DEC-008 wave-10 amendment): a runtime-minted event walks the whole CFP chain with no seed row anywhere", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
  });

  afterEach(() => {
    sqlite.close();
  });

  it("getOrCreateForm mints the eight DEC-008 locked fields with per-form-prefixed ids, and lockedFieldName resolves every one of them", async () => {
    const { eventId } = await buildFreshOrgAndEvent(db);

    const { form, fields } = await formsRepo.getOrCreateForm(db, eventId);
    expect(form.eventId).toBe(eventId);

    const expectedNames = [...LOCKED_SESSION_FIELDS, ...LOCKED_SPEAKER_FIELDS];
    expect(expectedNames).toHaveLength(8);

    const lockedRows = fields.filter((f) => f.locked);
    expect(lockedRows).toHaveLength(8);

    for (const name of expectedNames) {
      const expectedId = lockedFieldId(form.id, name);
      const row = lockedRows.find((f) => f.id === expectedId);
      expect(row, `expected a locked field row with id ${expectedId} (name ${name})`).toBeDefined();
      // DEC-050: the per-form-prefixed id is the ONLY id that exists for
      // this row -- no bare 'title'/'first_name' id is ever minted for a
      // freshly-created event's form (that literal only ever appears for
      // pre-existing seeded rows predating DEC-050, per lockedFieldName's
      // own doc comment).
      expect(lockedFieldName(row!.id)).toBe(name);
    }

    // Calling getOrCreateForm again (second read) must not mint a second
    // form or a second set of locked fields -- same invariant createDefaultForm
    // documents (DEC-398 race-safety), exercised here as a plain repeat call.
    const second = await formsRepo.getOrCreateForm(db, eventId);
    expect(second.form.id).toBe(form.id);
    expect(second.fields.filter((f) => f.locked)).toHaveLength(8);
  });

  it("walks GET CFP -> POST CFP -> accept -> public sessions list, entirely on runtime-minted ids", async () => {
    installFakeCaches();
    const { eventId, eventSlug, trackAId, trackBId } = await buildFreshOrgAndEvent(db);

    // getOrCreateForm's own locked-field minting is exercised by the route
    // handlers below (they call getDefaultForm/getFormFields, which in turn
    // require the default form to already exist) -- mint it explicitly here
    // exactly the way the organizer-side "open the form builder" route would
    // on first read (src/routes/api/forms.ts calling repo.getOrCreateForm).
    await formsRepo.getOrCreateForm(db, eventId);

    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", publicSubmitRoutes);
    app.route("/", publicRoutes);

    const bindings = {
      KV: fakeKv(),
      FILES: fakeFilesBucket(),
      DEV_MODE: "1",
    } as unknown as AppEnv["Bindings"];

    // --- GET the public CFP page -----------------------------------------
    const getRes = await app.request(new Request(`http://local/submit/${eventSlug}`), undefined, bindings);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.text();
    // Locked controls render (field name = fieldInputName(shortName), since
    // getFormFields projects the per-form-prefixed row id back down to its
    // short locked name -- see projectFieldForAnswers).
    expect(getBody).toContain('name="field__title"');
    expect(getBody).toContain('name="field__description"');
    expect(getBody).toContain('name="speaker_name"');
    expect(getBody).toContain('name="field__email"');
    // The track chooser lists both minted tracks (never a seed track name).
    expect(getBody).toContain("Runtime Track One");
    expect(getBody).toContain("Runtime Track Two");
    expect(getBody).toContain(trackAId);
    expect(getBody).toContain(trackBId);

    const csrfCookie = extractCookieValue(getRes.headers.get("Set-Cookie"), CSRF_COOKIE_NAME);
    expect(csrfCookie, "GET must issue a fresh chq_csrf cookie for the POST below to double-submit against").toBeTruthy();

    // --- POST a valid submission -------------------------------------------
    const form = new FormData();
    form.set(CSRF_COOKIE_NAME, csrfCookie!);
    form.set("field__title", "A Runtime-Minted Talk");
    form.set("field__description", "A talk that exists only because this test minted it at runtime.");
    form.set("speaker_name", "Runtime Speaker");
    form.set("field__email", `speaker-${newId()}@example.test`);
    form.set("trackIds", trackAId);

    const postRes = await app.request(
      new Request(`http://local/submit/${eventSlug}`, {
        method: "POST",
        headers: { cookie: `${CSRF_COOKIE_NAME}=${csrfCookie}` },
        body: form,
      }),
      undefined,
      bindings,
    );
    expect(postRes.status).toBe(200);
    const postBody = await postRes.text();
    expect(postBody).toContain("A Runtime-Minted Talk");

    // --- the submission, its participant/contact, and its track row all landed
    const submissionRows = sqlite
      .prepare(`select id, event_id, title, status, content_status from submission where event_id = ?`)
      .all(eventId) as { id: string; event_id: string; title: string; status: string; content_status: string }[];
    expect(submissionRows).toHaveLength(1);
    const submission = submissionRows[0]!;
    expect(submission.title).toBe("A Runtime-Minted Talk");
    expect(submission.status).toBe("pending");

    const participantRows = sqlite
      .prepare(`select contact_id from participant where submission_id = ?`)
      .all(submission.id) as { contact_id: string }[];
    expect(participantRows).toHaveLength(1);
    const contactId = participantRows[0]!.contact_id;

    const contactRows = sqlite.prepare(`select first_name, last_name from contact where id = ?`).all(contactId) as {
      first_name: string;
      last_name: string;
    }[];
    expect(contactRows).toHaveLength(1);
    expect(`${contactRows[0]!.first_name} ${contactRows[0]!.last_name}`.trim()).toBe("Runtime Speaker");

    const trackRows = sqlite
      .prepare(`select track_id from submission_track where submission_id = ?`)
      .all(submission.id) as { track_id: string }[];
    expect(trackRows.map((r) => r.track_id)).toEqual([trackAId]);

    // --- move to accepted through the real status repo, and mark content approved
    // (content approval is a distinct DEC-020 axis, driven directly here --
    // see file header) so the public sessions gate (accepted AND approved)
    // is satisfied without this test asserting anything about content review
    // itself.
    await updateSubmissionStatuses(db, eventId, [submission.id], "accepted", new Date());
    await updateContentStatus(db, eventId, submission.id, "approved");

    const acceptedRow = sqlite.prepare(`select status, accepted_at from submission where id = ?`).get(submission.id) as {
      status: string;
      accepted_at: number | null;
    };
    expect(acceptedRow.status).toBe("accepted");
    expect(acceptedRow.accepted_at).not.toBeNull();

    // The DEC-009 acceptance planner minted at least one task_assignment row
    // for this speaker's contact.
    const assignmentRows = sqlite
      .prepare(`select id from task_assignment where contact_id = ?`)
      .all(contactId) as { id: string }[];
    expect(assignmentRows.length).toBeGreaterThan(0);

    // --- read the public sessions list -------------------------------------
    const sessionsRes = await app.request(new Request(`http://local/e/${eventSlug}/sessions`), undefined, bindings);
    expect(sessionsRes.status).toBe(200);
    const sessionsBody = await sessionsRes.text();
    expect(sessionsBody).toContain("A Runtime-Minted Talk");
    expect(sessionsBody).toContain("Runtime Speaker");
    expect(sessionsBody).toContain("Runtime Track One");
  });
});
