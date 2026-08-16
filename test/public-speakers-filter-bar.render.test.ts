// w29-f (DEC-976 wave-29 amendment): closes the wave-28 gate's one surviving
// OPEN ITEM, which was mis-attributed. `docs/design/README.md:350` (heading
// at :343-345, "Public filter bar -- one idiom, four surfaces") names the
// PUBLIC Speakers surface's `[Search speakers…] [All tracks ▾] [List | Grid]`
// bar (the design doc's mock copy reads "Search speakers…"; the shipped
// PublicSearchBox's actual placeholder is the shorter "Search") -- not the admin onboarding-grid toolbar
// (app/src/pages/speakers/GridFilters.tsx) the wave-28 gate went and grepped
// instead. The controls already exist on the surface the heading names:
// SpeakerViewToggle (List/Grid, src/routes/public/speakers.tsx) and
// TrackFacetSelect (All tracks select, same file), both mounted on
// SpeakersContent and its gallery twin GalleryContent. Per DEC-976's
// amendment, a note alone is not a closure -- this test renders both
// surfaces directly (mirrors test/public-empty-state.render.test.ts's
// convention of exercising SpeakersContent/GalleryContent as pure render
// functions) and asserts the three controls are present, that the active
// half carries aria-current="page", and that switching halves preserves an
// active q/trackId.
//
// Filed as .test.ts (not .test.tsx) because vitest.config.ts's `include`
// only globs `test/**/*.test.ts` -- `test/**/*.render.test.tsx` is not
// listed there (that pattern is reserved for app/src's jsdom component
// tests). A `.tsx` file here would silently never run. No JSX literal
// syntax is used below (only function calls), so `.ts` is sufficient.

import { describe, expect, it } from "vitest";
import { SpeakersContent, GalleryContent } from "../src/routes/public/speakers";
import type { PublicEvent, PublicSpeakerWithSessions, PublicTrack } from "../src/server/repo/public";

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

const TRACKS: PublicTrack[] = [{ id: "t1", name: "Backend", color: null }];

describe("DEC-976 (wave 29): public Speakers filter bar -- List surface (SpeakersContent)", () => {
  it("renders the search box, the All tracks select and the List/Grid toggle, with List active", () => {
    const html = String(
      SpeakersContent({ event: EVENT, speakers: [SPEAKER], total: 1, page: 1, q: null, tracks: TRACKS, activeTrackId: null }),
    );
    expect(html).toContain("chq-pub-searchform");
    expect(html).toContain('placeholder="Search sessions or speakers…"'); // G13 (frame 10--00): frame's fuller placeholder
    expect(html).toContain("All tracks");
    expect(html).toContain("chq-pub-view-toggle");
    expect(html).toContain(">List<");
    expect(html).toContain(">Grid<");
    // List is active on this surface: its anchor carries aria-current="page".
    const listMatch = html.match(/<a[^>]*>List<\/a>/);
    expect(listMatch).toBeTruthy();
    expect(listMatch![0]).toContain('aria-current="page"');
    const gridMatch = html.match(/<a[^>]*>Grid<\/a>/);
    expect(gridMatch).toBeTruthy();
    expect(gridMatch![0]).not.toContain("aria-current");
  });

  it("switching to Grid preserves the active q and trackId in the toggle's href", () => {
    const html = String(
      SpeakersContent({
        event: EVENT,
        speakers: [SPEAKER],
        total: 1,
        page: 1,
        q: "ada",
        tracks: TRACKS,
        activeTrackId: "t1",
      }),
    );
    const gridMatch = html.match(/<a[^>]*>Grid<\/a>/);
    expect(gridMatch).toBeTruthy();
    expect(gridMatch![0]).toContain("href=\"/e/devflow/gallery?q=ada&amp;trackId=t1\"");
  });
});

describe("DEC-976 (wave 29): public Speakers filter bar -- Grid surface (GalleryContent, DEC-593 twin)", () => {
  it("renders the search box, the All tracks select and the List/Grid toggle, with Grid active", () => {
    const html = String(
      GalleryContent({ event: EVENT, speakers: [SPEAKER], total: 1, page: 1, q: null, tracks: TRACKS, activeTrackId: null }),
    );
    expect(html).toContain("chq-pub-searchform");
    expect(html).toContain('placeholder="Search sessions or speakers…"'); // G13 (frame 10--00): frame's fuller placeholder
    expect(html).toContain("All tracks");
    expect(html).toContain("chq-pub-view-toggle");
    const gridMatch = html.match(/<a[^>]*>Grid<\/a>/);
    expect(gridMatch).toBeTruthy();
    expect(gridMatch![0]).toContain('aria-current="page"');
    const listMatch = html.match(/<a[^>]*>List<\/a>/);
    expect(listMatch).toBeTruthy();
    expect(listMatch![0]).not.toContain("aria-current");
  });

  it("switching to List preserves the active q and trackId in the toggle's href", () => {
    const html = String(
      GalleryContent({
        event: EVENT,
        speakers: [SPEAKER],
        total: 1,
        page: 1,
        q: "ada",
        tracks: TRACKS,
        activeTrackId: "t1",
      }),
    );
    const listMatch = html.match(/<a[^>]*>List<\/a>/);
    expect(listMatch).toBeTruthy();
    expect(listMatch![0]).toContain("href=\"/e/devflow/speakers?q=ada&amp;trackId=t1\"");
  });
});
