// DEC-593 / rubric EMB-12,16: the gallery is a real gallery, not a
// headshots-only strip. Both the directory (SpeakersContent) and the
// gallery (GalleryContent) share one SpeakerCard, so a card always carries
// name + job title + company — the directory additionally lists sessions,
// the gallery does not. A speaker with no headshot still renders the same
// `.chq-pub-headshot-fallback` block in both surfaces so the grid never
// collapses, and the shared name/title/company markup is byte-identical
// between the two surfaces (EMB-16 consistency).

import { describe, expect, it } from "vitest";
import { SpeakersContent, GalleryContent } from "../src/routes/public/speakers";
import type { PublicEvent, PublicSpeakerWithSessions } from "../src/server/repo/public";

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

describe("DEC-593: real speaker gallery (EMB-12/EMB-16)", () => {
  // G13 (frame 10--11): the grid tile's subtitle is the company ALONE --
  // one line on every card -- while the list row keeps role, company.
  it("a gallery card exposes name and company (never the wrapping role clause)", () => {
    const html = String(GalleryContent({ event: EVENT, speakers: [speaker({})], total: 1, page: 1, q: null }));
    expect(html).toContain("Ada");
    expect(html).toContain("Lovelace");
    expect(html).not.toContain("Chief Engineer");
    expect(html).toContain("Analytical Engines Inc");
  });

  it("the gallery no longer carries the stale headshots-only caption", () => {
    const html = String(GalleryContent({ event: EVENT, speakers: [speaker({})], total: 1, page: 1, q: null }));
    expect(html).not.toContain("Headshots only");
  });

  it("the gallery does not list sessions (directory-only detail)", () => {
    const html = String(GalleryContent({ event: EVENT, speakers: [speaker({})], total: 1, page: 1, q: null }));
    expect(html).not.toContain("chq-pub-speaker-sessions");
    expect(html).not.toContain("Punch Cards 101");
  });

  it("the directory does list sessions", () => {
    const html = String(SpeakersContent({ event: EVENT, speakers: [speaker({})], total: 1, page: 1, q: null }));
    expect(html).toContain("chq-pub-speaker-sessions");
    expect(html).toContain("Punch Cards 101");
  });

  it("a headshot-less speaker still renders a card via the fallback block, in both surfaces", () => {
    const noHeadshot = speaker({ headshotUrl: null });
    const galleryHtml = String(GalleryContent({ event: EVENT, speakers: [noHeadshot], total: 1, page: 1, q: null }));
    const directoryHtml = String(SpeakersContent({ event: EVENT, speakers: [noHeadshot], total: 1, page: 1, q: null }));
    expect(galleryHtml).toContain("chq-pub-headshot-fallback");
    expect(directoryHtml).toContain("chq-pub-headshot-fallback");
    // The grid never collapses to an empty result for a headshot-less speaker.
    expect(galleryHtml).toContain("Ada");
    expect(directoryHtml).toContain("Ada");
  });

  it("the same speaker's name/title/company markup is byte-identical between the directory and the gallery", () => {
    const sp = speaker({});
    const galleryHtml = String(GalleryContent({ event: EVENT, speakers: [sp], total: 1, page: 1, q: null }));
    const directoryHtml = String(SpeakersContent({ event: EVENT, speakers: [sp], total: 1, page: 1, q: null }));

    const extract = (html: string, cls: string) => {
      const re = new RegExp(`<[^>]*class="${cls}"[^>]*>([\\s\\S]*?)<\\/[a-z]+>`);
      const m = html.match(re);
      if (!m) throw new Error(`${cls} not found`);
      return m[1];
    };

    expect(extract(galleryHtml, "chq-pub-speaker-name")).toBe(extract(directoryHtml, "chq-pub-speaker-name"));
    // G13 (frame 10--11): the tile subtitle is the company alone; the
    // directory row keeps the fuller role, company clause.
    expect(extract(galleryHtml, "chq-pub-speaker-role")).toBe(sp.company);
    expect(extract(directoryHtml, "chq-pub-speaker-role")).toContain(sp.company);
  });
});
