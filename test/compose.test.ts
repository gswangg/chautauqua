import { describe, expect, it } from "vitest";
import {
  buildMergeVars,
  expandRecipients,
  formatFeedback,
  MAX_COMPOSE_RECIPIENTS,
  NO_FEEDBACK_TEXT,
  preflightRender,
  type ComposeSubmission,
  type RenderTarget,
} from "../src/domain/compose";

function participant(contactId: string, email = `${contactId}@example.com`) {
  return { contactId, firstName: "Ada", lastName: "Lovelace", email };
}

describe("expandRecipients", () => {
  it("produces one (contactId, submissionId) row per participant", () => {
    const submissions: ComposeSubmission[] = [
      { id: "sub_1", title: "On Engines", participants: [participant("ct_1"), participant("ct_2")] },
      { id: "sub_2", title: "On Looms", participants: [participant("ct_1")] },
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
    });
    expect(vars).toEqual({
      speaker_name: "Ada Lovelace",
      talk_title: "On Engines",
      event_name: "DevCon",
      portal_link: "https://example.com/portal",
      feedback: "Reviewer 1: Loved it",
    });
  });

  it("uses the stated no-feedback value when no comments are given but feedback WAS attached (empty array)", () => {
    const vars = buildMergeVars({
      speakerName: "Ada",
      talkTitle: "Title",
      eventName: "DevCon",
      portalLink: "/portal",
      feedbackComments: [],
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
    });
    expect(vars).toEqual({
      speaker_name: "Ada",
      talk_title: "Title",
      event_name: "DevCon",
      portal_link: "/portal",
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
    expect(result.missing.some((m) => m.contactId === "ct_2" && m.field === "speaker_name")).toBe(true);
  });

  it("reports a missing field from both the subject and body templates for a fully-blank recipient", () => {
    const badTarget = target({ vars: {} });
    const result = preflightRender([badTarget], subjectTemplate, bodyTemplate);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    // renderTemplate throws on the first unresolved placeholder it hits per
    // template string, so a blank vars map yields one missing entry from the
    // subject template (talk_title) and one from the body template
    // (speaker_name, the first placeholder in bodyTemplate).
    const fields = result.missing.map((m) => m.field).sort();
    expect(fields).toEqual(["speaker_name", "talk_title"]);
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
    expect(result.missing).toEqual([{ contactId: "ct_1", submissionId: "sub_1", field: "feedback" }]);
  });
});
