// DEC-258 wave-75 amendment: PERSON-vs-PARTICIPATION, stated as a predicate.
// A surface whose unit of rendering is a PERSON (the speakers list/gallery,
// the speaker detail header) reads the live contact.title/company. A
// surface whose unit of rendering is a PARTICIPATION (session cards) keeps
// the DEC-258 frozen participant.titleAtTime/orgAtTime snapshot. This file
// pins BOTH sides of that boundary with one contact holding two visible
// submissions whose frozen snapshots differ from each other AND from the
// live contact record.
import { describe, expect, it } from "vitest";
import type { AppEnv } from "../src/server/env";
import { getPublicSpeakers } from "../src/server/repo/public/speakers";
import { getPublicSpeakerDetail } from "../src/server/repo/public/detail";
import { hydrateSessions } from "../src/server/repo/public/sessions";

const LIVE_TITLE = "Chief Scientist";
const LIVE_COMPANY = "Analytical Engines Inc";
const FROZEN_TITLE_A = "Junior Programmer";
const FROZEN_COMPANY_A = "Difference Engine Co";
const FROZEN_TITLE_B = "Research Fellow";
const FROZEN_COMPANY_B = "Babbage Labs";

// Response-queue fake db: replays queued row sets in db.select()/
// selectDistinct() call order, matching test/public-speaker-detail-
// identity.test.ts's established pattern.
function makeFakeDb(responses: unknown[][]) {
  let cursor = 0;
  function chain(): any {
    const value = responses[cursor] ?? [];
    cursor += 1;
    const obj: any = {};
    const passthrough = ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit", "offset", "select", "groupBy"];
    for (const m of passthrough) {
      obj[m] = (..._args: unknown[]) => obj;
    }
    obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(value).then(resolve, reject);
    return obj;
  }
  return { select: () => chain(), selectDistinct: () => chain() } as unknown as AppEnv["Variables"]["db"];
}

describe("DEC-258 wave-75: speakers list/gallery reads the live contact, not a participation snapshot", () => {
  it("(a) getPublicSpeakers returns the live contact title/company for a contact with two divergent frozen snapshots", async () => {
    const idRows = [{ contactId: "contact-1" }];
    const countRows = [{ total: 1 }];
    const hydrationRows = [
      {
        contactId: "contact-1",
        firstName: "Ada",
        lastName: "Lovelace",
        title: LIVE_TITLE,
        company: LIVE_COMPANY,
        headshotUrl: null,
        bio: null,
        submissionId: "sub-apple",
        submissionTitle: "Apple Talk",
      },
      {
        contactId: "contact-1",
        firstName: "Ada",
        lastName: "Lovelace",
        title: LIVE_TITLE,
        company: LIVE_COMPANY,
        headshotUrl: null,
        bio: null,
        submissionId: "sub-zebra",
        submissionTitle: "Zebra Talk",
      },
    ];
    const db = makeFakeDb([idRows, countRows, hydrationRows]);

    const { items } = await getPublicSpeakers(db, "event-1", { page: 1, perPage: 20 });

    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe(LIVE_TITLE);
    expect(items[0]!.company).toBe(LIVE_COMPANY);
    // Neither of the two submissions' (hypothetical) frozen snapshots leaks
    // through -- the row is the SAME live value regardless of which
    // submission's title happens to sort first.
    expect(items[0]!.title).not.toBe(FROZEN_TITLE_A);
    expect(items[0]!.title).not.toBe(FROZEN_TITLE_B);
    expect(items[0]!.company).not.toBe(FROZEN_COMPANY_A);
    expect(items[0]!.company).not.toBe(FROZEN_COMPANY_B);
  });

  it("(b) getPublicSpeakerDetail returns the same live title/company for that contact", async () => {
    const EVENT = { id: "event-1", recordPrefix: "SES", startDate: "2026-01-01", endDate: "2026-01-02", timezone: "UTC" } as any;
    const rows = [
      {
        contactId: "contact-1",
        firstName: "Ada",
        lastName: "Lovelace",
        contactTitle: LIVE_TITLE,
        contactCompany: LIVE_COMPANY,
        bio: null,
        headshotUrl: null,
        socialLinksJson: null,
        submissionId: "sub-apple",
        submissionTitle: "Apple Talk",
      },
      {
        contactId: "contact-1",
        firstName: "Ada",
        lastName: "Lovelace",
        contactTitle: LIVE_TITLE,
        contactCompany: LIVE_COMPANY,
        bio: null,
        headshotUrl: null,
        socialLinksJson: null,
        submissionId: "sub-zebra",
        submissionTitle: "Zebra Talk",
      },
    ];
    const db = makeFakeDb([rows, [], []]);

    const result = await getPublicSpeakerDetail(db, EVENT, "contact-1");

    expect(result).not.toBeNull();
    expect(result!.title).toBe(LIVE_TITLE);
    expect(result!.company).toBe(LIVE_COMPANY);
  });

  it("(c) getPublicSessions' per-session speaker attribution still returns the two DIFFERENT frozen snapshots (session cards render a PARTICIPATION, unchanged)", async () => {
    const EVENT = { id: "event-1", recordPrefix: "SES", startDate: "2026-01-01", endDate: "2026-01-02" };
    const subRows = [
      { id: "sub-apple", seq: 1, title: "Apple Talk", description: null, icsSequence: 0 },
      { id: "sub-zebra", seq: 2, title: "Zebra Talk", description: null, icsSequence: 0 },
    ];
    const trackRows: unknown[] = [];
    const speakerRows = [
      {
        submissionId: "sub-apple",
        order: 0,
        contactId: "contact-1",
        firstName: "Ada",
        lastName: "Lovelace",
        title: FROZEN_TITLE_A,
        company: FROZEN_COMPANY_A,
        headshotUrl: null,
        bio: null,
      },
      {
        submissionId: "sub-zebra",
        order: 0,
        contactId: "contact-1",
        firstName: "Ada",
        lastName: "Lovelace",
        title: FROZEN_TITLE_B,
        company: FROZEN_COMPANY_B,
        headshotUrl: null,
        bio: null,
      },
    ];
    const slotRows: unknown[] = [];
    const formatRows: unknown[] = [];
    const db = makeFakeDb([subRows, trackRows, speakerRows, slotRows, formatRows]);

    const items = await hydrateSessions(db, ["sub-apple", "sub-zebra"], EVENT);

    const byId = new Map(items.map((i) => [i.id, i]));
    const apple = byId.get("sub-apple");
    const zebra = byId.get("sub-zebra");
    expect(apple).toBeDefined();
    expect(zebra).toBeDefined();
    expect(apple!.speakers[0]!.title).toBe(FROZEN_TITLE_A);
    expect(apple!.speakers[0]!.company).toBe(FROZEN_COMPANY_A);
    expect(zebra!.speakers[0]!.title).toBe(FROZEN_TITLE_B);
    expect(zebra!.speakers[0]!.company).toBe(FROZEN_COMPANY_B);
    // Load-bearing: the two session cards for the SAME speaker disagree
    // with each other -- pinning the boundary so a future lane can't
    // "simplify" the session cards onto the live contact record.
    expect(apple!.speakers[0]!.title).not.toBe(zebra!.speakers[0]!.title);
    expect(apple!.speakers[0]!.company).not.toBe(zebra!.speakers[0]!.company);
    // And neither matches the live contact value the person-surfaces above
    // return for this same contact.
    expect(apple!.speakers[0]!.title).not.toBe(LIVE_TITLE);
    expect(zebra!.speakers[0]!.title).not.toBe(LIVE_TITLE);
  });
});
