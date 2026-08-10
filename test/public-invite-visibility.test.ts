// DEC-108 source-scan guard: every public/embed surface must gate on
// participant.invite_status IN ('none','accepted') — both in the shared
// visibleSubmissionConditions() gate and in the standalone speaker-hydration
// query in hydrateSessions, which does not route through that gate.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const publicSrc = readFileSync(
  join(__dirname, "..", "src", "server", "repo", "public.ts"),
  "utf-8",
);

describe("DEC-108: invite-state gating on public surfaces", () => {
  it("visibleSubmissionConditions body includes the inviteStatus inArray with both literals", () => {
    const bodyStart = publicSrc.indexOf("export function visibleSubmissionConditions");
    expect(bodyStart).toBeGreaterThan(-1);
    const nextFnStart = publicSrc.indexOf("\nexport ", bodyStart + 1);
    const body = publicSrc.slice(bodyStart, nextFnStart === -1 ? undefined : nextFnStart);
    expect(body).toContain("inArray(schema.participant.inviteStatus,");
    expect(body).toContain('"none"');
    expect(body).toContain('"accepted"');
  });

  it("the hydrateSessions speaker-hydration query also gates on inviteStatus", () => {
    const bodyStart = publicSrc.indexOf("async function hydrateSessions");
    expect(bodyStart).toBeGreaterThan(-1);
    const nextFnStart = publicSrc.indexOf("\nexport ", bodyStart + 1);
    const body = publicSrc.slice(bodyStart, nextFnStart === -1 ? undefined : nextFnStart);
    // scope down to the speaker query specifically
    const speakerQueryStart = body.indexOf("schema.participant.submissionId, batch");
    expect(speakerQueryStart).toBeGreaterThan(-1);
    const speakerQuery = body.slice(speakerQueryStart - 200, speakerQueryStart + 400);
    expect(speakerQuery).toContain("inArray(schema.participant.inviteStatus,");
  });

  it("'declined' never appears as an allowed invite-status literal", () => {
    expect(publicSrc).not.toContain("declined");
  });
});
