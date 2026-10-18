// Reminders cover portal items: a live portal assignment is outstanding with
// the deadline its portal set (not its task's), and an item that left the
// person's home when they lost the portal is no longer chased. Real rows,
// every migration on node:sqlite.

import { describe, expect, it } from "vitest";
import { reconcileEventPortals } from "../src/server/repo/portals/reconcile";
import { listOutstandingForEvent } from "../src/server/repo/tasks/reminders";
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
} from "./helpers/portals-fixture";

const EVENT = "rem-event";
const MAY1 = Date.UTC(2027, 4, 1);

function world() {
  const f = makePortalsFixture();
  addOrg(f, "rem-org");
  addEvent(f, EVENT, "rem-org");
  addContact(f, "rem-priya", "rem-org", "Priya Raman");
  addSession(f, "rem-talk", EVENT);
  addParticipant(f, "rem-part", "rem-talk", "rem-priya");
  // the task's own due date is not the portal's
  addTask(f, "rem-slides", EVENT, { title: "Final slides", scope: "participation", dueDate: Date.UTC(2027, 8, 1) });
  f.run(`update task set audience = 'portal' where id = 'rem-slides'`);
  addPortal(f, "rem-cfp", EVENT, ACCEPTED_SESSIONS, { name: "CFP speakers" });
  addPortalItem(f, "rem-item", "rem-cfp", { taskId: "rem-slides" }, { deadlineKind: "fixed", dueDate: MAY1, required: true });
  return f;
}

describe("reminders and portal items", () => {
  it("chases a live portal item with the deadline its portal set", async () => {
    const f = world();
    await reconcileEventPortals(f.db, EVENT, new Date(f.now), { notify: "none" });
    const rows = await listOutstandingForEvent(f.db, EVENT);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ taskTitle: "Final slides", contactId: "rem-priya" });
    expect(rows[0]!.dueDate?.getTime()).toBe(MAY1);
    f.sqlite.close();
  });

  it("stops chasing it once the person loses the portal", async () => {
    const f = world();
    await reconcileEventPortals(f.db, EVENT, new Date(f.now), { notify: "none" });
    f.run(`update portal set rule_json = '{"groups":[]}' where id = 'rem-cfp'`);
    await reconcileEventPortals(f.db, EVENT, new Date(f.now), { notify: "none" });
    expect(f.all(`select detached_at from task_assignment`)).toEqual([{ detached_at: expect.any(Number) }]);
    expect(await listOutstandingForEvent(f.db, EVENT)).toEqual([]);
    f.sqlite.close();
  });
});
