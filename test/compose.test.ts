import { describe, expect, it } from "vitest";
import {
  buildMergeVars,
  expandRecipients,
  formatFeedback,
  MAX_COMPOSE_RECIPIENTS,
  NO_DUE_DATE_TEXT,
  NO_FEEDBACK_TEXT,
  NO_TASKS_TEXT,
  preflightRender,
  type ComposeSubmission,
  type RenderTarget,
} from "../src/domain/compose";

// DEC-792: buildMergeVars now always requires taskList/dueDate — these
// tests are scoped to feedback behavior, so pass fixed placeholder values.
const TASK_LIST = "- Submit slides — due Mon, 01 Mar 2027";
const DUE_DATE = "Mon, 01 Mar 2027";

function participant(contactId: string, email = `${contactId}@example.com`) {
  return { contactId, firstName: "Ada", lastName: "Lovelace", email };
}

describe("expandRecipients", () => {
  it("produces one (contactId, submissionId) row per participant", () => {
    const submissions: ComposeSubmission[] = [
      { id: "sub_1", title: "On Engines", seq: 1, participants: [participant("ct_1"), participant("ct_2")] },
      { id: "sub_2", title: "On Looms", seq: 2, participants: [participant("ct_1")] },
    ];
    const result = expandRecipients(submissions);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.recipients).toEqual([
      { contactId: "ct_1", submissionId: "sub_1", email: "ct_1@example.com", name: "Ada Lovelace" },
      { contactId: "ct_2", submissionId: "sub_1", email: "ct_2@example.com", name: "Ada Lovelace" },
      { contactId: "ct_1", submissionId: "sub_2", email: "ct_1@example.com", name: "Ada Lovelace" },
    ]);
  });

  it("rejects 'invalid' when the expanded count exceeds the 100-recipient cap", () => {
    const submissions: ComposeSubmission[] = [
      {
        id: "sub_1",
        title: "Big talk",
        seq: 1,
        participants: Array.from({ length: MAX_COMPOSE_RECIPIENTS + 1 }, (_, i) => participant(`ct_${i}`)),
      },
    ];
    const result = expandRecipients(submissions);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.error).toBe("invalid");
  });

  it("accepts exactly the cap", () => {
    const submissions: ComposeSubmission[] = [
      {
        id: "sub_1",
        title: "Big talk",
        seq: 1,
        participants: Array.from({ length: MAX_COMPOSE_RECIPIENTS }, (_, i) => participant(`ct_${i}`)),
      },
    ];
    const result = expandRecipients(submissions);
    expect(result.ok).toBe(true);
  });
});

describe("formatFeedback", () => {
  it("anonymizes comments as 'Reviewer N: ...' bullets in order", () => {
    const out = formatFeedback(["Great talk!", "Needs more detail."]);
    expect(out).toBe("Reviewer 1: Great talk!\nReviewer 2: Needs more detail.");
  });

  it("renders the stated value for zero comments", () => {
    expect(formatFeedback([])).toBe(NO_FEEDBACK_TEXT);
  });

  it("drops blank/whitespace-only comments and renumbers the rest", () => {
    expect(formatFeedback(["  ", "Solid.", ""])).toBe("Reviewer 1: Solid.");
  });

  it("renders the stated value when all comments are blank", () => {
    expect(formatFeedback(["", "   "])).toBe(NO_FEEDBACK_TEXT);
  });
});

describe("buildMergeVars", () => {
  it("builds the DEC-006 merge vars for one recipient, feedback included", () => {
    const vars = buildMergeVars({
      speakerName: "Ada Lovelace",
      talkTitle: "On Engines",
      eventName: "DevCon",
      portalLink: "https://example.com/portal",
      feedbackComments: ["Loved it"],
      taskList: TASK_LIST,
      dueDate: DUE_DATE,
    });
    expect(vars).toEqual({
      speaker_name: "Ada Lovelace",
      talk_title: "On Engines",
      event_name: "DevCon",
      portal_link: "https://example.com/portal",
      feedback: "Reviewer 1: Loved it",
      task_list: TASK_LIST,
      task_due_date: DUE_DATE,
    });
  });

  it("uses the stated no-feedback value when no comments are given but feedback WAS attached (empty array)", () => {
    const vars = buildMergeVars({
      speakerName: "Ada",
      talkTitle: "Title",
      eventName: "DevCon",
      portalLink: "/portal",
      feedbackComments: [],
      taskList: TASK_LIST,
      dueDate: DUE_DATE,
    });
    expect(vars.feedback).toBe(NO_FEEDBACK_TEXT);
  });

  it("DEC-682: omits the feedback key entirely when feedback was NOT attached (null)", () => {
    const vars = buildMergeVars({
      speakerName: "Ada",
      talkTitle: "Title",
      eventName: "DevCon",
      portalLink: "/portal",
      feedbackComments: null,
      taskList: TASK_LIST,
      dueDate: DUE_DATE,
    });
    expect(vars).toEqual({
      speaker_name: "Ada",
      talk_title: "Title",
      event_name: "DevCon",
      portal_link: "/portal",
      task_list: TASK_LIST,
      task_due_date: DUE_DATE,
    });
    expect("feedback" in vars).toBe(false);
  });
});

describe("preflightRender", () => {
  const subjectTemplate = "Update on {talk_title}";
  const bodyTemplate = "Hi {speaker_name}, see {portal_link}. {feedback}";

  function target(overrides: Partial<RenderTarget> = {}): RenderTarget {
    return {
      contactId: "ct_1",
      submissionId: "sub_1",
      email: "ada@example.com",
      name: "Ada Lovelace",
      ref: "DFC-001",
      scheduled: true,
      vars: {
        talk_title: "On Engines",
        speaker_name: "Ada Lovelace",
        portal_link: "/portal",
        feedback: NO_FEEDBACK_TEXT,
      },
      ...overrides,
    };
  }

  it("renders every recipient when all merge fields resolve", () => {
    const result = preflightRender([target(), target({ contactId: "ct_2", submissionId: "sub_2" })], subjectTemplate, bodyTemplate);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.rendered).toHaveLength(2);
    expect(result.rendered[0]?.subject).toBe("Update on On Engines");
  });

  it("rejects the WHOLE batch as 'invalid' when even one recipient is missing a field, before any send", () => {
    const goodTarget = target();
    const badTarget = target({ contactId: "ct_2", submissionId: "sub_2", vars: { talk_title: "Missing speaker" } });
    const result = preflightRender([goodTarget, badTarget], subjectTemplate, bodyTemplate);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.error).toBe("invalid");
    // Missing-field details identify which recipient/field failed.
    expect(result.missing.some((m) => m.contactId === "ct_2" && m.fields.includes("speaker_name"))).toBe(true);
  });

  it("reports one entry per recipient naming every missing field from both the subject and body templates", () => {
    const badTarget = target({ vars: {} });
    const result = preflightRender([badTarget], subjectTemplate, bodyTemplate);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    // DEC-856: a blank vars map yields ONE entry naming every unresolved
    // placeholder across both templates — subject's misses first, then
    // body's, deduped — not one entry per template/field.
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0]?.contactId).toBe("ct_1");
    expect([...result.missing[0]!.fields].sort()).toEqual(["feedback", "portal_link", "speaker_name", "talk_title"]);
  });

  it("DEC-856: a recipient missing two fields across subject and body produces ONE entry carrying both", () => {
    const missingBoth = target({
      contactId: "ct_3",
      submissionId: "sub_3",
      vars: { portal_link: "/portal", feedback: NO_FEEDBACK_TEXT },
    });
    const result = preflightRender([missingBoth], subjectTemplate, bodyTemplate);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.missing).toEqual([
      { contactId: "ct_3", submissionId: "sub_3", fields: ["talk_title", "speaker_name"] },
    ]);
  });

  it("DEC-682: a {feedback} template sent with the feedback toggle off (vars built from feedbackComments: null) names 'feedback' as missing, never a silently-invented value", () => {
    // Mirrors buildMergeVars({ ..., feedbackComments: null }): the merge
    // vars map for this recipient simply has no `feedback` key.
    const noFeedbackVars = target({
      vars: { talk_title: "On Engines", speaker_name: "Ada Lovelace", portal_link: "/portal" },
    });
    const result = preflightRender([noFeedbackVars], subjectTemplate, bodyTemplate);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.missing).toEqual([{ contactId: "ct_1", submissionId: "sub_1", fields: ["feedback"] }]);
  });

  // DEC-792: growing the COMPOSE_MERGE_FIELDS vocabulary to close the
  // seeded-template landmine — a Content-Reminder-shaped template ({task_list}
  // / {due_date}) must preflight clean for a recipient WITH outstanding tasks
  // and for one with NONE (buildMergeVars always sets both keys). This
  // template still spells the alias {due_date} (wave-45 amendment made
  // task_due_date canonical) against vars keyed task_due_date, exercising
  // the permanent-alias resolution end to end.
  describe("DEC-792: a Content-Reminder-shaped {task_list}/{due_date} template", () => {
    const reminderSubject = "Reminder: {task_list} due {due_date}";
    const reminderBody =
      "Hi {speaker_name}, this is a friendly reminder that the following onboarding tasks are due " +
      "{due_date}: {task_list}. Please complete them via the speaker portal: {portal_link}. Thanks!";

    it("preflights clean for a recipient with outstanding tasks", () => {
      const vars = buildMergeVars({
        speakerName: "Ada Lovelace",
        talkTitle: "On Engines",
        eventName: "DevCon",
        portalLink: "https://example.com/portal",
        feedbackComments: null,
        taskList: "- Submit slides — due Mon, 01 Mar 2027",
        dueDate: "Mon, 01 Mar 2027",
      });
      const result = preflightRender(
        [target({ vars })],
        reminderSubject,
        reminderBody,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok");
      expect(result.rendered[0]?.subject).toBe("Reminder: - Submit slides — due Mon, 01 Mar 2027 due Mon, 01 Mar 2027");
    });

    it("preflights clean for a recipient with zero outstanding tasks (NO_TASKS_TEXT/NO_DUE_DATE_TEXT)", () => {
      const vars = buildMergeVars({
        speakerName: "Ada Lovelace",
        talkTitle: "On Engines",
        eventName: "DevCon",
        portalLink: "https://example.com/portal",
        feedbackComments: null,
        taskList: NO_TASKS_TEXT,
        dueDate: NO_DUE_DATE_TEXT,
      });
      const result = preflightRender(
        [target({ vars })],
        reminderSubject,
        reminderBody,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok");
      expect(result.rendered[0]?.subject).toBe(`Reminder: ${NO_TASKS_TEXT} due ${NO_DUE_DATE_TEXT}`);
    });
  });
});
