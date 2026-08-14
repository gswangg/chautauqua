// DEC-104 chunk-sweep (misc lane) source-scan guard. No D1 test harness
// reproduces the "too many bound parameters" 500 (local SQLite doesn't
// enforce the limit), so this test asserts, by reading the source files
// directly, that the seven enumerated unbounded inArray(...) call sites in
// tasks.ts/review.ts/contacts.ts/files.ts (listFileComments moved to
// files-comments.ts; contacts.ts's findContactsForOrg/dupeParticipantIds
// sites moved to contacts/bulk.ts and contacts/merge.ts; review.ts's
// getUsersByIds/track-filter sites moved to review/users.ts and
// review/submissions.ts; tasks.ts's getOnboardingGrid/createTaskAssignments/
// sendReminderEmails sites moved to tasks/grid.ts, tasks/crud.ts and
// tasks/reminders.ts -- all by contention-decomposition passes, same code,
// different file) have been rewritten to iterate chunkIds(...) batches
// instead of passing the raw id list straight through.
import { describe, expect, it } from "vitest";

const sourceModules = import.meta.glob(
  [
    "../src/server/repo/tasks/grid.ts",
    "../src/server/repo/tasks/crud.ts",
    "../src/server/repo/tasks/reminders.ts",
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
  it("glob matches exactly the eight target files (tripwire against a silently vacuous scan)", () => {
    expect(Object.keys(sourceModules).length).toBe(8);
  });

  it("grid.ts imports chunkIds", () => {
    const src = readSrc("grid.ts");
    expect(src).toMatch(/import\s*{\s*chunkIds\s*}\s*from\s*"..\/..\/..\/lib\/chunk"/);
  });

  it("grid.ts: getOnboardingGrid no longer passes the raw contact-id page list to inArray unbounded (DEC-340)", () => {
    const src = readSrc("grid.ts");
    // DEC-340: getOnboardingGrid's page-cells query is bounded by the page's
    // *contact* ids (never an unbounded event-wide id list), chunked via
    // chunkIds. The taskIds list is bounded by "tasks in one event" (never
    // unboundedly grown per request) so it's ANDed in unchunked alongside the
    // chunked contactId batch.
    expect((src.match(/inArray\(schema\.taskAssignment\.taskId, taskIds\)/g) ?? []).length).toBe(1);
    expect(src).toMatch(/for \(const batch of chunkIds\(contactIdsInOrder\)\) \{[\s\S]*?inArray\(schema\.taskAssignment\.contactId, batch\)/);
  });

  it("crud.ts: createTaskAssignments no longer passes the raw contactIds list to inArray", () => {
    const src = readSrc("crud.ts");
    expect(src).not.toContain("inArray(schema.taskAssignment.contactId, contactIds)");
    expect(src).toMatch(/for \(const batch of chunkIds\(contactIds\)\) \{[\s\S]*?inArray\(schema\.taskAssignment\.contactId, batch\)/);
  });

  it("reminders.ts: sendReminderEmails stamps lastRemindedAt in chunkIds batches", () => {
    const src = readSrc("reminders.ts");
    // wave-48: the stamped id list is now `sentAssignmentIds` — accumulated
    // across the send loop (only recipients whose mail actually went out) and
    // flushed in ONE chunked UPDATE after the loop, rather than an UPDATE per
    // recipient. The chunking guard itself is unchanged, only the accumulator
    // name; the raw-list forms stay forbidden.
    expect(src).not.toMatch(/\.where\(inArray\(schema\.taskAssignment\.id, assignmentIds\)\)/);
    expect(src).not.toMatch(/\.where\(inArray\(schema\.taskAssignment\.id, sentAssignmentIds\)\)/);
    expect(src).toMatch(/for \(const batch of chunkIds\(sentAssignmentIds\)\) \{[\s\S]*?inArray\(schema\.taskAssignment\.id, batch\)/);
    // wave-14 (DEC-078 tightened scan): taskIds/contactIds arrive via
    // parseBoundedIdArray (max 1000, routes/tasks.ts) -- above D1's bound
    // budget, so the old "exempt bounded track filter" reading was wrong.
    // listOutstandingForEvent/listRemindableContactIds now pair-chunk both
    // filters via idChunksOrUndefined (delegates to chunkIds); the raw
    // unchunked `inArray(schema.taskAssignment.taskId, taskIds)` form must
    // no longer appear.
    expect(src).not.toMatch(/inArray\(schema\.taskAssignment\.taskId, taskIds\)/);
    expect(src).not.toMatch(/inArray\(schema\.taskAssignment\.contactId, contactIds\)/);
    expect(src).toMatch(/inArray\(schema\.taskAssignment\.taskId, taskIdChunk\)/);
    expect(src).toMatch(/inArray\(schema\.taskAssignment\.contactId, contactIdChunk\)/);
  });

  it("review/users.ts imports chunkIds", () => {
    const src = readSrc("users.ts");
    // wave-14: batchUserDisplayNames also imports ID_CHUNK_SIZE (to derive
    // EMAIL_MATCH_BATCH_SIZE for its DEC-078 orgIds/emails re-chunk), so
    // chunkIds is no longer necessarily the only named import from
    // ../../../lib/chunk -- match chunkIds as ANY named import from that
    // module, not the sole one.
    expect(src).toMatch(/import\s*{\s*[^}]*\bchunkIds\b[^}]*}\s*from\s*"..\/..\/..\/lib\/chunk"/);
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
    // The import may carry other names alongside chunkIds (DEC-686 added
    // ID_CHUNK_SIZE for the version-chain paging guard) — assert on chunkIds
    // being imported from lib/chunk, not on the exact shape of the clause.
    expect(src).toMatch(/import\s*{[^}]*\bchunkIds\b[^}]*}\s*from\s*"..\/..\/lib\/chunk"/);
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
