import type { DocsArticle } from "./types";

export const callForPapersAndSubmissions: DocsArticle = {
  slug: "call-for-papers-and-submissions",
  group: "running-an-event",
  title: "Call for papers and submissions",
  standfirst:
    "You build the call-for-papers form and publish its link; submissions arrive as pending, triage moves each one toward a decision, and a decision never sends email on its own.",
  blocks: [
    { kind: "heading", text: "The form builder" },
    {
      kind: "prose",
      text: "A call-for-papers form is built from fields. Title, description, track, and format come built in; beyond those you can add custom questions — 'short text', 'long text', 'single choice', or 'multiple choice' — and mark any of them required. The form also carries the set of tracks it offers.",
    },
    {
      kind: "prose",
      text: "A custom question can be conditional: a rule hides the field unless the answer to another field matches a value you set. A 'co-speaker email' question, for example, can appear only after a 'yes' to 'will you have a co-presenter?'. Rules connect in sequence, so if a field is hidden, every field that depends on it stays hidden too.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-call-for-papers-and-submissions-01",
      caption:
        "The form builder. A field's settings, including its visibility rule, open in a dialog above the question list; custom questions and required flags live in the same list as the built-in fields.",
    },
    { kind: "heading", text: "The public link" },
    {
      kind: "prose",
      text: "Once a form has an open date, its public submission link is live at the event's public URL, and anyone with the link can submit — no account, no login. The form accepts submissions only inside its open window, between the open and close dates; outside that window the public page shows a message instead of the form.",
    },
    { kind: "heading", text: "Triage and the status pipeline" },
    {
      kind: "prose",
      text: "Every submission starts as pending. Triage moves it into accept_queue or decline_queue — not decisions, just the direction triage points — and the final step moves a queued submission to accepted or declined. A sixth status, waitlisted, is a hold rather than a decision; a waitlisted submission can still move to either final status later.",
    },
    {
      kind: "list",
      items: [
        "pending — the submission arrived and is not yet triaged.",
        "accept_queue / decline_queue — the direction triage points, not a decision.",
        "accepted / declined — the decision. Accepting a submission turns on the speaker portal and the onboarding tasks for its speakers.",
        "waitlisted — a hold. The submission can still move to accepted or declined.",
      ],
    },
    {
      kind: "prose",
      text: "Statuses move in both directions, and a submission can move between any of them at any time. That freedom is safe because a decision never sends email on its own — moving a submission to accepted or declined changes its status and nothing else. Notifying the speaker is always a separate, deliberate step, so you can accept a whole batch first and then send the accept emails together at a time you choose.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-call-for-papers-and-submissions-02",
      caption:
        "The submissions worklist: every submission for the event, with its status shown as a pill. Select a batch and apply one status change to all of them at once — a status change here never sends email.",
    },
  ],
};
