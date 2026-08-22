// DEC-393 wave-35 amendment / DEC-996 wave-35 amendment (task w35-b): the
// three UNGROUNDED public-site inline-prose links named in
// docs/design/audit/public-390-interactive-offenders-v12.md ("New speaker?
// Create an account" and "Already have an account? Sign in to the speaker
// portal" on /submit/:slug, and the docs `/login` reference on /docs/api)
// each now carry their own `chq-` class token (DEC-996: a classless anchor
// is unreachable by the roster classifier) and are recorded in
// DEVIATIONS.md §9 as rung-3 outcomes -- neither frame draws a standalone
// control or a same-surface floored twin for any of the three.
//
// Real `app.request()` dispatches through the actual route modules --
// never a source scan -- mirroring the fakeDb/fakeKv harness
// test/submit-track-legend.test.ts already established for
// publicSubmitRoutes, and the plain buildApp() harness test/docs-page.test.ts
// already established for docsRoutes (DEC-613: never a sixth reimplementation
// of the same mock stack).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { docsRoutes } from "../src/routes/docs";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import { DEC_393, DEC_996 } from "../src/decisions";

void DEC_393;
void DEC_996;

const EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "Test Conf",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
};

const FORM_ROW = {
  id: "form-1",
  eventId: "event-1",
  title: "Speak at Test Conf",
  description: null,
  isDefault: true,
  openDate: null,
  closeDate: null,
  tracksJson: null,
};

const TRACK_ROWS = [{ id: "track-1", name: "Main Track" }];

const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
];

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

function fakeKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function submitApp() {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, TRACK_ROWS]));
    await next();
  });
  app.route("/", publicSubmitRoutes);
  return app;
}

function docsApp() {
  const app = new Hono<AppEnv>();
  app.route("/", docsRoutes);
  return app;
}

describe("GET /submit/:eventSlug -- the two inline-prose links carry their own class token", () => {
  it("'Create an account' carries .chq-cfp-intro-cta-link", async () => {
    const res = await submitApp().request("/submit/test-conf", { headers: {} }, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<a class="chq-cfp-intro-cta-link" href="#chq-cfp-submit-form">Create an account</a>');
  });

  it("'Sign in to the speaker portal' carries .chq-cfp-identity-note-link", async () => {
    const res = await submitApp().request("/submit/test-conf", { headers: {} }, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);
    const body = await res.text();
    expect(body).toContain('<a class="chq-cfp-identity-note-link" href="/login">Sign in to the speaker portal</a>');
  });
});

describe("GET /docs/api -- the Authentication /login reference carries its own class token", () => {
  it("carries .chq-docs-auth-link", async () => {
    const res = await docsApp().request("/docs/api");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<a class="chq-docs-auth-link" href="/login">/login</a>');
  });
});

// ---------------------------------------------------------------------------
// Grounding: for each of the three, prove the chosen rung is REAL rather
// than asserted -- DEC-393 wave-35's ladder is floor (1) / same-surface
// floored twin (2) / DEVIATIONS (3), and all three resolve to rung 3, so
// the assertion is that DEVIATIONS.md names them (not that a floor rule
// renders, which would be the wrong rung for these three).
// ---------------------------------------------------------------------------

const DEVIATIONS = readFileSync(new URL("../docs/design/DEVIATIONS.md", import.meta.url), "utf8");

describe("rung 3 is real: DEVIATIONS.md §9 names all three links, each with its new class token", () => {
  it("names the CFP intro-cta link and its frame citation", () => {
    expect(DEVIATIONS).toContain("Wave 35 rulings (DEC-393 wave-35 amendment): ungrounded inline-prose tap-floor links");
    expect(DEVIATIONS).toContain(".chq-cfp-intro-cta-link");
    const collapsed = DEVIATIONS.replace(/\s+/g, " ");
    expect(collapsed).toContain("Chautauqua Public and Portal.dc.html:891-1010");
    expect(DEVIATIONS).toContain(":1017-1065");
  });

  it("names the CFP identity-note link", () => {
    expect(DEVIATIONS).toContain(".chq-cfp-identity-note-link");
  });

  it("names the docs auth link and its DEC-382 chrome citation", () => {
    expect(DEVIATIONS).toContain(".chq-docs-auth-link");
    expect(DEVIATIONS).toContain("DEC-382");
  });

  it("the two frame extents DEVIATIONS cites for the CFP entries are real lines in the pack (DEC-967: no false citation)", () => {
    const frame = readFileSync(new URL("../docs/design/Chautauqua Public and Portal.dc.html", import.meta.url), "utf8").split("\n");
    // :891-1010 is the desktop "Submit a talk · /submit/:slug" frame.
    expect(frame[893]).toContain("Submit a talk · /submit/:slug");
    // :1017-1065 is the 390 "Submit a talk" frame.
    expect(frame[1013]).toContain('style="font-family');
    expect(frame[1013]).toContain("Submit a talk");
  });

  it("neither frame extent draws 'Create an account' or 'Sign in' as a control (the rung-1/2 failure this deviation claims)", () => {
    const lines = readFileSync(new URL("../docs/design/Chautauqua Public and Portal.dc.html", import.meta.url), "utf8").split("\n");
    const desktopExtent = lines.slice(890, 1010).join("\n"); // :891-1010, 1-indexed
    const phoneExtent = lines.slice(1016, 1065).join("\n"); // :1017-1065, 1-indexed
    for (const extent of [desktopExtent, phoneExtent]) {
      expect(extent).not.toMatch(/create an account/i);
      expect(extent).not.toMatch(/sign in/i);
    }
  });

  it("no v12 frame draws /docs/api at all (the rung-1/2 failure the docs entry claims)", () => {
    const glob = ["Chautauqua Public and Portal.dc.html", "Chautauqua Docs.dc.html"];
    for (const name of glob) {
      const text = readFileSync(new URL(`../docs/design/${name}`, import.meta.url), "utf8");
      expect(text).not.toMatch(/docs\/api/i);
    }
  });
});
