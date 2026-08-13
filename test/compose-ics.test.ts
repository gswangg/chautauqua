// DEC-051: server-side calendar invites in compose. Pure-helper coverage —
// unscheduled-rejection field shape, use-then-bump SEQUENCE semantics, and
// LOCATION omission when no room is assigned yet.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { unscheduledIcsFields } from "../src/routes/comms";
import { chunkIds } from "../src/lib/chunk";
import type { IcsScheduleRow } from "../src/server/repo/comms";
import { buildIcsEvent, ICS_ORGANIZER_EMAIL, type IcsOptions } from "../src/mail/ics";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const requestOpts: IcsOptions = {
  method: "REQUEST",
  organizer: { name: "DevConf", email: ICS_ORGANIZER_EMAIL },
  attendee: { name: "Ada Lovelace", email: "ada@example.com" },
};

function slot(overrides: Partial<IcsScheduleRow> = {}): IcsScheduleRow {
  return {
    submissionId: "sub_1",
    day: "2026-09-01",
    startMin: 600,
    endMin: 630,
    roomName: "Main Hall",
    icsSequence: 0,
    ...overrides,
  };
}

describe("unscheduledIcsFields", () => {
  it("is empty when every selected submission has a schedule slot", () => {
    const icsMap = new Map([
      ["sub_1", slot({ submissionId: "sub_1" })],
      ["sub_2", slot({ submissionId: "sub_2" })],
    ]);
    expect(unscheduledIcsFields(icsMap, ["sub_1", "sub_2"])).toEqual({});
  });

  it("flags every submission missing a schedule_slot row as 'not scheduled'", () => {
    const icsMap = new Map([["sub_1", slot({ submissionId: "sub_1" })]]);
    expect(unscheduledIcsFields(icsMap, ["sub_1", "sub_2", "sub_3"])).toEqual({
      sub_2: "not scheduled",
      sub_3: "not scheduled",
    });
  });

  it("flags all selected submissions when none are scheduled", () => {
    const icsMap = new Map<string, IcsScheduleRow>();
    expect(unscheduledIcsFields(icsMap, ["sub_1", "sub_2"])).toEqual({
      sub_1: "not scheduled",
      sub_2: "not scheduled",
    });
  });
});

describe("use-then-bump SEQUENCE semantics", () => {
  it("send uses the current stored sequence, then a subsequent send after a bump uses sequence + 1", () => {
    const dtstamp = new Date("2026-08-10T12:00:00Z");
    const base = {
      uidSubmissionId: "sub_1",
      title: "On Engines",
      startUtc: new Date("2026-09-01T14:00:00Z"),
      endUtc: new Date("2026-09-01T14:30:00Z"),
      location: "Main Hall",
      dtstamp,
    };

    // First send: stored ics_sequence is 0.
    const first = buildIcsEvent({ ...base, sequence: 0 }, requestOpts);
    expect(first).toContain("SEQUENCE:0");
    const firstUid = first.match(/UID:([^\r\n]+)/)?.[1];

    // Route bumps ics_sequence by exactly 1 after the first send. A second
    // send (e.g. after the room changed) uses the bumped value.
    const bumped = 0 + 1;
    const second = buildIcsEvent({ ...base, sequence: bumped }, requestOpts);
    expect(second).toContain("SEQUENCE:1");
    const secondUid = second.match(/UID:([^\r\n]+)/)?.[1];

    // Same submission -> same stable UID across the sequence bump.
    expect(secondUid).toBe(firstUid);
  });

  it("preview never bumps: rendering the same stored sequence twice yields identical SEQUENCE lines", () => {
    const base = {
      uidSubmissionId: "sub_1",
      title: "On Engines",
      startUtc: new Date("2026-09-01T14:00:00Z"),
      endUtc: new Date("2026-09-01T14:30:00Z"),
      dtstamp: new Date("2026-08-10T12:00:00Z"),
      sequence: 3,
    };
    const previewOne = buildIcsEvent(base, requestOpts);
    const previewTwo = buildIcsEvent(base, requestOpts);
    expect(previewOne.match(/SEQUENCE:(\d+)/)?.[1]).toBe("3");
    expect(previewTwo.match(/SEQUENCE:(\d+)/)?.[1]).toBe("3");
  });
});

describe("LOCATION omitted when no room is assigned", () => {
  it("emits no LOCATION line when the schedule slot has no room", () => {
    const ics = buildIcsEvent(
      {
        uidSubmissionId: "sub_1",
        sequence: 0,
        title: "On Engines",
        startUtc: new Date("2026-09-01T14:00:00Z"),
        endUtc: new Date("2026-09-01T14:30:00Z"),
        location: undefined,
        dtstamp: new Date("2026-08-10T12:00:00Z"),
      },
      requestOpts,
    );
    expect(ics).not.toContain("LOCATION:");
  });

  it("emits LOCATION when a room is assigned", () => {
    const ics = buildIcsEvent(
      {
        uidSubmissionId: "sub_1",
        sequence: 0,
        title: "On Engines",
        startUtc: new Date("2026-09-01T14:00:00Z"),
        endUtc: new Date("2026-09-01T14:30:00Z"),
        location: "Main Hall",
        dtstamp: new Date("2026-08-10T12:00:00Z"),
      },
      requestOpts,
    );
    expect(ics).toContain("LOCATION:Main Hall");
  });
});

// Regression coverage for the D1 "too many SQL variables" crash a >90
// selected-submission compose (DEC-019's own 100-recipient cap lets a
// producer select more submissionIds than that before the expanded
// recipient count is even checked) tripped in loadComposeSubmissions,
// found by the producer walkthrough (scripts/walkthrough/producer.ts).
describe("chunkIds (D1 bound-parameter batching for compose data loading)", () => {
  it("returns a single batch for input under the chunk size", () => {
    expect(chunkIds(["a", "b", "c"])).toEqual([["a", "b", "c"]]);
  });

  it("returns an empty array for empty input", () => {
    expect(chunkIds([])).toEqual([]);
  });

  it("splits into batches small enough to leave headroom for an extra bound condition (e.g. eventId)", () => {
    const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`);
    const batches = chunkIds(ids);
    expect(batches.every((b: string[]) => b.length <= 90)).toBe(true);
    expect(batches.flat()).toEqual(ids);
  });
});

// DEC-494: the compose-preview payload's per-item ics.timeZone must equal
// the OWNING EVENT's stored timezone, not UTC/undefined — the SPA renders
// the calendar chip from this field instead of the viewer's ambient zone.
//
// vi.mock is hoisted above all module-scope declarations, so the mock
// factories below reference only module-scope `const`/`function` bindings
// declared above them at file scope (never a variable local to the
// describe block) to avoid a TDZ ReferenceError at hoist time.
const ICS_TZ_ORG_A = "org-a";
const ICS_TZ_ORIGIN = "https://events.example.com";

const icsTzEvent = {
  id: "evt-1",
  orgId: ICS_TZ_ORG_A,
  name: "DevCon",
  slug: "devcon",
  startDate: "2027-05-12",
  endDate: "2027-05-13",
  location: null,
  timezone: "America/Los_Angeles",
  recordPrefix: "DEV",
  branding: null,
  createdAt: 0,
  updatedAt: 0,
};

function icsTzSubmissionFixture(id: string, contactId: string, email: string) {
  return {
    id,
    title: `Talk ${id}`,
    seq: 1,
    participants: [{ contactId, firstName: "Ada", lastName: "Lovelace", email }],
  };
}

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async () => icsTzEvent),
  };
});

vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadComposeSubmissions: vi.fn(async (_db: unknown, _eventId: string, ids: string[]) =>
      ids.map((id) => icsTzSubmissionFixture(id, `ct-${id}`, `${id}@example.com`)),
    ),
    loadIcsScheduleData: vi.fn(
      async (_db: unknown, ids: string[]) =>
        new Map(
          ids.map((id) => [
            id,
            { submissionId: id, day: "2027-05-12", startMin: 540, endMin: 585, roomName: "Main Stage", icsSequence: 0 },
          ]),
        ),
    ),
    findAccountUserId: vi.fn(async () => null),
    findAccountUserIds: vi.fn(async (_db: unknown, params: { contactId: string }[]) => new Map(params.map((p) => [p.contactId, null]))),
    listFeedbackComments: vi.fn(async () => []),
    listFeedbackCommentsForSubmissions: vi.fn(async () => new Map()),
  };
});

// DEC-792: stub the batched outstanding-task lookup so this ics-focused
// suite doesn't need a real db for buildRenderTargets's {task_list}/
// {due_date} vars.
vi.mock("../src/server/repo/tasks/reminders", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks/reminders")>(
    "../src/server/repo/tasks/reminders",
  );
  return {
    ...actual,
    listOutstandingForEvent: vi.fn(async () => []),
  };
});

describe("compose/preview ics.timeZone (DEC-494)", () => {
  const ORG_A = ICS_TZ_ORG_A;
  const ORIGIN = ICS_TZ_ORIGIN;

  afterEach(() => {
    vi.clearAllMocks();
  });

  const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: ORG_A };

  async function buildApp() {
    const { commsRoutes } = await import("../src/routes/comms");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", organizerAuth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/", commsRoutes);
    return app;
  }

  it("stamps every previewed item's ics.timeZone with the event's stored timezone", async () => {
    const app = await buildApp();
    const res = await app.request(
      `${ORIGIN}/api/v1/events/evt-1/compose/preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({
          submissionIds: ["sub-a"],
          subject: "Update",
          bodyText: "Hi {speaker_name}",
          attachIcs: true,
        }),
      },
      { KV: { put: vi.fn() } },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { ics?: { timeZone: string } }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.ics?.timeZone).toBe("America/Los_Angeles");
  });
});
