// w1-i (EMB missing-capability shortlist): itinerary parity + honest dates
// on the public session/schedule surfaces.
//  1. the session detail page now renders the SAME .chq-itinerary-toggle
//     control the list card has (SessionDetailContent, detail.tsx).
//  2. the schedule/agenda list row's itinerary control flips its label the
//     SAME way the sessions list's Save/Saved pill does (ONE shared label
//     helper, cards.tsx's ItineraryToggle).
//  3. /schedule now honors ?trackId= exactly like /sessions instead of
//     silently ignoring it.
//  4. detail-page and day-heading dates route through the shared formatDay
//     helper (src/lib/event-time.ts) instead of a raw ISO 'YYYY-MM-DD'.
//  5. a photo-less speaker card's link has an accessible name.
//
// Mirrors the vi.mock(../src/server/repo/public) pattern established in
// test/public-embed-detail.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const EVENT: import("../src/server/repo/public").PublicEvent = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

const SESSION: import("../src/server/repo/public").PublicSessionDetail = {
  id: "sess1",
  ref: "SES-1",
  title: "Building Itineraries",
  description: "A talk about itineraries.",
  tracks: [],
  day: "2026-08-10",
  startMin: 540,
  endMin: 600,
  roomId: "room1",
  roomName: "Room A",
  speakers: [
    {
      contactId: "spk1",
      firstName: "Ada",
      lastName: "Lovelace",
      title: "Engineer",
      company: "Acme",
      headshotUrl: null,
      bio: null,
    },
  ],
  format: "talk",
};

const LONG_DESCRIPTION =
  "This session covers a comprehensive tour of itinerary building tools, from " +
  "the earliest calculating engines to modern conference scheduling software, " +
  "with plenty of worked examples along the way for attendees to follow.";

const TRACK_A = { id: "trackA", name: "Track A", color: null };
const TRACK_B = { id: "trackB", name: "Track B", color: null };

const AGENDA_ITEM_A: import("../src/server/repo/public").PublicAgendaItem = {
  submissionId: "agenda-a",
  ref: "SES-A",
  title: "Session in Track A",
  description: null,
  day: "2026-08-10",
  startMin: 540,
  endMin: 600,
  roomId: "room1",
  roomName: "Room A",
  roomPosition: 1,
  icsSequence: 0,
  tracks: [TRACK_A],
  speakers: [{ contactId: "spk1", firstName: "Ada", lastName: "Lovelace", title: null, company: null, headshotUrl: null, bio: null }],
  format: null,
};

const AGENDA_ITEM_B: import("../src/server/repo/public").PublicAgendaItem = {
  submissionId: "agenda-b",
  ref: "SES-B",
  title: "Session in Track B",
  description: null,
  day: "2026-08-10",
  startMin: 660,
  endMin: 720,
  roomId: "room1",
  roomName: "Room A",
  roomPosition: 1,
  icsSequence: 0,
  tracks: [TRACK_B],
  speakers: [{ contactId: "spk2", firstName: "Grace", lastName: "Hopper", title: null, company: null, headshotUrl: null, bio: null }],
  format: null,
};

const SPEAKER_NO_PHOTO: import("../src/server/repo/public").PublicSpeakerWithSessions = {
  contactId: "spk-nophoto",
  firstName: "Grace",
  lastName: "Hopper",
  title: "Admiral",
  company: null,
  headshotUrl: null,
  bio: null,
  sessions: [],
};

const SPEAKER_LONG_BIO: import("../src/server/repo/public").PublicSpeakerDetail = {
  contactId: "spk-longbio",
  firstName: "Ada",
  lastName: "Lovelace",
  title: "Engineer",
  company: "Acme",
  headshotUrl: null,
  bio: LONG_DESCRIPTION,
  socialLinks: [],
  sessions: [],
};

const SPEAKER_SHORT_BIO: import("../src/server/repo/public").PublicSpeakerDetail = {
  contactId: "spk-shortbio",
  firstName: "Grace",
  lastName: "Hopper",
  title: "Admiral",
  company: null,
  headshotUrl: null,
  bio: "A short bio.",
  socialLinks: [],
  sessions: [],
};

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>("../src/server/repo/public");
  return {
    ...actual,
    getPublicEventBySlug: vi.fn(async (_db: unknown, slug: string) => (slug === EVENT.slug ? EVENT : null)),
    getPublicSessionDetail: vi.fn(async (_db: unknown, _event: unknown, sessionId: string) =>
      sessionId === SESSION.id ? SESSION : null,
    ),
    // DEC-783: ?trackId=/?q= became SQL-level predicates INSIDE
    // getPublicAgenda (dispatch.tsx no longer post-filters the rows it got
    // back), so this stub has to honour the params it is handed — exactly
    // like the real repo — for the /schedule?trackId= assertion below to
    // mean "the route threaded the filter through".
    getPublicAgenda: vi.fn(async (_db: unknown, _event: unknown, params?: { trackId?: string | null; q?: string | null }) => {
      const trackId = params?.trackId ?? null;
      const q = params?.q ?? null;
      const items = [AGENDA_ITEM_A, AGENDA_ITEM_B].filter((item) => {
        if (trackId !== null && !item.tracks.some((t) => t.id === trackId)) return false;
        if (q !== null && !item.title.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      });
      return { items, total: items.length };
    }),
    // DEC-804: the agenda/schedule dispatch now also loads getPublicTracks
    // to feed the search form's track <select> — stub it so this test's
    // synthetic `db` ({}) is never touched by the real repo call.
    getPublicTracks: vi.fn(async () => [TRACK_A, TRACK_B]),
    getPublicSpeakers: vi.fn(async () => ({ items: [SPEAKER_NO_PHOTO], total: 1 })),
    getPublicSpeakerDetail: vi.fn(async (_db: unknown, _event: unknown, contactId: string) => {
      if (contactId === SPEAKER_LONG_BIO.contactId) return SPEAKER_LONG_BIO;
      if (contactId === SPEAKER_SHORT_BIO.contactId) return SPEAKER_SHORT_BIO;
      return null;
    }),
  };
});

import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import type { KVStore } from "../src/lib/draft";

class InMemoryKV implements KVStore {
  private store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.store.set(key, value);
  }
  async delete(key: string) {
    this.store.delete(key);
  }
}

// Mirrors public.test.ts's installFakeCaches: a genuine no-op (never
// serves a stale cached body across the many distinct requests these tests
// make against the SAME url path with different query strings) rather than
// public-embed-detail.test.ts's stateful InMemoryCache, which isn't needed
// here and re-served a locked Response body across tests that hit the same
// path twice.
(globalThis as unknown as { caches: { default: { match: () => Promise<undefined>; put: () => Promise<void> } } }).caches = {
  default: {
    async match() {
      return undefined;
    },
    async put() {
      /* no-op */
    },
  },
};

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };
  return {
    request: (path: string, init?: RequestInit) => app.request(path, init, env),
  };
}

describe("w1-i: session detail page itinerary control", () => {
  it("renders the SAME .chq-itinerary-toggle control the list card has", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/sessions/${SESSION.id}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('class="chq-itinerary-toggle"');
    expect(html).toContain(`value="${SESSION.id}"`);
    // The inline itinerary script (agenda.tsx's ItineraryScript) must ship
    // on this page too, or the checkbox is inert.
    expect(html).toContain("chq_itinerary_conf");
  });

  it("does not render the itinerary control on the /embed twin (DEC-672/683 chromeless)", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/${EVENT.slug}/sessions/${SESSION.id}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('class="chq-itinerary-toggle"');
  });
});

describe("w1-i: ONE shared itinerary label helper flips everywhere", () => {
  it("the schedule list row's toggle uses the SAME off/on span pair as the sessions list's Save/Saved pill", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/schedule`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('class="chq-pub-save-off">Save</span>');
    expect(html).toContain('class="chq-pub-save-on">Saved</span>');
    // The row's toggle control itself never renders the old static string
    // as its label any more (the phrase is still legitimately present in
    // the unrelated "Show only my picks" empty-state prose below it).
    expect(html).not.toMatch(/<label class="chq-pub-itinerary-row">[\s\S]*?Add to itinerary/);
  });

  it("the detail page's toggle uses the same off/on span pair too", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/sessions/${SESSION.id}`);
    const html = await res.text();
    expect(html).toContain('class="chq-pub-save-off"');
    expect(html).toContain('class="chq-pub-save-on"');
  });
});

describe("w1-i: /schedule honors ?trackId= like /sessions does", () => {
  it("returns only the items in the requested track", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/schedule?trackId=${TRACK_A.id}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(AGENDA_ITEM_A.title);
    expect(html).not.toContain(AGENDA_ITEM_B.title);
  });

  it("with no ?trackId= both items still render (unfiltered)", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/schedule`);
    const html = await res.text();
    expect(html).toContain(AGENDA_ITEM_A.title);
    expect(html).toContain(AGENDA_ITEM_B.title);
  });
});

describe("w1-i: honest dates via the shared formatDay helper", () => {
  it("the session detail page's schedule line is not a raw ISO date", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/sessions/${SESSION.id}`);
    const html = await res.text();
    expect(html).not.toContain(SESSION.day as string);
    // "Mon, Aug 10" style label from formatEventDay.
    expect(html).toMatch(/Aug 10/);
  });

  it("the schedule surface's day heading is not a raw ISO date", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/schedule`);
    const html = await res.text();
    expect(html).not.toContain("<h3>2026-08-10</h3>");
    expect(html).toMatch(/<h3>[^<]*Aug 10[^<]*<\/h3>/);
  });
});

describe("w1-i: photo-less speaker cards get an accessible name", () => {
  it("the fallback headshot link carries an aria-label naming the speaker", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/speakers`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(`aria-label="${SPEAKER_NO_PHOTO.firstName} ${SPEAKER_NO_PHOTO.lastName}"`);
  });

  it("the visible name link also names the speaker (non-empty accessible name via link text)", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/speakers`);
    const html = await res.text();
    expect(html).toMatch(
      new RegExp(`<a class="chq-pub-speaker-name"[^>]*>\\s*${SPEAKER_NO_PHOTO.firstName} ${SPEAKER_NO_PHOTO.lastName}\\s*</a>`),
    );
  });
});

// w4-k: a long description's disclosure replaces its preview -- the reader
// sees the snippet (inside <summary>) OR the full text (once <details> is
// opened), never both, and never the snippet doubled into the disclosed
// content.
describe("w4-k: description disclosure replaces its preview", () => {
  it("the snippet lives in <summary> and the full description appears exactly once, outside it", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/speakers/${SPEAKER_LONG_BIO.contactId}`);
    expect(res.status).toBe(200);
    const html = await res.text();

    // The full description string appears exactly once in the whole page.
    const occurrences = html.split(LONG_DESCRIPTION).length - 1;
    expect(occurrences).toBe(1);

    // The <summary> carries the snippet (truncated prefix + ellipsis) and
    // the "Show more" affordance, not the full text.
    const summaryMatch = html.match(/<summary>([\s\S]*?)<\/summary>/);
    expect(summaryMatch).not.toBeNull();
    const summaryHtml = summaryMatch![1];
    expect(summaryHtml).toContain(LONG_DESCRIPTION.slice(0, 160));
    expect(summaryHtml).toContain("Show more");
    expect(summaryHtml).not.toContain(LONG_DESCRIPTION);

    // The full description sits in the <details> body, after </summary>.
    const detailsMatch = html.match(/<details[^>]*>([\s\S]*?)<\/details>/);
    expect(detailsMatch).not.toBeNull();
    expect(detailsMatch![1]).toContain(LONG_DESCRIPTION);

    // The CSS rule that hides the snippet once expanded ships with the page.
    expect(html).toContain("chq-pub-desc-snippet");
  });

  it("a short bio still renders as a bare <p>, no <details> disclosure", async () => {
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/speakers/${SPEAKER_SHORT_BIO.contactId}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(`<p>${SPEAKER_SHORT_BIO.bio}</p>`);
    expect(html).not.toContain("<details");
  });
});
