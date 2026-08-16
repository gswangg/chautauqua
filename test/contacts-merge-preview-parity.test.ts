// DEC-026 wave-47 amendment (closes CONFIRMED-DEFECT #2, verification-log
// 0234): GET /contacts/merge/preview used to run only previewMerge +
// countMergeImpact, so a producer could see a clean field-by-field preview
// of a merge POST /contacts/merge would then refuse (a second login account
// on the pair, or an email already claimed by another account). Both routes
// now run the SAME repo.checkMergeConflicts preflight (extracted from
// mergeContacts, not a parallel copy) -- this file asserts PARITY directly:
// a fixture that makes the POST refuse 409s with a given code/message makes
// the preview return `blocked` with that identical code/message, and a
// clean fixture returns `blocked: null` from the preview.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import { MERGE_BOTH_LOGINS_MESSAGE, MERGE_EMAIL_TAKEN_MESSAGE } from "../src/server/repo/contacts/merge-preflight";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

function contactRaw(id: string, email: string) {
  return {
    id,
    orgId: ORG_A,
    firstName: "First",
    lastName: "Last",
    email,
    phone: null,
    company: null,
    title: null,
    bio: null,
    headshotUrl: null,
    headshotFileId: null,
    socialLinksJson: null,
    notes: null,
    customFieldsJson: null,
    externalRef: null,
    createdAt: new Date(1000),
    updatedAt: new Date(1000),
  };
}

const KEEP = contactRaw("contact-keep", "jane@example.com");
const DUP = contactRaw("contact-dup", "jane@example.com");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

function appWithDbAndAuth(db: AppEnv["Variables"]["db"], auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", contactsRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

function jsonRequest(method: string, path: string, body?: unknown) {
  return new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("merge preview / write preflight parity (DEC-026 wave-47 amendment)", () => {
  it("both contacts holding a login account: POST 409s, and preview reports the identical blocked code/message (not a clean preview)", async () => {
    const postDb = fakeDb([
      [KEEP, DUP], // requireOwnedContacts
      [KEEP], // checkMergeConflicts findContactById(keep)
      [DUP], // checkMergeConflicts findContactById(dup)
      [{ contactId: KEEP.id }, { contactId: DUP.id }], // contactIdsWithLogin -- BOTH hold a login
      [], // emailOwners
    ]);
    const postApp = appWithDbAndAuth(postDb, ORGANIZER_A);
    const postRes = await postApp.request(
      jsonRequest("POST", "/api/v1/contacts/merge", { keepId: KEEP.id, mergeIds: [DUP.id] }),
    );
    expect(postRes.status).toBe(409);
    const postJson = (await postRes.json()) as { error: { code: string; message: string } };
    expect(postJson.error.message).toBe(MERGE_BOTH_LOGINS_MESSAGE);

    const previewDb = fakeDb([
      [KEEP, DUP], // requireOwnedContacts
      [], // countMergeImpact participants
      [], // countMergeImpact tasks
      [KEEP], // checkMergeConflicts findContactById(keep)
      [DUP], // checkMergeConflicts findContactById(dup)
      [{ contactId: KEEP.id }, { contactId: DUP.id }], // contactIdsWithLogin -- BOTH hold a login
      [], // emailOwners
    ]);
    const previewApp = appWithDbAndAuth(previewDb, ORGANIZER_A);
    const previewRes = await previewApp.request(
      new Request(`http://local/api/v1/contacts/merge/preview?ids=${DUP.id}&keep=${KEEP.id}`),
    );
    // A preview describes, including describing a refusal -- it stays 200,
    // never a 409, unlike the write.
    expect(previewRes.status).toBe(200);
    const previewJson = (await previewRes.json()) as {
      blocked: { code: string; message: string } | null;
    };
    expect(previewJson.blocked).not.toBeNull();
    expect(previewJson.blocked!.code).toBe("both_logins");
    expect(previewJson.blocked!.message).toBe(postJson.error.message);
  });

  it("keeper's email already claimed by an out-of-list account: POST 409s, and preview reports the identical blocked code/message", async () => {
    const OTHER_OWNER_ID = "contact-someone-else";
    const postDb = fakeDb([
      [KEEP, DUP], // requireOwnedContacts
      [KEEP], // checkMergeConflicts findContactById(keep)
      [DUP], // checkMergeConflicts findContactById(dup)
      [], // contactIdsWithLogin -- nobody in the merge set holds a login
      [{ email: KEEP.email, contactId: OTHER_OWNER_ID }], // emailOwners -- keep's email is owned OUTSIDE the merge set
    ]);
    const postApp = appWithDbAndAuth(postDb, ORGANIZER_A);
    const postRes = await postApp.request(
      jsonRequest("POST", "/api/v1/contacts/merge", { keepId: KEEP.id, mergeIds: [DUP.id] }),
    );
    expect(postRes.status).toBe(409);
    const postJson = (await postRes.json()) as { error: { code: string; message: string } };
    expect(postJson.error.message).toBe(MERGE_EMAIL_TAKEN_MESSAGE);

    const previewDb = fakeDb([
      [KEEP, DUP], // requireOwnedContacts
      [], // countMergeImpact participants
      [], // countMergeImpact tasks
      [KEEP], // checkMergeConflicts findContactById(keep)
      [DUP], // checkMergeConflicts findContactById(dup)
      [], // contactIdsWithLogin
      [{ email: KEEP.email, contactId: OTHER_OWNER_ID }], // emailOwners
    ]);
    const previewApp = appWithDbAndAuth(previewDb, ORGANIZER_A);
    const previewRes = await previewApp.request(
      new Request(`http://local/api/v1/contacts/merge/preview?ids=${DUP.id}&keep=${KEEP.id}`),
    );
    expect(previewRes.status).toBe(200);
    const previewJson = (await previewRes.json()) as {
      blocked: { code: string; message: string } | null;
    };
    expect(previewJson.blocked).not.toBeNull();
    expect(previewJson.blocked!.code).toBe("email_taken");
    expect(previewJson.blocked!.message).toBe(postJson.error.message);
  });

  it("clean fixture (no logins, no foreign email claim): POST succeeds, and preview reports blocked: null", async () => {
    const previewDb = fakeDb([
      [KEEP, DUP], // requireOwnedContacts
      [], // countMergeImpact participants
      [], // countMergeImpact tasks
      [KEEP], // checkMergeConflicts findContactById(keep)
      [DUP], // checkMergeConflicts findContactById(dup)
      [], // contactIdsWithLogin
      [], // emailOwners
    ]);
    const previewApp = appWithDbAndAuth(previewDb, ORGANIZER_A);
    const previewRes = await previewApp.request(
      new Request(`http://local/api/v1/contacts/merge/preview?ids=${DUP.id}&keep=${KEEP.id}`),
    );
    expect(previewRes.status).toBe(200);
    const previewJson = (await previewRes.json()) as {
      blocked: { code: string; message: string } | null;
    };
    expect(previewJson.blocked).toBeNull();
  });
});
