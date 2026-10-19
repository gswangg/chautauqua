// Multi-portal decision 74: the event-wide "Show resources" switch is
// retired -- each portal lists the resources its people see. A stored
// show_resources = 0 (set before the switch went) no longer hides anything:
// the portal data loader reads every event the person takes part in as
// showing resources. Real rows, every migration on node:sqlite.

import { describe, expect, it } from "vitest";
import { getPortalData } from "../src/server/repo/portal/data";
import { addContact, addEvent, addOrg, addParticipant, addSession, makePortalsFixture } from "./helpers/portals-fixture";

describe("Show resources is retired (decision 74)", () => {
  it("a stored 'off' still shows resources for every event the person takes part in", async () => {
    const f = makePortalsFixture();
    addOrg(f, "rs-org");
    addEvent(f, "rs-event", "rs-org");
    addContact(f, "rs-priya", "rs-org", "Priya Raman");
    addSession(f, "rs-talk", "rs-event");
    addParticipant(f, "rs-part", "rs-talk", "rs-priya", { inviteStatus: "accepted" });
    f.run(
      `insert into portal_settings (id, event_id, show_resources, created_at, updated_at) values ('rs-settings', 'rs-event', 0, ?, ?)`,
      f.now,
      f.now,
    );

    const data = await getPortalData(f.db, "rs-priya", "rs-org");
    expect(data.showResourcesByEventId).toEqual({ "rs-event": true });
    f.sqlite.close();
  });
});
