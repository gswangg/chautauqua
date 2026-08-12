// DEC-666: the public agenda must never leak the internal "TBD" shorthand
// (used only as an internal map KEY for the roomless column, see
// src/routes/public/agenda.tsx's `roomId ?? "tbd"` grouping) into rendered
// markup. publicRoomLabel is the ONE place a nullable room name becomes
// public-facing prose; both the desktop grid header and the phone list row
// call it, so they can never drift apart.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { publicRoomLabel, ROOM_TBA_LABEL } from "../src/domain/schedule";
import { AgendaContent, ScheduleContent } from "../src/routes/public/agenda";
import { agendaIcsEvents, projectCardFields } from "../src/routes/public/feeds";
import type { PublicAgendaItem, PublicEvent } from "../src/server/repo/public";

describe("publicRoomLabel (DEC-666)", () => {
  it("returns the room name unchanged when present", () => {
    expect(publicRoomLabel("Main Hall")).toBe("Main Hall");
  });

  it("returns ROOM_TBA_LABEL, never the internal 'TBD' shorthand, for a null room", () => {
    expect(publicRoomLabel(null)).toBe(ROOM_TBA_LABEL);
    expect(publicRoomLabel(null)).toBe("To be announced");
    expect(publicRoomLabel(null)).not.toBe("TBD");
  });
});

const EVENT: PublicEvent = {
  id: "e1",
  orgId: "org1",
  name: "Event",
  slug: "ev",
  startDate: "2026-08-10",
  endDate: "2026-08-10",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

function item(overrides: Partial<PublicAgendaItem>): PublicAgendaItem {
  return {
    submissionId: "sub",
    ref: "SES-1",
    title: "Talk",
    description: null,
    day: "2026-08-10",
    startMin: 540,
    endMin: 600,
    roomId: null,
    roomName: null,
    roomPosition: null,
    icsSequence: 0,
    tracks: [],
    speakers: [],
    format: null,
    ...overrides,
  };
}

describe("agenda.tsx rendering (DEC-666)", () => {
  const unroomed = item({ submissionId: "s1", title: "Unroomed Talk" });

  it("AgendaContent (desktop grid header + phone list) renders 'To be announced', never 'TBD'", () => {
    const html = String(AgendaContent({ event: EVENT, items: [unroomed], total: 1 }));
    expect(html).toContain("To be announced");
    expect(html).not.toContain("TBD");
  });

  it("ScheduleContent's phone-list row renders 'To be announced', never 'TBD'", () => {
    const html = String(ScheduleContent({ event: EVENT, items: [unroomed], total: 1 }));
    expect(html).toContain("To be announced");
    expect(html).not.toContain("TBD");
  });

  it("a roomed session still renders its real room name at both call sites", () => {
    const roomed = item({ submissionId: "s2", roomId: "r1", roomName: "Main Hall", roomPosition: 0 });
    const html = String(AgendaContent({ event: EVENT, items: [roomed], total: 1 }));
    expect(html).toContain("Main Hall");
  });
});

describe("feeds stay data, not prose, for an unroomed session (DEC-666)", () => {
  const unroomed = item({ submissionId: "s1", title: "Unroomed Talk", description: null });

  it("projectCardFields emits room: null, not any TBD prose", () => {
    const projected = projectCardFields(unroomed as unknown as Record<string, unknown>, {
      track: false,
      time: false,
      room: true,
      speaker: false,
      description: false,
      format: false,
    });
    expect(projected).toHaveProperty("roomName", null);
  });

  it("agendaIcsEvents omits LOCATION (location: undefined) for an unroomed session", () => {
    const events = agendaIcsEvents(EVENT, [unroomed], new Date("2026-08-10T00:00:00Z"));
    expect(events[0]!.location).toBeUndefined();
  });
});

describe("guard: no public route markup emits the literal 'TBD' (DEC-666)", () => {
  it("enumerates every file under src/routes/public/ and fails naming file+line on any 'TBD' occurrence", () => {
    const root = join(__dirname, "..", "src", "routes", "public");
    const offenders: string[] = [];

    function walk(dir: string): void {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(tsx?|jsx?)$/.test(entry)) continue;
        const lines = readFileSync(full, "utf8").split("\n");
        lines.forEach((line, idx) => {
          // Comments (// ...) explain code, they don't emit markup — only a
          // non-comment line containing "TBD" is a leak into what a browser
          // or feed consumer actually receives.
          if (line.trim().startsWith("//")) return;
          if (line.includes("TBD")) {
            offenders.push(`${full}:${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }

    walk(root);
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
