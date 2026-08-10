import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import * as schema from "../src/db/schema";

// DEC-003: the 24 canonical table names.
const EXPECTED_TABLE_NAMES = [
  "org",
  "user",
  "auth_session",
  "contact",
  "event",
  "form",
  "form_field",
  "submission",
  "submission_answer",
  "participant",
  "evaluation_plan",
  "plan_reviewer",
  "evaluation",
  "track",
  "room",
  "schedule_slot",
  "task",
  "task_assignment",
  "portal_settings",
  "resource",
  "file",
  "file_comment",
  "email_template",
  "email_log",
];

const EXPORT_NAME_BY_TABLE: Record<string, keyof typeof schema> = {
  org: "org",
  user: "user",
  auth_session: "authSession",
  contact: "contact",
  event: "event",
  form: "form",
  form_field: "formField",
  submission: "submission",
  submission_answer: "submissionAnswer",
  participant: "participant",
  evaluation_plan: "evaluationPlan",
  plan_reviewer: "planReviewer",
  evaluation: "evaluation",
  track: "track",
  room: "room",
  schedule_slot: "scheduleSlot",
  task: "task",
  task_assignment: "taskAssignment",
  portal_settings: "portalSettings",
  resource: "resource",
  file: "file",
  file_comment: "fileComment",
  email_template: "emailTemplate",
  email_log: "emailLog",
};

describe("schema", () => {
  it("has exactly 24 tables", () => {
    expect(EXPECTED_TABLE_NAMES).toHaveLength(24);
  });

  for (const tableName of EXPECTED_TABLE_NAMES) {
    it(`exports table '${tableName}' with matching D1 table name`, () => {
      const exportName = EXPORT_NAME_BY_TABLE[tableName];
      const table = (schema as Record<string, unknown>)[exportName as string];
      expect(table, `expected schema.${exportName} to exist`).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getTableName(table as any)).toBe(tableName);
    });
  }
});
