import type { DocsArticle } from "./types";

export const yourSpeakerPortal: DocsArticle = {
  slug: "your-speaker-portal",
  group: "for-speakers",
  title: "Your speaker portal",
  standfirst:
    "After the event accepts your submission, you work in the portal. Here you track your status, complete tasks with deadlines, upload deliverables, and keep your bio and headshot current. You do not need an account — your private link signs you in.",
  blocks: [
    { kind: "heading", text: "Submissions and status" },
    {
      kind: "prose",
      text: "The portal lists every submission on which you are a speaker, with its current status. If a submission is still pending or in triage, there is no action for you here. Status changes happen on the side of the organizer. The portal only reflects them.",
    },
    { kind: "heading", text: "Tasks and deadlines" },
    {
      kind: "prose",
      text: "Acceptance turns on a list of tasks: items that the organizer needs from you, each with its own due date. Examples are a bio, a headshot, a signed agreement, and slides. A task shows as open, and as completed after you finish it. An overdue task is called out, so you know what is late.",
    },
    {
      kind: "figure",
      shotId: "for-speakers-your-speaker-portal-01",
      caption:
        "The portal task list: the title, due date, and status of each task. An overdue task is marked differently from a task that is simply still open.",
    },
    { kind: "heading", text: "Uploads and versions" },
    {
      kind: "prose",
      text: "A task that needs a file — slides, or a signed form — takes an upload directly in the portal. A new upload for the same task does not erase the last file. The upload adds a new version, and the task shows the current version. If the task has a comment thread, replies land on the version that everyone currently sees.",
    },
    { kind: "heading", text: "Editing your bio and headshot" },
    {
      kind: "prose",
      text: "Your bio, your headshot, and your contact details live in one profile. When you edit the profile in the portal, you update the same record that the public speaker page reads. There is no separate copy to keep in sync. A bio that you correct here is correct in every place where it shows.",
    },
    {
      kind: "figure",
      shotId: "for-speakers-your-speaker-portal-02",
      caption:
        "The profile form: bio, headshot, and social links in one place. You edit them only here, and the public speaker page shows the same change.",
    },
    { kind: "heading", text: "The close-date rule" },
    {
      kind: "prose",
      text: "The call-for-papers form has its own close date. After the close date, a submission stops being editable. This rule does not apply to you after acceptance: an accepted submission stays editable, even when the window of the form is closed. The close date restricts only the submissions that have no decision yet.",
    },
  ],
};
