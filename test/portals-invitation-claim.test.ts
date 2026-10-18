// Multi-portal flow 8: an invited speaker with no account accepts from the
// emailed link and is asked to set a password (the Portals frame: "accepting
// asks her to set a password"). The password page speaks to an invitee --
// "You've accepted" -- not the CFP submitter's "track your submission".
// Runs the real routes on the migrated schema (node:sqlite).
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { hashClaimToken, parseClaimRecord } from "../src/auth/claim";
import { parseIndexMounts } from "./helpers/index-mounts";
import { addContact, addEvent, addOrg, addParticipant, addSession, makePortalsFixture, type Fixture } from "./helpers/portals-fixture";

const ORG = "ic-org";
const EVENT = "ic-event";
const TOKEN = "ic-invitation-token-0123456789";

async function seed(f: Fixture): Promise<void> {
  addOrg(f, ORG);
  addEvent(f, EVENT, ORG);
  addContact(f, "ic-ruth", ORG, "Ruth Adeyemi");
  addSession(f, "ic-panel", EVENT, { title: "Platform panel", origin: "invited" });
  addParticipant(f, "ic-part", "ic-panel", "ic-ruth", { role: "panelist", inviteStatus: "invited" });
  f.run(`update participant set invitation_token_hash = ? where id = 'ic-part'`, await hashClaimToken(TOKEN));
}

async function buildApp(f: Fixture, kv: Map<string, string>) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", f.db);
    c.env = {
      ...(c.env ?? {}),
      KV: {
        get: async (k: string) => kv.get(k) ?? null,
        put: async (k: string, v: string) => void kv.set(k, v),
        delete: async (k: string) => void kv.delete(k),
      },
    } as never;
    await next();
  });
  registerErrorHandler(app);
  for (const { prefix, subApp } of await parseIndexMounts()) app.route(prefix, subApp);
  return app;
}

describe("invited-speaker acceptance · no account yet", () => {
  it("accepting mints an invitation claim whose password page says the invitation was accepted", async () => {
    const f = makePortalsFixture();
    await seed(f);
    const kv = new Map<string, string>();
    const app = await buildApp(f, kv);

    const accept = await app.request(`/portal/invitations/${TOKEN}/accept`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: "chq_csrf=ic-csrf" },
      body: "chq_csrf=ic-csrf",
    });
    expect(accept.status).toBe(302);
    const location = accept.headers.get("location") ?? "";
    expect(location).toMatch(/^\/claim\/[A-Za-z0-9_-]+$/);
    expect(f.all<{ invite_status: string }>(`select invite_status from participant where id = 'ic-part'`)[0]?.invite_status).toBe("accepted");

    const page = await app.request(location);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("You&#39;ve accepted. Create a password to open your speaker portal");
    expect(html).not.toContain("track your submission");
  });

  it("a claim record keeps only the invitation purpose; anything else reads as a plain claim", () => {
    expect(parseClaimRecord(JSON.stringify({ contactId: "c1", eventId: "e1", purpose: "invitation" }))).toEqual({
      contactId: "c1",
      eventId: "e1",
      purpose: "invitation",
    });
    expect(parseClaimRecord(JSON.stringify({ contactId: "c1", eventId: "e1", purpose: "admin" }))).toEqual({ contactId: "c1", eventId: "e1" });
  });
});
