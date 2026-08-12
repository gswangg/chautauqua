// DEC-543: listEmailLog must use a narrow LIST projection (no
// bodyText/bodyHtml/icsText/icsFilename -- neither list renderer displays
// them, and bodyText/bodyHtml can be up to MAX_RICH_TEXT_LENGTH each), while
// getEmailLogById keeps the full projection for the dev mailbox detail page
// and its .ics download.
//
// This asserts the ABSENCE against the actual *selected-column object* the
// db receives (not just the returned row shape), so the guard survives a
// schema rename per the field guide's "check the selected-column object the
// fake db receives" note: a renamed column would still show up as a key in
// the object passed to `db.select(...)`, even though its identifier changed.

import { describe, expect, it } from "vitest";
import { getEmailLogById, listEmailLog } from "../src/server/repo/email";
import type { Db } from "../src/server/context";

const RICH_FIELDS = ["bodyText", "bodyHtml", "icsText", "icsFilename"] as const;

/** A minimal chainable query-builder stand-in: every fluent method returns
 * itself, and it resolves (via `then`) to `rows` when awaited -- mirroring
 * how src/server/repo/email.ts uses the real drizzle builder
 * (`.from().innerJoin().where()?.orderBy().limit().offset()` for the list
 * query, `.from().innerJoin().where()?` for the count query). */
function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function makeFakeDb(opts: { listRow: Record<string, unknown>; detailRow?: Record<string, unknown> }) {
  const selectedColumnObjects: Record<string, unknown>[] = [];
  const db = {
    select: (cols: Record<string, unknown>) => {
      selectedColumnObjects.push(cols);
      if ("count" in cols) {
        return makeChain([{ count: 1 }]);
      }
      // getEmailLogById's SELECTED_COLUMNS includes bodyText; listEmailLog's
      // LIST_COLUMNS does not -- use that to pick which fixture row to hand
      // back, exactly like the real two distinct projections would each
      // only ever be queried by their own caller.
      const row = "bodyText" in cols ? (opts.detailRow ?? opts.listRow) : opts.listRow;
      return makeChain([row]);
    },
  } as unknown as Db;
  return { db, selectedColumnObjects };
}

describe("DEC-543: email-log list vs detail projection", () => {
  it("listEmailLog's selected-column object and returned items omit rich/detail fields", async () => {
    const { db, selectedColumnObjects } = makeFakeDb({
      listRow: {
        id: "log-1",
        eventName: "Arbitrary Con",
        toEmail: "ada@org.test",
        subject: "Welcome",
        status: "sent",
        sentAt: new Date(1700000000000),
      },
    });

    const result = await listEmailLog(db, { page: 1, perPage: 10 });

    // The list query's own selected-column object (first select() call)
    // never names a rich/detail field.
    const listColumns = selectedColumnObjects[0]!;
    for (const field of RICH_FIELDS) {
      expect(Object.keys(listColumns)).not.toContain(field);
    }

    // And the returned row itself carries none of them either.
    const item = result.items[0]!;
    for (const field of RICH_FIELDS) {
      expect(item).not.toHaveProperty(field);
    }
    expect(item).toEqual({
      id: "log-1",
      eventName: "Arbitrary Con",
      toEmail: "ada@org.test",
      subject: "Welcome",
      status: "sent",
      sentAt: 1700000000000,
    });
  });

  it("getEmailLogById's selected-column object and returned row still carry all rich/detail fields", async () => {
    const detailRow = {
      id: "log-1",
      eventId: "event-1",
      eventName: "Arbitrary Con",
      templateId: null,
      contactId: "ct-1",
      toEmail: "ada@org.test",
      subject: "Welcome",
      bodyText: "Hi there",
      bodyHtml: "<p>Hi there</p>",
      icsText: "BEGIN:VCALENDAR...",
      icsFilename: "invite.ics",
      provider: "dev",
      status: "sent",
      sentAt: new Date(1700000000000),
    };
    const { db, selectedColumnObjects } = makeFakeDb({
      listRow: detailRow,
      detailRow,
    });

    const row = await getEmailLogById(db, "log-1", "org-1");

    const detailColumns = selectedColumnObjects[0]!;
    for (const field of RICH_FIELDS) {
      expect(Object.keys(detailColumns)).toContain(field);
    }

    expect(row).not.toBeNull();
    expect(row!.bodyText).toBe("Hi there");
    expect(row!.bodyHtml).toBe("<p>Hi there</p>");
    expect(row!.icsText).toBe("BEGIN:VCALENDAR...");
    expect(row!.icsFilename).toBe("invite.ics");
  });
});
