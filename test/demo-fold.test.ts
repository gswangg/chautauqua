// Multi-portal decision 78: scripts/demo-fold-lib.ts folds the DevFlow
// demo's duplicate items into the item each one repeats. Real rows, every
// migration on node:sqlite, the portal reconcile before and after -- the
// order production sees.

import { describe, expect, it } from "vitest";
import { demoFoldStatements, FOLDED_TITLES } from "../scripts/demo-fold-lib";
import { DEMO_EVENT_SLUG } from "../scripts/portal-demo-lib";
import { reconcileEventPortals } from "../src/server/repo/portals/reconcile";
import {
  ACCEPTED_SESSIONS,
  addContact,
  addEvent,
  addOrg,
  addParticipant,
  addPortal,
  addPortalItem,
  addSession,
  addTask,
  makePortalsFixture,
  type Fixture,
} from "./helpers/portals-fixture";

const ORG = "fold-org";
const EVENT = "fold-event";

function file(f: Fixture, id: string, submissionId: string, createdAt: number): void {
  f.run(
    `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, created_at, updated_at) values (?, ?, 'presentation', ?, ?, 1000, 'application/pdf', ?, ?)`,
    id,
    submissionId,
    `${id}.pdf`,
    `r2/${id}`,
    createdAt,
    createdAt,
  );
}

function assign(f: Fixture, id: string, taskId: string, contactId: string, opts: { fileId?: string; status?: string } = {}): void {
  f.run(
    `insert into task_assignment (id, task_id, contact_id, status, file_id, completed_at, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    taskId,
    contactId,
    opts.status ?? "pending",
    opts.fileId ?? null,
    opts.status === "complete" ? f.now : null,
    f.now,
    f.now,
  );
}

async function world(): Promise<Fixture> {
  const f = makePortalsFixture();
  addOrg(f, ORG);
  addEvent(f, EVENT, ORG);
  f.run(`update event set slug = ? where id = ?`, DEMO_EVENT_SLUG, EVENT);
  addContact(f, "ada", ORG, "Ada Lovelace");
  addContact(f, "bo", ORG, "Bo Diaz");
  addContact(f, "cy", ORG, "Cy Young");
  addSession(f, "ada-talk", EVENT);
  addSession(f, "bo-one", EVENT);
  addSession(f, "bo-two", EVENT);
  addSession(f, "cy-talk", EVENT, { status: "pending" });
  addParticipant(f, "p-ada", "ada-talk", "ada");
  addParticipant(f, "p-bo-1", "bo-one", "bo");
  addParticipant(f, "p-bo-2", "bo-two", "bo");
  addParticipant(f, "p-cy", "cy-talk", "cy");

  addTask(f, "slides", EVENT, { title: "Final slides", kind: "file_request", scope: "participation" });
  addTask(f, "hotel", EVENT, { title: "Hotel stay requirement form", kind: "form" });
  addTask(f, "flight", EVENT, { title: "Flight reimbursement form", kind: "form" });
  addTask(f, "deck", EVENT, { title: "Upload your slide deck", kind: "file_request" });
  addTask(f, "pres", EVENT, { title: "Upload Session Presentation", kind: "file_request" });
  addTask(f, "bio", EVENT, { title: "Finalize bio + headshot" });
  addTask(f, "print", EVENT, { title: "Upload Final Headshot (print quality)", kind: "file_request" });
  addTask(f, "travel", EVENT, { title: "Travel form" });
  f.run(`update task set audience = 'portal' where id in ('slides', 'travel')`);

  addPortal(f, "cfp", EVENT, ACCEPTED_SESSIONS, { name: "CFP speakers" });
  addPortalItem(f, "i-slides", "cfp", { taskId: "slides" }, { required: true });
  addPortalItem(f, "i-hotel", "cfp", { taskId: "hotel" }, { required: true });
  addPortalItem(f, "i-flight", "cfp", { taskId: "flight" }, { required: true });
  addPortalItem(f, "i-travel", "cfp", { taskId: "travel" }, { required: true });

  // pre-portal hand-picked rows, and decks uploaded for a session
  assign(f, "a-hotel-ada", "hotel", "ada");
  assign(f, "a-hotel-cy", "hotel", "cy");
  file(f, "f-ada", "ada-talk", f.now - 3000);
  file(f, "f-bo-old", "bo-two", f.now - 2000);
  file(f, "f-bo-new", "bo-two", f.now - 1000);
  assign(f, "a-deck-ada", "deck", "ada", { fileId: "f-ada", status: "complete" });
  assign(f, "a-deck-bo", "deck", "bo", { fileId: "f-bo-old", status: "complete" });
  assign(f, "a-pres-bo", "pres", "bo", { fileId: "f-bo-new", status: "complete" });
  assign(f, "a-deck-cy", "deck", "cy");
  assign(f, "a-bio-ada", "bio", "ada", { status: "complete" });
  assign(f, "a-print-bo", "print", "bo");
  assign(f, "a-travel-cy", "travel", "cy");

  await reconcileEventPortals(f.db, EVENT, new Date(f.now), { notify: "none" });
  return f;
}

function fold(f: Fixture): void {
  for (const s of demoFoldStatements(f.now)) f.sqlite.exec(s);
}

const snapshot = (f: Fixture) => ({
  tasks: f.all(`select id, title, audience from task order by id`),
  rows: f.all(`select task_id, contact_id, scope_key, status, file_id, source from task_assignment order by task_id, contact_id, scope_key`),
  items: f.all(`select id, task_id, position from portal_item order by id`),
});

describe("demo fold (decision 78)", () => {
  it("puts each deck on the Final slides row for its own session, newest upload first", async () => {
    const f = await world();
    fold(f);
    expect(f.all(`select contact_id, scope_key, status, file_id from task_assignment where task_id = 'slides' order by contact_id, scope_key`)).toEqual([
      { contact_id: "ada", scope_key: "p:p-ada", status: "complete", file_id: "f-ada" },
      { contact_id: "bo", scope_key: "p:p-bo-1", status: "pending", file_id: null },
      { contact_id: "bo", scope_key: "p:p-bo-2", status: "complete", file_id: "f-bo-new" },
    ]);
    f.sqlite.close();
  });

  it("removes every duplicate with its rows and portal items, and leaves the files", async () => {
    const f = await world();
    fold(f);
    const placeholders = FOLDED_TITLES.map(() => "?").join(", ");
    expect(f.all(`select id from task where title in (${placeholders})`, ...FOLDED_TITLES)).toEqual([]);
    expect(f.all(`select id from task_assignment where task_id in ('deck', 'pres', 'bio', 'print', 'travel')`)).toEqual([]);
    expect(f.all(`select id from portal_item where id = 'i-travel'`)).toEqual([]);
    expect(f.all(`select id from file order by id`)).toEqual([{ id: "f-ada" }, { id: "f-bo-new" }, { id: "f-bo-old" }]);
    f.sqlite.close();
  });

  it("makes the Hotel and Flight forms portal items: a covered person's hand-picked row becomes the portal's", async () => {
    const f = await world();
    fold(f);
    expect(f.all(`select audience from task where id in ('hotel', 'flight') order by id`)).toEqual([{ audience: "portal" }, { audience: "portal" }]);
    // Ada's talk is in CFP speakers; Cy's is still in review, so Cy keeps the hand-picked row
    expect(f.all(`select contact_id, source from task_assignment where task_id = 'hotel' order by contact_id`)).toEqual([
      { contact_id: "ada", source: "portal" },
      { contact_id: "bo", source: "portal" },
      { contact_id: "cy", source: "direct" },
    ]);
    f.sqlite.close();
  });

  it("is idempotent, and a reconcile afterwards adds no second copy of anything", async () => {
    const f = await world();
    fold(f);
    const once = snapshot(f);
    fold(f);
    expect(snapshot(f)).toEqual(once);
    await reconcileEventPortals(f.db, EVENT, new Date(f.now), { notify: "none" });
    expect(f.all(`select task_id, contact_id, scope_key, count(*) as n from task_assignment group by 1, 2, 3 having n > 1`)).toEqual([]);
    expect(f.all(`select count(*) as n from task_assignment where task_id = 'slides'`)).toEqual([{ n: 3 }]);
    f.sqlite.close();
  });

  it("touches nothing outside the demo event", async () => {
    const f = await world();
    f.run(`update event set slug = 'another-event' where id = ?`, EVENT);
    const before = snapshot(f);
    fold(f);
    expect(snapshot(f)).toEqual(before);
    f.sqlite.close();
  });
});
