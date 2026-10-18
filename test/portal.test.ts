import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import {
  assertSpeakerContactId,
  isOwnedByContact,
  speakerStatusLabel,
} from "../src/server/repo/portal";
import { registerErrorHandler } from "../src/server/http";
import type { PortalHome } from "../src/server/repo/portal/home";
import { homeFixture, itemFixture, sectionFixture, sessionParticipation, viewFixture } from "./helpers/person-view-fixture";
import type { AppEnv, AuthInfo } from "../src/server/env";

// The home renders from getPortalHome's person views; mocked the same way as
// test/portal-signout.test.ts (vi.importActual + targeted overrides) so the
// plain unit tests below stay on the real implementations.
let mockHome: PortalHome = homeFixture([]);

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalHome: vi.fn(async () => mockHome),
    getPortalData: vi.fn(async () => ({
      branding: {
        eventId: "evt-1",
        eventName: "Arbitrary Con",
        welcomeMessage: null,
        accentColor: null,
        logoUrl: null,
      },
      submissions: [],
      tasks: [],
      contactName: "Priya Raman",
      contactCompany: "Latticework Systems",
      showResourcesByEventId: { "evt-1": true },
    })),
    getMySessions: vi.fn(async () => []),
    getMyInvitations: vi.fn(async () => []),
    getMyTaskAssignments: vi.fn(async () => []),
    getLatestDeliverable: vi.fn(async () => null),
    getMySubmissions: vi.fn(async () => []),
  };
});

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

async function buildPortalApp() {
  const { portalRoutes } = await import("../src/routes/portal/index");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", speakerAuth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/portal", portalRoutes);
  return app;
}


// Multi-portal: the home is the person view (src/routes/portal/home.tsx) --
// profile first, then one section per participation. The hero counts what
// the view counts (DEC-590's "the number is the rows", kept): open items,
// plus any invitation still waiting for an answer.
describe("PortalPage participation home (multi-portal)", () => {
  it("counts the open items and the waiting invitation: 'Hi Priya — 3 things to do'", async () => {
    const talk = sessionParticipation({ submissionId: "sub-2", title: "Taming 40-Minute CI" });
    const invited = sessionParticipation({ submissionId: "sub-1", title: "Panel talk", role: "panelist", participationStatus: "invited" });
    mockHome = homeFixture([
      viewFixture({
        profileItems: [
          itemFixture({ key: "a1|", assignmentId: "a1", title: "Sign the W-9" }),
          itemFixture({ key: "a2|", assignmentId: "a2", taskId: "t2", title: "Upload headshot", kind: "file_request", state: "done" }),
        ],
        sections: [
          sectionFixture(talk, { items: [itemFixture({ key: "a3|p", assignmentId: "a3", taskId: "t3", title: "Confirm hotel stay", kind: "form" })] }),
          sectionFixture(invited, { heading: "Invitation", phrase: "your invitation" }),
        ],
      }),
    ]);
    const app = await buildPortalApp();
    const res = await app.request("/portal");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/Hi Priya[\s\S]*3 things to do/);
    expect(html).toContain("Sign the W-9");
    expect(html).toContain("Confirm hotel stay");
    // the finished item sits in its section's done fold, not among the open rows
    const fold = html.slice(html.indexOf('class="chq-home-done"'));
    expect(fold).toContain("Upload headshot");
    // the invitation keeps its accept/decline forms + CSRF field
    expect(html).toContain('<form method="post" action="/portal/invitations/part-sub-1">');
    expect(html).toMatch(/<input type="hidden" name="chq_csrf" value="[^"]+"\s*\/?>/);
    expect(html).toMatch(/<input type="hidden" name="action" value="accept"/);
    expect(html).toMatch(/<input type="hidden" name="action" value="decline"/);
  });

  it("reads '1 thing to do' (singular) when exactly one item is open", async () => {
    mockHome = homeFixture([viewFixture({ profileItems: [itemFixture({ title: "Only task" })] })]);
    const app = await buildPortalApp();
    const html = await (await app.request("/portal")).text();
    expect(html).toMatch(/1 thing to do/);
  });

  it("greets without a count when nothing is open", async () => {
    mockHome = homeFixture([viewFixture({ profileItems: [itemFixture({ title: "Done already", state: "done" })] })]);
    const app = await buildPortalApp();
    const html = await (await app.request("/portal")).text();
    expect(html).toMatch(/<h1[^>]*>\s*Hi Priya\s*<\/h1>/);
  });

  it("names no portal: the participant sees their roles, not the configuration", async () => {
    const talk = sessionParticipation();
    mockHome = homeFixture([
      viewFixture({
        sections: [sectionFixture(talk, { items: [itemFixture({ title: "Final slides", portals: [{ id: "p1", name: "CFP speakers" }] })] })],
      }),
    ]);
    const app = await buildPortalApp();
    const html = await (await app.request("/portal")).text();
    expect(html).toContain("Final slides");
    expect(html).not.toContain("CFP speakers");
  });
});

describe("portal home layout (multi-portal, Portals frame flow 6)", () => {
  it("emits no pipe-separated Nav and no <table> — the shell is the card layout, not the old bar+table", async () => {
    mockHome = homeFixture([viewFixture({ profileItems: [itemFixture({ title: "Sign the W-9" })] })]);
    const app = await buildPortalApp();
    const html = await (await app.request("/portal")).text();
    expect(html).not.toMatch(/Dashboard<\/a>\s*\|/);
    expect(html).not.toContain("<table");
  });

  it("renders the profile first, then one section per participation", async () => {
    const talk = sessionParticipation();
    mockHome = homeFixture([
      viewFixture({
        profileItems: [itemFixture({ title: "Bio", kind: "bio", taskId: null, assignmentId: null })],
        sections: [sectionFixture(talk, { items: [itemFixture({ title: "Final slides" })] })],
      }),
    ]);
    const app = await buildPortalApp();
    const html = await (await app.request("/portal")).text();
    const profileIdx = html.indexOf(">Your profile<");
    const talkIdx = html.indexOf(">Your talk<");
    expect(profileIdx).toBeGreaterThan(-1);
    expect(talkIdx).toBeGreaterThan(profileIdx);
  });

  it("keeps /portal/tasks, /portal/profile, /portal/resources reachable", async () => {
    mockHome = homeFixture([]);
    const app = await buildPortalApp();
    const html = await (await app.request("/portal")).text();
    expect(html).toContain('href="/portal/tasks"');
    expect(html).toContain('href="/portal/profile"');
    expect(html).toContain('href="/portal/resources"');
  });
});

describe("speakerStatusLabel", () => {
  it("collapses all three queue-ish statuses to 'Under review' — internal queue states must never leak", () => {
    expect(speakerStatusLabel("pending")).toBe("Under review");
    expect(speakerStatusLabel("accept_queue")).toBe("Under review");
    expect(speakerStatusLabel("decline_queue")).toBe("Under review");
  });

  it("maps the two decided statuses to speaker-friendly text", () => {
    expect(speakerStatusLabel("accepted")).toBe("Accepted");
    expect(speakerStatusLabel("declined")).toBe("Not accepted");
  });

  it("throws on an unknown status literal — fail loudly, no silent default", () => {
    expect(() => speakerStatusLabel("bogus" as any)).toThrow();
  });
});

// DEC-777: the welcome tagline is confined to the portal home route, so
// subpages lead with the wordmark + identity instead of displacing it.
describe("portal home tagline (DEC-777)", () => {
  it("renders the welcome tagline on GET /portal", async () => {
    const { getPortalData } = await import("../src/server/repo/portal");
    vi.mocked(getPortalData).mockResolvedValueOnce({
      branding: {
        eventId: "evt-1",
        eventName: "Arbitrary Con",
        welcomeMessage: "Welcome to the speaker portal!",
        accentColor: null,
        logoUrl: null,
      },
      submissions: [],
      tasks: [],
      contactName: "Priya Raman",
      contactCompany: null,
      showResourcesByEventId: { "evt-1": true },
    });
    mockHome = homeFixture([]);
    const app = await buildPortalApp();
    const res = await app.request("/portal");
    const html = await res.text();
    expect(html).toContain("Welcome to the speaker portal!");
  });
});

describe("assertSpeakerContactId", () => {
  it("returns the contactId for a well-formed speaker auth", () => {
    expect(assertSpeakerContactId({ role: "speaker", contactId: "c1" })).toBe("c1");
  });

  it("throws when auth is undefined", () => {
    expect(() => assertSpeakerContactId(undefined)).toThrow();
  });

  it("throws when role isn't speaker", () => {
    expect(() => assertSpeakerContactId({ role: "organizer", contactId: "c1" })).toThrow();
  });

  it("throws when a speaker session is missing contactId — data corruption, fail loudly", () => {
    expect(() => assertSpeakerContactId({ role: "speaker" })).toThrow();
  });
});

describe("isOwnedByContact", () => {
  it("is true when the contactId is among the submission's participants", () => {
    expect(isOwnedByContact(["c1", "c2"], "c2")).toBe(true);
  });

  it("is false for a contactId not in the participant list — no IDOR", () => {
    expect(isOwnedByContact(["c1", "c2"], "c3")).toBe(false);
  });

  it("is false for an empty participant list", () => {
    expect(isOwnedByContact([], "c1")).toBe(false);
  });
});
