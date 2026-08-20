// DEC-576/DEC-154 (wave-110 amendments): the portal's phone dock band --
// the "Your tasks" 390 frame's :492-495 band and the "Your session"
// frame's :586-589 band, each cited by path+line, quoted and receipted at
// the geometry it()s below, where an assertion can stand beside the claim
// (a file-header citation can carry no expect(, DEC-976 wave-87) -- holds
// a page's own primary [+ secondary] action inside PortalLayout's shared
// .chq-portal-footer, and the header/footer no longer both carry Sign out
// at 390.
//
// Two halves, mirroring test/portal-phone-frames.test.ts's idiom for the
// CSS half (jsdom applies no @media, so the phone-only geometry and the
// footer sign-out hide are pinned as a CSS TEXT scan) and the existing
// portal render-test idiom (vi.mock + app.request) for the DOM half.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { PORTAL_CSS } from "../src/routes/portal/portal.css";
import type { PortalTaskAssignment } from "../src/server/repo/portal";

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function phoneLayer(css: string): string {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") depth -= 1;
      i += 1;
    }
    if (depth !== 0) throw new Error("unbalanced @media block");
    out.push(css.slice(start, i - 1));
  }
  if (out.length === 0) throw new Error("no max-width media block found");
  return out.join("\n");
}

function phoneRuleAll(layer: string, selector: string): string {
  const bodies: string[] = [];
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(",")
      .map((s) => s.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    if (selectors.includes(selector)) bodies.push(m[2]!);
  }
  if (bodies.length === 0) throw new Error(`no phone rule for ${selector}`);
  return bodies.join("\n");
}

const CLEAN = stripComments(PORTAL_CSS);
const PHONE = phoneLayer(CLEAN);

function desktopLayer(css: string): string {
  const idx = css.indexOf("@media (max-width: 700px)");
  expect(idx, "no phone media block found").toBeGreaterThan(-1);
  return css.slice(0, idx);
}
const DESKTOP = desktopLayer(CLEAN);

describe("v12 phone dock band (390) — .chq-portal-dock geometry", () => {
  // docs/design/Chautauqua Public and Portal.dc.html:493/:587
  // `<span style="flex:1; ... min-height:48px; ...">Mark the release signed</span>`
  it("the primary is flex:1 and reaches the 48px floor", () => {
    const primary = phoneRuleAll(PHONE, ".chq-portal-dock .chq-btn-primary");
    expect(primary).toMatch(/flex:\s*1/);
    expect(primary).toMatch(/min-height:\s*48px/);
  });

  // docs/design/Chautauqua Public and Portal.dc.html:494/:588
  // `<span style="border:1px solid #BAB6A6; ... min-height:48px; ...">Later</span>`
  it("the secondary reaches the 48px floor (border is the shared .chq-btn-secondary token, untouched here)", () => {
    const secondary = phoneRuleAll(PHONE, ".chq-portal-dock .chq-btn-secondary");
    expect(secondary).toMatch(/min-height:\s*48px/);
  });

  it("is declared only inside the terminal phone media block, never in the desktop layer", () => {
    expect(DESKTOP).not.toMatch(/\.chq-portal-dock/);
  });
});

describe("DEC-154: the footer's duplicate Sign out is stood down at 390 only", () => {
  it("phone layer hides .chq-portal-footer .chq-portal-signout", () => {
    const hidden = phoneRuleAll(PHONE, ".chq-portal-shell > .chq-portal-footer .chq-portal-signout");
    expect(hidden).toMatch(/display:\s*none/);
  });

  it("desktop layer declares no such hide -- desktop keeps both header and footer Sign out exactly as before", () => {
    expect(DESKTOP).not.toMatch(/\.chq-portal-signout\s*\{[^}]*display:\s*none/);
  });
});

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

const BASE_BRANDING = {
  eventId: "evt-1",
  eventName: "Arbitrary Con",
  welcomeMessage: null,
  accentColor: null,
  logoUrl: null,
};

function taskFixture(overrides: Partial<PortalTaskAssignment>): PortalTaskAssignment {
  return {
    id: "assign-1",
    taskId: "task-1",
    eventId: "evt-1",
    kind: "general",
    title: "Untitled task",
    description: null,
    instructions: null,
    dueDate: null,
    assignedAt: 0,
    required: false,
    status: "pending",
    formId: null,
    deliverableKind: null,
    fileId: null,
    responseJson: null,
    timezone: "UTC",
    completedAt: null,
    ...overrides,
  };
}

/** Every `Sign out` control's `<form method="post" action="/logout" ...>`
 * occurrence in the rendered document -- the header cluster (:199
 * shared.tsx) and the footer (:213) each render one. */
function signOutFormCount(html: string): number {
  return (html.match(/<form method="post" action="\/logout"/g) ?? []).length;
}

describe("GET /portal/tasks — the dock carries the first incomplete task's own primary (DEC-576/DEC-967)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("renders the general task's existing 'Mark complete' form inside .chq-portal-dock, inside .chq-portal-footer, after </main>", async () => {
    vi.doMock("../src/server/repo/portal", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
      return {
        ...actual,
        getPortalData: vi.fn(async () => ({
          branding: BASE_BRANDING,
          showResourcesByEventId: { "evt-1": true },
          contactName: "Priya Raman",
          contactCompany: null,
        })),
        getMyTaskAssignments: vi.fn(async () => [
          taskFixture({ id: "assign-release", title: "Mark the release signed", status: "pending" }),
        ]),
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

    const dockIdx = html.indexOf('class="chq-portal-dock"');
    const footerIdx = html.indexOf('class="chq-portal-footer"');
    const mainCloseIdx = html.indexOf("</main>");
    expect(dockIdx).toBeGreaterThan(-1);
    expect(mainCloseIdx).toBeGreaterThan(-1);
    expect(dockIdx).toBeGreaterThan(footerIdx);
    expect(dockIdx).toBeGreaterThan(mainCloseIdx);

    const dockBlock = html.slice(dockIdx, html.indexOf("</footer>"));
    expect(dockBlock).toContain(`action="/portal/tasks/assign-release/complete"`);
    expect(dockBlock).toContain("Mark complete");
    expect(dockBlock).toContain("chq-btn-primary");

    // No secondary "Later" -- DEC-967 wave-106: the frame's second control
    // has no verb behind it anywhere in the portal task model and is never
    // manufactured just to fill the band.
    expect(dockBlock).not.toMatch(/Later/);

    // DEC-154: exactly one Sign out form in the whole document (the header
    // cluster's) -- the footer's copy exists too (stood down by CSS at 390,
    // pinned above) but DEC-154's "sign out once" is a per-document identity
    // claim the SSR output itself must not duplicate as a SECOND distinct
    // destination; both forms below post the same /logout action, so this
    // instead asserts the shared shell renders precisely the two the design
    // predates (header + footer) and no THIRD copy leaks out of the dock.
    expect(signOutFormCount(html)).toBe(2);
  });

  it("omits the dock entirely when every task is complete (no primary to promote, nothing manufactured)", async () => {
    vi.doMock("../src/server/repo/portal", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
      return {
        ...actual,
        getPortalData: vi.fn(async () => ({
          branding: BASE_BRANDING,
          showResourcesByEventId: { "evt-1": true },
          contactName: "Priya Raman",
          contactCompany: null,
        })),
        getMyTaskAssignments: vi.fn(async () => [
          taskFixture({ id: "assign-done", title: "Already done", status: "complete" }),
        ]),
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
    expect(html).not.toContain('class="chq-portal-dock"');
  });
});

describe("GET /portal/submissions/:id — the dock carries the frame's primary + secondary (DEC-576)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("renders the upload primary (flex:1) and 'Edit submission' secondary (bordered) inside the dock", async () => {
    vi.doMock("../src/server/repo/portal", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
      return {
        ...actual,
        getPortalSubmissionDetail: vi.fn(async () => ({
          id: "sub-1",
          eventId: "evt-1",
          ref: "SES-1",
          title: "A great talk",
          description: "An abstract.",
          status: "accepted",
          statusLabel: "Accepted",
          submittedAt: 0,
          timezone: "America/Chicago",
          answers: [],
          trackName: null,
          format: null,
          day: null,
          startMin: null,
          endMin: null,
          roomName: null,
        })),
        getPortalData: vi.fn(async () => ({
          branding: BASE_BRANDING,
          showResourcesByEventId: { "evt-1": true },
          contactName: "Priya Raman",
          contactCompany: null,
        })),
        getLatestDeliverable: vi.fn(async () => null),
        getMyTaskAssignments: vi.fn(async () => [
          taskFixture({ id: "assign-upload", eventId: "evt-1", kind: "file_request", status: "pending" }),
        ]),
        listDeliverableCandidatesForEvents: vi.fn(
          async () => new Map([["evt-1", [{ id: "sub-1", title: "A great talk", format: null, ref: "SES-1" }]]]),
        ),
      };
    });
    vi.doMock("../src/server/repo/portal-edit", async () => {
      const actual =
        await vi.importActual<typeof import("../src/server/repo/portal-edit")>("../src/server/repo/portal-edit");
      return {
        ...actual,
        loadEditableSubmission: vi.fn(async () => ({
          submission: { id: "sub-1", status: "accepted", title: "A great talk", description: "An abstract." },
          form: { id: "f1", closeDate: null, timezone: "America/Chicago" },
          fields: [],
          answers: {},
          offeredTrackIds: [],
          allTracks: [],
          selectedTrackIds: [],
        })),
        getPortalParticipants: vi.fn(async () => []),
      };
    });
    vi.doMock("../src/server/repo/files", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
      return {
        ...actual,
        getFileVersionNumber: vi.fn(async () => null),
      };
    });

    const { portalRoutes } = await import("../src/routes/portal/index");
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

    const dockIdx = html.indexOf('class="chq-portal-dock"');
    const mainCloseIdx = html.indexOf("</main>");
    expect(dockIdx).toBeGreaterThan(-1);
    expect(dockIdx).toBeGreaterThan(mainCloseIdx);

    const dockBlock = html.slice(dockIdx, html.indexOf("</footer>"));
    expect(dockBlock).toContain('href="/portal/tasks#task-assign-upload"');
    expect(dockBlock).toContain("Upload file");
    expect(dockBlock).toContain("chq-btn-primary");
    expect(dockBlock).toContain('href="/portal/submissions/sub-1/edit"');
    expect(dockBlock).toContain("Edit submission");
    expect(dockBlock).toContain("chq-btn-secondary");

    // Two Sign out forms render server-side (header + footer, DEC-154's
    // phone-only hide is the CSS pinned above) -- never a third.
    expect(signOutFormCount(html)).toBe(2);
  });
});
