// DEC-020 amendment (wave 43): re-upload reopen disclosure was RULED
// DELIBERATE and ADEQUATELY DISCLOSED at both doors. This file is the
// falsifying pin the wave-43 DEC-020 amendment cites for the four
// task-w43-e assertions, PLUS one genuinely new coverage gap found while
// auditing.
//
// Already covered elsewhere (extended, not duplicated, here):
//   - test/portal-tasks.test.ts, describe "portal tasks page — DEC-020
//     amendment: re-upload review notice":
//       "renders the reopen-review notice for a submission-linked
//       (deliverableKind set) file_request assignment" (pending-status row)
//       "renders NO notice for a plain handout (deliverableKind null)
//       file_request assignment" (the negative control)
//       "renders a post-upload receipt naming the assignment when
//       ?uploaded=<id> is present" (the AFTER-upload redirect receipt)
//   - test/content-reupload-reopens.test.ts, describe "POST
//     /api/v1/submissions/:id/files reopens content review on a new
//     deliverable version (DEC-020 amendment)":
//       "the 201 reports contentReviewReopened:true ... for an approved
//       submission" and "...:false for an already-pending submission"
//
// NEW here: the existing portal-tasks.test.ts coverage only exercises
// ReuploadReviewNotice on the PENDING (first-upload) form. TaskRow renders
// the identical notice a second time on the COMPLETE/replace-file form
// (views.tsx:303, guarded by the same isValidFileKind(t.deliverableKind)
// predicate as the pending form at views.tsx:272) — that second call site
// was never exercised by any existing test. Pinned directly at the
// component level (no route/db harness needed) so a future edit that
// diverges the two guards is caught here.

import { describe, expect, it } from "vitest";
import { TaskRow } from "../src/routes/portal/tasks/views";
import type { PortalTaskAssignment } from "../src/server/repo/portal";

const NOTICE_TEXT_1 = "sends it back to the producer for review";
const NOTICE_TEXT_2 = "will not appear on the public schedule";

function baseAssignment(overrides: Partial<PortalTaskAssignment>): PortalTaskAssignment {
  return {
    id: "assign-file",
    taskId: "task-1",
    eventId: "event-1",
    kind: "file_request",
    title: "Upload your slides",
    description: null,
    instructions: null,
    dueDate: null,
    assignedAt: 0,
    required: false,
    status: "pending",
    formId: null,
    deliverableKind: null,
    fileId: null,
    responseJson: null,
    timezone: "UTC",
    completedAt: null,
    ...overrides,
  } as PortalTaskAssignment;
}

function renderTaskRow(assignment: PortalTaskAssignment, fileExtras?: unknown): string {
  const el = TaskRow({
    assignment,
    csrfToken: "tok",
    now: Date.now(),
    fileExtras: fileExtras as never,
  });
  return String(el);
}

describe("ReuploadReviewNotice (DEC-020 amendment, wave 43 pin) — component level", () => {
  it("renders for a submission-linked (deliverableKind set) PENDING file_request assignment", () => {
    const html = renderTaskRow(baseAssignment({ deliverableKind: "presentation" }));
    expect(html).toContain(NOTICE_TEXT_1);
    expect(html).toContain(NOTICE_TEXT_2);
  });

  it("NEGATIVE CONTROL: renders NOTHING for a plain handout assignment (deliverableKind null), pending state", () => {
    const html = renderTaskRow(baseAssignment({ deliverableKind: null }));
    expect(html).not.toContain(NOTICE_TEXT_1);
    expect(html).not.toContain(NOTICE_TEXT_2);
  });

  // NEW: the replace-file form on an already-COMPLETE submission-linked
  // deliverable task (views.tsx:293-310) renders the identical notice via a
  // second, independent isValidFileKind(t.deliverableKind) guard — never
  // exercised before this file.
  it("also renders on the COMPLETE/replace-file form for a submission-linked deliverable task", () => {
    const html = renderTaskRow(
      baseAssignment({ deliverableKind: "presentation", status: "complete" }),
      {
        filename: "slides.pdf",
        version: 1,
        uploadedAt: 0,
        comments: [],
        timezone: "UTC",
        versions: [{ id: "f1", version: 1, filename: "slides.pdf", uploadedAt: 0, isCurrent: true }],
      },
    );
    expect(html).toContain(NOTICE_TEXT_1);
  });

  // NEW negative control for the same COMPLETE/replace-file form: a plain
  // handout task that somehow reached 'complete' with fileExtras still
  // never shows the notice — the carve-out holds on both render sites.
  it("NEGATIVE CONTROL: does NOT render on the COMPLETE/replace-file form for a plain handout (deliverableKind null)", () => {
    const html = renderTaskRow(
      baseAssignment({ deliverableKind: null, status: "complete" }),
      {
        filename: "handout.pdf",
        version: 1,
        uploadedAt: 0,
        comments: [],
        timezone: "UTC",
        versions: [{ id: "f1", version: 1, filename: "handout.pdf", uploadedAt: 0, isCurrent: true }],
      },
    );
    expect(html).not.toContain(NOTICE_TEXT_1);
    expect(html).not.toContain(NOTICE_TEXT_2);
  });
});
