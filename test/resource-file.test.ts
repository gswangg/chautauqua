// DEC-047 file-kind resources: pure-logic coverage for the multipart create
// branch (POST /events/:eventId/resources) and the organizer-only serve
// scope for GET /files/:fileId. Repo functions that touch Db (getResourceFileScope,
// insertResourceFile, deleteResource's cascade) aren't covered here — this
// repo's test harness runs vitest in plain node with no D1/miniflare binding
// (see test/portal-config-repo.test.ts, test/files-repo.test.ts: every other
// repo module in this codebase is likewise tested only at its pure-function
// boundary, never against a live Db).
import { describe, expect, it } from "vitest";
import { canAccessResourceFile } from "../src/server/repo/files";
import { parseFileResourcePosition } from "../src/routes/api/portal-config";
import { validateUpload } from "../src/domain/files";

describe("parseFileResourcePosition (multipart create field parsing)", () => {
  it("is undefined when the field is omitted", () => {
    expect(parseFileResourcePosition(undefined)).toEqual({ ok: true, value: undefined });
  });

  it("is undefined for an empty string", () => {
    expect(parseFileResourcePosition("")).toEqual({ ok: true, value: undefined });
  });

  it("parses a valid non-negative integer string", () => {
    expect(parseFileResourcePosition("3")).toEqual({ ok: true, value: 3 });
  });

  it("rejects a negative number", () => {
    const result = parseFileResourcePosition("-1");
    expect(result.ok).toBe(false);
  });

  it("rejects a non-integer", () => {
    const result = parseFileResourcePosition("1.5");
    expect(result.ok).toBe(false);
  });

  it("rejects a non-numeric string", () => {
    const result = parseFileResourcePosition("abc");
    expect(result.ok).toBe(false);
  });

  it("is undefined when the field isn't a string (e.g. a File instance for another field)", () => {
    expect(parseFileResourcePosition(new File(["x"], "f.txt"))).toEqual({ ok: true, value: undefined });
  });
});

describe("validateUpload tier used for resource file uploads (DEC-047: 'handout' tier, never one of the stored file row's kinds)", () => {
  it("accepts a pdf resource upload under the document cap", () => {
    const result = validateUpload({ filename: "agenda.pdf", sizeBytes: 1024, kind: "handout" });
    expect(result).toEqual({ ok: true, ext: "pdf", servedContentType: "application/pdf" });
  });

  it("rejects an unsupported extension", () => {
    const result = validateUpload({ filename: "agenda.exe", sizeBytes: 1024, kind: "handout" });
    expect(result.ok).toBe(false);
  });
});

describe("canAccessResourceFile (organizer serve scope for GET /files/:fileId, DEC-047)", () => {
  it("serves organizers whose org owns the resource's event", () => {
    expect(canAccessResourceFile({ role: "organizer", orgId: "org-a" }, { orgId: "org-a" })).toBe(true);
  });

  it("denies organizers from a different org — cross-org denial, no IDOR", () => {
    expect(canAccessResourceFile({ role: "organizer", orgId: "org-b" }, { orgId: "org-a" })).toBe(false);
  });

  it("denies non-organizer roles even within the same org", () => {
    expect(canAccessResourceFile({ role: "speaker", orgId: "org-a" }, { orgId: "org-a" })).toBe(false);
    expect(canAccessResourceFile({ role: "reviewer", orgId: "org-a" }, { orgId: "org-a" })).toBe(false);
  });
});
