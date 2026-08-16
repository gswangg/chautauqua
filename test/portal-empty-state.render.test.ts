// DEC-919 (wave 52 amendment, wave-56 amendment): the speaker portal
// renders its zero-states through the SAME server-rendered PublicEmptyState
// renderer the public surfaces use. Covers the four bare sentences that
// previously bypassed it (GET /portal's "Waiting on you" / "Done" sections,
// GET /portal/submissions/:id's Slides card, and GET /portal/tasks's
// assignment list) plus the CSS-reachability half: a renderer whose
// stylesheet is not composed into the surface's <style> block is unstyled
// at runtime, so this also asserts PORTAL_CSS actually carries the
// .chq-pub-empty-block rule. Wave-56 (task w56-a) extends coverage to the
// seven remaining bare zero-states: GET /portal's "Your submissions" /
// "Your session" sections, GET /portal/submissions (SubmissionsListPage),
// CommentThread, ResourcesPage, ParticipantsSection, and the printable
// programme.

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
};

const SHOW_RESOURCES_BY_EVENT_ID = { "evt-1": true };

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
          showResourcesByEventId: SHOW_RESOURCES_BY_EVENT_ID,
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
    expect(html).toContain("No submissions yet.");
    expect(html).toContain("Anything you send to a call for papers shows up here.");
    expect(html).toContain("No accepted sessions yet.");
    expect(html).toContain("When a session of yours is accepted it appears here with its schedule.");
    noEscape(html);
    const blocks = emptyStateBlocks(html);
    // Four independent fresh blocks -- "Waiting on you", "Done" (via the
    // "Nothing completed yet." fixture below), "Your submissions" and
    // "Your session" -- each its own PublicEmptyState render.
    expect(blocks.length).toBe(4);
    for (const block of blocks) {
      expect(block).not.toContain("<button");
      expect(block).not.toContain("<a ");
    }
  });
});

describe("GET /portal/submissions — SubmissionsListPage zero-state (DEC-919 wave-56 amendment)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("renders 'No submissions yet.' through PublicEmptyState when the speaker has none", async () => {
    vi.doMock("../src/server/repo/portal", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
      return {
        ...actual,
        getPortalData: vi.fn(async () => ({
          branding: BASE_BRANDING,
          showResourcesByEventId: SHOW_RESOURCES_BY_EVENT_ID,
          contactName: "Ada Lovelace",
          contactCompany: null,
        })),
        getMySubmissions: vi.fn(async () => []),
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

    const res = await app.request("/portal/submissions");
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain("No submissions yet.");
    expect(html).toContain("Anything you send to a call for papers shows up here.");
    noEscape(html);
    const blocks = emptyStateBlocks(html);
    expect(blocks.length).toBeGreaterThan(0);
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
          showResourcesByEventId: SHOW_RESOURCES_BY_EVENT_ID,
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
          showResourcesByEventId: SHOW_RESOURCES_BY_EVENT_ID,
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

describe("GET /portal/tasks — CommentThread zero-state (DEC-919 wave-56 amendment)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("renders 'No comments yet.' through PublicEmptyState for a completed file_request with no comments", async () => {
    vi.doMock("../src/server/repo/portal", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
      return {
        ...actual,
        getPortalData: vi.fn(async () => ({
          branding: BASE_BRANDING,
          showResourcesByEventId: SHOW_RESOURCES_BY_EVENT_ID,
        })),
        getMyTaskAssignments: vi.fn(async () => [
          {
            id: "assignment-1",
            taskId: "task-1",
            eventId: "event-1",
            kind: "file_request",
            title: "Upload slides",
            description: null,
            instructions: null,
            dueDate: null,
            assignedAt: 0,
            required: true,
            status: "complete",
            formId: null,
            deliverableKind: null,
            fileId: "file-1",
            responseJson: null,
            timezone: "UTC",
            completedAt: null,
          },
        ]),
      };
    });
    vi.doMock("../src/server/repo/files", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
      const CHAIN = [
        { id: "file-1", filename: "slides.pdf", contentType: "application/pdf", r2Key: "k", createdAt: 0, versionNo: 1 },
      ];
      return {
        ...actual,
        resolveTaskFileChainLatestMany: vi.fn(async () => new Map([["file-1", CHAIN[0]]])),
        listFileChainVersionsMany: vi.fn(async () => new Map([["file-1", CHAIN]])),
        listFileCommentsForFiles: vi.fn(async () => new Map()),
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

    expect(html).toContain("No comments yet.");
    expect(html).toContain("Your organiser can leave notes on this file here.");
    noEscape(html);
    const blocks = emptyStateBlocks(html);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).not.toContain("<button");
      expect(block).not.toContain("<a ");
    }
  });
});

describe("GET /portal/resources — ResourcesPage zero-state (DEC-919 wave-56 amendment)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("renders 'No resources yet.' through PublicEmptyState when there are none", async () => {
    vi.doMock("../src/server/repo/portal", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
      return {
        ...actual,
        getPortalData: vi.fn(async () => ({
          branding: BASE_BRANDING,
          showResourcesByEventId: SHOW_RESOURCES_BY_EVENT_ID,
          contactName: "Ada Lovelace",
        })),
        getMyResources: vi.fn(async () => []),
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

    const res = await app.request("/portal/resources");
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain("No resources yet.");
    expect(html).toContain("Your organiser has not shared any speaker resources.");
    noEscape(html);
    const blocks = emptyStateBlocks(html);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).not.toContain("<button");
      expect(block).not.toContain("<a ");
    }
  });
});

describe("GET /portal/submissions/:id/edit — ParticipantsSection zero-state (DEC-919 wave-56 amendment)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("renders 'No participants yet.' through PublicEmptyState when the submission has none", async () => {
    vi.doMock("../src/server/repo/portal", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
      return {
        ...actual,
        getPortalData: vi.fn(async () => ({
          branding: BASE_BRANDING,
          showResourcesByEventId: SHOW_RESOURCES_BY_EVENT_ID,
          submissions: [],
          tasks: [],
        })),
      };
    });
    vi.doMock("../src/server/repo/portal-edit", async () => {
      const actual =
        await vi.importActual<typeof import("../src/server/repo/portal-edit")>("../src/server/repo/portal-edit");
      return {
        ...actual,
        loadEditableSubmission: vi.fn(async () => ({
          submission: { id: "s1", status: "pending", title: "Talk title", description: "desc" },
          form: { id: "f1", closeDate: null, timezone: "America/Los_Angeles" },
          fields: [],
          answers: {},
          offeredTrackIds: [],
          allTracks: [],
          selectedTrackIds: [],
        })),
        getPortalParticipants: vi.fn(async () => []),
      };
    });

    const { portalEditRoutes } = await import("../src/routes/portal/edit");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", speakerAuth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/portal", portalEditRoutes);

    const res = await app.request("/portal/submissions/s1/edit");
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain("No participants yet.");
    expect(html).toContain("Anyone presenting this session with you appears here.");
    noEscape(html);
    const blocks = emptyStateBlocks(html);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).not.toContain("<button");
      expect(block).not.toContain("<a ");
    }
  });
});

describe("GET /e/:eventSlug/programme — fresh zero-state (DEC-919 wave-56 amendment)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("renders 'No sessions scheduled yet.' through PublicEmptyState when nothing is published", async () => {
    (globalThis as unknown as { caches: { default: { match: () => Promise<undefined>; put: () => Promise<void> } } }).caches = {
      default: { match: async () => undefined, put: async () => {} },
    };
    vi.doMock("../src/server/repo/public/home", () => ({
      getHubOrg: vi.fn(async () => null),
      listHubEvents: vi.fn(async () => ({ items: [], capped: false })),
    }));
    vi.doMock("../src/server/repo/public", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/public")>("../src/server/repo/public");
      return {
        ...actual,
        getPublicEventBySlug: vi.fn(async () => ({
          id: "ev1",
          orgId: "org1",
          name: "Test Conf",
          slug: "conf",
          startDate: "2026-08-10",
          endDate: "2026-08-11",
          location: "Moscone West",
          timezone: "UTC",
          recordPrefix: "SES",
          brandingJson: null,
        })),
        getPublicAgenda: vi.fn(async () => ({ items: [], total: 0 })),
        getPublicBreaksByDay: vi.fn(async () => new Map()),
      };
    });

    const { publicRoutes } = await import("../src/routes/public");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", {} as never);
      await next();
    });
    app.route("/", publicRoutes);
    const env = { KV: { get: async () => null, put: async () => {}, delete: async () => {} } as unknown as AppEnv["Bindings"]["KV"] };

    const res = await app.request("/e/conf/programme", undefined, env);
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain("No sessions scheduled yet.");
    expect(html).toContain("The programme has not been published.");
    noEscape(html);
    const blocks = emptyStateBlocks(html);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).not.toContain("<button");
      expect(block).not.toContain("<a ");
    }
  });
});
