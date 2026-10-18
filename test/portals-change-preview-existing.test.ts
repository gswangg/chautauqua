// The change preview says who'll get new items (and offers to email them).
// Someone who already has the item -- assigned directly before the portal
// listed it -- gets nothing new: the reconcile creates no row and emails no
// one, so the preview must not count them either.
import { describe, expect, it } from "vitest";
import { previewPortalChange } from "../src/server/repo/portals/admin";
import { reconcileEventPortals } from "../src/server/repo/portals/reconcile";
import type { PortalItemInput } from "../src/server/repo/portals/admin";
import { ACCEPTED_SESSIONS, addContact, addEvent, addOrg, addParticipant, addPortal, addSession, addTask, makePortalsFixture } from "./helpers/portals-fixture";

const ORG = "cpe-org";
const EVENT = "cpe-event";

function item(taskId: string): PortalItemInput {
  return { taskId, resourceId: null, systemKind: null, displayName: null, deadlineKind: "none", dueDate: null, relativeDays: null, required: false, graceDays: 0, allowEditAfterSubmit: false, viewOnlyWhenDone: false };
}

describe("change preview · people who already have the item", () => {
  it("counts only people the item is new to, and the save emails exactly them", async () => {
    const f = makePortalsFixture();
    addOrg(f, ORG);
    addEvent(f, EVENT, ORG);
    addContact(f, "cpe-ana", ORG, "Ana Direct");
    addContact(f, "cpe-ben", ORG, "Ben New");
    addSession(f, "cpe-s1", EVENT);
    addSession(f, "cpe-s2", EVENT);
    addParticipant(f, "cpe-p1", "cpe-s1", "cpe-ana");
    addParticipant(f, "cpe-p2", "cpe-s2", "cpe-ben");
    addTask(f, "cpe-announce", EVENT, { title: "Announce participation" });
    // Ana was assigned it directly before any portal listed it
    f.run(`insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at) values ('cpe-direct', 'cpe-announce', 'cpe-ana', 'pending', 1, 1)`);
    addPortal(f, "cpe-portal", EVENT, ACCEPTED_SESSIONS, { name: "CFP speakers" });
    await reconcileEventPortals(f.db, EVENT, new Date(f.now), { notify: "none" });

    const impact = await previewPortalChange(f.db, EVENT, "cpe-portal", {
      name: "CFP speakers",
      note: null,
      rule: ACCEPTED_SESSIONS,
      fieldPermissions: {},
      capabilities: {},
      notifyOnJoin: true,
      items: [item("cpe-announce")],
    });
    expect(impact.newItems.contactIds).toEqual(["cpe-ben"]);
    expect(impact.newItems.people).toBe(1);

    // saving with "email them" reaches the same one person
    f.run(`insert into portal_item (id, portal_id, task_id, deadline_kind, required, grace_days, position, created_at, updated_at) values ('cpe-item', 'cpe-portal', 'cpe-announce', 'none', 0, 0, 0, ?, ?)`, f.now, f.now);
    const result = await reconcileEventPortals(f.db, EVENT, new Date(f.now), { notify: "all" });
    expect(result.notifiedContactIds).toEqual(["cpe-ben"]);
    f.sqlite.close();
  });
});
