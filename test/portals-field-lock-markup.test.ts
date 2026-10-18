// Field permissions reach the browser as the readonly attribute, which HTML
// treats as present whatever its value. Hono's JSX writes a camelCase
// `readOnly={false}` out as readonly="false" (only the lowercase name is a
// known boolean it omits), which locked every profile field for every
// speaker and froze a sponsor session sent back for changes. This renders
// the profile through the real route and pins the markup, and keeps the
// server views free of camelCase boolean props with computed values.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { parseIndexMounts } from "./helpers/index-mounts";
import { ACCEPTED_SESSIONS, addContact, addEvent, addOrg, addParticipant, addPortal, addSession, makePortalsFixture } from "./helpers/portals-fixture";

const ORG = "flm-org";
const EVENT = "flm-event";
const SPEAKER: AuthInfo = { userId: "flm-user", role: "speaker", orgId: ORG, contactId: "flm-priya" };

async function profileHtml(): Promise<string> {
  const f = makePortalsFixture();
  addOrg(f, ORG);
  addEvent(f, EVENT, ORG);
  addContact(f, "flm-priya", ORG, "Priya Raman");
  addSession(f, "flm-talk", EVENT);
  addParticipant(f, "flm-part", "flm-talk", "flm-priya");
  addPortal(f, "flm-portal", EVENT, ACCEPTED_SESSIONS, { name: "CFP speakers", fields: { bio: { level: "view" } } });
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", f.db);
    c.set("auth", SPEAKER);
    await next();
  });
  registerErrorHandler(app);
  for (const { prefix, subApp } of await parseIndexMounts()) app.route(prefix, subApp);
  const res = await app.request("/portal/profile");
  expect(res.status).toBe(200);
  return res.text();
}

function tagFor(html: string, name: string): string {
  return html.match(new RegExp(`<(?:input|textarea)[^>]*name="${name}"[^>]*>`, "i"))?.[0] ?? "";
}

describe("field locks in the rendered markup", () => {
  it("an editable profile field carries no readonly attribute; a locked one does", async () => {
    const html = await profileHtml();
    for (const name of ["firstName", "lastName", "title", "company"]) {
      const tag = tagFor(html, name);
      expect(tag, name).not.toBe("");
      expect(tag, name).not.toMatch(/\breadonly/i);
    }
    expect(tagFor(html, "bio")).toMatch(/\breadonly/i);
  });

  it("no server view passes a computed value to a camelCase boolean attribute", () => {
    const root = join(__dirname, "..", "src");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".tsx")) {
          readFileSync(p, "utf8")
            .split("\n")
            .forEach((line, i) => {
              if (/\b(readOnly|autoFocus|noValidate|formNoValidate|autoPlay|allowFullScreen|playsInline|noModule)=\{/.test(line)) offenders.push(`${p}:${i + 1}`);
            });
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
