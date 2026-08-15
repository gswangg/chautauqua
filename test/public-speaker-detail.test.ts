// w9-b (DEC-885): the public speaker-detail page's headshot-less fallback
// must draw the SAME hatch+initials placeholder the speakers list/grid use
// -- never an empty sunk box -- and the affiliation paragraph must not
// print when the speaker has neither a title nor a company.
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const EVENT: import("../src/server/repo/public").PublicEvent = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2027-05-10",
  endDate: "2027-05-14",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

function speaker(
  opts: Partial<import("../src/server/repo/public").PublicSpeakerDetail> = {},
): import("../src/server/repo/public").PublicSpeakerDetail {
  return {
    // publicCacheMiddleware keys the response cache by request URL, and all
    // these tests hit the same event/route -- give each test's speaker a
    // distinct contactId so they don't collide on a shared cache entry.
    contactId: opts.contactId ?? "c1",
    firstName: "Ada",
    lastName: "Lovelace",
    title: null,
    company: null,
    bio: null,
    headshotUrl: null,
    socialLinks: [],
    sessions: [],
    ...opts,
  };
}

let SPEAKER = speaker();

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>(
    "../src/server/repo/public",
  );
  return {
    ...actual,
    getPublicEventBySlug: vi.fn(async (_db: unknown, slug: string) => (slug === EVENT.slug ? EVENT : null)),
    getPublicSpeakerDetail: vi.fn(async (_db: unknown, _event: unknown, contactId: string) =>
      contactId === SPEAKER.contactId ? SPEAKER : null,
    ),
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

class InMemoryCache {
  private store = new Map<string, Response>();
  async match(request: Request) {
    return this.store.get(request.url);
  }
  async put(request: Request, response: Response) {
    this.store.set(request.url, response);
  }
}

(globalThis as unknown as { caches: { default: InMemoryCache } }).caches = { default: new InMemoryCache() };

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

describe("w9-b: public speaker-detail headshot fallback + affiliation line", () => {
  it("draws the DEC-885 initials placeholder (not an empty div) when there's no headshot", async () => {
    SPEAKER = speaker({ contactId: "c-no-headshot" });
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/speakers/${SPEAKER.contactId}`);
    const body = await res.text();

    expect(body).toContain('class="chq-pub-headshot-fallback chq-pub-detail-headshot"');
    expect(body).toContain("AL"); // speakerInitials("Ada", "Lovelace")
    // Not the old empty-box shape: no inline width style on the fallback div.
    expect(body).not.toContain('<div class="chq-pub-headshot-fallback" style="width:160px" />');
    expect(body).not.toMatch(/<div class="chq-pub-headshot-fallback[^>]*style=/);
  });

  it("renders the headshot <img> with the shared sizing class when a headshotUrl is present", async () => {
    SPEAKER = speaker({ contactId: "c-headshot", headshotUrl: "https://example.com/ada.jpg" });
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/speakers/${SPEAKER.contactId}`);
    const body = await res.text();

    expect(body).toContain('src="https://example.com/ada.jpg"');
    expect(body).toContain('class="chq-pub-detail-headshot"');
  });

  it("prints no affiliation paragraph when the speaker has neither title nor company", async () => {
    SPEAKER = speaker({ contactId: "c-no-affiliation", title: null, company: null });
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/speakers/${SPEAKER.contactId}`);
    const body = await res.text();

    expect(body).not.toContain("<p></p>");
  });

  it("renders 'Title, Company' when both are present", async () => {
    SPEAKER = speaker({ contactId: "c-title-company", title: "Engineer", company: "Analytical Engines Inc" });
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/speakers/${SPEAKER.contactId}`);
    const body = await res.text();

    expect(body).toContain("<p>Engineer, Analytical Engines Inc</p>");
  });

  it("renders title-only affiliation with no dangling comma", async () => {
    SPEAKER = speaker({ contactId: "c-title-only", title: "Engineer", company: null });
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/speakers/${SPEAKER.contactId}`);
    const body = await res.text();

    expect(body).toContain("<p>Engineer</p>");
  });

  it("renders company-only affiliation with no dangling comma", async () => {
    SPEAKER = speaker({ contactId: "c-company-only", title: null, company: "Analytical Engines Inc" });
    const app = buildApp();
    const res = await app.request(`/e/${EVENT.slug}/speakers/${SPEAKER.contactId}`);
    const body = await res.text();

    expect(body).toContain("<p>Analytical Engines Inc</p>");
  });
});
