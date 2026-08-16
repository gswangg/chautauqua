import type { DocsArticle } from "./types";

export const yourSpeakerPortal: DocsArticle = {
  slug: "your-speaker-portal",
  group: "for-speakers",
  title: "Your speaker portal",
  standfirst:
    "After the event accepts your submission, you use the portal. Here you see your status, complete tasks with due dates, upload deliverables, and keep your bio and headshot correct. An account is not necessary — your portal link signs you in.",
  blocks: [
    { kind: "heading", text: "Submissions and status" },
    {
      kind: "prose",
      text: "The portal lists each submission on which you are a speaker, with its status. If a submission stays pending or in triage, there is no step for you here. Status changes occur on the side of the organizer. The portal only shows them.",
    },
    { kind: "heading", text: "Tasks and due dates" },
    {
      kind: "prose",
      text: "When the event accepts you, your task list turns on: items that the organizer must get from you, each with a due date. Examples are a bio, a headshot, a signed agreement, and slides. A task shows as open, and as completed after you finish it. An overdue task is flagged. Thus, you know which tasks are after their due dates.",
    },
    {
      kind: "figure",
      shotId: "for-speakers-your-speaker-portal-01",
      caption:
        "The portal task list: the title, due date, and status of each task. An overdue task has a different mark from a task that is only open.",
    },
    { kind: "heading", text: "Uploads and versions" },
    {
      kind: "prose",
      text: "A task that must have a file — slides, or a signed form — accepts an upload directly in the portal. A new upload for the same task does not erase the last file. The upload adds a new version, and the task shows the newest version. If the task has a comment thread, replies go onto the version that all persons see at that time.",
    },
    { kind: "heading", text: "Editing your bio and headshot" },
    {
      kind: "prose",
      text: "Your bio, your headshot, and your contact data live in one profile. When you edit the profile in the portal, you update the same record that the public speaker page reads. There is no second copy to keep in sync. A bio that you correct here is correct on each page where it shows.",
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
      text: "The call-for-papers form has a close date. After the close date, a submission does not accept edits. This rule does not apply to you after the event accepts you. You can edit an accepted submission also when the period of the form is closed. The close date locks only the submissions that have no decision.",
    },
  ],
};
