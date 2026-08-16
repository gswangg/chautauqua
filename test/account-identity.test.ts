// DEC-456: account identity is answered by contact_id (or email), never
// email alone.
//
//  1. patchContact cascades a changed contact email onto its linked user
//     row (login-by-email stays in sync).
//  2. patchContact rejects (409, no writes) a patch to an email already
//     owned by a *different* account.
//  3. comms compose's portal-link resolution (resolvePortalLinks) and POST
//     /claim/:token both key off contact_id, not just email — a desynced
//     contact.email vs user.email still resolves to "has an account" via
//     contact_id.
//  4. findAccountUserId still finds the account after a merge repoints
//     user.contact_id onto the surviving contact.
//
// Uses the fake-db-chain / select-queue pattern from
// test/contacts-merge-integrity.test.ts and the table-identity-dispatch
// fakeDb from test/claim.test.ts (no D1 test harness exists in stage 1 —
// see package.json / test/public.test.ts's header comment). All vi.mock
// calls live at module top level (vitest hoists them above everything
// else regardless of source position — per-test variation is done via
// vi.mocked(...).mockImplementation inside each test, never via a second
// vi.mock call for the same path).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { patchContact } from "../src/server/repo/contacts/crud";
import { findAccountUserId } from "../src/server/repo/comms";
import { ApiError } from "../src/server/http";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";
import type { Db } from "../src/server/context";

const EVENT = {
  id: "evt-1",
  orgId: "org-a",
  name: "DevCon",
  slug: "devcon",
  startDate: "2026-01-01",
  endDate: "2026-01-02",
  location: null,
  timezone: "UTC",
  recordPrefix: "DEV",
  branding: null,
  createdAt: 0,
  updatedAt: 0,
};

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return { ...actual, getEventForOrg: vi.fn(async () => EVENT) };
});

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  const findAccountUserIdMock = vi.fn(actual.findAccountUserId);
  return {
    ...actual,
    loadComposeSubmissions: vi.fn(async () => []),
    listFeedbackComments: vi.fn(async () => []),
    listFeedbackCommentsForSubmissions: vi.fn(async () => new Map()),
    // DEC-912: buildRenderTargets now unconditionally loads schedule data
    // for `scheduled` — unrelated to this file's account-identity scope, so
    // stub it to "nothing scheduled" (an empty map).
    loadIcsScheduleData: vi.fn(async () => new Map()),
    findAccountUserId: findAccountUserIdMock,
    // Batched sibling delegates to the (per-test-overridable) singular mock
    // above so every existing findAccountUserId.mockImplementation(...) in
    // this file drives both code paths identically (DEC-530).
    findAccountUserIds: vi.fn(async (db: unknown, params: { contactId: string; email: string }[]) => {
      const map = new Map<string, string | null>();
      for (const p of params) map.set(p.contactId, await findAccountUserIdMock(db as never, p));
      return map;
    }),
  };
});

// DEC-792: stub the batched outstanding-task lookup used by buildRenderTargets
// for {task_list}/{due_date} — unrelated to this file's account-identity scope.
vi.mock("../src/server/repo/tasks/reminders", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks/reminders")>(
    "../src/server/repo/tasks/reminders",
  );
  return {
    ...actual,
    listOutstandingForEvent: vi.fn(async () => []),
  };
});

function contactRaw(id: string, email: string) {
  return {
    id,
    orgId: "org-a",
    firstName: "Jane",
    lastName: "Doe",
    email,
    phone: null,
    company: null,
    title: null,
    bio: null,
    headshotUrl: null,
    socialLinksJson: null,
    notes: null,
    customFieldsJson: null,
    createdAt: new Date(1000),
    updatedAt: new Date(1000),
  };
}

/** Feeds successive db.select() calls the queued row sets, in order, and
 * records every update() write (table object + values). */
function selectQueueDb(selectQueue: unknown[][]) {
  let call = 0;
  const updates: { table: unknown; vals: unknown }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: async () => rows,
        then: (resolve: (v: unknown[]) => void) => resolve(rows),
      };
      return chain;
    },
    update: (table: unknown) => ({
      set: (vals: unknown) => ({
        where: async () => {
          updates.push({ table, vals });
        },
      }),
    }),
  };
  return { db: db as Db, updates };
}

describe("patchContact cascades email onto the linked user row (DEC-456)", () => {
  it("updates contact.email and user.email (lowercased) when no conflict exists", async () => {
    const current = contactRaw("ct-1", "old@example.com");
    const updated = contactRaw("ct-1", "New@Example.com");
    const { db, updates } = selectQueueDb([
      [current], // findContactById (pre-patch read)
      [], // conflict check: no user owns New@Example.com
      [updated], // findContactById (post-update read-back)
    ]);

    const result = await patchContact(db, "ct-1", { email: "New@Example.com" });
    expect(result.id).toBe("ct-1");

    const contactUpdate = updates.find((u) => u.table === schema.contact);
    expect((contactUpdate?.vals as { email?: string }).email).toBe("New@Example.com");

    // The linked user row's email is cascaded, lowercased — this is exactly
    // the value a subsequent login's lower(email)=lower(input) lookup keys
    // off, so login with the new address now succeeds.
    const userUpdate = updates.find((u) => u.table === schema.user);
    expect(userUpdate).toBeDefined();
    expect((userUpdate?.vals as { email?: string }).email).toBe("new@example.com");
  });

  it("rejects (409 conflict) a patch to an email already owned by a different account, and writes nothing", async () => {
    const current = contactRaw("ct-1", "old@example.com");
    const conflictingUser = { id: "user-2", contactId: "ct-2" };
    const { db, updates } = selectQueueDb([
      [current], // findContactById (pre-patch read)
      [conflictingUser], // conflict check: a DIFFERENT contact's user owns this email
    ]);

    let caught: unknown;
    try {
      await patchContact(db, "ct-1", { email: "taken@example.com" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("conflict");

    // Nothing was written — the conflict is caught before any update.
    expect(updates).toHaveLength(0);
  });

  it("does not treat a same-contact re-save of its own (differently-cased) address as a conflict", async () => {
    const current = contactRaw("ct-1", "same@example.com");
    const updated = contactRaw("ct-1", "same@example.com");
    const { db, updates } = selectQueueDb([
      [current], // findContactById (pre-patch read)
      // No conflict-check select queued: newEmailLower === current lower,
      // so patchContact must skip the conflict check entirely.
      [updated], // findContactById (post-update read-back)
    ]);

    const result = await patchContact(db, "ct-1", { email: "Same@Example.com" });
    expect(result.id).toBe("ct-1");
    // Same-address re-save still cascades onto the user row (harmless — the
    // lowercased value is unchanged), but must not throw.
    expect(updates.find((u) => u.table === schema.contact)).toBeDefined();
  });
});

describe("portal-link resolution keys off contact_id, not email alone (DEC-456)", () => {
  const ORG_A = "org-a";
  const ORIGIN = "https://events.example.com";

  class InMemoryKV implements KVStore {
    private readonly store = new Map<string, string>();
    async get(key: string): Promise<string | null> {
      return this.store.get(key) ?? null;
    }
    async put(key: string, value: string): Promise<void> {
      this.store.set(key, value);
    }
    async delete(key: string): Promise<void> {
      this.store.delete(key);
    }
  }

  const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: ORG_A };

  afterEach(() => {
    vi.mocked(findAccountUserId).mockReset();
  });

  it("resolves /portal (not a claim link) for a contact whose email is out of sync with its account", async () => {
    const { loadComposeSubmissions } = await import("../src/server/repo/comms");
    vi.mocked(loadComposeSubmissions).mockResolvedValueOnce([
      {
        id: "sub-1",
        title: "On Engines",
        seq: 1,
        participants: [{ contactId: "ct-desynced", firstName: "Ada", lastName: "Lovelace", email: "ada-new@example.com" }],
      },
    ]);
    // A desynced contact: contact.email has drifted from the linked
    // user's own stored email. findAccountUserId is stubbed to hit on
    // contactId alone here (the real DB-level contact_id-OR-email query is
    // exercised directly by the "findAccountUserId" describe block below)
    // — this proves the compose preview's portal-link resolution threads contactId through, rather
    // than the old email-only lookup that would have missed this account
    // and wrongly minted a claim link for an existing user.
    vi.mocked(findAccountUserId).mockImplementation(async (_db, params) =>
      params.contactId === "ct-desynced" ? "user-ada" : null,
    );

    const { commsRoutes } = await import("../src/routes/comms");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", organizerAuth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/", commsRoutes);

    const kv = new InMemoryKV();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({
          submissionIds: ["sub-1"],
          subject: "Update on {talk_title}",
          bodyText: "Hi {speaker_name}, see {portal_link}.",
        }),
      },
      {
        KV: kv as unknown as AppEnv["Bindings"]["KV"],
        PUBLIC_BASE_URL: "https://events.example.com",
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { contactId: string; text: string }[] };
    const item = body.items.find((i) => i.contactId === "ct-desynced");
    expect(item?.text).toContain(`${ORIGIN}/portal`);
    expect(item?.text).not.toMatch(/claim/);
  });
});

describe("POST /claim/:token redirects to /login (not a duplicate insert) for a desynced contact (DEC-456)", () => {
  const CONTACT_ID = "ct_desynced";
  const ORG_ID = "org_1";
  // The contact's *current* email has drifted from the account's original
  // email — DEC-456 must still recognize this contact already has an
  // account via contact_id.
  const CONTACT_EMAIL = "drifted@example.test";

  class InMemoryKV implements KVStore {
    private readonly store = new Map<string, string>();
    async get(key: string): Promise<string | null> {
      return this.store.get(key) ?? null;
    }
    async put(key: string, value: string): Promise<void> {
      this.store.set(key, value);
    }
    async delete(key: string): Promise<void> {
      this.store.delete(key);
    }
  }

  beforeEach(() => {
    vi.mocked(findAccountUserId).mockImplementation(async (_db, params) =>
      params.contactId === CONTACT_ID ? "user-existing" : null,
    );
  });

  afterEach(() => {
    vi.mocked(findAccountUserId).mockReset();
  });

  function makeFakeDb(opts: { contacts: unknown[] }) {
    const state = { contacts: [...opts.contacts] };
    const inserted: Array<{ table: unknown; row: unknown }> = [];
    // DEC-948: checkAndIncrementScopedLimit's atomic D1 upsert against its
    // own `rate_limit` row — dispatched separately from `inserted`, which
    // this file's one test asserts stays empty for "no second user row".
    const rateLimitRows = new Map<string, { count: number; expiresAt: number }>();
    return {
      db: {
        select() {
          return {
            from(table: unknown) {
              return {
                where() {
                  return {
                    limit() {
                      if (table === schema.contact) return Promise.resolve(state.contacts);
                      if (table === schema.rateLimit) return Promise.resolve([]);
                      throw new Error("unexpected table in fake db select");
                    },
                  };
                },
              };
            },
          };
        },
        insert(table: unknown) {
          return {
            values(row: unknown) {
              if (table === schema.rateLimit) {
                const vals = row as { key: string; count: number; expiresAt: number };
                return {
                  onConflictDoUpdate: () => ({
                    returning: async () => {
                      const existing = rateLimitRows.get(vals.key);
                      if (existing) {
                        existing.count += 1;
                        return [{ count: existing.count }];
                      }
                      rateLimitRows.set(vals.key, { count: vals.count, expiresAt: vals.expiresAt });
                      return [{ count: vals.count }];
                    },
                    then: (resolve: (v: undefined) => void) => {
                      const existing = rateLimitRows.get(vals.key);
                      if (existing) existing.count += 1;
                      else rateLimitRows.set(vals.key, { count: vals.count, expiresAt: vals.expiresAt });
                      resolve(undefined);
                    },
                  }),
                };
              }
              inserted.push({ table, row });
              return Promise.resolve();
            },
          };
        },
        delete(table: unknown) {
          return {
            where() {
              if (table === schema.rateLimit) return Promise.resolve();
              throw new Error("unexpected table in fake db delete");
            },
          };
        },
        // DEC-949 (wave 46 amendment): POST /claim/:token now issues
        // refundScopedLimit (db.update) once the token resolves.
        update(table: unknown) {
          return {
            set() {
              return {
                where() {
                  if (table === schema.rateLimit) return Promise.resolve();
                  throw new Error("unexpected table in fake db update");
                },
              };
            },
          };
        },
      } as unknown as AppEnv["Variables"]["db"],
      inserted,
    };
  }

  async function getCsrf(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }, path: string) {
    const res = await app.request(path, {}, env);
    const setCookie = res.headers.get("set-cookie") ?? "";
    const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie set on ${path}`);
    return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
  }

  it("redirects to /login without inserting a second user row for the same contact_id", async () => {
    const kv = new InMemoryKV();
    const { authRoutes } = await import("../src/routes/auth");
    const { createClaimToken, readClaimToken } = await import("../src/auth/claim");

    const { db, inserted } = makeFakeDb({
      contacts: [{ id: CONTACT_ID, orgId: ORG_ID, email: CONTACT_EMAIL }],
    });
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", authRoutes);
    const env = { KV: kv as unknown as AppEnv["Bindings"]["KV"] };

    const token = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });
    const { csrf, cookie } = await getCsrf(app, env, `/claim/${token}`);

    const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, password: "a-valid-password" });
    const res = await app.request(
      `/claim/${token}`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie },
        body: form.toString(),
      },
      env,
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
    expect(inserted).toHaveLength(0);

    // The token stays unconsumed (DEC-064): still readable directly.
    await expect(readClaimToken(kv, token)).resolves.toEqual({ contactId: CONTACT_ID, eventId: "ev_1" });
  });
});

describe("findAccountUserId still finds the account after a merge repoints user.contact_id (DEC-456)", () => {
  beforeEach(async () => {
    // These tests exercise the REAL findAccountUserId (the module mock
    // above only stubs loadComposeSubmissions/listFeedbackComments; here
    // we restore findAccountUserId's genuine implementation in case an
    // earlier describe block left a stub in place).
    const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
    vi.mocked(findAccountUserId).mockImplementation(actual.findAccountUserId);
  });

  afterEach(() => {
    vi.mocked(findAccountUserId).mockReset();
  });

  it("resolves via contact_id even when the merge-surviving contact's email differs from the account's email", async () => {
    // Post-merge: user.contact_id now points at the surviving contact
    // ct-keep, but the user's own email is still the pre-merge address —
    // findAccountUserId (the real, un-mocked implementation) must still
    // resolve it via contact_id.
    const { db } = selectQueueDb([[{ id: "user-repointed", contactId: "ct-keep", email: "pre-merge-address@example.com" }]]);
    const userId = await findAccountUserId(db, { contactId: "ct-keep", email: "some-other-address@example.com" });
    expect(userId).toBe("user-repointed");
  });

  it("returns null when neither contact_id nor email matches any account", async () => {
    const { db } = selectQueueDb([[]]);
    const userId = await findAccountUserId(db, { contactId: "ct-orphan", email: "nobody@example.com" });
    expect(userId).toBeNull();
  });
});
