import type { DocsArticle } from "./types";

export const callForPapersAndSubmissions: DocsArticle = {
  slug: "call-for-papers-and-submissions",
  group: "running-an-event",
  title: "Call for papers and submissions",
  standfirst:
    "You make the call-for-papers form and publish its link. Submissions come in with the pending status. Triage moves each submission to a decision. A decision does not send an email.",
  blocks: [
    { kind: "heading", text: "The form builder" },
    {
      kind: "prose",
      text: "You make a call-for-papers form from fields. The built-in fields include the title, the description, the track, and the format. You can add custom questions: 'short text', 'long text', 'single choice', or 'multiple choice'. You can mark each custom field as required. You also select the tracks that the form shows.",
    },
    {
      kind: "prose",
      text: "A custom question can be conditional. A field can have a rule that keeps it out of view unless the answer to a different field matches a value that you set. For example, a 'co-speaker email' question can show only after the answer 'yes' to 'will you have a co-presenter?'. Rules connect in sequence: if a field is out of view, each field with a condition on it is also out of view.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-call-for-papers-and-submissions-01",
      caption:
        "The form builder. The settings of a field, with its visibility rule, open in a dialog above the question list. Required fields and custom questions are in the same list as the built-in fields.",
    },
    { kind: "heading", text: "The public link" },
    {
      kind: "prose",
      text: "When a form has an open date, its public submission link is live at the public URL of the event. Each person with the link can submit. No account and no login are necessary. The form accepts submissions only in its open period, between the open date and the close date. Out of that period, the public page shows a message and not the form.",
    },
    { kind: "heading", text: "Triage and the status pipeline" },
    {
      kind: "prose",
      text: "Each submission starts with the pending status. Triage moves it into accept_queue or decline_queue. These two are not decisions: they only show the direction that triage points to. The last step moves a queued submission to accepted or declined. A sixth status, waitlisted, is a hold and not a decision. A waitlisted submission can move to one of the two last statuses at a subsequent time.",
    },
    {
      kind: "list",
      items: [
        "pending — the submission came in and is not triaged.",
        "accept_queue / decline_queue — the direction that triage points to, not a decision.",
        "accepted / declined — the decision. When you accept a submission, the speaker portal and the onboarding tasks turn on for its speakers.",
        "waitlisted — a hold. The submission can always move to accepted or declined.",
      ],
    },
    {
      kind: "prose",
      text: "A submission can always move between all of these statuses. Statuses can change in the two directions. This rule makes the next rule safe: a decision does not send an email. When you move a submission to accepted or declined, only its status changes. If you want to tell the speaker, you send that notification as a second, different step. For example, you can accept a batch first and then send all the accept emails together at a time that you select.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-call-for-papers-and-submissions-02",
      caption:
        "The submissions worklist: each submission for the event, with its status shown as a pill. Select a batch and apply one status change to all of the selected submissions at the same time. A status change here does not send an email.",
    },
  ],
};
