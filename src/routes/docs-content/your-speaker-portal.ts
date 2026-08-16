import type { DocsArticle } from "./types";

export const yourSpeakerPortal: DocsArticle = {
  slug: "your-speaker-portal",
  group: "for-speakers",
  title: "Your speaker portal",
  standfirst:
    "Once the event accepts your submission, the portal is where you work: check your status, complete tasks, upload deliverables, and keep your bio and headshot current. You need no account — your portal link signs you in.",
  blocks: [
    { kind: "heading", text: "Submissions and status" },
    {
      kind: "prose",
      text: "The portal lists every submission you are a speaker on, with its status. If a submission is still pending or in triage, there is nothing for you to do yet. Status changes happen on the organizer's side; the portal only shows them.",
    },
    { kind: "heading", text: "Tasks and due dates" },
    {
      kind: "prose",
      text: "When the event accepts you, your task list turns on: items the organizer needs from you, each with a due date — a bio, a headshot, a signed agreement, slides. A task shows as open, then as completed once you finish it; an overdue task gets a flag, so you always know which ones are past their due dates.",
    },
    {
      kind: "figure",
      shotId: "for-speakers-your-speaker-portal-01",
      caption:
        "The portal task list: each task's title, due date, and status. An overdue task carries a different mark from a task that is only open.",
    },
    { kind: "heading", text: "Uploads and versions" },
    {
      kind: "prose",
      text: "A task that needs a file — slides, or a signed form — accepts uploads directly in the portal. A new upload never erases the last file; it adds a new version, and the task shows the newest one. If the task has a comment thread, replies attach to the version everyone sees at that time.",
    },
    { kind: "heading", text: "Editing your bio and headshot" },
    {
      kind: "prose",
      text: "Your bio, headshot, and contact details live in one profile, and editing it in the portal updates the same record the public speaker page reads. There is no second copy to keep in sync — a bio you correct here is correct everywhere it appears.",
    },
    {
      kind: "figure",
      shotId: "for-speakers-your-speaker-portal-02",
      caption:
        "The profile form: bio, headshot, and links in one profile. You edit them only here, and the public speaker page shows the same change.",
    },
    { kind: "heading", text: "The close-date rule" },
    {
      kind: "prose",
      text: "The call-for-papers form has a close date, and after it a submission stops accepting edits. That rule stops applying to you once the event accepts you: you can edit an accepted submission even after the form's window closes. The close date locks only the submissions that have no decision.",
    },
  ],
};
