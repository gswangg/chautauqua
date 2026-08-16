// CNT-10 (DEC-152, DEC-142, DEC-028): admin editing of speaker bio/social
// links + headshot from the contact drawer. Mirrors headshot-gate.test.ts's
// fake-db pattern (no D1 test harness in stage 1) — a mutable row object
// stands in for the contact table so PATCH/upload writes are observable via
// a subsequent "read".

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

// DEC-894: the dimension gate now runs for webp too, so a webp fixture used
// to exercise a successful upload must be real bytes a RIFF/VP8X reader can
// parse — a minimal extended-format (VP8X) container well under the
// MAX_HEADSHOT_EDGE_PX gate.
// Return type is the narrow ArrayBuffer-backed view (not Uint8Array<ArrayBufferLike>)
// so the bytes are assignable to BlobPart in `new File([...])`.
function minimalWebpBytes(width = 100, height = 100): Uint8Array<ArrayBuffer> {
  const u32le = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  const u24le = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff];
  const payload = [0, 0, 0, 0, ...u24le(width - 1), ...u24le(height - 1)];
  const chunk = [0x56, 0x50, 0x38, 0x58 /* "VP8X" */, ...u32le(payload.length), ...payload];
  const riffSize = 4 + chunk.length;
  const header = [0x52, 0x49, 0x46, 0x46 /* "RIFF" */, ...u32le(riffSize), 0x57, 0x45, 0x42, 0x50 /* "WEBP" */];
  return new Uint8Array([...header, ...chunk]);
}

interface FakeRow {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  title: string | null;
  bio: string | null;
  headshotUrl: string | null;
  socialLinksJson: string | null;
  notes: string | null;
  customFieldsJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function baseRow(): FakeRow {
  return {
    id: "c1",
    orgId: "org1",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: null,
    company: null,
    title: null,
    bio: null,
    headshotUrl: null,
    socialLinksJson: null,
    notes: null,
    customFieldsJson: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function fakeDb(row: FakeRow) {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => [{ ...row }],
  };
  return {
    select: () => chain,
    update: () => ({
      set: (patch: Record<string, unknown>) => ({
        where: async () => {
          Object.assign(row, patch);
        },
      }),
    }),
    insert: () => ({
      values: async () => {
        // file row insert — not asserted on directly; headshot_url below
        // (written by the subsequent update()) is the observable effect.
      },
    }),
  } as unknown as AppEnv["Variables"]["db"];
}

function fakeFilesBucket() {
  const puts: { key: string; contentType?: string }[] = [];
  const bucket = {
    async put(key: string, _data: unknown, opts?: { httpMetadata?: { contentType?: string } }) {
      puts.push({ key, contentType: opts?.httpMetadata?.contentType });
    },
    async get() {
      return null;
    },
    async delete() {},
  } as unknown as R2Bucket;
  return { bucket, puts };
}

function appWithDbAndAuth(db: AppEnv["Variables"]["db"], auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", contactsRoutes);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };

describe("PATCH /contacts/:id bio + socialLinks (CNT-10)", () => {
  it("roundtrips bio and social links through serializeSocialLinks", async () => {
    const row = baseRow();
    const app = appWithDbAndAuth(fakeDb(row), ORGANIZER);

    const res = await app.request("/contacts/c1", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({
        bio: "Speaks about widgets.",
        socialLinks: { twitter: "@jane", linkedin: "", github: "janedoe", website: "https://jane.example" },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { bio: string; socialLinks: Record<string, string> };
    expect(body.bio).toBe("Speaks about widgets.");
    // linkedin was blank -> dropped by serializeSocialLinks in STORAGE, but the
    // wire always carries all four keys as strings (DEC-152 wave-76 amendment):
    // serializeContact derives socialLinks through parseSocialLinks, so a
    // dropped key comes back as "" rather than going missing.
    expect(body.socialLinks).toEqual({ twitter: "@jane", linkedin: "", github: "janedoe", website: "https://jane.example" });
    expect(row.bio).toBe("Speaks about widgets.");
    expect(JSON.parse(row.socialLinksJson!)).toEqual({ twitter: "@jane", github: "janedoe", website: "https://jane.example" });
  });

  it("clears social links when socialLinks is null", async () => {
    const row = baseRow();
    row.socialLinksJson = JSON.stringify({ twitter: "@old" });
    const app = appWithDbAndAuth(fakeDb(row), ORGANIZER);

    const res = await app.request("/contacts/c1", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ socialLinks: null }),
    });
    expect(res.status).toBe(200);
    expect(row.socialLinksJson).toBe("{}");
  });

  it("rejects a non-string social link field", async () => {
    const row = baseRow();
    const app = appWithDbAndAuth(fakeDb(row), ORGANIZER);

    const res = await app.request("/contacts/c1", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ socialLinks: { twitter: 5 } }),
    });
    expect(res.status).toBe(400);
  });

  it("403s a non-organizer (reviewer) session", async () => {
    const row = baseRow();
    const app = appWithDbAndAuth(fakeDb(row), { userId: "u2", role: "reviewer", orgId: "org1" });

    const res = await app.request("/contacts/c1", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ bio: "nope" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /contacts/:id/headshot (CNT-10, mirrors portal headshot validation)", () => {
  async function upload(file: File, db = fakeDb(baseRow()), auth: AuthInfo | undefined = ORGANIZER) {
    const app = appWithDbAndAuth(db, auth);
    const { bucket, puts } = fakeFilesBucket();
    const form = new FormData();
    form.set("headshot", file);
    const res = await app.request(
      "/contacts/c1/headshot",
      { method: "POST", headers: { "x-chq-csrf": "1" }, body: form },
      { FILES: bucket } as unknown as AppEnv["Bindings"],
    );
    return { res, puts };
  }

  it("accepts a valid webp, stores the file, and sets headshot_url", async () => {
    const row = baseRow();
    const db = fakeDb(row);
    const file = new File([minimalWebpBytes()], "me.webp", { type: "image/webp" });
    const { res, puts } = await upload(file, db);
    expect(res.status).toBe(200);
    expect(puts).toHaveLength(1);
    expect(puts[0]!.contentType).toBe("image/webp");
    const body = (await res.json()) as { headshotUrl: string | null };
    expect(body.headshotUrl).toMatch(/^\/headshots\//);
    expect(row.headshotUrl).toBe(body.headshotUrl);
  });

  it("rejects an oversized file (>8MB)", async () => {
    const file = new File([new Uint8Array(9 * 1024 * 1024)], "me.webp", { type: "image/webp" });
    const { res } = await upload(file);
    expect(res.status).toBe(400);
  });

  it("rejects an unsupported content type (pdf)", async () => {
    const file = new File([new Uint8Array(16)], "me.pdf", { type: "application/pdf" });
    const { res } = await upload(file);
    expect(res.status).toBe(400);
  });

  it("403s a non-organizer (speaker) session", async () => {
    const file = new File([new Uint8Array(16)], "me.webp", { type: "image/webp" });
    const { res } = await upload(file, fakeDb(baseRow()), { userId: "u3", role: "speaker", orgId: "org1", contactId: "c1" });
    expect(res.status).toBe(403);
  });
});
