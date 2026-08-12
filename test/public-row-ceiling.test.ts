// DEC-477/DEC-487: raises the public list row ceiling past SPEC.md:73-76's
// top-of-range 800 speakers, and makes 'Show more' honest about the ROW
// bound (MAX_PUBLIC_ROWS) as well as the page bound (MAX_PUBLIC_PAGE) — a
// large ?limit= embed can hit the row ceiling well before the page ceiling.
// PUBLIC_PER_PAGE/MAX_PUBLIC_PAGE/MAX_PUBLIC_ROWS/hasMorePages all live in
// one home: src/server/repo/public/bounds.ts (DEC-487).

import { describe, expect, it } from "vitest";
import { PUBLIC_PER_PAGE, MAX_PUBLIC_PAGE, MAX_PUBLIC_ROWS, hasMorePages } from "../src/server/repo/public/bounds";
import { SessionsContent } from "../src/routes/public/sessions";
import { SpeakersContent, GalleryContent } from "../src/routes/public/speakers";
import type { PublicEvent, PublicSession, PublicSpeakerWithSessions } from "../src/server/repo/public";

const EVENT: PublicEvent = {
  id: "e1",
  slug: "ev",
  name: "Ev",
  timezone: "UTC",
} as unknown as PublicEvent;

function session(i: number): PublicSession {
  return {
    id: `s${i}`,
    ref: `s${i}`,
    title: `Session ${i}`,
    description: null,
    icsSequence: 1,
    tracks: [],
    speakers: [],
    day: null,
    startMin: null,
    endMin: null,
    roomName: null,
  };
}

function speaker(i: number): PublicSpeakerWithSessions {
  return {
    contactId: `c${i}`,
    firstName: "First",
    lastName: `Last${i}`,
    title: null,
    company: null,
    headshotUrl: null,
    bio: null,
    sessions: [],
  };
}

describe("DEC-477/DEC-487: MAX_PUBLIC_PAGE x PUBLIC_PER_PAGE == MAX_PUBLIC_ROWS (drift guard)", () => {
  it("stays in lockstep — MAX_PUBLIC_ROWS is derived, never a second literal", () => {
    expect(MAX_PUBLIC_PAGE * PUBLIC_PER_PAGE).toBe(MAX_PUBLIC_ROWS);
  });
});

describe("DEC-477/DEC-487: hasMorePages respects the row ceiling, not just the page ceiling", () => {
  it("present just under the row ceiling for a large ?limit= perPage (page*perPage < MAX_PUBLIC_ROWS)", () => {
    // perPage=100: page 11 * 100 = 1100 < 1200 (MAX_PUBLIC_ROWS)
    expect(hasMorePages(100, 2000, 11, 100)).toBe(true);
  });

  it("absent right at the row ceiling for a large ?limit= perPage (page*perPage == MAX_PUBLIC_ROWS)", () => {
    // perPage=100: page 12 * 100 = 1200 == MAX_PUBLIC_ROWS
    expect(hasMorePages(100, 2000, 12, 100)).toBe(false);
  });

  it("absent once page reaches MAX_PUBLIC_PAGE even if shown < total and row ceiling isn't hit", () => {
    expect(hasMorePages(1, 2000, MAX_PUBLIC_PAGE, 1)).toBe(false);
  });

  it("absent once shown >= total even with room under both ceilings", () => {
    expect(hasMorePages(50, 50, 1, PUBLIC_PER_PAGE)).toBe(false);
  });
});

describe("DEC-477/DEC-487: SessionsContent/SpeakersContent/GalleryContent wire hasMorePages through", () => {
  it("SessionsContent: 'Show more' present just under the row ceiling for a large perPage", () => {
    const items = Array.from({ length: 100 }, (_, i) => session(i));
    const html = String(
      SessionsContent({
        event: EVENT,
        tracks: [],
        activeTrackId: null,
        q: null,
        items,
        total: 2000,
        page: 11,
        perPage: 100,
      }),
    );
    expect(html).toContain("Show more");
  });

  it("SessionsContent: 'Show more' absent right at the row ceiling for a large perPage", () => {
    const items = Array.from({ length: 100 }, (_, i) => session(i));
    const html = String(
      SessionsContent({
        event: EVENT,
        tracks: [],
        activeTrackId: null,
        q: null,
        items,
        total: 2000,
        page: 12,
        perPage: 100,
      }),
    );
    expect(html).not.toContain("Show more");
  });

  it("SessionsContent: default perPage falls back to PUBLIC_PER_PAGE when omitted", () => {
    const items = Array.from({ length: PUBLIC_PER_PAGE }, (_, i) => session(i));
    const html = String(
      SessionsContent({ event: EVENT, tracks: [], activeTrackId: null, q: null, items, total: 2000, page: 1 }),
    );
    expect(html).toContain("Show more");
  });

  it("SpeakersContent: 'Show more' absent once page reaches MAX_PUBLIC_PAGE", () => {
    const items = Array.from({ length: PUBLIC_PER_PAGE }, (_, i) => speaker(i));
    const html = String(
      SpeakersContent({ event: EVENT, speakers: items, total: 2000, page: MAX_PUBLIC_PAGE, q: null }),
    );
    expect(html).not.toContain("Show more");
  });

  it("GalleryContent: 'Show more' absent once page reaches MAX_PUBLIC_PAGE", () => {
    const items = Array.from({ length: PUBLIC_PER_PAGE }, (_, i) => speaker(i));
    const html = String(
      GalleryContent({ event: EVENT, speakers: items, total: 2000, page: MAX_PUBLIC_PAGE, q: null }),
    );
    expect(html).not.toContain("Show more");
  });
});
