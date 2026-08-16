import type { DocsArticle } from "./types";

export const callForPapersAndSubmissions: DocsArticle = {
  slug: "call-for-papers-and-submissions",
  group: "running-an-event",
  title: "Call for papers and submissions",
  standfirst:
    "The call for papers is a form you build, a link you publish, and a queue of submissions that arrive as pending — waiting for triage to move them toward a decision that never emails anyone by itself.",
  blocks: [
    { kind: "heading", text: "Building the form" },
    {
      kind: "prose",
      text: "A call-for-papers form is built from fields: the built-in ones (title, description, track, format and the like) plus any custom questions you add — short text, long text, single choice, multiple choice. Each custom field can be marked required, and you choose which tracks the form offers.",
    },
    {
      kind: "prose",
      text: "Custom questions can be shown conditionally: a field can carry a rule that hides it unless another field's answer matches a value you set — for example, a 'co-speaker email' question that only appears once someone answers 'yes' to 'will you have a co-presenter?'. Rules chain, so hiding an earlier field also hides anything conditioned on it.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-call-for-papers-and-submissions-01",
      caption:
        "The form builder: field list on the left, a field's settings — including its visibility rule — on the right. Required fields and custom questions live in the same list as the built-ins.",
    },
    { kind: "heading", text: "The public link" },
    {
      kind: "prose",
      text: "Once a form has an open date, its public submission link is live at the event's public URL. Anyone with the link can submit — no account, no login. The form only accepts submissions inside its open/close window; outside it, the public page says so instead of showing the form.",
    },
    { kind: "heading", text: "Triage and the status pipeline" },
    {
      kind: "prose",
      text: "Every submission starts life as pending. From there, triage moves it into accept_queue or decline_queue — a staging state that says 'this is where triage is leaning' without being a decision yet. The final step moves a queued submission to accepted or declined; a sixth status, waitlisted, is a hold rather than a decision and can move on to either final state later.",
    },
    {
      kind: "list",
      items: [
        "pending — just arrived, not yet triaged.",
        "accept_queue / decline_queue — triage's working sort, not yet final.",
        "accepted / declined — the decision. Accepting is what turns on the speaker portal and onboarding tasks for that submission's speakers.",
        "waitlisted — parked; can move to accepted or declined whenever you're ready.",
      ],
    },
    {
      kind: "prose",
      text: "A submission can move between any of these statuses at any time — there's no one-way gate. That matters because it makes the next rule safe: deciding never sends email on its own. Moving a submission to accepted or declined changes only its status. If you want the speaker to know, you send that notification as its own, separate action — so you can, for instance, accept a batch overnight and send the acceptance emails together the next morning.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-call-for-papers-and-submissions-02",
      caption:
        "The submissions worklist: every proposal for the event with its status shown as a pill. Select a batch and apply a status change to all of them at once — moving statuses here only ever changes status; nothing sends mail on its own.",
    },
  ],
};
