// DEC-028 amendment (wave 13, task w13-e): every /portal/* page becomes the
// framed phone app shell -- PortalLayout wraps header/main/footer in a
// `.chq-portal-shell` div so the @media (max-width: 700px) block can turn
// the three regions into a fixed header/scrolling body/fixed footer column
// (docs/design "Chautauqua Public and Portal.dc.html" lines 414-467,
// 563-591). The wrapper carries NO top-level rule of its own -- desktop is
// pixel-identical to before this task.
//
// (a) drives a real authenticated /portal route (mirroring
// test/portal-header-identity.test.ts's render-assertion idiom) and checks
// the shell div's children appear, in order: header, main, footer.
//
// (b) source-scans src/routes/portal/portal.css.ts using the strip-@media
// helper idiom from app/src/shell-geometry.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

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

describe("portal phone app shell (DEC-028 amendment)", () => {
  it("wraps header, main and footer in .chq-portal-shell, in DOM order", async () => {
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

    const shellIdx = html.indexOf('class="chq-portal-shell"');
    const headerIdx = html.indexOf('class="chq-header"');
    const mainIdx = html.indexOf('class="chq-measure"');
    const footerIdx = html.indexOf('class="chq-portal-footer"');

    expect(shellIdx).toBeGreaterThan(-1);
    expect(headerIdx).toBeGreaterThan(-1);
    expect(mainIdx).toBeGreaterThan(-1);
    expect(footerIdx).toBeGreaterThan(-1);

    // All three regions must be inside the shell wrapper, in the right order.
    expect(shellIdx).toBeLessThan(headerIdx);
    expect(headerIdx).toBeLessThan(mainIdx);
    expect(mainIdx).toBeLessThan(footerIdx);

    // The shell div must close after the footer (i.e. footer is its last
    // child, not a sibling that follows it).
    const shellCloseIdx = html.indexOf("</div>", footerIdx);
    expect(shellCloseIdx).toBeGreaterThan(footerIdx);
  });
});

describe("portal.css.ts source scan (DEC-028 amendment)", () => {
  const CSS = readFileSync(join(__dirname, "..", "src", "routes", "portal", "portal.css.ts"), "utf8");

  /** Extracts a top-level (not inside an @media block) rule's declaration
   * body by selector, mirroring app/src/shell-geometry.test.ts's helper. */
  function topLevelRuleBody(css: string, selector: string): string | undefined {
    const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, "");
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    return match?.[1];
  }

  /** Extracts the contents of every `@media (max-width: 700px) { ... }`
   * block via balanced-brace scanning. */
  function extract700Blocks(src: string): string[] {
    const blocks: string[] = [];
    const marker = "@media (max-width: 700px)";
    let searchFrom = 0;
    for (;;) {
      const idx = src.indexOf(marker, searchFrom);
      if (idx === -1) break;
      const openBrace = src.indexOf("{", idx);
      let depth = 0;
      let i = openBrace;
      for (; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") {
          depth--;
          if (depth === 0) break;
        }
      }
      blocks.push(src.slice(openBrace + 1, i));
      searchFrom = i + 1;
    }
    return blocks;
  }

  it(".chq-portal-shell has no top-level rule -- desktop stays untouched", () => {
    expect(topLevelRuleBody(CSS, "\\.chq-portal-shell")).toBeUndefined();
  });

  it("all four region rules live inside the 700px block", () => {
    const blocks = extract700Blocks(CSS);
    const joined = blocks.join("\n");
    expect(joined).toMatch(/\.chq-portal-shell\s*\{[^}]*min-height:\s*100dvh[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*\}/);
    expect(joined).toMatch(/\.chq-portal-shell\s*>\s*\.chq-header\s*\{[^}]*flex-shrink:\s*0[^}]*\}/);
    expect(joined).toMatch(/\.chq-portal-shell\s*>\s*\.chq-measure\s*\{[^}]*flex:\s*1[^}]*min-height:\s*0[^}]*overflow-y:\s*auto[^}]*\}/);
    expect(joined).toMatch(/\.chq-portal-shell\s*>\s*\.chq-portal-footer\s*\{[^}]*flex-shrink:\s*0[^}]*border-top:\s*1px solid var\(--chq-ink\)[^}]*background:\s*var\(--chq-surface-sunk\)[^}]*padding:\s*12px 16px 16px[^}]*\}/);
  });

  it("declares no colour literal (DEC-383): only var(--chq-*) tokens, no hex/rgb", () => {
    const withoutComments = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const hexMatches = withoutComments.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    const rgbMatches = withoutComments.match(/\brgba?\(/g) ?? [];
    expect(hexMatches).toEqual([]);
    expect(rgbMatches).toEqual([]);
  });
});
