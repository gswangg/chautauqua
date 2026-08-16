// DEC-919 (wave 47 amendment): ONE zero-state renderer for the PUBLIC
// (server-rendered) surfaces. SessionsContent/SpeakersContent/GalleryContent
// are exercised directly as pure render functions (mirrors
// test/public-sessions-anatomy.test.ts's convention), asserting the
// fresh/filtered split PublicEmptyState draws: fresh drops the filter bar
// and renders no escape link, filtered keeps the bar and links back to the
// surface's bare path, and neither case ever renders a <button>.

import { describe, expect, it } from "vitest";
import { SessionsContent } from "../src/routes/public/sessions";
import { SpeakersContent, GalleryContent } from "../src/routes/public/speakers";
import { PublicEmptyState } from "../src/routes/public/empty-state";
import type { PublicEvent, PublicSpeakerWithSessions } from "../src/server/repo/public";

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

const SPEAKER: PublicSpeakerWithSessions = {
  contactId: "c1",
  firstName: "Ada",
  lastName: "Lovelace",
  title: "Engineer",
  company: "Analytical Engines Inc",
  bio: null,
  headshotUrl: null,
  sessions: [],
};

describe("PublicEmptyState component", () => {
  it("'fresh' has no action prop by construction and never renders an escape or a button", () => {
    const html = String(PublicEmptyState({ variant: "fresh", what: "Nothing here yet.", reason: "Check back later." }));
    expect(html).toContain("Nothing here yet.");
    expect(html).toContain("Check back later.");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("<button");
  });

  it("'filtered' renders the escape as a plain <a href>, never a <button>", () => {
    const html = String(
      PublicEmptyState({
        variant: "filtered",
        what: "No matches.",
        escapeHref: "/e/devflow/sessions",
        escapeLabel: "Clear filters",
      }),
    );
    expect(html).toContain('href="/e/devflow/sessions"');
    expect(html).toContain("Clear filters");
    expect(html).not.toContain("<button");
  });

  it("throws if 'fresh' is given an escape", () => {
    expect(() => PublicEmptyState({ variant: "fresh", what: "x", escapeHref: "/y", escapeLabel: "Clear" })).toThrow();
  });

  it("throws if 'filtered' is missing its escape", () => {
    expect(() => PublicEmptyState({ variant: "filtered", what: "x" })).toThrow();
  });
});

describe("DEC-919 (wave 47): sessions surface fresh/filtered zero state", () => {
  it("fresh: no facet in flight and grandTotal 0 -- drops the filter row, no escape link, no button", () => {
    const html = String(
      SessionsContent({
        event: EVENT,
        tracks: [],
        activeTrackId: null,
        q: null,
        items: [],
        total: 0,
        grandTotal: 0,
        page: 1,
      }),
    );
    expect(html).toContain("The programme is not out yet");
    expect(html).toContain("Sessions appear here once the schedule is published.");
    expect(html).not.toContain("chq-pub-filter-row");
    expect(html).not.toContain("Clear filters");
    expect(html).not.toContain("<button");
  });

  it("filtered: q set, zero matches -- keeps the filter row, links back to the bare path, no button", () => {
    const html = String(
      SessionsContent({
        event: EVENT,
        tracks: [],
        activeTrackId: null,
        q: "zzz-no-match",
        items: [],
        total: 0,
        grandTotal: 5,
        page: 1,
      }),
    );
    expect(html).toContain("No sessions match your search.");
    expect(html).toContain("chq-pub-filter-row");
    expect(html).toContain('href="/e/devflow/sessions"');
    expect(html).toContain("Clear filters");
    // The filter row's own PublicSearchBox/PublicFilterSelectForm forms
    // (DEC-919 wave 40) legitimately keep a visually-hidden submit button --
    // the "no button" rule is about PublicEmptyState's own output, which the
    // component-level tests above cover directly. The empty-state escape
    // itself must still be a plain <a>, never a <button>.
    expect(html).toContain('class="chq-pub-accent-link chq-pub-empty-escape"');
  });
});

describe("DEC-919 (wave 47): speakers list surface fresh/filtered zero state", () => {
  it("fresh: no facet in flight and total 0 -- drops the search box, no escape link, no button", () => {
    const html = String(
      SpeakersContent({
        event: EVENT,
        speakers: [],
        total: 0,
        page: 1,
        q: null,
      }),
    );
    expect(html).toContain("No speakers listed yet.");
    expect(html).not.toContain("chq-pub-searchform");
    expect(html).not.toContain("Clear filters");
    expect(html).not.toContain("<button");
  });

  it("filtered: q excludes every row -- keeps the search box, links back to the bare path, no button", () => {
    const html = String(
      SpeakersContent({
        event: EVENT,
        speakers: [],
        total: 0,
        page: 1,
        q: "zzz-no-match",
      }),
    );
    expect(html).toContain("No speakers match your search.");
    expect(html).toContain("chq-pub-searchform");
    expect(html).toContain('href="/e/devflow/speakers"');
    expect(html).toContain("Clear filters");
    expect(html).toContain('class="chq-pub-accent-link chq-pub-empty-escape"');
  });

  it("non-empty results never render PublicEmptyState markup", () => {
    const html = String(
      SpeakersContent({
        event: EVENT,
        speakers: [SPEAKER],
        total: 1,
        page: 1,
        q: null,
      }),
    );
    expect(html).not.toContain("chq-pub-empty-block");
  });
});

describe("DEC-919 (wave 47): gallery surface (DEC-593 twin) fresh/filtered zero state", () => {
  it("fresh: drops the search box, no escape link, no button", () => {
    const html = String(
      GalleryContent({
        event: EVENT,
        speakers: [],
        total: 0,
        page: 1,
        q: null,
      }),
    );
    expect(html).toContain("No speakers listed yet.");
    expect(html).not.toContain("chq-pub-searchform");
    expect(html).not.toContain("Clear filters");
    expect(html).not.toContain("<button");
  });

  it("filtered: keeps the search box, links back to the bare gallery path, no button", () => {
    const html = String(
      GalleryContent({
        event: EVENT,
        speakers: [],
        total: 0,
        page: 1,
        q: "zzz-no-match",
      }),
    );
    expect(html).toContain("No speakers match your search.");
    expect(html).toContain("chq-pub-searchform");
    expect(html).toContain('href="/e/devflow/gallery"');
    expect(html).toContain("Clear filters");
    expect(html).toContain('class="chq-pub-accent-link chq-pub-empty-escape"');
  });
});
