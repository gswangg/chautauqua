// DEC-300: form-field deletion is a declared cascade, not a silent orphan.
// Repo-level tests use the fake-db pattern from
// test/track-delete-references.test.ts against the real (unmocked) repo
// functions. Route-level tests live in
// test/forms-field-delete-cascade-route.test.ts since vi.mock of the repo
// module in the same file would shadow these direct calls.

import { describe, expect, it } from "vitest";
import { describeFieldDependents, deleteFieldCascade } from "../src/server/repo/forms";
import type { AppEnv } from "../src/server/env";

const now = new Date();

function fieldRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "field1",
    formId: "form1",
    section: "session",
    kind: "text",
    label: "Materials",
    helpText: null,
    required: false,
    position: 1,
    optionsJson: null,
    ruleJson: null,
    locked: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Fake db mirroring listFields' single select().from().where().orderBy()
 * call, plus select()/update()/delete() for submission_answer and
 * formField, tracked so we can assert cascade order/effects. */
function fakeDb(opts: { siblings: ReturnType<typeof fieldRow>[]; answerRows: { id: string }[] }) {
  const updates: { ruleJson: unknown }[] = [];
  const deletes: { table: string }[] = [];

  const selectChain: any = {
    from: () => selectChain,
    where: () => selectChain,
    orderBy: async () => opts.siblings,
    then: (resolve: (v: unknown[]) => void) => {
      // submission_answer select (no orderBy call) resolves to answerRows
      resolve(opts.answerRows);
    },
  };

  const db = {
    select: () => ({ ...selectChain }),
    update: () => ({
      set: (values: { ruleJson?: unknown }) => ({
        where: async () => {
          updates.push({ ruleJson: values.ruleJson });
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: async () => {
        deletes.push({ table: String(table) });
      },
    }),
  } as unknown as AppEnv["Variables"]["db"];

  return { db, updates, deletes };
}

describe("describeFieldDependents / deleteFieldCascade (DEC-300)", () => {
  it("finds sibling fields whose rule targets the field, plus the answer count", async () => {
    const siblings = [
      fieldRow({ id: "field1", label: "Materials" }),
      fieldRow({ id: "field2", label: "Slides link", ruleJson: JSON.stringify({ fieldId: "field1", op: "eq", value: "yes" }) }),
      fieldRow({ id: "field3", label: "Unrelated", ruleJson: null }),
    ];
    const { db } = fakeDb({ siblings, answerRows: [{ id: "a1" }, { id: "a2" }] });
    const result = await describeFieldDependents(db, "form1", "field1");
    expect(result.dependentLabels).toEqual(["Slides link"]);
    expect(result.answerCount).toBe(2);
  });

  it("clears dependent rules, deletes answers, deletes the field, and no remaining field references the deleted id", async () => {
    const siblings = [
      fieldRow({ id: "field1", label: "Materials" }),
      fieldRow({ id: "field2", label: "Slides link", ruleJson: JSON.stringify({ fieldId: "field1", op: "eq", value: "yes" }) }),
      fieldRow({ id: "field3", label: "Also dependent", ruleJson: JSON.stringify({ fieldId: "field1", op: "eq", value: "yes" }) }),
    ];
    const { db, updates, deletes } = fakeDb({ siblings, answerRows: [{ id: "a1" }] });
    const result = await deleteFieldCascade(db, "form1", "field1");
    expect(result.clearedRules).toBe(2);
    expect(result.deletedAnswers).toBe(1);
    // two rule clears (ruleJson: null) + two deletes (answers, field)
    expect(updates.filter((u) => u.ruleJson === null).length).toBe(2);
    expect(deletes.length).toBe(2);

    // The invariant: after cascade, re-listing (simulated here by inspecting
    // the recorded update payloads) shows every dependent's rule cleared —
    // no remaining field's ruleJson can still reference the deleted id.
    expect(updates.every((u) => u.ruleJson === null)).toBe(true);
  });

  it("no dependents/no answers still runs cleanly with zero counts", async () => {
    const siblings = [fieldRow({ id: "field1", label: "Materials" }), fieldRow({ id: "field2", label: "Unrelated", ruleJson: null })];
    const { db, updates } = fakeDb({ siblings, answerRows: [] });
    const result = await deleteFieldCascade(db, "form1", "field1");
    expect(result.clearedRules).toBe(0);
    expect(result.deletedAnswers).toBe(0);
    expect(updates.length).toBe(0);
  });
});
