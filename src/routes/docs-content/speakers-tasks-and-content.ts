import type { DocsArticle } from "./types";

export const speakersTasksAndContent: DocsArticle = {
  slug: "speakers-tasks-and-content",
  group: "running-an-event",
  title: "Speakers, tasks and content",
  standfirst:
    "After you accept a submission, the work shifts from decisions to collecting: tasks with due dates, deliverables as files, and a content review before anything goes public.",
  blocks: [
    { kind: "heading", text: "The roster" },
    {
      kind: "prose",
      text: "The speaker roster lists every person attached to an accepted submission for the event — one row per person, not per session. A co-presenter on two accepted submissions appears once, with both submissions listed. You can also add a speaker directly here, without the call-for-papers form; use that for a speaker who did not come through the call for papers.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-speakers-tasks-and-content-01",
      caption:
        "The roster grid: each speaker's name, their submissions, and the state of their onboarding tasks.",
    },
    { kind: "heading", text: "Tasks: all accepted speakers, or a selected group" },
    {
      kind: "prose",
      text: "A task is something you need from an accepted speaker by a due date — a bio, a signed agreement, slides. When you create one, you choose who gets it, once: every speaker accepted at that moment, or a group you select. That selection never changes afterward — the task stays with the people you selected, and speakers accepted later are not added.",
    },
    {
      kind: "prose",
      text: "Tasks accumulate as onboarding continues. Each shows as open or completed, and an overdue task gets a clear flag — it never drops out of view after its due date.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-speakers-tasks-and-content-02",
      caption:
        "The task form: a title, a due date, and one choice between all accepted speakers and a selected group. You make that choice once, when you create the task.",
    },
    { kind: "heading", text: "Deliverables and file uploads" },
    {
      kind: "prose",
      text: "A task with a file deliverable accepts uploads from the speaker portal or from the admin side. A new upload never overwrites the last file; it adds a new version to the task's file history, and the task always points at the newest one. Earlier versions stay in the history.",
    },
    { kind: "heading", text: "Reviewing content" },
    {
      kind: "prose",
      text: "The content review is not the accept-and-decline decision. It records whether a submission's public content — the title, the description, the attached deliverables — is ready to go public. The content status moves through its small set of statuses as an organizer reviews it. A content status change never sends email on its own; telling the speaker is a separate, deliberate step.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-speakers-tasks-and-content-03",
      caption:
        "The full view of a deliverable: the current content status, the control that changes it, and the version history below.",
    },
    { kind: "heading", text: "Version history" },
    {
      kind: "prose",
      text: "The file history of each deliverable lists every version, newest first. Each version keeps its version number rather than its position in the list, so removing a middle version leaves the other numbers untouched. Unrelated documents keep separate histories, even when they are uploaded against the same task.",
    },
    { kind: "heading", text: "Content status and the public schedule" },
    {
      kind: "prose",
      text: "You can place a session on the schedule grid before its content is approved; grid position and content approval are independent. But the publish step checks every session's content status and holds back any session whose content is not approved, so a session without approval never reaches the public schedule.",
    },
  ],
};
