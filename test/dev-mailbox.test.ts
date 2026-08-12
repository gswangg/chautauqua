import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../src/server/env";

const EMAIL_LOG_ROW = {
  id: "email-1",
  eventId: "event-1",
  eventName: "Arbitrary Con",
  templateId: null,
  contactId: "ct-1",
  toEmail: "ada@org.test",
  subject: "Welcome",
  bodyText: "Hi",
  bodyHtml: null,
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

const { shouldMountDevMailbox, devMailboxRoutes } = await import("../src/routes/dev/mailbox");

describe("shouldMountDevMailbox (DEC-005 mounting predicate)", () => {
  it("mounts only when DEV_MODE is exactly '1'", () => {
    expect(shouldMountDevMailbox({ DEV_MODE: "1" })).toBe(true);
  });

  it("does not mount when DEV_MODE is unset", () => {
    expect(shouldMountDevMailbox({})).toBe(false);
  });

  it("does not mount for any other DEV_MODE value", () => {
    expect(shouldMountDevMailbox({ DEV_MODE: "true" })).toBe(false);
    expect(shouldMountDevMailbox({ DEV_MODE: "0" })).toBe(false);
    expect(shouldMountDevMailbox({ DEV_MODE: "" })).toBe(false);
    expect(shouldMountDevMailbox({ DEV_MODE: "yes" })).toBe(false);
  });
});

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as never);
    c.set("auth", { userId: "u-1", role: "organizer", orgId: "org-1" });
    await next();
  });
  app.route("/", devMailboxRoutes);
  return app;
}

describe("GET /dev/mailbox rendering (DEC-311/253 mobile overflow fix)", () => {
  it("ships a viewport meta tag and a scrollable table wrapper on the list page", async () => {
    const app = buildApp();
    const res = await app.request("/dev/mailbox");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<meta name="viewport" content="width=device-width, initial-scale=1"');
    expect(body).toContain("chq-tool-table-wrap");
    expect(body).toContain("overflow-x: auto");
  });

  it("ships a viewport meta tag and wrapped <pre> blocks on the detail page", async () => {
    const app = buildApp();
    const res = await app.request("/dev/mailbox/email-1");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<meta name="viewport" content="width=device-width, initial-scale=1"');
    expect(body).toContain("overflow-wrap: anywhere");
  });
});
