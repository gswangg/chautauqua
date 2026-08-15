// task-w8-a (DEC-968 amendment, wave 8): EMB-01 (sessions-list card, weight
// 3) and EMB-09 (schedule/itinerary card, weight 2) both require the
// session-scoped speaker line to carry job title and/or company. This pins
// the identity clause on both the sessions-list row (SessionCard) and the
// /schedule itinerary row (AgendaItemList) so a future edit can't restore a
// bare-name line on one surface while leaving the other correct.

import { describe, expect, it } from "vitest";
import { SessionCard } from "../src/routes/public/cards";
import { AgendaItemList } from "../src/routes/public/agenda-list";
import type { PublicEvent, PublicSession } from "../src/server/repo/public";
import type { PublicAgendaItem } from "../src/server/repo/public/agenda";

const EVENT: PublicEvent = {
  id: "e1",
  orgId: "org1",
  name: "DevFlow Conf",
  slug: "devflow",
  startDate: "2026-08-10",
  endDate: "2026-08-12",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

const SPEAKER = {
  contactId: "sp1",
  firstName: "Ada",
  lastName: "Lovelace",
  title: "Engineer",
  company: "Acme",
  headshotUrl: null,
  bio: null,
};

describe("task-w8-a: speaker identity clause on the sessions-list card (EMB-01)", () => {
  it("SessionCard's speaker line carries the title/company clause", () => {
    const session: PublicSession = {
      id: "s1",
      ref: "s1",
      title: "Session One",
      description: null,
      icsSequence: 1,
      tracks: [],
      speakers: [SPEAKER],
      day: null,
      startMin: null,
      endMin: null,
      roomName: null,
      format: null,
    };
    const html = String(SessionCard({ session, event: EVENT }));
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Engineer, Acme");
    expect(html).toContain("chq-pub-speaker-identity");
  });
});

describe("task-w8-a: speaker identity clause on the /schedule itinerary row (EMB-09)", () => {
  it("AgendaItemList's speaker line carries the title/company clause", () => {
    const item: PublicAgendaItem = {
      submissionId: "s1",
      ref: "s1",
      title: "Session One",
      description: null,
      day: "2026-08-10",
      startMin: 540,
      endMin: 570,
      roomId: null,
      roomName: null,
      roomPosition: null,
      icsSequence: 1,
      tracks: [],
      speakers: [SPEAKER],
      format: null,
    };
    const html = String(
      AgendaItemList({
        day: "2026-08-10",
        items: [item],
        event: EVENT,
        from: "agenda",
        itinerary: true,
      }),
    );
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Engineer, Acme");
    expect(html).toContain("chq-pub-speaker-identity");
  });
});
