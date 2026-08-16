import type { DocsArticle } from "./types";

export const callForPapersAndSubmissions: DocsArticle = {
  slug: "call-for-papers-and-submissions",
  group: "running-an-event",
  title: "Call for papers and submissions",
  standfirst:
    "You build the call-for-papers form and publish its link. Submissions arrive with the pending status. Triage moves each submission toward a decision. A decision never sends an email by itself.",
  blocks: [
    { kind: "heading", text: "Building the form" },
    {
      kind: "prose",
      text: "You build a call-for-papers form from fields. The built-in fields include the title, the description, the track, and the format. You can add custom questions: short text, long text, single choice, or multiple choice. You can mark each custom field as required. You also choose the tracks that the form offers.",
    },
    {
      kind: "prose",
      text: "A custom question can be conditional. A field can carry a rule that hides it unless the answer to another field matches a value that you set. For example, a 'co-speaker email' question can appear only after the answer 'yes' to 'will you have a co-presenter?'. Rules chain: if an earlier field is hidden, each field that is conditioned on it is also hidden.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-call-for-papers-and-submissions-01",
      caption:
        "The form builder. The settings of a field, with its visibility rule, open in a dialog over the question list. Required fields and custom questions are in the same list as the built-in fields.",
    },
    { kind: "heading", text: "The public link" },
    {
      kind: "prose",
      text: "When a form has an open date, its public submission link is live at the public URL of the event. Every person with the link can submit. No account and no login are necessary. The form accepts submissions only inside its open and close window. Outside the window, the public page shows a message instead of the form.",
    },
    { kind: "heading", text: "Triage and the status pipeline" },
    {
      kind: "prose",
      text: "Every submission starts with the pending status. Triage moves it into accept_queue or decline_queue. These two are staging states: they show where triage leans, but they are not a decision. The final step moves a queued submission to accepted or declined. A sixth status, waitlisted, is a hold and not a decision. A waitlisted submission can move to either final status later.",
    },
    {
      kind: "list",
      items: [
        "pending — the submission arrived and is not yet triaged.",
        "accept_queue / decline_queue — the working sort of triage, not yet final.",
        "accepted / declined — the decision. When you accept a submission, the speaker portal and the onboarding tasks turn on for its speakers.",
        "waitlisted — a hold. The submission can move to accepted or declined at any time.",
      ],
    },
    {
      kind: "prose",
      text: "A submission can move between all of these statuses at any time. There is no one-way gate. This rule makes the next rule safe: a decision never sends an email on its own. When you move a submission to accepted or declined, only its status changes. If you want to notify the speaker, you send that notification as a separate action. For example, you can accept a batch at night and send the acceptance emails together the next morning.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-call-for-papers-and-submissions-02",
      caption:
        "The submissions worklist: every submission for the event, with its status shown as a pill. Select a batch and apply one status change to all of the selected submissions at once. A status change here never sends an email.",
    },
  ],
};
