// DEC-291 wave-80 amendment: task_assignment.response_json gets ONE
// validated parser/serializer (src/forms/task-response.ts) and ONE "has a
// saved response" predicate, replacing three unchecked-cast JSON.parse call
// sites and a fourth door (src/routes/tasks.ts) that decided the same
// question by a different rule (`responseJson === null`, which let a stored
// "{}" count as answered). Unit-covers every branch of the new module, a
// source scan proving no other file under src/ still hand-parses
// response_json, and two behavioural pins on the PATCH
// /api/v1/task-assignments/:id speaker-completion gate.

import { describe, expect, it, vi, afterEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import {
  TaskResponseError,
  parseTaskResponse,
  serializeTaskResponse,
  hasSavedTaskResponse,
} from "../src/forms/task-response";

describe("parseTaskResponse", () => {
  it("returns {} for null/undefined/empty input", () => {
    expect(parseTaskResponse(null, "a1")).toEqual({});
    expect(parseTaskResponse(undefined, "a1")).toEqual({});
    expect(parseTaskResponse("", "a1")).toEqual({});
  });

  it("parses a well-formed object", () => {
    expect(parseTaskResponse('{"f1":"hi","f2":42}', "a1")).toEqual({ f1: "hi", f2: 42 });
  });

  it("parses an empty object", () => {
    expect(parseTaskResponse("{}", "a1")).toEqual({});
  });

  it("throws TaskResponseError, named per assignment/column, on invalid JSON", () => {
    expect(() => parseTaskResponse("{not json", "assignment-9")).toThrow(TaskResponseError);
    try {
      parseTaskResponse("{not json", "assignment-9");
      throw new Error("unreachable");
    } catch (e) {
      expect(e).toBeInstanceOf(TaskResponseError);
      expect((e as Error).message).toBe("task_assignment assignment-9.response_json: not valid JSON");
    }
  });

  it("throws TaskResponseError on a stored array", () => {
    expect(() => parseTaskResponse("[1,2,3]", "assignment-9")).toThrow(TaskResponseError);
    try {
      parseTaskResponse("[1,2,3]", "assignment-9");
      throw new Error("unreachable");
    } catch (e) {
      expect((e as Error).message).toBe("task_assignment assignment-9.response_json: must be an object");
    }
  });

  it("throws TaskResponseError on a stored scalar", () => {
    expect(() => parseTaskResponse('"just a string"', "a1")).toThrow(TaskResponseError);
    expect(() => parseTaskResponse("42", "a1")).toThrow(TaskResponseError);
  });

  it("throws TaskResponseError on stored null literal", () => {
    // JSON.parse("null") === null -- must be rejected, not treated as {}.
    expect(() => parseTaskResponse("null", "a1")).toThrow(TaskResponseError);
  });
});

describe("serializeTaskResponse", () => {
  it("round-trips through parseTaskResponse", () => {
    const answers = { f1: "hi", f2: 42, f3: true };
    const json = serializeTaskResponse(answers);
    expect(parseTaskResponse(json, "a1")).toEqual(answers);
  });

  it("serializes an empty AnswerMap to '{}'", () => {
    expect(serializeTaskResponse({})).toBe("{}");
  });
});

describe("hasSavedTaskResponse", () => {
  it("is false for null/undefined/empty", () => {
    expect(hasSavedTaskResponse(null)).toBe(false);
    expect(hasSavedTaskResponse(undefined)).toBe(false);
    expect(hasSavedTaskResponse("")).toBe(false);
  });

  it("is false for a stored '{}' -- an empty object is NOT a saved response", () => {
    expect(hasSavedTaskResponse("{}")).toBe(false);
  });

  it("is true for a non-empty object", () => {
    expect(hasSavedTaskResponse('{"f1":"hi"}')).toBe(true);
  });

  it("is false (not throwing) for malformed JSON", () => {
    expect(hasSavedTaskResponse("{not json")).toBe(false);
  });

  it("is false (not throwing) for a stored array or scalar", () => {
    expect(hasSavedTaskResponse("[1,2,3]")).toBe(false);
    expect(hasSavedTaskResponse('"a string"')).toBe(false);
    expect(hasSavedTaskResponse("null")).toBe(false);
  });
});

describe("source scan: response_json has exactly one bare-JSON.parse owner", () => {
  it("no file under src/ other than src/forms/task-response.ts calls JSON.parse on a responseJson-named value", () => {
    const srcRoot = join(__dirname, "..", "src");
    const offenders: string[] = [];

    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry)) continue;
        if (full === join(srcRoot, "forms", "task-response.ts")) continue;
        const text = readFileSync(full, "utf8");
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? "";
          if (/JSON\.parse\(/.test(line) && /responseJson/.test(line)) {
            offenders.push(`${full}:${i + 1}: ${line.trim()}`);
          }
        }
      }
    }
    walk(srcRoot);

    expect(offenders).toEqual([]);
  });
});

const DEC214_ORG_A = "org-a";
const DEC214_CONTACT_SPEAKER = "contact-speaker-1";
const DEC214_EVENT_ID = "event-1";
const ASSIGNMENT_EMPTY_OBJECT = "assignment-empty-object";
const ASSIGNMENT_MALFORMED = "assignment-malformed";

interface AssignmentOwnershipRow {
  eventId: string;
  orgId: string;
  contactId: string;
  kind: string;
  responseJson: string | null;
  fileId: string | null;
}

const DEC214_OWNERSHIP_ROWS: Record<string, AssignmentOwnershipRow> = {
  [ASSIGNMENT_EMPTY_OBJECT]: {
    eventId: DEC214_EVENT_ID,
    orgId: DEC214_ORG_A,
    contactId: DEC214_CONTACT_SPEAKER,
    kind: "form",
    responseJson: "{}",
    fileId: null,
  },
  [ASSIGNMENT_MALFORMED]: {
    eventId: DEC214_EVENT_ID,
    orgId: DEC214_ORG_A,
    contactId: DEC214_CONTACT_SPEAKER,
    kind: "form",
    responseJson: "[1,2,3]",
    fileId: null,
  },
};

const dec214UpdateAssignmentStatusCalls: { assignmentId: string; status: string }[] = [];

vi.mock("../src/server/repo/tasks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
  return {
    ...actual,
    getAssignmentOwnership: vi.fn(
      async (_db: unknown, assignmentId: string) => DEC214_OWNERSHIP_ROWS[assignmentId] ?? null,
    ),
    updateAssignmentStatus: vi.fn(async (_db: unknown, assignmentId: string, status: string) => {
      dec214UpdateAssignmentStatusCalls.push({ assignmentId, status });
      return {
        id: assignmentId,
        taskId: "task-1",
        contactId: DEC214_CONTACT_SPEAKER,
        status,
        completedAt: status === "complete" ? Date.now() : null,
        completedBy: status === "complete" ? "u1" : null,
        fileId: null,
        responseJson: DEC214_OWNERSHIP_ROWS[assignmentId]?.responseJson ?? null,
        lastRemindedAt: null,
        createdAt: 0,
        updatedAt: Date.now(),
      };
    }),
  };
});

describe("DEC-214 pin: PATCH /api/v1/task-assignments/:id speaker completion gate spends hasSavedTaskResponse", () => {
  afterEach(() => {
    vi.clearAllMocks();
    dec214UpdateAssignmentStatusCalls.length = 0;
  });

  async function buildApp(auth: AuthInfo) {
    const { taskRoutes } = await import("../src/routes/tasks");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", auth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", taskRoutes);
    return app;
  }

  const SPEAKER: AuthInfo = {
    userId: "u-speaker",
    role: "speaker",
    orgId: DEC214_ORG_A,
    contactId: DEC214_CONTACT_SPEAKER,
  };

  function patchRequest(assignmentId: string, status: string) {
    return new Request(`http://test/api/v1/task-assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ status }),
    });
  }

  it("400s the owning speaker's completion of a stored '{}' response, with the existing message/fields", async () => {
    const app = await buildApp(SPEAKER);
    const res = await app.request(patchRequest(ASSIGNMENT_EMPTY_OBJECT, "complete"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.message).toBe("Complete this task through the portal form/upload flow");
    expect(body.error.fields).toEqual({ status: "Save a response in the portal before marking this task complete" });
    expect(dec214UpdateAssignmentStatusCalls).toHaveLength(0);
  });

  it("400s (not 500s) the owning speaker's completion when response_json is malformed, rather than crashing the route", async () => {
    const app = await buildApp(SPEAKER);
    const res = await app.request(patchRequest(ASSIGNMENT_MALFORMED, "complete"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid");
    expect(dec214UpdateAssignmentStatusCalls).toHaveLength(0);
  });
});
