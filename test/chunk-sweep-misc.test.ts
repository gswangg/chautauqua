// DEC-104 chunk-sweep (misc lane) source-scan guard. No D1 test harness
// reproduces the "too many bound parameters" 500 (local SQLite doesn't
// enforce the limit), so this test asserts, by reading the source files
// directly, that the seven enumerated unbounded inArray(...) call sites in
// tasks.ts/review.ts/contacts.ts/files.ts (listFileComments moved to
// files-comments.ts; contacts.ts's findContactsForOrg/dupeParticipantIds
// sites moved to contacts/bulk.ts and contacts/merge.ts; review.ts's
// getUsersByIds/track-filter sites moved to review/users.ts and
// review/submissions.ts -- all by contention-decomposition passes, same
// code, different file) have been rewritten to iterate chunkIds(...)
// batches instead of passing the raw id list straight through.
import { describe, expect, it } from "vitest";

const sourceModules = import.meta.glob(
  [
    "../src/server/repo/tasks.ts",
    "../src/server/repo/review/users.ts",
    "../src/server/repo/review/submissions.ts",
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
  it("glob matches exactly the six target files (tripwire against a silently vacuous scan)", () => {
    expect(Object.keys(sourceModules).length).toBe(6);
  });

  it("tasks.ts imports chunkIds", () => {
    const src = readSrc("tasks.ts");
    expect(src).toMatch(/import\s*{\s*chunkIds\s*}\s*from\s*"..\/..\/lib\/chunk"/);
  });

  it("tasks.ts: getOnboardingGrid no longer passes the raw contact-id page list to inArray unbounded (DEC-340)", () => {
    const src = readSrc("tasks.ts");
    // DEC-340: getOnboardingGrid's page-cells query is bounded by the page's
    // *contact* ids (never an unbounded event-wide id list), chunked via
    // chunkIds. The taskIds list is bounded by "tasks in one event" (never
    // unboundedly grown per request) so it's ANDed in unchunked alongside the
    // chunked contactId batch — the exempt sendDueRemindersForEvent-adjacent
    // listOutstandingForEvent filter (DEC-104-exempt bounded track filter)
    // legitimately still uses `inArray(schema.taskAssignment.taskId, taskIds)`
    // once too, so this count is 2 (one per site), not 1.
    expect((src.match(/inArray\(schema\.taskAssignment\.taskId, taskIds\)/g) ?? []).length).toBe(2);
    expect(src).toMatch(/for \(const batch of chunkIds\(contactIdsInOrder\)\) \{[\s\S]*?inArray\(schema\.taskAssignment\.contactId, batch\)/);
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

  it("review/users.ts imports chunkIds", () => {
    const src = readSrc("users.ts");
    expect(src).toMatch(/import\s*{\s*chunkIds\s*}\s*from\s*"..\/..\/..\/lib\/chunk"/);
  });

  it("review/users.ts: getUsersByIds no longer passes the raw userIds list to inArray", () => {
    const src = readSrc("users.ts");
    expect(src).not.toContain("inArray(schema.user.id, userIds)");
    expect(src).toMatch(/for \(const batch of chunkIds\(userIds\)\) \{[\s\S]*?inArray\(schema\.user\.id, batch\)/);
  });

  it("review/submissions.ts: DEC-104-exempt bounded track filters are left alone", () => {
    const src = readSrc("submissions.ts");
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
