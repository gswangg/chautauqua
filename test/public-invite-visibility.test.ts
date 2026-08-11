// DEC-108/DEC-274 source-scan guard: the session-visibility gate
// (visibleSessionConditions) must never reference schema.participant, and
// every session-rooted public query must gate on visibleSessionConditions()
// alone (no mandatory innerJoin(participant)) — DEC-274 splits the session
// gate from the participant gate (visibleParticipantConditions) so a
// speakerless or all-hidden-speaker session stays publicly visible. Every
// participant-gating query (visibleParticipantConditions() and the
// standalone speaker-hydration query in hydrateSessions, which does not
// route through visibleSubmissionConditions()) must still gate on
// participant.invite_status IN ('none','accepted').
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const publicSrc = readFileSync(
  join(__dirname, "..", "src", "server", "repo", "public.ts"),
  "utf-8",
);

function fnBody(src: string, marker: string): string {
  const bodyStart = src.indexOf(marker);
  expect(bodyStart).toBeGreaterThan(-1);
  const nextFnStart = src.indexOf("\nexport ", bodyStart + 1);
  return src.slice(bodyStart, nextFnStart === -1 ? undefined : nextFnStart);
}

describe("DEC-274: session gate vs participant gate", () => {
  it("visibleSessionConditions body contains no reference to schema.participant", () => {
    const body = fnBody(publicSrc, "export function visibleSessionConditions");
    expect(body).not.toContain("schema.participant");
  });

  it.each([
    "async function getVisibleSubmissionIdsOrdered",
    "export async function getPublicSessionsByIds",
    "export async function getPublicSessionDetail",
    "export async function getPublicAgenda",
  ])("%s gates on visibleSessionConditions() and does not innerJoin(participant)", (marker) => {
    const body = fnBody(publicSrc, marker);
    expect(body).toContain("visibleSessionConditions()");
    expect(body).not.toContain(".innerJoin(schema.participant");
  });
});

describe("DEC-108: invite-state gating on public surfaces", () => {
  it("visibleParticipantConditions body includes the inviteStatus inArray with both literals", () => {
    const body = fnBody(publicSrc, "export function visibleParticipantConditions");
    expect(body).toContain("inArray(schema.participant.inviteStatus,");
    expect(body).toContain('"none"');
    expect(body).toContain('"accepted"');
  });

  it("the hydrateSessions speaker-hydration query gates on visibleParticipantConditions()", () => {
    const body = fnBody(publicSrc, "async function hydrateSessions");
    const speakerQueryStart = body.indexOf("schema.participant.submissionId, batch");
    expect(speakerQueryStart).toBeGreaterThan(-1);
    const speakerQuery = body.slice(speakerQueryStart - 200, speakerQueryStart + 400);
    expect(speakerQuery).toContain("visibleParticipantConditions()");
  });

  it("'declined' never appears as an allowed invite-status literal", () => {
    expect(publicSrc).not.toContain("declined");
  });

  it("getPublicSpeakerDetail (DEC-151 speaker drill-in) gates on visibleSubmissionConditions", () => {
    const body = fnBody(publicSrc, "export async function getPublicSpeakerDetail");
    expect(body).toContain("visibleSubmissionConditions()");
    expect(body).toContain("if (rows.length === 0) return null;");
  });

  it("getPublicSessionDetail (DEC-151 session drill-in) gates on visibleSessionConditions", () => {
    const body = fnBody(publicSrc, "export async function getPublicSessionDetail");
    expect(body).toContain("visibleSessionConditions()");
    expect(body).toContain("if (visibleRows.length === 0) return null;");
  });
});
