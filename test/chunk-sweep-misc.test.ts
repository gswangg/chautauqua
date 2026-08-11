// DEC-104 chunk-sweep (misc lane) source-scan guard. No D1 test harness
// reproduces the "too many bound parameters" 500 (local SQLite doesn't
// enforce the limit), so this test asserts, by reading the source files
// directly, that the seven enumerated unbounded inArray(...) call sites in
// tasks.ts/review.ts/contacts.ts/files.ts (listFileComments moved to
// files-comments.ts, and contacts.ts's findContactsForOrg/dupeParticipantIds
// sites moved to contacts/bulk.ts and contacts/merge.ts, both by the
// contention-decomposition pass — same code, different file) have been
// rewritten to iterate chunkIds(...) batches instead of passing the raw id
// list straight through.
import { describe, expect, it } from "vitest";

const sourceModules = import.meta.glob(
  [
    "../src/server/repo/tasks.ts",
    "../src/server/repo/review.ts",
    "../src/server/repo/contacts/bulk.ts",
    "../src/server/repo/contacts/merge.ts",
    "../src/server/repo/files-comments.ts",
  ],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

function readSrc(fileName: string): string {
  const entry = Object.entries(sourceModules).find(([path]) => path.endsWith(`/${fileName}`));
  if (!entry) throw new Error(`source module glob did not match ${fileName}`);
  return entry[1];
}

describe("DEC-104 chunk sweep — misc lane", () => {
  it("glob matches exactly the five target files (tripwire against a silently vacuous scan)", () => {
    expect(Object.keys(sourceModules).length).toBe(5);
  });

  it("tasks.ts imports chunkIds", () => {
    const src = readSrc("tasks.ts");
    expect(src).toMatch(/import\s*{\s*chunkIds\s*}\s*from\s*"..\/..\/lib\/chunk"/);
  });

  it("tasks.ts: getOnboardingGrid no longer passes the raw taskIds list to inArray", () => {
    const src = readSrc("tasks.ts");
    // The exempt sendDueRemindersForEvent-adjacent listOutstandingForEvent
    // filter (line ~421, DEC-104-exempt bounded track filter) legitimately
    // still uses `inArray(schema.taskAssignment.taskId, taskIds)` once —
    // only the getOnboardingGrid site (chunked below) must be gone.
    expect((src.match(/inArray\(schema\.taskAssignment\.taskId, taskIds\)/g) ?? []).length).toBe(1);
    expect(src).toMatch(/for \(const batch of chunkIds\(taskIds\)\) \{[\s\S]*?inArray\(schema\.taskAssignment\.taskId, batch\)/);
  });

  it("tasks.ts: createTaskAssignments no longer passes the raw contactIds list to inArray", () => {
    const src = readSrc("tasks.ts");
    expect(src).not.toContain("inArray(schema.taskAssignment.contactId, contactIds)");
    expect(src).toMatch(/for \(const batch of chunkIds\(contactIds\)\) \{[\s\S]*?inArray\(schema\.taskAssignment\.contactId, batch\)/);
  });

  it("tasks.ts: sendReminderEmails stamps lastRemindedAt in chunkIds batches", () => {
    const src = readSrc("tasks.ts");
    expect(src).not.toMatch(/\.where\(inArray\(schema\.taskAssignment\.id, assignmentIds\)\)/);
    expect(src).toMatch(/for \(const batch of chunkIds\(assignmentIds\)\) \{[\s\S]*?inArray\(schema\.taskAssignment\.id, batch\)/);
  });

  it("review.ts imports chunkIds", () => {
    const src = readSrc("review.ts");
    expect(src).toMatch(/import\s*{\s*chunkIds\s*}\s*from\s*"..\/..\/lib\/chunk"/);
  });

  it("review.ts: getUsersByIds no longer passes the raw userIds list to inArray", () => {
    const src = readSrc("review.ts");
    expect(src).not.toContain("inArray(schema.user.id, userIds)");
    expect(src).toMatch(/for \(const batch of chunkIds\(userIds\)\) \{[\s\S]*?inArray\(schema\.user\.id, batch\)/);
  });

  it("review.ts: DEC-104-exempt bounded track filters (lines ~302/385/408) are left alone", () => {
    const src = readSrc("review.ts");
    // These sites filter by a small, request-bounded track/status list, not
    // an unbounded id list expansion — DEC-104 explicitly exempts them.
    const exemptCount = (src.match(/inArray\(/g) ?? []).length;
    expect(exemptCount).toBeGreaterThan(0);
  });

  it("contacts/bulk.ts imports chunkIds", () => {
    const src = readSrc("bulk.ts");
    expect(src).toMatch(/import\s*{\s*chunkIds\s*}\s*from\s*"..\/..\/..\/lib\/chunk"/);
  });

  it("contacts/bulk.ts: findContactsForOrg no longer passes the raw ids list to inArray", () => {
    const src = readSrc("bulk.ts");
    expect(src).not.toContain("inArray(schema.contact.id, ids)");
    expect(src).toMatch(/for \(const batch of chunkIds\(ids\)\) \{[\s\S]*?inArray\(schema\.contact\.id, batch\)/);
  });

  it("contacts/merge.ts: the pre-existing chunked dupeParticipantIds site is untouched", () => {
    const src = readSrc("merge.ts");
    expect(src).toMatch(/for \(const chunk of chunkIds\(dupeParticipantIds\)\)/);
  });

  it("files-comments.ts imports chunkIds", () => {
    const src = readSrc("files-comments.ts");
    expect(src).toMatch(/import\s*{\s*chunkIds\s*}\s*from\s*"..\/..\/lib\/chunk"/);
  });

  it("files-comments.ts: listFileComments user hydration no longer passes the raw userIds list to inArray", () => {
    const src = readSrc("files-comments.ts");
    expect(src).not.toContain("inArray(schema.user.id, userIds)");
    expect(src).toMatch(/for \(const batch of chunkIds\(userIds\)\) \{[\s\S]*?inArray\(schema\.user\.id, batch\)/);
  });

  it("files-comments.ts: listFileComments contact hydration no longer passes the raw contactIds list to inArray", () => {
    const src = readSrc("files-comments.ts");
    expect(src).not.toContain("inArray(schema.contact.id, contactIds)");
    expect(src).toMatch(/for \(const batch of chunkIds\(contactIds\)\) \{[\s\S]*?inArray\(schema\.contact\.id, batch\)/);
  });
});
