// DEC-477 (+DEC-453): raises the public list row ceiling past SPEC.md:73-76's
// top-of-range 800 speakers, and makes 'Show more' honest about the ROW
// bound (MAX_PUBLIC_ROWS) as well as the page bound (MAX_PUBLIC_PAGE) — a
// large ?limit= embed can hit the row ceiling well before the page ceiling.

import { describe, expect, it } from "vitest";
import { MAX_PUBLIC_PAGE } from "../src/routes/public/query";
import { PER_PAGE } from "../src/routes/public/shell";
import { MAX_PUBLIC_ROWS } from "../src/server/repo/public/bounds";
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

describe("DEC-477: MAX_PUBLIC_PAGE x PER_PAGE == MAX_PUBLIC_ROWS (drift guard)", () => {
  it("stays in lockstep — a change to one without the other silently truncates or offers a dead 'Show more'", () => {
    expect(MAX_PUBLIC_PAGE * PER_PAGE).toBe(MAX_PUBLIC_ROWS);
  });
});

describe("DEC-477: hasMore respects the row ceiling, not just the page ceiling", () => {
  it("SessionsContent: 'Show more' present just under the row ceiling (1199 of 2000)", () => {
    const items = Array.from({ length: MAX_PUBLIC_ROWS - 1 }, (_, i) => session(i));
    const html = String(
      SessionsContent({ event: EVENT, tracks: [], activeTrackId: null, q: null, items, total: 2000, page: 1 }),
    );
    expect(html).toContain("Show more");
  });

  it("SessionsContent: 'Show more' absent right at the row ceiling (1200 of 2000)", () => {
    const items = Array.from({ length: MAX_PUBLIC_ROWS }, (_, i) => session(i));
    const html = String(
      SessionsContent({ event: EVENT, tracks: [], activeTrackId: null, q: null, items, total: 2000, page: 1 }),
    );
    expect(html).not.toContain("Show more");
  });

  it("SpeakersContent: 'Show more' present just under the row ceiling (1199 of 2000)", () => {
    const items = Array.from({ length: MAX_PUBLIC_ROWS - 1 }, (_, i) => speaker(i));
    const html = String(SpeakersContent({ event: EVENT, speakers: items, total: 2000, page: 1, q: null }));
    expect(html).toContain("Show more");
  });

  it("SpeakersContent: 'Show more' absent right at the row ceiling (1200 of 2000)", () => {
    const items = Array.from({ length: MAX_PUBLIC_ROWS }, (_, i) => speaker(i));
    const html = String(SpeakersContent({ event: EVENT, speakers: items, total: 2000, page: 1, q: null }));
    expect(html).not.toContain("Show more");
  });

  it("GalleryContent: 'Show more' present just under the row ceiling (1199 of 2000)", () => {
    const items = Array.from({ length: MAX_PUBLIC_ROWS - 1 }, (_, i) => speaker(i));
    const html = String(GalleryContent({ event: EVENT, speakers: items, total: 2000, page: 1, q: null }));
    expect(html).toContain("Show more");
  });

  it("GalleryContent: 'Show more' absent right at the row ceiling (1200 of 2000)", () => {
    const items = Array.from({ length: MAX_PUBLIC_ROWS }, (_, i) => speaker(i));
    const html = String(GalleryContent({ event: EVENT, speakers: items, total: 2000, page: 1, q: null }));
    expect(html).not.toContain("Show more");
  });
});
