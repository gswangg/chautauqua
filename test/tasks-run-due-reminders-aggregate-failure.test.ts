// DEC-946: runDueReminders (src/routes/tasks.ts) must keep DEC-238 class 1
// per-event isolation — one bad event's failure must not cost the other
// events their sends — but it must no longer swallow every per-event
// failure behind a console.error. It must collect the failing eventIds and
// throw ONE aggregate error naming each of them, so
// src/server/scheduled.ts's `failures.push("runDueReminders")` (which can
// only ever fire if this function rejects) stops being dead code.
import { describe, expect, it, vi, afterEach } from "vitest";

const listEventIdsWithOutstandingAssignments = vi.fn<(...args: unknown[]) => unknown>();
const sendDueRemindersForEvent = vi.fn<(...args: unknown[]) => unknown>();
const makeDb = vi.fn<(...args: unknown[]) => unknown>(() => ({}) as unknown);
const makeMailer = vi.fn<(...args: unknown[]) => unknown>(() => ({
  send: vi.fn(async () => undefined),
}));
const resolveBaseUrlForCron = vi.fn<(...args: unknown[]) => unknown>(() => "https://events.example.com");
const resolveBaseUrl = vi.fn<(...args: unknown[]) => unknown>(() => "https://events.example.com");

vi.mock("../src/server/context", () => ({
  makeDb: (...args: unknown[]) => makeDb(...args),
  makeMailer: (...args: unknown[]) => makeMailer(...args),
}));
vi.mock("../src/server/origin", () => ({
  resolveBaseUrlForCron: (...args: unknown[]) => resolveBaseUrlForCron(...args),
  resolveBaseUrl: (...args: unknown[]) => resolveBaseUrl(...args),
}));
vi.mock("../src/server/repo/tasks", () => ({
  listEventIdsWithOutstandingAssignments: (...args: unknown[]) => listEventIdsWithOutstandingAssignments(...args),
  sendDueRemindersForEvent: (...args: unknown[]) => sendDueRemindersForEvent(...args),
}));

import { runDueReminders } from "../src/routes/tasks";

const fakeEnv = {} as unknown as Parameters<typeof runDueReminders>[0];

describe("runDueReminders (DEC-946 aggregate rethrow)", () => {
  afterEach(() => {
    listEventIdsWithOutstandingAssignments.mockReset();
    sendDueRemindersForEvent.mockReset();
    makeMailer.mockReset();
    makeMailer.mockImplementation(() => ({ send: vi.fn(async () => undefined) }));
  });

  it("still sends for the other events and rejects naming the one failing eventId", async () => {
    listEventIdsWithOutstandingAssignments.mockResolvedValueOnce(["event_a", "event_b", "event_c"]);

    const sent: string[] = [];
    const mailer = { send: vi.fn(async (m: { to: { email: string } }) => { sent.push(m.to.email); }) };
    // DEC-547 (w43-b): makeMailer is now constructed inside the per-event
    // guarded loop, not once above it — so it's called once per eventId
    // (three times here), not once overall. mockReturnValue (not `Once`)
    // covers every call.
    makeMailer.mockReturnValue(mailer);

    sendDueRemindersForEvent.mockImplementation((...args: unknown[]) => {
      const [, m, eventId] = args as [unknown, typeof mailer, string];
      if (eventId === "event_b") {
        return Promise.reject(new Error("simulated mailer outage"));
      }
      return m.send({ to: { email: `${eventId}@example.com` } }).then(() => 1);
    });

    await expect(runDueReminders(fakeEnv)).rejects.toThrow(/event_b/);

    expect(sendDueRemindersForEvent).toHaveBeenCalledTimes(3);
    expect(sent).toEqual(["event_a@example.com", "event_c@example.com"]);
  });

  it("resolves cleanly when every event succeeds", async () => {
    listEventIdsWithOutstandingAssignments.mockResolvedValueOnce(["event_a", "event_b"]);
    sendDueRemindersForEvent.mockResolvedValue(1);

    await expect(runDueReminders(fakeEnv)).resolves.toBeUndefined();
    expect(sendDueRemindersForEvent).toHaveBeenCalledTimes(2);
  });

  // DEC-547 (w43-b): makeMailer is constructed inside the per-event try, not
  // once above the loop — a misconfigured environment (which throws
  // synchronously) must land in the same failedEventIds bucket and aggregate
  // rethrow as a sendDueRemindersForEvent rejection, and must not stop the
  // loop from attempting the other events.
  it("still sends for the other events and rejects naming the one whose mailer construction throws", async () => {
    listEventIdsWithOutstandingAssignments.mockResolvedValueOnce(["event_a", "event_b", "event_c"]);

    const sent: string[] = [];
    const mailer = { send: vi.fn(async (m: { to: { email: string } }) => { sent.push(m.to.email); }) };

    // Fail construction only for the second event's call (order matches
    // listEventIdsWithOutstandingAssignments' returned array: a, b, c).
    let call = 0;
    makeMailer.mockImplementation(() => {
      call += 1;
      if (call === 2) throw new Error("the EMAIL binding is not configured");
      return mailer;
    });
    sendDueRemindersForEvent.mockImplementation((...args: unknown[]) => {
      const [, m, eventId] = args as [unknown, typeof mailer, string];
      return m.send({ to: { email: `${eventId}@example.com` } }).then(() => 1);
    });

    await expect(runDueReminders(fakeEnv)).rejects.toThrow(/event_b/);

    // event_b's makeMailer() call threw before sendDueRemindersForEvent
    // could be invoked for it, so only event_a and event_c reach the mock.
    expect(sendDueRemindersForEvent).toHaveBeenCalledTimes(2);
    expect(sent).toEqual(["event_a@example.com", "event_c@example.com"]);
  });
});
