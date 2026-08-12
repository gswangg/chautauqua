// DEC-298: POST /events/:eventId/agenda/auto-schedule must bound its
// parameters before they ever reach src/domain/schedule.ts's greedy grid
// loop (startMin += gridMin) — a gridMin of 0/negative/non-integer, or a
// dayEndMin that does not exceed dayStartMin, would otherwise let the loop
// never advance and run the isolate to its CPU limit. This test mocks
// src/server/repo/agenda's getEventInfo/runAutoSchedule the way
// test/comms-send-mailer-failure.test.ts mocks its repo module, so we can
// assert the validation boundary without hand-rolling the full db select
// chain that runAutoSchedule's internals need.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const event = {
  orgId: "org1",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  recordPrefix: "EV",
};

const runAutoScheduleMock = vi.fn(async () => ({
  days: ["2026-08-10", "2026-08-11"],
  rooms: [],
  tracks: [],
  placed: [],
  unscheduled: [],
  conflicts: [],
  unplacedReasons: [],
  summary: { unplaced: 0, conflicts: 0 },
}));

vi.mock("../src/server/repo/agenda", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/agenda")>(
    "../src/server/repo/agenda",
  );
  return {
    ...actual,
    getEventInfo: vi.fn(async () => event),
    runAutoSchedule: runAutoScheduleMock,
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

async function importAgendaRoutes() {
  // Imported after vi.mock is registered (hoisted by vitest) so the route
  // module picks up the mocked repo functions.
  const mod = await import("../src/routes/agenda");
  return mod.agendaRoutes;
}

const organizer: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };

async function postAutoSchedule(body: unknown) {
  const agendaRoutes = await importAgendaRoutes();
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    c.set("auth", organizer);
    await next();
  });
  app.route("/", agendaRoutes);

  return app.request("/events/event1/agenda/auto-schedule", {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("POST /events/:eventId/agenda/auto-schedule param bounds (DEC-298)", () => {
  it("rejects gridMin: 0 with a 400 and fields.gridMin", async () => {
    const res = await postAutoSchedule({ gridMin: 0 });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(json.error.fields?.gridMin).toBeTruthy();
    expect(runAutoScheduleMock).not.toHaveBeenCalled();
  });

  it("rejects gridMin: -5 with a 400 and fields.gridMin", async () => {
    const res = await postAutoSchedule({ gridMin: -5 });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(json.error.fields?.gridMin).toBeTruthy();
  });

  it("rejects a non-integer gridMin: 7.5 with a 400 and fields.gridMin", async () => {
    const res = await postAutoSchedule({ gridMin: 7.5 });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(json.error.fields?.gridMin).toBeTruthy();
  });

  it("rejects an absurdly large dayEndMin with a 400", async () => {
    const res = await postAutoSchedule({ dayEndMin: 1e12 });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(json.error.fields?.dayEndMin).toBeTruthy();
  });

  it("rejects dayEndMin <= dayStartMin with a 400", async () => {
    const res = await postAutoSchedule({ dayStartMin: 600, dayEndMin: 600 });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(json.error.fields?.dayEndMin).toBeTruthy();
  });

  it("an empty body still produces today's successful default payload", async () => {
    const res = await postAutoSchedule({});
    expect(res.status).toBe(200);
    expect(runAutoScheduleMock).toHaveBeenCalledWith(
      expect.anything(),
      "event1",
      event,
      { dayStartMin: 540, dayEndMin: 1080, defaultDurationMin: 30, gridMin: 15 },
    );
    const json = (await res.json()) as { summary: { unplaced: number; conflicts: number } };
    expect(json.summary).toEqual({ unplaced: 0, conflicts: 0 });
  });
});
