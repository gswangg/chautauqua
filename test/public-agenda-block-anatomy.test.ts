// task-w53-a (DEC-999 Amendment, wave 53): the agenda block's time/track-
// chip/format-chip trio share one flex-wrap row (chq-pub-agenda-block-meta)
// instead of the block's own column flexbox default-stretching the
// inline-flex chip children full-width (no align-items declared previously).

import { describe, expect, it } from "vitest";
import { PUBLIC_CSS } from "../src/routes/public/public.css";
import { AgendaDayGrid } from "../src/routes/public/agenda";
import type { PublicAgendaItem, PublicEvent } from "../src/server/repo/public";

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
    endMin: 555,
    roomId: "room-a",
    roomName: "Alpha Hall",
    roomPosition: 0,
    icsSequence: 0,
    tracks: [{ id: "t1", name: "Track One", color: "#123456" }],
    speakers: [{ contactId: "sp1", firstName: "Ada", lastName: "Lovelace", title: "Engineer", company: "Acme", headshotUrl: null, bio: null }],
    format: "Talk",
    ...overrides,
  };
}

describe("public.css.ts: agenda block anatomy", () => {
  it("the agenda-block rule declares a non-stretch align-items", () => {
    // Locate the rule by its selector comment landmark (DEC-999): the block
    // rule is emitted via `.${ACCENT_BOUND_CLASSES[0]} { ... }` template
    // interpolation, so it appears in the compiled string as the class name
    // itself (chq-pub-agenda-block) followed by its declaration body.
    const match = PUBLIC_CSS.match(/\.chq-pub-agenda-block\s*\{([^}]*)\}/);
    expect(match).toBeTruthy();
    const body = match![1]!;
    expect(body).toMatch(/align-items:\s*flex-start/);
    expect(body).not.toMatch(/align-items:\s*stretch/);
  });

  it("declares a .chq-pub-agenda-block-meta rule", () => {
    const match = PUBLIC_CSS.match(/\.chq-pub-agenda-block-meta\s*\{([^}]*)\}/);
    expect(match).toBeTruthy();
    const body = match![1]!;
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/flex-wrap:\s*wrap/);
  });
});

describe("AgendaDayGrid: chips render inline in one meta row, trailing the block (DEC-584 wave 64)", () => {
  it("renders both chips inside one chq-pub-agenda-block-meta element at the end of the block", () => {
    const items = [item({ submissionId: "s1", startMin: 540, endMin: 555 })];
    const html = String(AgendaDayGrid({ day: "2026-08-10", items, event: EVENT, from: "agenda" }));
    const meta = html.match(/<div class="chq-pub-agenda-block-meta">([\s\S]*?)<\/div>\s*<\/div>/);
    expect(meta).toBeTruthy();
    const metaHtml = meta![1]!;
    expect(metaHtml).toContain("chq-pub-track-chip");
    expect(metaHtml).toContain("chq-pub-format-chip");
    // the time is no longer repeated per block -- it lives once in the
    // row's own time cell (chq-pub-agenda-day-time).
    expect(html).toContain('<div class="chq-pub-agenda-day-time">9:00</div>');
  });
});
