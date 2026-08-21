// DEC-936 (wave-19 amendment): "a comms recipient is a PERSON, and a batch
// dedupes by contactId unless the composed message spends a per-submission
// merge field". Covers:
//   1. a contact on 3 submissions collapses to 1 row when the composed
//      subject+body is generic (spends none of PER_SUBMISSION_MERGE_VARS).
//   2. the same contact stays at 3 rows when the body spends {talk_title}.
//   3. MAX_COMPOSE_RECIPIENTS is enforced on the FINAL (post-collapse) list,
//      not the pre-collapse expansion.
//   4. collapsing keeps the FIRST occurrence, in the same deterministic
//      order test/compose-order.test.ts pins for expandRecipients.

import { describe, expect, it } from "vitest";
import {
  expandRecipients,
  MAX_COMPOSE_RECIPIENTS,
  PER_SUBMISSION_MERGE_VARS,
  spendsPerSubmissionVars,
  type ComposeSubmission,
} from "../src/domain/compose";

function participant(contactId: string, email = `${contactId}@example.com`) {
  return { contactId, firstName: "Ada", lastName: "Lovelace", email };
}

describe("spendsPerSubmissionVars (DEC-936 wave-19)", () => {
  it("is false for a generic message with no merge fields at all", () => {
    expect(spendsPerSubmissionVars("Hello, thanks for speaking.")).toBe(false);
  });

  it("is false for a message that spends only per-person/global merge fields", () => {
    expect(spendsPerSubmissionVars("Hi {speaker_name}, see you at {event_name}. {portal_link}")).toBe(false);
  });

  it("is false for a message that spends only per-contact merge fields (task_list/task_due_date)", () => {
    expect(spendsPerSubmissionVars("Your tasks: {task_list}, due {task_due_date}")).toBe(false);
  });

  it("is true when the message spends {talk_title}", () => {
    expect(spendsPerSubmissionVars("Update on {talk_title}")).toBe(true);
  });

  it("is true when the message spends {session_time}", () => {
    expect(spendsPerSubmissionVars("Your slot is {session_time}")).toBe(true);
  });

  it("is true when the message spends {feedback}", () => {
    expect(spendsPerSubmissionVars("Reviewer notes: {feedback}")).toBe(true);
  });

  it("PER_SUBMISSION_MERGE_VARS contains exactly the submission-scoped tokens", () => {
    expect([...PER_SUBMISSION_MERGE_VARS].sort()).toEqual(["feedback", "session_time", "talk_title"]);
  });
});

describe("expandRecipients dedup by contactId (DEC-936 wave-19)", () => {
  const threeSubs: ComposeSubmission[] = [
    { id: "sub_1", title: "On Engines", seq: 1, participants: [participant("ct_1")] },
    { id: "sub_2", title: "On Looms", seq: 2, participants: [participant("ct_1")] },
    { id: "sub_3", title: "On Bridges", seq: 3, participants: [participant("ct_1")] },
  ];

  it("collapses a contact on 3 submissions to 1 row when the body is generic", () => {
    const result = expandRecipients(threeSubs, { perSubmissionVarsSpent: false });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.recipients).toHaveLength(1);
    expect(result.recipients).toEqual([
      { contactId: "ct_1", submissionId: "sub_1", email: "ct_1@example.com", name: "Ada Lovelace" },
    ]);
  });

  it("keeps all 3 rows when the composed body spends {talk_title}", () => {
    const result = expandRecipients(threeSubs, { perSubmissionVarsSpent: true });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.recipients).toHaveLength(3);
    expect(result.recipients.map((r) => r.submissionId)).toEqual(["sub_1", "sub_2", "sub_3"]);
  });

  it("defaults to no collapsing when opts is omitted (existing callers unchanged)", () => {
    const result = expandRecipients(threeSubs);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.recipients).toHaveLength(3);
  });

  it("collapse keeps the FIRST occurrence in existing iteration order for a mixed batch", () => {
    const submissions: ComposeSubmission[] = [
      { id: "sub_a", title: "Talk A", seq: 1, participants: [participant("ct_1"), participant("ct_2")] },
      { id: "sub_b", title: "Talk B", seq: 2, participants: [participant("ct_1")] },
      { id: "sub_c", title: "Talk C", seq: 3, participants: [participant("ct_3")] },
    ];
    const result = expandRecipients(submissions, { perSubmissionVarsSpent: false });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.recipients).toEqual([
      { contactId: "ct_1", submissionId: "sub_a", email: "ct_1@example.com", name: "Ada Lovelace" },
      { contactId: "ct_2", submissionId: "sub_a", email: "ct_2@example.com", name: "Ada Lovelace" },
      { contactId: "ct_3", submissionId: "sub_c", email: "ct_3@example.com", name: "Ada Lovelace" },
    ]);
  });

  it("applies MAX_COMPOSE_RECIPIENTS to the FINAL (post-collapse) list, not the pre-collapse expansion", () => {
    // One contact appears on 3x the cap worth of submissions — pre-collapse
    // this would reject as over-cap, but post-collapse it's a single row.
    const submissions: ComposeSubmission[] = Array.from({ length: MAX_COMPOSE_RECIPIENTS * 3 }, (_, i) => ({
      id: `sub_${i}`,
      title: `Talk ${i}`,
      seq: i + 1,
      participants: [participant("ct_1")],
    }));
    const result = expandRecipients(submissions, { perSubmissionVarsSpent: false });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.recipients).toHaveLength(1);
  });

  it("still rejects over-cap when the composed text spends a per-submission var (no collapsing to save it)", () => {
    const submissions: ComposeSubmission[] = Array.from({ length: MAX_COMPOSE_RECIPIENTS + 1 }, (_, i) => ({
      id: `sub_${i}`,
      title: `Talk ${i}`,
      seq: i + 1,
      participants: [participant(`ct_${i}`)],
    }));
    const result = expandRecipients(submissions, { perSubmissionVarsSpent: true });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.error).toBe("invalid");
  });

  it("still rejects over-cap post-collapse when distinct contacts alone exceed the cap", () => {
    const submissions: ComposeSubmission[] = Array.from({ length: MAX_COMPOSE_RECIPIENTS + 1 }, (_, i) => ({
      id: `sub_${i}`,
      title: `Talk ${i}`,
      seq: i + 1,
      participants: [participant(`ct_${i}`)],
    }));
    const result = expandRecipients(submissions, { perSubmissionVarsSpent: false });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.error).toBe("invalid");
  });
});
