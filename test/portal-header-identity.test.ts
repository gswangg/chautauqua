// DEC-820/w6-i: once a speaker leaves /portal (the dashboard), the portal
// must keep saying whose account they're in — every PortalLayout call site
// across src/routes/portal/*.tsx must carry a speakerName prop. This is an
// ENUMERATING source scan (not a hand-listed set of files): it walks every
// .tsx file under src/routes/portal, finds every `<PortalLayout` occurrence,
// and asserts each one carries `speakerName=` — so a new subpage that adds
// its own `<PortalLayout ...>` without threading the signed-in contact's
// name through fails this test automatically.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const PORTAL_DIR = join(__dirname, "..", "src", "routes", "portal");

// Every `<PortalLayout` occurrence, paired with the fragment from the open
// tag through its closing `>` (the props are always on that fragment — none
// of these call sites are self-closing, but this also handles a
// self-closing tag if one is ever added).
function findPortalLayoutTags(source: string): string[] {
  const tags: string[] = [];
  const re = /<PortalLayout\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const start = m.index;
    const close = source.indexOf(">", start);
    if (close === -1) throw new Error(`Unterminated <PortalLayout tag at offset ${start}`);
    tags.push(source.slice(start, close + 1));
  }
  return tags;
}

describe("portal header identity: every PortalLayout call site carries speakerName (DEC-820)", () => {
  const tsxFiles = readdirSync(PORTAL_DIR).filter((f) => f.endsWith(".tsx"));
  // Guard against the enumeration itself silently finding nothing (a
  // directory-listing regression would otherwise make every assertion below
  // vacuously true).
  expect(tsxFiles.length).toBeGreaterThan(0);

  let totalTags = 0;

  for (const file of tsxFiles) {
    const source = readFileSync(join(PORTAL_DIR, file), "utf8");
    const tags = findPortalLayoutTags(source);
    for (const [i, tag] of tags.entries()) {
      totalTags += 1;
      it(`${file}: <PortalLayout> occurrence #${i + 1} carries speakerName`, () => {
        expect(tag).toMatch(/\bspeakerName=/);
      });
    }
  }

  it("found at least one <PortalLayout> call site to check", () => {
    expect(totalTags).toBeGreaterThan(0);
  });
});

// Render assertion: a real /portal/tasks response's header actually contains
// the signed-in speaker's name, not just a prop wired through unused markup.
vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalData: vi.fn(async () => ({
      branding: {
        eventId: "evt-1",
        eventName: "Arbitrary Con",
        welcomeMessage: null,
        accentColor: null,
        logoUrl: null,
        showResources: true,
      },
      submissions: [],
      tasks: [],
      contactName: "Ada Lovelace",
      contactCompany: null,
    })),
    getMyTaskAssignments: vi.fn(async () => []),
  };
});

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

describe("GET /portal/tasks header names the signed-in speaker", () => {
  it("renders the speaker's name in the header, not just the dashboard", async () => {
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
    expect(html).toContain('<span class="chq-portal-header-name">Ada Lovelace</span>');
  });
});
