// DEC-838: the per-event accent must be visible on every public/embed
// surface without moving a default pixel. This enumerates SURFACES/
// isSurface (shell.tsx) and, for each, renders through the /embed path
// (EmbedShell + the surface's own Content component) with a non-default
// accent, asserting (i) <body>'s style carries the normalized accent and
// (ii) the emitted HTML carries at least one element whose class is in
// ACCENT_BOUND_CLASSES (public.css.ts) -- the ONE exported source both the
// CSS text and this test read, never hand-listed twice.

import { describe, expect, it } from "vitest";
import { SURFACES, EmbedShell, type Surface } from "../src/routes/public/shell";
import { ACCENT_BOUND_CLASSES } from "../src/routes/public/public.css";
import { SessionsContent } from "../src/routes/public/sessions";
import { SpeakersContent, GalleryContent } from "../src/routes/public/speakers";
import { AgendaContent, ScheduleContent } from "../src/routes/public/agenda";
import { SessionDetailContent, BackLink } from "../src/routes/public/detail";
import type { PublicEvent, PublicSession, PublicAgendaItem, PublicSessionDetail } from "../src/server/repo/public";
import type { PublicSpeakerWithSessions } from "../src/server/repo/public/speakers";

const EVENT: PublicEvent = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: "Moscone West",
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

const NON_DEFAULT_ACCENT = "#123ABC";

function session(overrides: Partial<PublicSession>): PublicSession {
  return {
    id: "s1",
    ref: "SES-1",
    title: "Opening Talk",
    description: null,
    icsSequence: 0,
    tracks: [],
    speakers: [],
    day: null,
    startMin: null,
    endMin: null,
    roomName: null,
    format: null,
    ...overrides,
  };
}

function speaker(overrides: Partial<PublicSpeakerWithSessions>): PublicSpeakerWithSessions {
  return {
    contactId: "sp1",
    firstName: "Ada",
    lastName: "Lovelace",
    title: "Engineer",
    company: "Acme",
    headshotUrl: null,
    bio: null,
    sessions: [],
    ...overrides,
  };
}

function agendaItem(overrides: Partial<PublicAgendaItem>): PublicAgendaItem {
  return {
    submissionId: "sub1",
    ref: "SES-1",
    title: "Talk",
    description: null,
    day: "2026-08-10",
    startMin: 540,
    endMin: 600,
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

// Two distinct days so DaySwitcher (shared by agenda + schedule) renders
// more than one .chq-pub-day-pill -- days.length <= 1 short-circuits it.
const TWO_DAY_ITEMS: PublicAgendaItem[] = [
  agendaItem({ submissionId: "sub1", day: "2026-08-10" }),
  agendaItem({ submissionId: "sub2", day: "2026-08-11" }),
];

const SESSION_DETAIL: PublicSessionDetail = {
  id: "s1",
  ref: "SES-1",
  title: "Opening Talk",
  description: null,
  tracks: [],
  day: null,
  startMin: null,
  endMin: null,
  roomId: null,
  roomName: null,
  speakers: [],
  format: null,
};

function contentFor(surface: Surface): unknown {
  switch (surface) {
    case "sessions":
      // total > items.length so 'Show more' (.chq-pub-accent-link) renders.
      return SessionsContent({
        event: EVENT,
        tracks: [],
        activeTrackId: null,
        q: null,
        items: [session({})],
        total: 2,
        page: 1,
        embed: true,
      });
    case "speakers":
      return SpeakersContent({ event: EVENT, speakers: [speaker({})], total: 2, page: 1, q: null, embed: true });
    case "gallery":
      return GalleryContent({ event: EVENT, speakers: [speaker({})], total: 2, page: 1, q: null, embed: true });
    case "agenda":
      return AgendaContent({ event: EVENT, items: TWO_DAY_ITEMS, total: 2, embed: true });
    case "schedule":
      return ScheduleContent({ event: EVENT, items: TWO_DAY_ITEMS, total: 2, embed: true });
    default: {
      const exhaustive: never = surface;
      throw new Error(`Unknown public surface '${exhaustive}'`);
    }
  }
}

describe("DEC-838: every isSurface value carries an accent-bound element on the embed path", () => {
  for (const surface of SURFACES) {
    it(`${surface}: body style carries the custom accent and the HTML carries an accent-bound class`, () => {
      const html = String(
        EmbedShell({
          event: EVENT,
          title: `${surface} - ${EVENT.name}`,
          accentOverride: NON_DEFAULT_ACCENT,
          children: contentFor(surface) as any,
        }),
      );
      expect(html).toContain(`--chq-brandable-accent: ${NON_DEFAULT_ACCENT};`);
      const carriesAccentClass = ACCENT_BOUND_CLASSES.some((cls) => {
        const re = new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"`);
        return re.test(html);
      });
      expect(carriesAccentClass).toBe(true);
    });
  }

  it("every ACCENT_BOUND_CLASSES entry is actually declared in PUBLIC_CSS bound to --chq-brandable-accent", async () => {
    const { PUBLIC_CSS } = await import("../src/routes/public/public.css");
    for (const cls of ACCENT_BOUND_CLASSES) {
      const re = new RegExp(`\\.${cls}\\s*\\{[^}]*var\\(--chq-brandable-accent\\)`);
      expect(PUBLIC_CSS).toMatch(re);
    }
  });

  it("the session-detail drill-in (outside isSurface, still an accent-bound surface per DEC-838) carries an accent-bound class", () => {
    const html = String(
      EmbedShell({
        event: EVENT,
        title: `${SESSION_DETAIL.title} - ${EVENT.name}`,
        accentOverride: NON_DEFAULT_ACCENT,
        children: SessionDetailContent({ event: EVENT, session: SESSION_DETAIL, from: "sessions", base: "/embed" }) as any,
      }),
    );
    expect(html).toContain(`--chq-brandable-accent: ${NON_DEFAULT_ACCENT};`);
    expect(html).toContain(`class="${ACCENT_BOUND_CLASSES[2]}"`);
  });

  it("BackLink (session/speaker detail 'Back to <surface>') renders the shared accent-link class", () => {
    const html = String(BackLink({ event: EVENT, from: "sessions", base: "/embed" }));
    expect(html).toContain(`class="${ACCENT_BOUND_CLASSES[2]}"`);
  });
});
