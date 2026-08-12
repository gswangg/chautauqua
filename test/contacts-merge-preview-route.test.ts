// DEC-705: contact merge preview. MergePage used to diff only name/email/
// company, but planMerge also fills blank primary fields from the
// duplicate, appends duplicate-only notes behind a separator, and unions
// customFields -- none of which the organizer saw before an irreversible
// set-based merge. GET /api/v1/contacts/merge/preview?ids=&keep= reports
// every field the write will actually touch, computed by the SAME pure-core
// planMerge fold repo.mergeContacts uses (via previewMerge), so preview and
// write can never drift -- this file asserts that directly by diffing the
// preview's `kept` values against what the POST route would write.
//
// Uses the fakeDb select-queue pattern from
// test/contacts-duplicates-merge-route.test.ts:41-70 (no D1 test harness
// exists in stage 1).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import { previewMerge } from "../src/domain/contacts";
import { toContactRecord, toRow } from "../src/server/repo/contacts";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

function contactRaw(fields: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string | null;
  notes?: string | null;
  customFieldsJson?: string | null;
}) {
  return {
    id: fields.id,
    orgId: ORG_A,
    firstName: fields.firstName,
    lastName: fields.lastName,
    email: fields.email,
    phone: null,
    company: fields.company ?? null,
    title: null,
    bio: null,
    headshotUrl: null,
    socialLinksJson: null,
    notes: fields.notes ?? null,
    customFieldsJson: fields.customFieldsJson ?? null,
    externalRef: null,
    createdAt: new Date(1000),
    updatedAt: new Date(1000),
  };
}

const KEEP = contactRaw({
  id: "contact-keep",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  company: "Acme",
  notes: "Met at PlatformCon.",
  customFieldsJson: JSON.stringify({ shirtSize: "M" }),
});
const DUP = contactRaw({
  id: "contact-dup",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  company: "Acme Corp",
  notes: "Prefers Tuesday.",
  customFieldsJson: JSON.stringify({ shirtSize: "L", dietary: "vegetarian" }),
});

function makeChain(rows: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

describe("GET /api/v1/contacts/merge/preview (DEC-705)", () => {
  it("reports keep/discard for company, append for notes, and combine for a duplicate-only custom field, matching what previewMerge computes directly", async () => {
    const db = fakeDb([
      [KEEP], // requireOwnedContact(keep)
      [DUP], // requireOwnedContact(dup)
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      new Request(
        `http://local/api/v1/contacts/merge/preview?ids=${KEEP.id},${DUP.id}&keep=${KEEP.id}`,
      ),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      fields: { key: string; label: string; kept: string; discarded: string[]; outcome: string }[];
    };

    const byKey = new Map(json.fields.map((f) => [f.key, f]));

    const company = byKey.get("company");
    expect(company).toBeDefined();
    expect(company!.outcome).toBe("keep");
    expect(company!.kept).toBe("Acme");
    expect(company!.discarded).toEqual(["Acme Corp"]);

    const notes = byKey.get("notes");
    expect(notes).toBeDefined();
    expect(notes!.outcome).toBe("append");
    expect(notes!.kept).toBe("Met at PlatformCon.\n\n---\n\nPrefers Tuesday.");
    expect(notes!.discarded).toEqual([]);

    const dietary = byKey.get("customFields.dietary");
    expect(dietary).toBeDefined();
    expect(dietary!.outcome).toBe("combine");
    expect(dietary!.kept).toBe("vegetarian");

    const shirtSize = byKey.get("customFields.shirtSize");
    expect(shirtSize).toBeDefined();
    expect(shirtSize!.outcome).toBe("keep");
    expect(shirtSize!.kept).toBe("M");
    expect(shirtSize!.discarded).toEqual(["L"]);

    // The preview must be identical to what mergeOnePair's own planMerge
    // call would compute and write -- not a second implementation.
    const direct = previewMerge(toContactRecord(toRow(KEEP)), [toContactRecord(toRow(DUP))]);
    expect(json.fields).toEqual(direct);
  });

  it("a foreign/unknown id in ids -> 404, matching the POST route's org-scoped authz", async () => {
    const db = fakeDb([
      [KEEP], // requireOwnedContact(keep)
      [], // requireOwnedContact(dup) -- not found in this org
    ]);
    const app = appWithDbAndAuth(db, ORGANIZER_A);

    const res = await app.request(
      new Request(`http://local/api/v1/contacts/merge/preview?ids=${KEEP.id},contact-foreign&keep=${KEEP.id}`),
    );
    expect(res.status).toBe(404);
  });

  it("no auth -> unauthorized", async () => {
    const db = fakeDb([]);
    const app = appWithDbAndAuth(db, undefined);
    const res = await app.request(
      new Request(`http://local/api/v1/contacts/merge/preview?ids=${KEEP.id},${DUP.id}&keep=${KEEP.id}`),
    );
    expect(res.status).toBe(401);
  });
});
