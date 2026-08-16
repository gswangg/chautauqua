// task-w17-c (DEC-885): three-up desktop speaker grid, a drawn headshot
// placeholder (initials over a hatch), and day pills that say which day is
// showing (?day= links on the default view + exactly one aria-current
// pill on both the default and the ?day=-filtered view).

import { describe, expect, it } from "vitest";
import { PUBLIC_CSS } from "../src/routes/public/public.css";
import { AGENDA_CSS } from "../src/routes/public/css/agenda.css";
import { CARDS_CSS } from "../src/routes/public/css/cards.css";
import { SpeakersContent, GalleryContent } from "../src/routes/public/speakers";
import { AgendaContent } from "../src/routes/public/agenda";
import type { PublicAgendaItem, PublicEvent, PublicSpeakerWithSessions } from "../src/server/repo/public";

const EVENT: PublicEvent = {
  id: "e1",
  orgId: "org1",
  name: "Event",
  slug: "ev",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

function speaker(overrides: Partial<PublicSpeakerWithSessions>): PublicSpeakerWithSessions {
  return {
    contactId: "sp1",
    firstName: "Ada",
    lastName: "Lovelace",
    title: "Chief Engineer",
    company: "Analytical Engines Inc",
    headshotUrl: "https://x.test/ada.jpg",
    bio: null,
    sessions: [{ id: "sub1", title: "Punch Cards 101" }],
    ...overrides,
  };
}

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
    tracks: [],
    speakers: [],
    format: null,
    ...overrides,
  };
}

describe("DEC-885/DEC-385: desktop speaker grid is three-up (single-direction, max-width only)", () => {
  it("the unprefixed (desktop) .chq-pub-speaker-grid rule declares exactly 3 columns", () => {
    // Checked against CARDS_CSS directly (task-w5-a: chrome.css.ts now also
    // has its own earlier @media (max-width: 700px) block for
    // .chq-pub-filter-row, so cutting PUBLIC_CSS at the FIRST "@media"
    // literal would land inside CHROME_CSS, before .chq-pub-speaker-grid's
    // own rule in CARDS_CSS is ever reached). CARDS_CSS's own
    // .chq-pub-speaker-grid rule itself carries no @media prefix -- DEC-367
    // (wave 50 amendment) since added CARDS_CSS's own phone-scoped 700px
    // block AFTER it (for .chq-pub-view-toggle-option's tap floor only),
    // so the grid rule stays unprefixed/desktop.
    const speakerGridIdx = CARDS_CSS.indexOf(".chq-pub-speaker-grid {");
    const cardsMediaIdx = CARDS_CSS.indexOf("@media");
    expect(speakerGridIdx).toBeGreaterThan(-1);
    expect(cardsMediaIdx).toBeGreaterThan(-1);
    expect(speakerGridIdx).toBeLessThan(cardsMediaIdx);
    expect(CARDS_CSS).toMatch(
      /\.chq-pub-speaker-grid\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(3,\s*1fr\);/,
    );
  });

  it("never introduces a min-width media query (DEC-385 single-direction guard)", () => {
    expect(PUBLIC_CSS).not.toMatch(/@media[^{]*min-width/);
  });

  it("a max-width:900px block narrows the desktop 3-column grid back to the auto-fill floor", () => {
    const media900 = PUBLIC_CSS.match(/@media \(max-width: 900px\) \{([\s\S]*?)\n  \}/);
    expect(media900).toBeTruthy();
    const block = media900![1]!;
    expect(block).toMatch(/\.chq-pub-speaker-grid\s*\{\s*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(140px,\s*1fr\)\);\s*\}/);
    expect(block).not.toMatch(/\.chq-pub-gallery-grid\s*\{/);
  });

  it("the existing narrow-viewport (700px) speaker-grid rule is untouched and sits after the 900px block, still winning below 700px", () => {
    expect(AGENDA_CSS).toMatch(
      /\.chq-pub-speaker-grid\s*\{\s*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(120px,\s*1fr\)\);\s*\}/,
    );
    // task-w5-a: compared within AGENDA_CSS, not PUBLIC_CSS -- chrome.css.ts
    // now has its own earlier, unrelated @media (max-width: 700px) block
    // (see the "gallery's own DEC-593 override" test below for the same
    // caveat on the concatenated string).
    const idx900 = AGENDA_CSS.indexOf("@media (max-width: 900px)");
    const idx700 = AGENDA_CSS.indexOf("@media (max-width: 700px)");
    expect(idx900).toBeGreaterThan(-1);
    expect(idx700).toBeGreaterThan(idx900);
  });

  it("the gallery's own DEC-593 override still wins at every width (appears after the speaker-grid override in the SAME 700px block)", () => {
    const idxGalleryOverride = PUBLIC_CSS.lastIndexOf(".chq-pub-gallery-grid");
    const idx900 = PUBLIC_CSS.indexOf("@media (max-width: 900px)");
    // The 700px block that actually narrows .chq-pub-speaker-grid (a second,
    // unrelated 700px block owned by another lane appears later in the file
    // but only touches .chq-pub-sessions-layout, so it's not the one that
    // matters for this cascade check).
    const idxNarrowSpeakerGridRule = PUBLIC_CSS.indexOf(
      ".chq-pub-speaker-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }",
    );
    expect(idxGalleryOverride).toBeGreaterThan(idx900);
    expect(idxGalleryOverride).toBeGreaterThan(idxNarrowSpeakerGridRule);
  });
});

describe("DEC-885: drawn headshot placeholder carries initials", () => {
  it("a speaker with no headshot renders the fallback element with initials text", () => {
    const noHeadshot = speaker({ headshotUrl: null, firstName: "Ada", lastName: "Lovelace" });
    const html = String(SpeakersContent({ event: EVENT, speakers: [noHeadshot], total: 1, page: 1, q: null }));
    expect(html).toContain('class="chq-pub-headshot-fallback"');
    expect(html).toContain(">AL<");
  });

  it("the fallback element is aria-hidden (the wrapping link already names the speaker via aria-label)", () => {
    const noHeadshot = speaker({ headshotUrl: null });
    const html = String(GalleryContent({ event: EVENT, speakers: [noHeadshot], total: 1, page: 1, q: null }));
    expect(html).toMatch(/<div class="chq-pub-headshot-fallback" aria-hidden="true">/);
  });

  it("PUBLIC_CSS draws the placeholder from a repeating-linear-gradient hatch built from existing tokens", () => {
    expect(PUBLIC_CSS).toMatch(/\.chq-pub-headshot-fallback\s*\{[^}]*repeating-linear-gradient\(/);
    expect(PUBLIC_CSS).toMatch(/\.chq-pub-headshot-fallback\s*\{[^}]*var\(--chq-surface-sunk\)/);
    expect(PUBLIC_CSS).toMatch(/\.chq-pub-headshot-fallback\s*\{[^}]*var\(--chq-hairline\)/);
  });
});

describe("DEC-885: agenda/schedule day pills say which day is showing", () => {
  const items = [
    item({ submissionId: "s1", day: "2026-08-10" }),
    item({ submissionId: "s2", day: "2026-08-11" }),
  ];

  it("the default (unfiltered) AgendaContent view emits ?day= hrefs, not bare #anchors", () => {
    const html = String(AgendaContent({ event: EVENT, items, total: 2, activeDay: null }));
    const pillHrefs = [...html.matchAll(/class="chq-pub-day-pill[^"]*" href="([^"]*)"/g)].map((m) => m[1]!);
    expect(pillHrefs.length).toBe(2);
    for (const href of pillHrefs) {
      expect(href.startsWith("#")).toBe(false);
      expect(href).toContain("?day=");
    }
  });

  it("the default view marks exactly one pill aria-current=\"page\" (the first day)", () => {
    const html = String(AgendaContent({ event: EVENT, items, total: 2, activeDay: null }));
    const current = [...html.matchAll(/aria-current="page"/g)];
    expect(current.length).toBe(1);
    // the first day's pill is the one carrying it
    const firstPillMatch = html.match(/<a class="chq-pub-day-pill[^"]*"[^>]*>/);
    expect(firstPillMatch![0]).toContain('aria-current="page"');
    expect(firstPillMatch![0]).toContain("chq-pub-day-pill-active");
  });

  // task-w1-d (DEC-555 amendment): /schedule dropped the day-pill row
  // entirely (frame 10--12 has none) -- the day-pill contract below is now
  // /agenda's alone, proven on AgendaContent rather than ScheduleContent.
  it("the ?day=-filtered view marks exactly one pill aria-current=\"page\" (the filtered day)", () => {
    const html = String(AgendaContent({ event: EVENT, items: [items[0]!], total: 2, activeDay: "2026-08-10", allDays: ["2026-08-10", "2026-08-11"] }));
    const current = [...html.matchAll(/aria-current="page"/g)];
    expect(current.length).toBe(1);
    expect(html).toContain('aria-current="page"');
  });

  it("a non-active day pill on the filtered view carries no aria-current", () => {
    const html = String(AgendaContent({ event: EVENT, items: [items[0]!], total: 2, activeDay: "2026-08-10", allDays: ["2026-08-10", "2026-08-11"] }));
    // day 08-11 pill (out-link, not rendered on this filtered page) should not carry aria-current
    const day11Pill = html.match(/<a class="chq-pub-day-pill[^"]*"[^>]*href="[^"]*day=2026-08-11[^"]*"[^>]*>/);
    expect(day11Pill).toBeTruthy();
    expect(day11Pill![0]).not.toContain("aria-current");
  });
});
