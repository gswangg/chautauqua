import type { DocsArticle } from "./types";

export const speakersTasksAndContent: DocsArticle = {
  slug: "speakers-tasks-and-content",
  group: "running-an-event",
  title: "Speakers, tasks and content",
  standfirst:
    "After you accept a submission, the work changes from decisions to collection. You collect tasks with due dates and deliverables that arrive as files. A content review must finish before any content goes public.",
  blocks: [
    { kind: "heading", text: "The roster" },
    {
      kind: "prose",
      text: "The speaker roster lists every person who is attached to an accepted submission for the event. The roster shows one row for each person, not one row for each session. A co-presenter on two accepted submissions shows once, with both submissions. You can also add a speaker directly here, without the call-for-papers form. Use this for a speaker that you invited.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-speakers-tasks-and-content-01",
      caption:
        "The roster grid: the name of each speaker, their submissions, and the state of their onboarding tasks.",
    },
    { kind: "heading", text: "Tasks: all accepted speakers, or a subset" },
    {
      kind: "prose",
      text: "A task is an item that you need from an accepted speaker, with a due date. Examples are a bio, a signed agreement, and slides. When you create a task, you choose its audience once: every speaker who is accepted at that time, or a subset that you pick. The choice is fixed at creation. A task for a subset stays scoped to the people that you picked, even if you accept more speakers later.",
    },
    {
      kind: "prose",
      text: "Tasks accumulate while onboarding continues. Each task shows as open or completed. An overdue task gets a clear flag, and it does not sit past its date quietly.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-speakers-tasks-and-content-02",
      caption:
        "The task creation form: a title, a due date, and one audience choice between all accepted speakers and a picked subset. You make the choice once, at creation.",
    },
    { kind: "heading", text: "Deliverables and file uploads" },
    {
      kind: "prose",
      text: "A task that expects a file accepts an upload from the speaker portal or from the admin side. A new upload does not overwrite the last file. It adds a new version to the file history of the task, and the task always points at the current version. Earlier versions stay in the history.",
    },
    { kind: "heading", text: "Reviewing content" },
    {
      kind: "prose",
      text: "The content review is separate from the accept and decline decision. It tracks whether the public content of a submission is ready to publish: the title, the description, and the attached deliverables. The content status moves through its own small lifecycle as an organizer reviews it. A content status change never sends an email by itself. If you want to notify the speaker, you send that notification as a separate action.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-speakers-tasks-and-content-03",
      caption:
        "The detail view of a deliverable: the current content status, the action that changes it, and the version history below.",
    },
    { kind: "heading", text: "Version history" },
    {
      kind: "prose",
      text: "The file history of each deliverable lists every version, newest first. Each version keeps its own version number, not its position in the list. If you remove a middle version, the other versions keep their numbers. Unrelated documents that are uploaded against the same task keep separate histories.",
    },
    { kind: "heading", text: "Content status and the public schedule" },
    {
      kind: "prose",
      text: "You can place a session on the schedule grid before its content is approved. Placement and content approval are independent. But the publish step checks the content status of each session. The publish step holds back a session whose content is not yet approved. So the public schedule never shows a session that nobody approved.",
    },
  ],
};
