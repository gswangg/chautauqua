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

// DEC-326: public.ts is now a re-export barrel (contention decomposition) —
// this probe cites the submodules under src/server/repo/public/ that OWN
// each behaviour post-decomposition, rather than the barrel file.
const repoDir = join(__dirname, "..", "src", "server", "repo");
const gatesSrc = readFileSync(join(repoDir, "public", "gates.ts"), "utf-8");
const sessionsSrc = readFileSync(join(repoDir, "public", "sessions.ts"), "utf-8");
const detailSrc = readFileSync(join(repoDir, "public", "detail.ts"), "utf-8");
const agendaSrc = readFileSync(join(repoDir, "public", "agenda.ts"), "utf-8");
const speakersSrc = readFileSync(join(repoDir, "public", "speakers.ts"), "utf-8");
const eventSrc = readFileSync(join(repoDir, "public", "event.ts"), "utf-8");
const barrelSrc = readFileSync(join(repoDir, "public.ts"), "utf-8");
const allPublicSrc = [gatesSrc, sessionsSrc, detailSrc, agendaSrc, speakersSrc, eventSrc, barrelSrc].join("\n");

function fnBody(src: string, marker: string): string {
  const bodyStart = src.indexOf(marker);
  expect(bodyStart).toBeGreaterThan(-1);
  const nextFnStart = src.indexOf("\nexport ", bodyStart + 1);
  return src.slice(bodyStart, nextFnStart === -1 ? undefined : nextFnStart);
}

describe("DEC-274: session gate vs participant gate", () => {
  it("visibleSessionConditions body contains no reference to schema.participant", () => {
    const body = fnBody(gatesSrc, "export function visibleSessionConditions");
    expect(body).not.toContain("schema.participant");
  });

  it.each([
    { marker: "async function getVisibleSubmissionIdsOrdered", src: sessionsSrc },
    { marker: "export async function getPublicSessionsByIds", src: sessionsSrc },
    { marker: "export async function getPublicSessionDetail", src: detailSrc },
    { marker: "export async function getPublicAgenda", src: agendaSrc },
  ])("$marker gates on visibleSessionConditions() and does not innerJoin(participant)", ({ marker, src }) => {
    const body = fnBody(src, marker);
    expect(body).toContain("visibleSessionConditions()");
    expect(body).not.toContain(".innerJoin(schema.participant");
  });
});

describe("DEC-108: invite-state gating on public surfaces", () => {
  // DEC-180 (wave-75 amendment, ruling (a)): the SQL gate COMPOSES the
  // declared ACTIVE_INVITE_STATUSES constant and must never re-type a second
  // literal pair — a hand-inlined ['none','accepted'] here would not track a
  // change to the declared constant. So this scan no longer demands the
  // literals inline; it demands the inArray narrow on inviteStatus and that
  // the operand be the shared constant. The MEMBER SET itself is pinned at
  // runtime (bound-param inspection) by
  // test/public-gates-active-invite-statuses.test.ts, which is strictly
  // stronger than a source-text literal match.
  it("visibleParticipantConditions narrows inviteStatus via the shared ACTIVE_INVITE_STATUSES constant", () => {
    const body = fnBody(gatesSrc, "export function visibleParticipantConditions");
    expect(body).toContain("inArray(schema.participant.inviteStatus,");
    expect(body).toContain("ACTIVE_INVITE_STATUSES");
    // The literals must NOT be re-typed at the gate (DEC-180 ruling (a)).
    expect(body).not.toContain('"none"');
    expect(body).not.toContain('"accepted"');
    // …and the constant is genuinely imported, not a local shadow.
    expect(gatesSrc).toContain("ACTIVE_INVITE_STATUSES");
    expect(gatesSrc).toMatch(/import\s*\{[^}]*ACTIVE_INVITE_STATUSES[^}]*\}\s*from/);
  });

  it("the hydrateSessions speaker-hydration query gates on visibleParticipantConditions()", () => {
    const body = fnBody(sessionsSrc, "export async function hydrateSessions");
    const speakerQueryStart = body.indexOf("schema.participant.submissionId, batch");
    expect(speakerQueryStart).toBeGreaterThan(-1);
    const speakerQuery = body.slice(speakerQueryStart - 200, speakerQueryStart + 400);
    expect(speakerQuery).toContain("visibleParticipantConditions()");
  });

  it("'declined' never appears as an allowed invite-status literal", () => {
    expect(allPublicSrc).not.toContain("declined");
  });

  it("getPublicSpeakerDetail (DEC-151 speaker drill-in) gates on visibleSubmissionConditions", () => {
    const body = fnBody(detailSrc, "export async function getPublicSpeakerDetail");
    expect(body).toContain("visibleSubmissionConditions()");
    expect(body).toContain("if (rows.length === 0) return null;");
  });

  it("getPublicSessionDetail (DEC-151 session drill-in) gates on visibleSessionConditions", () => {
    const body = fnBody(detailSrc, "export async function getPublicSessionDetail");
    expect(body).toContain("visibleSessionConditions()");
    expect(body).toContain("if (visibleRows.length === 0) return null;");
  });
});
