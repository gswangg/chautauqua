// DEC-371 amendment (wave 43): ONE hex-colour grammar. Before this task, six
// regex copies disagreed (validators.ts accepted '#abc'/'#aabbcc';
// shell.tsx/portal/shared.tsx accepted only 6-digit; query.ts's HEX3_OR_6_RE
// accepted either with or without '#'; cards.tsx and app's formState.ts
// carried further copies) — an accent saved as '#abc' passed the API and
// was then silently discarded by every reader, repainting the default
// olive. src/domain/color.ts is now the ONE definition site.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { normalizeHexColor, isValidHexColor } from "../src/domain/color";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

describe("normalizeHexColor", () => {
  const cases: Array<[string | null | undefined, string | null]> = [
    ["#abc", "#aabbcc"],
    ["abc", "#aabbcc"],
    ["#AABBCC", "#aabbcc"],
    ["nope", null],
    ["", null],
    ["#12345", null],
    [null, null],
    [undefined, null],
    ["#336699", "#336699"],
  ];

  it.each(cases)("normalizeHexColor(%j) -> %j", (input, expected) => {
    expect(normalizeHexColor(input)).toBe(expected);
  });
});

describe("isValidHexColor", () => {
  it("agrees with normalizeHexColor !== null", () => {
    for (const raw of ["#abc", "abc", "#AABBCC", "nope", "", "#12345", "#336699"]) {
      expect(isValidHexColor(raw)).toBe(normalizeHexColor(raw) !== null);
    }
  });
});

// ---------------------------------------------------------------------------
// A '#abc' accent round-trips through PATCH /api/v1/events and comes back
// six-digit — the write normalizes, so no reader can disagree with what the
// writer accepted.
// ---------------------------------------------------------------------------

const ORG_A = "org-hex";
const EVENT_ID = "event-hex";

const existingEvent = {
  id: EVENT_ID,
  orgId: ORG_A,
  name: "Hex Event",
  slug: "hex-event",
  startDate: "2026-06-01",
  endDate: "2026-06-10",
  location: null,
  timezone: "UTC",
  recordPrefix: "EV",
  branding: null,
  createdAt: 0,
  updatedAt: 0,
};

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>(
    "../src/server/repo/events",
  );
  return {
    ...actual,
    isSlugTaken: vi.fn(async () => false),
    getEventForOrg: vi.fn(async () => existingEvent),
    updateEvent: vi.fn(async (_db: unknown, _eventId: string, _orgId: string, patch: Record<string, unknown>) => {
      const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      return { ...existingEvent, ...defined };
    }),
  };
});

vi.mock("../src/server/repo/agenda", () => ({
  listSlotsOutsideWindow: vi.fn(async () => ({ count: 0, sessions: [] })),
}));

// DEC-844 amendment (wave 68): PATCH /api/v1/events also names the breaks a
// narrowed window orphans; this suite's db mock has no select(), so stub the
// breaks read the same way listSlotsOutsideWindow is stubbed above.
vi.mock("../src/server/repo/breaks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/breaks")>(
    "../src/server/repo/breaks",
  );
  return {
    ...actual,
    listBreaksOutsideWindow: vi.fn(async () => ({ count: 0, breaks: [] })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

async function buildApp(db: unknown, auth: AuthInfo | undefined) {
  const { eventsRoutes } = await import("../src/routes/api/events");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    c.set("db", db as never);
    await next();
  });
  app.route("/api/v1", eventsRoutes);
  return app;
}

describe("PATCH /api/v1/events branding.accentColor normalizes on write", () => {
  it("stores '#abc' as the six-digit '#aabbcc' in the response", async () => {
    const app = await buildApp({} as unknown, { userId: "u1", role: "organizer", orgId: ORG_A });

    const res = await app.request(`/api/v1/events/${EVENT_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ branding: { accentColor: "#abc" } }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { branding: { accentColor: string } };
    expect(body.branding.accentColor).toBe("#aabbcc");
  });
});

// ---------------------------------------------------------------------------
// ENUMERATE rather than hand-list: scan src/**/*.ts(x) for hex-colour regex
// literals and assert src/domain/color.ts is the only definition site.
// ---------------------------------------------------------------------------

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// A hex-colour-shaped character class: something that looks like
// [0-9a-fA-F] (any bracket ordering/case) repeated for 3 or 6 digits, OR a
// literal hex-digit alternation used to build one. Deliberately loose: the
// point is to catch "another regex that matches hex colours", not to
// require an exact byte match with the deleted ones.
const HEX_CLASS_RE = /0-9a-fA-F/;

describe("src/domain/color.ts is the only hex-colour-grammar definition site", () => {
  it("no other src/**/*.ts(x) file contains a hex-digit character class", () => {
    const root = join(__dirname, "..", "src");
    const offenders = walk(root)
      .filter((f) => f !== join(root, "domain", "color.ts"))
      .filter((f) => HEX_CLASS_RE.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
