import type { DocsArticle } from "./types";

export const speakersTasksAndContent: DocsArticle = {
  slug: "speakers-tasks-and-content",
  group: "running-an-event",
  title: "Speakers, tasks and content",
  standfirst:
    "After you accept a submission, the work changes from decisions to collecting items. You set tasks with due dates, and deliverables come in as files. A content review must finish before content goes public.",
  blocks: [
    { kind: "heading", text: "The roster" },
    {
      kind: "prose",
      text: "The speaker roster lists each person who is attached to an accepted submission for the event. The roster shows one row for each person, not one row for each session. A co-presenter on two accepted submissions shows one time, with the two submissions. You can also add a speaker directly here, without the call-for-papers form. Use this for a speaker who did not come through the call for papers.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-speakers-tasks-and-content-01",
      caption:
        "The roster grid: the name of each speaker, their submissions, and the condition of their onboarding tasks.",
    },
    { kind: "heading", text: "Tasks: all accepted speakers, or a selected group" },
    {
      kind: "prose",
      text: "A task is an item that you must get from an accepted speaker, with a due date. Examples are a bio, a signed agreement, and slides. When you make a task, you select who gets it, one time. The task goes to all speakers who are accepted at that time, or to a group that you select. The selection does not change after you make the task: a task for a selected group stays with the persons that you selected. If you accept more speakers at a subsequent time, the task does not include them.",
    },
    {
      kind: "prose",
      text: "Tasks collect while onboarding continues. Each task shows as open or completed. An overdue task gets a clear flag, and it does not stay out of view after its due date.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-speakers-tasks-and-content-02",
      caption:
        "The task form: a title, a due date, and one selection between all accepted speakers and a selected group. You make the selection one time, when you make the task.",
    },
    { kind: "heading", text: "Deliverables and file uploads" },
    {
      kind: "prose",
      text: "A task with a file deliverable accepts an upload from the speaker portal or from the admin side. A new upload does not overwrite the last file. It adds a new version to the file history of the task, and the task always points at the newest version. The versions from before stay in the history.",
    },
    { kind: "heading", text: "Reviewing content" },
    {
      kind: "prose",
      text: "The content review is not the accept and decline decision. It records if the public content of a submission is prepared to go public: the title, the description, and the attached deliverables. The content status moves through its small set of statuses as an organizer reviews it. A content status change does not send an email. If you want to tell the speaker, you send that notification as a second, different step.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-speakers-tasks-and-content-03",
      caption:
        "The full view of a deliverable: the newest content status, the control that changes it, and the version history below.",
    },
    { kind: "heading", text: "Version history" },
    {
      kind: "prose",
      text: "The file history of each deliverable lists all versions, newest first. Each version keeps its version number, not its position in the list. If you remove a middle version, the other versions keep their numbers. Documents that are not related keep their histories apart, also when they are uploaded against the same task.",
    },
    { kind: "heading", text: "Content status and the public schedule" },
    {
      kind: "prose",
      text: "You can put a session on the schedule grid before its content is approved. The grid position and the content approval operate independently. But the publish step checks the content status of each session. The publish step holds back a session whose content is not approved. Thus, a session without approval does not go onto the public schedule.",
    },
  ],
};
