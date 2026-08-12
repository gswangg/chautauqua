// DEC-382: the three operator surfaces (landing, /docs/api, dev mailbox
// list + detail) share TOOLS_CSS and the shell pattern (header + wordmark,
// <main class="chq-measure">, etc). This pins the DEC-374 escaping trap --
// TOOLS_CSS (like THEME_CSS) must be inlined via dangerouslySetInnerHTML,
// never as a hono/jsx text child, or quoted CSS values round-trip as HTML
// entities -- and confirms each page uses the shared shell.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { rootRoutes } from "../src/routes/root";
import { docsRoutes } from "../src/routes/docs";

const EMAIL_LOG_ROW = {
  id: "email-1",
  eventId: "event-1",
  eventName: "Arbitrary Con",
  templateId: null,
  contactId: "ct-1",
  toEmail: "ada@org.test",
  subject: "Welcome",
  bodyText: "Hi",
  bodyHtml: "<p>hi <script>alert(1)</script></p>",
  icsText: null,
  icsFilename: null,
  provider: "dev",
  status: "sent",
  sentAt: 1700000000000,
};

vi.mock("../src/server/repo/email", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/email")>("../src/server/repo/email");
  return {
    ...actual,
    listEmailLog: vi.fn(async () => ({ items: [EMAIL_LOG_ROW], total: 1 })),
    getEmailLogById: vi.fn(async () => EMAIL_LOG_ROW),
  };
});

const { devMailboxRoutes } = await import("../src/routes/dev/mailbox");

function fakeAssets(): Fetcher {
  return {
    async fetch() {
      return new Response("<html>admin shell</html>", { status: 200, headers: { "content-type": "text/html" } });
    },
  } as unknown as Fetcher;
}

function fakeDbWithSlug(slug: string | null) {
  return {
    select: () => ({
      from: () => ({
        orderBy: () => ({
          limit: async () => (slug ? [{ slug }] : []),
        }),
      }),
    }),
  } as unknown as import("../src/server/context").Db;
}

function buildRootApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", fakeDbWithSlug(null));
    await next();
  });
  app.route("/", rootRoutes);
  registerErrorHandler(app);
  return app;
}

function buildDocsApp() {
  const app = new Hono<AppEnv>();
  app.route("/", docsRoutes);
  return app;
}

function buildMailboxApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as never);
    await next();
  });
  app.route("/", devMailboxRoutes);
  return app;
}

/** Extracts every <style>...</style> block's inner text (there are two per
 * page: ThemeStyles() then ToolsStyles()) and concatenates them. */
function styleText(body: string): string {
  const matches = [...body.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
  expect(matches.length).toBeGreaterThan(0);
  return matches.map((m) => m[1]).join("\n");
}

const PAGES: { name: string; fetch: () => Promise<Response> }[] = [
  {
    name: "landing (/)",
    fetch: async () => buildRootApp().request("/", {}, { ASSETS: fakeAssets() }),
  },
  {
    name: "docs (/docs/api)",
    fetch: async () => buildDocsApp().request("/docs/api"),
  },
  {
    name: "mailbox list (/dev/mailbox)",
    fetch: async () => buildMailboxApp().request("/dev/mailbox"),
  },
  {
    name: "mailbox detail (/dev/mailbox/:id)",
    fetch: async () => buildMailboxApp().request("/dev/mailbox/email-1"),
  },
];

describe("Operator SSR surfaces (DEC-382)", () => {
  it.each(PAGES)("$name: style text is unescaped (DEC-374) and never HTML-entity-corrupted", async ({ fetch }) => {
    const res = await fetch();
    expect(res.status).toBe(200);
    const body = await res.text();
    const css = styleText(body);
    expect(css).toContain("Familjen Grotesk");
    expect(css).not.toContain("&#39;");
    expect(css).not.toContain("&quot;");
    expect(css).not.toContain("&gt;");
  });

  it.each(PAGES)("$name: uses the shared .chq-header shell with the lowercase wordmark", async ({ fetch }) => {
    const res = await fetch();
    const body = await res.text();
    expect(body).toContain('class="chq-header"');
    expect(body).toContain('class="chq-wordmark"');
    expect(body).toContain(">chautauqua<");
  });

  it("mailbox detail still emits the sandboxed iframe (SPEC §6: never render recipient HTML inline)", async () => {
    const res = await buildMailboxApp().request("/dev/mailbox/email-1");
    const body = await res.text();
    expect(body).toContain("<iframe");
    expect(body).toContain('sandbox=""');
    expect(body).toContain("srcdoc=");
    // The raw <script> from bodyHtml must appear only inside the escaped
    // srcdoc attribute value, never as a live tag in the page's own DOM.
    expect(body).not.toMatch(/<script>alert\(1\)<\/script>/);
  });
});
