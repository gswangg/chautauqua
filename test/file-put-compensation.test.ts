// DEC-005 amendment (wave 50): putThenRecord is the ONLY sanctioned
// single-object upload path (src/server/context.ts). Unit-tests the helper
// directly with a fake FileStore, then a route-level regression on the
// deliverable-upload path (src/routes/files.ts) proving that when the row
// write throws, the just-written R2 object is deleted before the error
// propagates.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { putThenRecord, type FileStore } from "../src/server/context";

function fakeFileStore(): FileStore & { puts: string[]; deletes: string[] } {
  const puts: string[] = [];
  const deletes: string[] = [];
  return {
    puts,
    deletes,
    async put(key) {
      puts.push(key);
    },
    async get() {
      return null;
    },
    async delete(key) {
      deletes.push(key);
    },
    async deleteMany(keys) {
      deletes.push(...keys);
    },
  };
}

describe("putThenRecord (DEC-005 amendment, wave 50)", () => {
  it("returns record()'s result and never deletes the object on success", async () => {
    const store = fakeFileStore();
    const result = await putThenRecord(store, "k1", new ArrayBuffer(0), "text/plain", async () => "row-id");
    expect(result).toBe("row-id");
    expect(store.puts).toEqual(["k1"]);
    expect(store.deletes).toEqual([]);
  });

  it("deletes the object and rethrows the ORIGINAL error when record() throws", async () => {
    const store = fakeFileStore();
    const original = new Error("row write failed");
    await expect(
      putThenRecord(store, "k2", new ArrayBuffer(0), "text/plain", async () => {
        throw original;
      }),
    ).rejects.toBe(original);
    expect(store.puts).toEqual(["k2"]);
    expect(store.deletes).toEqual(["k2"]);
  });

  it("a cleanup (delete) failure never masks or replaces the original error", async () => {
    const store = fakeFileStore();
    store.delete = async () => {
      throw new Error("R2 delete transiently failed");
    };
    const original = new Error("row write failed");
    await expect(
      putThenRecord(store, "k3", new ArrayBuffer(0), "text/plain", async () => {
        throw original;
      }),
    ).rejects.toBe(original);
  });
});

const ORG_A = "org-a";
const SPEAKER_CONTACT = "contact-speaker";

const scope = {
  submissionId: "sub-1",
  eventId: "event-1",
  orgId: ORG_A,
  readParticipantContactIds: [SPEAKER_CONTACT],
  activeParticipantContactIds: [SPEAKER_CONTACT],
  status: "pending",
  formCloseDate: null,
  timezone: "America/New_York",
};

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getSubmissionScope: vi.fn(async () => scope),
    insertFile: vi.fn(async () => {
      throw new Error("db insert failed");
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function fakeFilesBucket(deleteSpy: (key: string) => void) {
  return {
    async get() {
      return null;
    },
    async put() {},
    // makeFileStore's delete() always calls the R2 binding's delete with a
    // chunk array (deleteMany's single-key convenience path), never a bare
    // string key.
    async delete(keys: string[]) {
      keys.forEach(deleteSpy);
    },
  } as unknown as R2Bucket;
}

describe("POST /api/v1/submissions/:id/files compensates a failed row write", () => {
  it("deletes the R2 object it just wrote when insertFile throws, and the 500 propagates", async () => {
    const { fileApiRoutes } = await import("../src/routes/files");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    const auth: AuthInfo = { userId: "u-speaker", role: "speaker", orgId: ORG_A, contactId: SPEAKER_CONTACT };
    let deletedKey: string | undefined;
    app.use("*", async (c, next) => {
      c.set("auth", auth);
      c.set("db", {} as never);
      c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket((key) => (deletedKey = key)) } as never;
      await next();
    });
    app.route("/api/v1", fileApiRoutes);

    const form = new FormData();
    form.set("file", new File(["hello world"], "deck.pdf", { type: "application/pdf" }));
    form.set("kind", "presentation");
    const res = await app.request("/api/v1/submissions/sub-1/files", {
      method: "POST",
      headers: { "x-chq-csrf": "1" },
      body: form,
    });

    expect(res.status).toBe(500);
    expect(deletedKey).toBeDefined();
    expect(deletedKey).toMatch(/^sub\/sub-1\//);
  });
});
