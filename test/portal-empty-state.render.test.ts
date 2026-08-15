// DEC-919 (wave 52 amendment): the speaker portal renders its zero-states
// through the SAME server-rendered PublicEmptyState renderer the public
// surfaces use. Covers the four bare sentences that previously bypassed it
// (GET /portal's "Waiting on you" / "Done" sections, GET /portal/submissions/
// :id's Slides card, and GET /portal/tasks's assignment list) plus the
// CSS-reachability half: a renderer whose stylesheet is not composed into
// the surface's <style> block is unstyled at runtime, so this also asserts
// PORTAL_CSS actually carries the .chq-pub-empty-block rule.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { PORTAL_CSS } from "../src/routes/portal/portal.css";

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

const BASE_BRANDING = {
  eventId: "evt-1",
  eventName: "Arbitrary Con",
  welcomeMessage: null,
  accentColor: null,
  logoUrl: null,
  showResources: true,
};

function noEscape(html: string) {
  // Body markup only -- the composed stylesheet legitimately declares the
  // .chq-pub-empty-escape selector (EMPTY_CSS) even though no 'fresh' block
  // ever emits an element carrying it.
  const body = html.slice(html.lastIndexOf("</style>"));
  expect(body).toContain("chq-pub-empty-block-fresh");
  expect(body).not.toContain("chq-pub-empty-escape");
}

/** Every `.chq-pub-empty-block` `<div>...</div>` in the document body, as
 * rendered markup -- scoped so a legitimate `<button>` elsewhere on the page
 * (e.g. the portal's own sign-out control) doesn't false-positive the "no
 * button in a fresh zero-state" assertion. */
function emptyStateBlocks(html: string): string[] {
  const body = html.slice(html.lastIndexOf("</style>"));
  const blocks: string[] = [];
  const re = /<div class="chq-pub-empty-block[^"]*">.*?<\/div>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body))) {
    blocks.push(match[0]);
  }
  return blocks;
}

describe("PORTAL_CSS composes EMPTY_CSS (DEC-919 wave 52)", () => {
  it("carries the .chq-pub-empty-block rule from EMPTY_CSS", () => {
    expect(PORTAL_CSS).toContain(".chq-pub-empty-block {");
    expect(PORTAL_CSS).toContain(".chq-pub-empty-block-fresh");
  });
});

describe("GET /portal — dashboard zero-states render PublicEmptyState (DEC-919 wave 52)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("'Waiting on you' and 'Done' both render .chq-pub-empty-block-fresh with no anchor when empty", async () => {
    vi.doMock("../src/server/repo/portal", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
      return {
        ...actual,
        getPortalData: vi.fn(async () => ({
          branding: BASE_BRANDING,
          contactName: "Ada Lovelace",
          contactCompany: null,
        })),
        getMySessions: vi.fn(async () => []),
        getMyInvitations: vi.fn(async () => []),
        getMyTaskAssignments: vi.fn(async () => []),
        getMySubmissions: vi.fn(async () => []),
        listLatestDeliverables: vi.fn(async () => new Map()),
      };
    });

    const { portalRoutes } = await import("../src/routes/portal");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", speakerAuth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/portal", portalRoutes);

    const res = await app.request("/portal");
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain("Nothing pending right now.");
    expect(html).toContain("Nothing completed yet.");
    noEscape(html);
    const blocks = emptyStateBlocks(html);
    // Two independent fresh blocks -- "Waiting on you" and "Done" -- each
    // its own PublicEmptyState render.
    expect(blocks.length).toBe(2);
    for (const block of blocks) {
      expect(block).not.toContain("<button");
      expect(block).not.toContain("<a ");
    }
  });
});

describe("GET /portal/submissions/:id — Slides card zero-state (DEC-919 wave 52)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("renders 'Nothing uploaded yet.' through PublicEmptyState when no deliverable exists", async () => {
    vi.doMock("../src/server/repo/portal", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
      return {
        ...actual,
        getPortalSubmissionDetail: vi.fn(async () => ({
          id: "sub-1",
          title: "My Talk",
          ref: "SES-1",
          format: null,
          trackName: null,
          description: "An abstract.",
          statusLabel: "Accepted",
          submittedAt: 0,
          day: null,
          startMin: null,
          roomName: null,
        })),
        getPortalData: vi.fn(async () => ({
          branding: BASE_BRANDING,
          contactName: "Ada Lovelace",
          contactCompany: null,
        })),
        getLatestDeliverable: vi.fn(async () => null),
        getMyTaskAssignments: vi.fn(async () => []),
        listDeliverableCandidatesForEvents: vi.fn(async () => new Map()),
      };
    });
    vi.doMock("../src/server/repo/portal-edit", async () => {
      const actual =
        await vi.importActual<typeof import("../src/server/repo/portal-edit")>("../src/server/repo/portal-edit");
      return {
        ...actual,
        loadEditableSubmission: vi.fn(async () => null),
        getPortalParticipants: vi.fn(async () => []),
      };
    });

    const { portalRoutes } = await import("../src/routes/portal");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", speakerAuth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/portal", portalRoutes);

    const res = await app.request("/portal/submissions/sub-1");
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain("Nothing uploaded yet.");
    noEscape(html);
    const blocks = emptyStateBlocks(html);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).not.toContain("<button");
      expect(block).not.toContain("<a ");
    }
  });
});

describe("GET /portal/tasks — zero-state carries a true, endpoint-backed reason (DEC-919 wave 52)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("renders 'No tasks assigned yet.' through PublicEmptyState with the organiser-fact reason", async () => {
    vi.doMock("../src/server/repo/portal", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
      return {
        ...actual,
        getPortalData: vi.fn(async () => ({
          branding: BASE_BRANDING,
          submissions: [],
          tasks: [],
        })),
        getMyTaskAssignments: vi.fn(async () => []),
        getAssignmentScope: vi.fn(),
        listDeliverableCandidates: vi.fn(async () => []),
      };
    });

    const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", speakerAuth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/portal", portalTasksRoutes);

    const res = await app.request("/portal/tasks");
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain("No tasks assigned yet.");
    expect(html).toContain("Your organiser has not assigned anything yet.");
    noEscape(html);
    const blocks = emptyStateBlocks(html);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).not.toContain("<button");
      expect(block).not.toContain("<a ");
    }
  });
});
