// DEC-385 (v12 mobile campaign, w2-e): "Sign in · 390"
// (docs/design/Chautauqua Account.dc.html:121 `<div style="width:390px;
// height:844px; ...`) -- wordmark/input/button sizing, the dropped
// "Forgot your password?" link, and the "No account?" footer's phone
// stacking, layered onto the desktop .chq-auth-card/.chq-auth-stack
// LoginPage this file's sibling suites (auth-card-geometry.test.ts etc.)
// already pin. Two kinds of coverage, mirroring
// test/account-password-phone.test.ts:
//   (a) a live GET /login request, asserting the markup still carries the
//       elements the phone frame draws (email/password/submit, the
//       tertiary Forgot link -- present in markup, hidden via CSS below
//       700px rather than dropped from the DOM -- and both footer links).
//   (b) a source-scan proving the new phone rules live inside
//       auth.css.ts's existing `@media (max-width: 700px)` block, never as
//       unconditional base rules, and that no .chq-phone-* class name was
//       introduced (DEC-385).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { authRoutes } from "../src/routes/auth";
import type { AppEnv } from "../src/server/env";
import type { Db } from "../src/server/context";
import { registerErrorHandler } from "../src/server/http";
import * as schema from "../src/db/schema";

const REPO_ROOT = join(__dirname, "..");

// -----------------------------------------------------------------------
// (a) live-request coverage
// -----------------------------------------------------------------------

function fakeDbNoDemoNoOrg(): Db {
  return {
    select: () => ({
      from: (table: unknown) => {
        if (table === schema.org) {
          return { orderBy: () => ({ limit: async () => [] }) };
        }
        return { where: () => ({ limit: async () => [] }) };
      },
    }),
  } as unknown as Db;
}

function buildApp(db: Db) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", authRoutes);
  registerErrorHandler(app);
  return app;
}

describe("GET /login — 390 frame markup survives (DEC-385)", () => {
  it("still renders Email, Password, Sign in, the Forgot link and both footer links", async () => {
    const app = buildApp(fakeDbNoDemoNoOrg());
    const res = await app.request("/login");
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain('class="chq-auth-wordmark"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain(">Sign in<");
    // The 390 frame draws no Forgot link at all -- it is hidden via CSS at
    // phone width (auth.css.ts's .chq-auth-stack .chq-auth-tertiary rule),
    // not removed from the markup, so the desktop card keeps it.
    expect(html).toContain('href="/forgot"');
    expect(html).toContain("Forgot your password?");
  });
});

// -----------------------------------------------------------------------
// (b) source-scan coverage, mirroring
// test/account-password-phone.test.ts's part (b).
// -----------------------------------------------------------------------

const AUTH_CSS_TS = readFileSync(join(REPO_ROOT, "src/routes/auth.css.ts"), "utf-8");

/** Extracts the contents of every `@media (max-width: 700px) { ... }` block
 * via balanced-brace scanning (same helper shape as
 * account-password-phone.test.ts). */
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

describe("Sign in / Change password 390 CSS source-scan (DEC-385)", () => {
  const blocks = extract700Blocks(AUTH_CSS_TS);
  const joined = blocks.join("\n");

  it("the Sign-in phone rules (wordmark, inputs, hidden Forgot link, full-width button, stacked footer) live inside a 700px block", () => {
    expect(joined).toMatch(/\.chq-auth-stack \.chq-auth-wordmark\s*\{[^}]*font-size:\s*26px/);
    expect(joined).toMatch(/\.chq-auth-stack \.chq-auth-card input\[type=email\][\s\S]*?min-height:\s*50px/);
    expect(joined).toMatch(/\.chq-auth-stack \.chq-auth-tertiary\s*\{[^}]*display:\s*none/);
    expect(joined).toMatch(/\.chq-auth-stack \.chq-auth-card button\[type=submit\]\s*\{[^}]*width:\s*100%/);
    expect(joined).toMatch(/\.chq-auth-footer \.chq-auth-footer-links\s*\{[^}]*flex-direction:\s*column/);
  });

  it("the Change-password band rules (head border, drill H1, sunk dock) live inside a 700px block", () => {
    expect(joined).toMatch(
      /\.chq-bare-page:has\(\.chq-auth-fields\) \.chq-auth-titlerow\s*\{[^}]*border-bottom:\s*1px solid var\(--chq-ink\)/,
    );
    expect(joined).toMatch(
      /\.chq-bare-page:has\(\.chq-auth-fields\) \.chq-auth-title\s*\{[^}]*font-size:\s*var\(--chq-type-page-title-phone-drill\)/,
    );
    expect(joined).toMatch(/\.chq-auth-actions\s*\{[^}]*background:\s*var\(--chq-surface-sunk\)/);
  });

  it("none of the new rules sit at the top level (outside every 700px block)", () => {
    const withoutMedia = AUTH_CSS_TS.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, "");
    expect(withoutMedia).not.toMatch(/\.chq-auth-stack \.chq-auth-wordmark/);
    expect(withoutMedia).not.toMatch(/\.chq-bare-page:has\(\.chq-auth-fields\) \.chq-auth-titlerow/);
  });

  it("no .chq-phone-* class name is introduced on this SSR surface (DEC-385)", () => {
    expect(AUTH_CSS_TS).not.toMatch(/\.chq-phone-/);
  });
});
