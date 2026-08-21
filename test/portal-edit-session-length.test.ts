// DEC-777 (wave-148 amendment): the portal edit page's read-only
// "Session length" row (docs/design/Chautauqua Public and Portal.dc.html:620
// (390) / :1405 (desktop)) — "Talk, 30 min · set by the organisers".
// loadEditableSubmission reads the submission's session_format-role answer
// through the SAME answerFieldRoleCondition('session_format') predicate
// review/submissions.ts:908 already uses; the route renders it through the
// SAME sessionFormatLabel vocabulary (DEC-908) every other reader uses.
// When the answer is absent, or its stored label carries no parseable
// duration (sessionFormatLabel would hand back the raw label unchanged),
// the whole row is omitted -- never an empty box, never a fabricated
// default (DEC-895).
//
// This file uses a CALL-ORDER dispatch fake db (mirrors
// test/portal-input-bounds.test.ts's fakeDb/makeChain pattern), not the
// table-identity dispatch test/portal-edit-speaker-locked.test.ts uses --
// loadEditableSubmission now issues TWO distinct selects against
// schema.submissionAnswer (the full per-field answer map, and the
// role-scoped format-only read this task adds), and a table-keyed fake
// cannot tell them apart.

import { describe, expect, it } from "vitest";
import { loadEditableSubmission } from "../src/server/repo/portal-edit";
import { EditPage } from "../src/routes/portal/edit";
import type { EditableSubmissionData } from "../src/server/repo/portal-edit";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async (n: number) => rows.slice(0, n),
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

// selectQueue[0]=main join row, [1]=contact, [2]=fields, [3]=all answers,
// [4]=format-role answer (this task), [5]=tracks, [6]=selected tracks.
function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  return {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  } as unknown as Parameters<typeof loadEditableSubmission>[0];
}

const MAIN_ROW = {
  submissionId: "sub-1",
  status: "pending",
  title: "Taming 40-Minute CI",
  description: "desc",
  formId: "form-1",
  formCloseDate: null,
  formTracksJson: null,
  eventId: "event-1",
  eventTimezone: "America/Los_Angeles",
  participantContactId: "contact-1",
};

const CONTACT_ROW = {
  firstName: "Ana",
  lastName: "Reyes",
  email: "ana@example.com",
  title: null,
  company: null,
  bio: null,
};

function queueWith(formatRows: unknown[]): unknown[][] {
  return [[MAIN_ROW], [CONTACT_ROW], [], [], formatRows, [], []];
}

describe("loadEditableSubmission's session_format-role read (DEC-777)", () => {
  it("returns formatLabel from the role-scoped answer, verbatim (not yet passed through sessionFormatLabel)", async () => {
    const db = fakeDb(queueWith([{ valueJson: JSON.stringify("Talk (30 min)") }]));
    const data = await loadEditableSubmission(db, "org-1", "contact-1", "sub-1");
    expect(data?.formatLabel).toBe("Talk (30 min)");
  });

  it("is null when the submission carries no session_format-role answer", async () => {
    const db = fakeDb(queueWith([]));
    const data = await loadEditableSubmission(db, "org-1", "contact-1", "sub-1");
    expect(data?.formatLabel).toBeNull();
  });

  it("is null when the stored answer is the empty-string 'no real answer' shape (roleAnswerLabel's own grammar)", async () => {
    const db = fakeDb(queueWith([{ valueJson: JSON.stringify("") }]));
    const data = await loadEditableSubmission(db, "org-1", "contact-1", "sub-1");
    expect(data?.formatLabel).toBeNull();
  });
});

function baseProps(data: EditableSubmissionData) {
  return {
    branding: { eventName: "Event", welcomeMessage: null, accentColor: null, logoUrl: null },
    submissionId: "sub-1",
    data,
    answers: {},
    selectedTrackIds: [],
    csrfToken: "tok",
    editable: true,
    tracksEditable: true,
    participants: [],
    speakerName: "Ana Reyes",
  };
}

function baseData(formatLabel: string | null): EditableSubmissionData {
  return {
    submission: { id: "sub-1", status: "pending", title: "Taming 40-Minute CI", description: "desc" },
    form: { id: "form-1", closeDate: null, timezone: "America/Los_Angeles" },
    fields: [],
    answers: {},
    offeredTrackIds: [],
    allTracks: [],
    selectedTrackIds: [],
    formatLabel,
  };
}

describe("EditPage's Session length row (DEC-777, Chautauqua Public and Portal.dc.html:620/:1405)", () => {
  it("renders the section label and 'set by the organisers' reading when the format parses a duration", () => {
    const html = EditPage(baseProps(baseData("Talk (30 min)"))).toString();
    expect(html).toContain("Session length");
    expect(html).toContain("Talk, 30 min · set by the organisers");
  });

  it("omits the whole row when there is no session_format-role answer", () => {
    const html = EditPage(baseProps(baseData(null))).toString();
    expect(html).not.toContain("Session length");
    expect(html).not.toContain("set by the organisers");
  });

  it("omits the whole row when the stored label has no parseable '(N min)' duration (sessionFormatLabel would hand it back unchanged, DEC-895's 'never a fabricated default')", () => {
    const html = EditPage(baseProps(baseData("Panel (in Spanish)"))).toString();
    expect(html).not.toContain("Session length");
    expect(html).not.toContain("set by the organisers");
  });
});

