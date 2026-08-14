// DEC-945 (wave-6 amendment): the pure /portal/* route manifest speakerGate
// consults before deciding a role redirect vs a 404. Mirrors
// test coverage style for src/lib/admin-routes.ts's matchesAdminRoute.

import { describe, expect, it } from "vitest";
import { matchesPortalRoute } from "../src/lib/portal-routes";

describe("matchesPortalRoute", () => {
  it("matches every declared static and param route", () => {
    expect(matchesPortalRoute("/")).toBe(true);
    expect(matchesPortalRoute("/submissions")).toBe(true);
    expect(matchesPortalRoute("/submissions/abc123")).toBe(true);
    expect(matchesPortalRoute("/submissions/abc123/edit")).toBe(true);
    expect(matchesPortalRoute("/submissions/abc123/participants")).toBe(true);
    expect(matchesPortalRoute("/invitations/p1")).toBe(true);
    expect(matchesPortalRoute("/profile")).toBe(true);
    expect(matchesPortalRoute("/tasks")).toBe(true);
    expect(matchesPortalRoute("/tasks/a1/form")).toBe(true);
    expect(matchesPortalRoute("/tasks/a1/complete")).toBe(true);
    expect(matchesPortalRoute("/tasks/a1/upload")).toBe(true);
    expect(matchesPortalRoute("/tasks/a1/comments")).toBe(true);
    expect(matchesPortalRoute("/tasks/a1/file")).toBe(true);
    expect(matchesPortalRoute("/tasks/a1/file/f1")).toBe(true);
    expect(matchesPortalRoute("/resources")).toBe(true);
    expect(matchesPortalRoute("/resources/r1/download")).toBe(true);
  });

  it("rejects an unknown path, an unknown suffix on a real prefix, and a missing param segment", () => {
    expect(matchesPortalRoute("/nope")).toBe(false);
    expect(matchesPortalRoute("/tasks/a1/nope")).toBe(false);
    expect(matchesPortalRoute("/submissions/")).toBe(false);
    expect(matchesPortalRoute("/submissions/abc123/nope")).toBe(false);
  });
});
