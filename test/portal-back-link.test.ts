// DEC-914: one PortalBackLink component, resolving its label from a single
// exported table (PORTAL_BACK_LINKS in src/routes/portal/shared.tsx) — a
// back link's text can never drift from the route its href actually lands
// on. Regression for profile.tsx:142, which used to render "Back to My
// Submissions" while pointing at /portal (the portal home, not the
// submissions list).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { PORTAL_BACK_LINKS, PortalBackLink } from "../src/routes/portal/shared";
import type { ContactProfile } from "../src/server/repo/profile";

// Every portal destination actually linked back to from a portal page, per
// the field-guide task (profile.tsx, index.tsx, edit.tsx, tasks/views.tsx).
// A dynamic entry is represented by one concrete example URL.
const LINKED_DESTINATIONS = [
  "/portal",
  "/portal/submissions",
  "/portal/tasks",
  "/portal/submissions/sub-123",
];

describe("PORTAL_BACK_LINKS table (DEC-914)", () => {
  it("is total over every destination actually linked back to from a portal page", () => {
    for (const to of LINKED_DESTINATIONS) {
      expect(() => PORTAL_BACK_LINKS.find((e) => e.test(to))).not.toThrow();
      const entry = PORTAL_BACK_LINKS.find((e) => e.test(to));
      expect(entry, `no PORTAL_BACK_LINKS entry matches ${to}`).toBeDefined();
    }
  });

  it("throws for an unregistered destination rather than falling back to a generic label", () => {
    expect(() => PortalBackLink({ to: "/portal/unregistered-route" })).toThrow();
  });
});

describe("PortalBackLink", () => {
  it("renders 'Your portal' for /portal", () => {
    const html = String(PortalBackLink({ to: "/portal" }));
    expect(html).toContain('href="/portal"');
    expect(html).toContain("Your portal");
  });

  it("renders 'Your submissions' for /portal/submissions", () => {
    const html = String(PortalBackLink({ to: "/portal/submissions" }));
    expect(html).toContain('href="/portal/submissions"');
    expect(html).toContain("Your submissions");
  });

  it("renders 'Your tasks' for /portal/tasks", () => {
    const html = String(PortalBackLink({ to: "/portal/tasks" }));
    expect(html).toContain('href="/portal/tasks"');
    expect(html).toContain("Your tasks");
  });
});

const BASE_PROFILE: ContactProfile = {
  id: "c1",
  firstName: "Jane",
  lastName: "Doe",
  title: null,
  company: null,
  bio: null,
  headshotUrl: null,
  socialLinks: { twitter: "", linkedin: "", github: "", website: "" },
};

vi.mock("../src/server/repo/profile", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/profile")>("../src/server/repo/profile");
  return {
    ...actual,
    getContactProfile: vi.fn(async () => BASE_PROFILE),
  };
});

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalData: vi.fn(async () => ({
      branding: { eventName: "Test Conf", welcomeMessage: null, accentColor: null, logoUrl: null },
      submissions: [],
      tasks: [],
    })),
  };
});

const { portalProfileRoutes } = await import("../src/routes/portal/profile");

describe("GET /portal/profile — back link agrees with its own destination", () => {
  it("emits a back link whose href and label name the same route (h1 heading)", async () => {
    const app = new Hono<AppEnv>();
    const auth: AuthInfo = { userId: "u1", role: "speaker", orgId: "org1", contactId: "c1" };
    app.use("*", async (c, next) => {
      c.set("auth", auth);
      c.set("db", {} as AppEnv["Variables"]["db"]);
      await next();
    });
    registerErrorHandler(app);
    app.route("/portal", portalProfileRoutes);

    const res = await app.request("/portal/profile");
    expect(res.status).toBe(200);
    const html = await res.text();

    // The href goes to /portal (the portal home) — the label must name that
    // destination ("Your portal"), never a stale "Back to My Submissions".
    const match = html.match(/<a href="([^"]+)" class="chq-portal-back">([^<]*)<\/a>/);
    expect(match, "expected a chq-portal-back link in the rendered page").not.toBeNull();
    const [, href, label] = match!;
    const expectedEntry = PORTAL_BACK_LINKS.find((e) => e.test(href!));
    expect(expectedEntry, `no PORTAL_BACK_LINKS entry for rendered href ${href}`).toBeDefined();
    expect(label).toContain(expectedEntry!.label);

    // The page heading is the page's only <h1>, not a demoted <h2>.
    expect(html).toContain('<h1 class="chq-portal-hero">My Profile</h1>');
    expect(html).not.toContain('<h2 class="chq-portal-hero">My Profile</h2>');
  });
});
