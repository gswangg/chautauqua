// Multi-portal engine against real SQLite with every migration applied:
// reconciliation (memberships and assignments), the person view (merging,
// strictest lock, sections), keeping finished work when a portal is lost,
// invitations, and notification queueing.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { reconcileEventPortals } from "../src/server/repo/portals/reconcile";
import { buildPersonView } from "../src/server/repo/portals/view";
import {
  ACCEPTED_SESSIONS,
  addContact,
  addEvent,
  addFormat,
  addOrg,
  addParticipant,
  addPortal,
  addPortalItem,
  addSession,
  addSponsor,
  addSponsorContact,
  addTask,
  addTier,
  makePortalsFixture,
  type Fixture,
} from "./helpers/portals-fixture";

const ORG = "org-a";
const EVENT = "ev-1";
const APR3 = Date.UTC(2027, 3, 3);
const APR10 = Date.UTC(2027, 3, 10);
const MAY1 = Date.UTC(2027, 4, 1);

function priyaWorld(): Fixture {
  const f = makePortalsFixture();
  addOrg(f, ORG);
  addEvent(f, EVENT, ORG);
  addContact(f, "priya", ORG, "Priya Raman");
  addSession(f, "talk", EVENT, { title: "Taming 40-Minute CI", origin: "cfp" });
  addSession(f, "panel", EVENT, { title: "Lunch panel: Platform teams", origin: "organizer" });
  addFormat(f, EVENT, "talk", "Talk (30 min)");
  addFormat(f, EVENT, "panel", "Panel (45 min)");
  addParticipant(f, "pt-talk", "talk", "priya");
  addParticipant(f, "pt-panel", "panel", "priya", { role: "panelist", inviteStatus: "accepted" });
  addTier(f, "gold", EVENT, "Gold");
  addSponsor(f, { company: "latticework", sponsorship: "sp-lw", tier: "gold" }, ORG, EVENT, { name: "Latticework Systems" });
  addSponsorContact(f, "sc-priya", "sp-lw", EVENT, "priya", { primary: true });

  addTask(f, "bio", EVENT, { title: "Bio" });
  addTask(f, "headshot", EVENT, { title: "Headshot" });
  addTask(f, "slides", EVENT, { title: "Final slides", kind: "file_request", scope: "participation" });
  addTask(f, "travel", EVENT, { title: "Travel form" });
  addTask(f, "booth", EVENT, { title: "Logo and booth details", scope: "participation" });

  addPortal(
    f,
    "pb",
    EVENT,
    {
      groups: [
        ...ACCEPTED_SESSIONS.groups,
        {
          conditions: [
            { field: "kind", op: "is", values: ["company"] },
            { field: "sponsorship_status", op: "is", values: ["active"] },
          ],
        },
      ],
    },
    { name: "Profile basics", position: 0, fields: { headshot: { level: "edit" } } },
  );
  addPortalItem(f, "pb-bio", "pb", { taskId: "bio" }, { deadlineKind: "fixed", dueDate: APR10, graceDays: 7 });
  addPortalItem(f, "pb-head", "pb", { taskId: "headshot" });

  addPortal(
    f,
    "cfp",
    EVENT,
    {
      groups: [
        {
          conditions: [
            { field: "arrival", op: "is", values: ["cfp"] },
            { field: "session_status", op: "is", values: ["accepted"] },
          ],
        },
      ],
    },
    { name: "CFP speakers", position: 1, note: "As a CFP speaker, you'll share final slides and your AV needs." },
  );
  addPortalItem(f, "cfp-slides", "cfp", { taskId: "slides" }, { deadlineKind: "fixed", dueDate: MAY1, required: true });

  addPortal(
    f,
    "inv",
    EVENT,
    {
      groups: [
        {
          conditions: [
            { field: "role", op: "is_any_of", values: ["speaker", "moderator", "panelist"] },
            { field: "arrival", op: "is", values: ["organizer"] },
          ],
        },
      ],
    },
    {
      name: "Invited speakers",
      position: 2,
      note: "As an invited speaker, you'll confirm your session and share a bio.",
      fields: { headshot: { level: "view" } },
    },
  );
  addPortalItem(f, "inv-accept", "inv", { systemKind: "acceptance" });
  addPortalItem(f, "inv-bio", "inv", { taskId: "bio" }, { deadlineKind: "fixed", dueDate: APR3, required: true });
  addPortalItem(f, "inv-travel", "inv", { taskId: "travel" }, { deadlineKind: "relative", relativeDays: 14, required: true });

  addPortal(
    f,
    "spons",
    EVENT,
    { groups: [{ conditions: [{ field: "kind", op: "is", values: ["company"] }] }] },
    { name: "Sponsors", position: 3, capabilities: { createSponsorSessions: true, addTeammates: true } },
  );
  addPortalItem(f, "sp-booth", "spons", { taskId: "booth" }, { deadlineKind: "fixed", dueDate: APR3 });
  addPortalItem(f, "sp-design", "spons", { systemKind: "sponsor_sessions" });
  return f;
}

describe("the migration", () => {
  it("gives every existing event a Profile basics portal that changes nobody's portal", () => {
    const sqlite = new DatabaseSync(":memory:");
    const dir = join(__dirname, "..", "migrations");
    const files = readdirSync(dir).filter((x) => x.endsWith(".sql")).sort();
    const before = files.filter((x) => x < "0046");
    for (const file of before) sqlite.exec(readFileSync(join(dir, file), "utf8"));
    sqlite
      .prepare(
        `insert into event (id, org_id, name, slug, start_date, end_date, timezone, created_at, updated_at) values ('e1', 'o1', 'E', 'e', '2027-01-01', '2027-01-02', 'UTC', 1, 1)`,
      )
      .run();
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at) values ('a1', 't1', 'c1', 'complete', 1, 1)`,
      )
      .run();
    for (const file of files.filter((x) => x >= "0046")) sqlite.exec(readFileSync(join(dir, file), "utf8"));

    const portals = sqlite.prepare(`select * from portal`).all() as Record<string, unknown>[];
    expect(portals).toHaveLength(1);
    expect(portals[0]).toMatchObject({ event_id: "e1", name: "Profile basics", template: "profile_basics" });
    expect(sqlite.prepare(`select count(*) n from portal_item`).get()).toEqual({ n: 0 });
    // existing assignments become direct, person-scoped, attached
    expect(sqlite.prepare(`select scope_key, source, detached_at from task_assignment`).get()).toEqual({
      scope_key: "",
      source: "direct",
      detached_at: null,
    });
  });
});

describe("reconciliation and the person view", () => {
  it("materialises one assignment per (task, person, scope) and merges an item from two portals", async () => {
    const f = priyaWorld();
    const result = await reconcileEventPortals(f.db, EVENT, new Date(f.now));
    expect(result.joined.map((j) => `${j.portalId}:${j.participationKey}`).sort()).toEqual(
      ["cfp:p:pt-talk", "inv:p:pt-panel", "pb:c:sc-priya", "pb:p:pt-panel", "pb:p:pt-talk", "spons:c:sc-priya"].sort(),
    );
    const rows = f.all<{ task_id: string; scope_key: string; source: string }>(
      `select task_id, scope_key, source from task_assignment order by task_id, scope_key`,
    );
    expect(rows).toEqual([
      { task_id: "bio", scope_key: "", source: "portal" },
      { task_id: "booth", scope_key: "c:sc-priya", source: "portal" },
      { task_id: "headshot", scope_key: "", source: "portal" },
      { task_id: "slides", scope_key: "p:pt-talk", source: "portal" },
      { task_id: "travel", scope_key: "", source: "portal" },
    ]);

    const view = await buildPersonView(f.db, { eventId: EVENT, contactId: "priya", now: f.now });
    const bio = view.profileItems.find((i) => i.taskId === "bio")!;
    expect(bio.dueDay).toBe(APR3);
    expect(bio.required).toBe(true);
    expect(bio.graceDays).toBe(7);
    expect(bio.portals.map((p) => p.name)).toEqual(["Profile basics", "Invited speakers"]);
    expect(bio.merge?.deadlineFrom).toBe("Invited speakers");

    // relative deadline counts from activation
    const travel = view.profileItems.find((i) => i.taskId === "travel")!;
    expect(travel.dueDay).toBe(Date.UTC(2027, 2, 15));

    // strictest lock wins and names the participation
    expect(view.profileFields.headshot.level).toBe("view");
    expect(view.profileFields.headshot.lockedBy?.participationPhrase).toBe("your invited panel");

    const headings = view.sections.map((s) => s.heading);
    expect(headings).toEqual(["Your talk", "Invited panel", "Gold sponsor"]);
    const talk = view.sections[0]!;
    expect(talk.items.map((i) => i.title)).toEqual(["Final slides"]);
    expect(talk.notes).toEqual(["As a CFP speaker, you'll share final slides and your AV needs."]);
    const panel = view.sections[1]!;
    expect(panel.items[0]).toMatchObject({ kind: "acceptance", state: "done" });
    const sponsor = view.sections[2]!;
    expect(sponsor.sponsor?.canDesign).toBe(true);
    expect(sponsor.items.map((i) => i.kind)).toEqual(["general", "sponsor_sessions"]);
  });

  it("is idempotent", async () => {
    const f = priyaWorld();
    await reconcileEventPortals(f.db, EVENT, new Date(f.now));
    const again = await reconcileEventPortals(f.db, EVENT, new Date(f.now + 1000));
    expect(again).toMatchObject({ joined: [], left: [], assignmentsCreated: 0, assignmentsDetached: 0 });
  });

  it("keeps finished work when a portal is lost, hides it from the home, and re-attaches it", async () => {
    const f = priyaWorld();
    await reconcileEventPortals(f.db, EVENT, new Date(f.now));
    f.run(`update task_assignment set status = 'complete', completed_at = ? where task_id = 'slides'`, f.now);
    f.run(`update submission set status = 'declined' where id = 'talk'`);
    const lost = await reconcileEventPortals(f.db, EVENT, new Date(f.now + 1000));
    expect(lost.left.map((l) => l.portalId).sort()).toEqual(["cfp", "pb"]);
    expect(lost.assignmentsDetached).toBe(1);
    const row = f.all<{ status: string; detached_at: number | null }>(`select status, detached_at from task_assignment where task_id = 'slides'`)[0]!;
    expect(row.status).toBe("complete");
    expect(row.detached_at).not.toBeNull();

    const home = await buildPersonView(f.db, { eventId: EVENT, contactId: "priya", now: f.now });
    expect(home.sections.flatMap((s) => s.items).some((i) => i.taskId === "slides")).toBe(false);
    const record = await buildPersonView(f.db, { eventId: EVENT, contactId: "priya", now: f.now, includeDetached: true });
    const kept = record.sections.flatMap((s) => s.items).find((i) => i.taskId === "slides");
    expect(kept).toMatchObject({ detached: true, state: "done" });

    f.run(`update submission set status = 'accepted' where id = 'talk'`);
    const back = await reconcileEventPortals(f.db, EVENT, new Date(f.now + 2000));
    expect(back.assignmentsReattached).toBe(1);
  });

  it("an item about each session is one assignment per session", async () => {
    const f = priyaWorld();
    addSession(f, "talk2", EVENT, { title: "Second talk", origin: "cfp" });
    addParticipant(f, "pt-talk2", "talk2", "priya");
    await reconcileEventPortals(f.db, EVENT, new Date(f.now));
    const scopes = f.all<{ scope_key: string }>(`select scope_key from task_assignment where task_id = 'slides' order by scope_key`);
    expect(scopes.map((s) => s.scope_key)).toEqual(["p:pt-talk", "p:pt-talk2"]);
  });
});

describe("invitations", () => {
  function ruthWorld(): Fixture {
    const f = priyaWorld();
    addContact(f, "ruth", ORG, "Ruth Adeyemi");
    addSession(f, "invited-talk", EVENT, { title: "Shipping Platforms People Want", origin: "organizer" });
    addParticipant(f, "pt-ruth", "invited-talk", "ruth", { inviteStatus: "invited" });
    return f;
  }

  it("an unanswered invitation is matched but assigns nothing, listing what acceptance brings", async () => {
    const f = ruthWorld();
    await reconcileEventPortals(f.db, EVENT, new Date(f.now));
    expect(f.all(`select * from task_assignment where contact_id = 'ruth'`)).toEqual([]);
    const m = f.all<{ portal_id: string; activated_at: number | null }>(`select portal_id, activated_at from portal_membership where contact_id = 'ruth' order by portal_id`);
    expect(m).toEqual([
      { portal_id: "inv", activated_at: null },
      { portal_id: "pb", activated_at: null },
    ]);
    const view = await buildPersonView(f.db, { eventId: EVENT, contactId: "ruth", now: f.now });
    expect(view.profileItems).toEqual([]);
    const invitation = view.sections[0]!;
    expect(invitation.heading).toBe("Invitation");
    expect(invitation.items[0]).toMatchObject({ kind: "acceptance", state: "waiting", canAct: true });
    expect(invitation.deferredItemNames.sort()).toEqual(["Bio", "Headshot", "Travel form"]);
    expect(view.todoCount).toBe(1);
  });

  it("accepting activates the memberships, assigns the items, and starts relative deadlines", async () => {
    const f = ruthWorld();
    await reconcileEventPortals(f.db, EVENT, new Date(f.now));
    f.run(`update participant set invite_status = 'accepted' where id = 'pt-ruth'`);
    const acceptedAt = Date.UTC(2027, 2, 13, 9);
    await reconcileEventPortals(f.db, EVENT, new Date(acceptedAt));
    const tasks = f.all<{ task_id: string }>(`select task_id from task_assignment where contact_id = 'ruth' order by task_id`);
    expect(tasks.map((t) => t.task_id)).toEqual(["bio", "headshot", "travel"]);
    const view = await buildPersonView(f.db, { eventId: EVENT, contactId: "ruth", now: acceptedAt });
    expect(view.profileItems.find((i) => i.taskId === "travel")?.dueDay).toBe(Date.UTC(2027, 2, 27));
  });

  it("declining ends the participation: it leaves every portal", async () => {
    const f = ruthWorld();
    await reconcileEventPortals(f.db, EVENT, new Date(f.now));
    f.run(`update participant set invite_status = 'declined' where id = 'pt-ruth'`);
    const r = await reconcileEventPortals(f.db, EVENT, new Date(f.now + 1000));
    expect(r.left.filter((l) => l.contactId === "ruth")).toHaveLength(2);
  });
});

describe("notifications", () => {
  it("queues one email per person who gains items, following each portal's setting unless overridden", async () => {
    const f = priyaWorld();
    await reconcileEventPortals(f.db, EVENT, new Date(f.now), { notify: "none" });
    expect(f.all(`select * from portal_notification`)).toEqual([]);

    const g = priyaWorld();
    await reconcileEventPortals(g.db, EVENT, new Date(g.now), { notify: "auto" });
    const queued = g.all<{ contact_id: string; task_ids_json: string }>(`select contact_id, task_ids_json from portal_notification`);
    expect(queued).toHaveLength(1);
    expect(JSON.parse(queued[0]!.task_ids_json).sort()).toEqual(["bio", "booth", "headshot", "slides", "travel"]);
  });
});
