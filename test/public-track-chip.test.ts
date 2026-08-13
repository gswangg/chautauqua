// DEC-430: the public track chip stops using organizer-supplied colour as a
// text-on-fill background (measured 3.00-3.10:1 against --chq-on-brand across
// six public/embed routes). It now renders ink-on-surface always, carrying the
// colour only as a bounded swatch fed by --chq-track-color -- and only when
// that value passes a strict hex guard (DEC-374 pattern). This test exercises
// the guard directly (cards.tsx's TrackChips) and confirms public.css.ts no
// longer models "text on an arbitrary accent fill".

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TrackChips } from "../src/routes/public/cards";
import { AgendaContent, ScheduleContent } from "../src/routes/public/agenda";
import type { PublicAgendaItem, PublicEvent, PublicTrack } from "../src/server/repo/public";

function track(color: string | null): PublicTrack {
  return { id: "t1", name: "Track A", color, sortOrder: 0 } as PublicTrack;
}

function renderChip(color: string | null): string {
  return String(TrackChips({ tracks: [track(color)] }));
}

const EVENT: PublicEvent = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-10",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

function agendaItem(format: string | null): PublicAgendaItem {
  return {
    submissionId: "sub-a",
    ref: "SES-001",
    title: "Session A",
    description: null,
    day: "2026-08-10",
    startMin: 540,
    endMin: 600,
    roomId: "room-1",
    roomName: "Room 1",
    roomPosition: 0,
    icsSequence: 0,
    tracks: [],
    speakers: [],
    format,
  };
}

describe("TrackChips: DEC-374-pattern hex guard on the track colour", () => {
  it("a non-hex value never reaches the rendered style attribute", () => {
    for (const bad of ["red;}", "javascript:alert(1)", "var(--x)", "rgb(0,0,0)", "#gggggg", "#12345"]) {
      const html = renderChip(bad);
      expect(html).not.toContain("--chq-track-color");
      expect(html).not.toContain(bad);
    }
  });

  it("null color never reaches the rendered style attribute", () => {
    const html = renderChip(null);
    expect(html).not.toContain("--chq-track-color");
    expect(html).not.toContain("style=");
  });

  it("a valid 6-digit hex value is carried as the --chq-track-color custom property", () => {
    const html = renderChip("#1a2b3c");
    expect(html).toContain('style="--chq-track-color:#1a2b3c"');
  });

  it("a valid 3-digit hex value is expanded to 6-digit and carried as the --chq-track-color custom property (DEC-371 amendment, wave 43: normalizeHexColor expands 3->6)", () => {
    const html = renderChip("#abc");
    expect(html).toContain('style="--chq-track-color:#aabbcc"');
  });

  it("never emits a background: declaration on the chip element", () => {
    const html = renderChip("#123456");
    expect(html).not.toContain("background:");
  });
});

describe("FormatChip on /e/:slug/agenda and /e/:slug/schedule (EMB mandate 40e)", () => {
  it("AgendaContent renders the format chip when format is set", () => {
    const html = String(AgendaContent({ event: EVENT, items: [agendaItem("Workshop")], total: 1 }));
    expect(html).toContain('class="chq-pub-format-chip"');
    expect(html).toContain("Workshop");
  });

  it("AgendaContent renders no format chip when format is null", () => {
    const html = String(AgendaContent({ event: EVENT, items: [agendaItem(null)], total: 1 }));
    expect(html).not.toContain("chq-pub-format-chip");
  });

  it("ScheduleContent renders the format chip when format is set", () => {
    const html = String(ScheduleContent({ event: EVENT, items: [agendaItem("Workshop")], total: 1 }));
    expect(html).toContain('class="chq-pub-format-chip"');
    expect(html).toContain("Workshop");
  });

  it("ScheduleContent renders no format chip when format is null", () => {
    const html = String(ScheduleContent({ event: EVENT, items: [agendaItem(null)], total: 1 }));
    expect(html).not.toContain("chq-pub-format-chip");
  });
});

describe("public.css.ts: chip rule no longer references --chq-on-brand", () => {
  it("the .chq-pub-track-chip rule does not use --chq-on-brand", () => {
    const css = readFileSync(join(__dirname, "../src/routes/public/public.css.ts"), "utf8");
    const ruleStart = css.indexOf(".chq-pub-track-chip {");
    expect(ruleStart).toBeGreaterThan(-1);
    const ruleEnd = css.indexOf("}", ruleStart);
    const rule = css.slice(ruleStart, ruleEnd);
    expect(rule).not.toContain("--chq-on-brand");
    expect(rule).toContain("--chq-ink");
  });
});
