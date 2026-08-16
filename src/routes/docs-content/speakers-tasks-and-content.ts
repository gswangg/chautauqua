import type { DocsArticle } from "./types";

export const speakersTasksAndContent: DocsArticle = {
  slug: "speakers-tasks-and-content",
  group: "running-an-event",
  title: "Speakers, tasks and content",
  standfirst:
    "Once a submission is accepted, the work shifts from deciding to collecting: tasks with due dates, deliverables that come back as files, and a content review loop that has to finish before anything goes public.",
  blocks: [
    { kind: "heading", text: "The roster" },
    {
      kind: "prose",
      text: "The speaker roster lists everyone attached to an accepted submission for the event — one row per person, not per session, so a co-presenter on two accepted talks shows once with both. You can add a speaker directly here, without routing them through the call-for-papers form, for the cases where someone was invited rather than submitted.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-speakers-tasks-and-content-01",
      caption:
        "The roster grid: each speaker's name, their submissions, and the state of their onboarding tasks at a glance.",
    },
    { kind: "heading", text: "Tasks: everyone, or just some of them" },
    {
      kind: "prose",
      text: "A task is something you need from an accepted speaker — a bio, a signed agreement, slides — with a due date attached. When you create one, you choose its audience once: every currently-accepted speaker, or a hand-picked subset. That choice is made at creation time and isn't revisited later, so a task meant for a subset stays scoped to the people you picked, even as more speakers get accepted afterward.",
    },
    {
      kind: "prose",
      text: "Tasks accumulate as onboarding continues. Each shows as open or completed, and an overdue task is flagged distinctly rather than just sitting past its date quietly.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-speakers-tasks-and-content-02",
      caption:
        "Creating a task: title, due date, and an audience choice between everyone accepted and a picked subset — made once, at creation.",
    },
    { kind: "heading", text: "Deliverables and file uploads" },
    {
      kind: "prose",
      text: "A task that expects a file accepts an upload either from the speaker's own portal or from the admin side. Uploading again doesn't overwrite — it adds a new version to that task's file history, and the task always points at the current one. Nothing about an earlier version disappears; it just stops being the one that counts.",
    },
    { kind: "heading", text: "Reviewing content" },
    {
      kind: "prose",
      text: "Content review is separate from the accept/decline decision — it tracks whether a submission's public-facing content (title, description, any deliverables tied to it) is fit to publish. A submission's content status moves through its own small lifecycle as an organizer reviews it, and that move never sends an email by itself; if you want the speaker notified, you send that separately.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-speakers-tasks-and-content-03",
      caption:
        "A deliverable's detail view: current content status, the action that changes it, and the version history beneath.",
    },
    { kind: "heading", text: "Version history" },
    {
      kind: "prose",
      text: "Each deliverable's file history lists every version newest-first, tagged by its own version number rather than its position in the list — so removing a middle version never renumbers the ones around it. Unrelated documents uploaded against the same task keep separate histories rather than being folded into one chain.",
    },
    { kind: "heading", text: "Why this gates the agenda" },
    {
      kind: "prose",
      text: "A session can be placed on the schedule grid before its content is approved — placement and content approval are independent. But publishing the agenda checks content status per session: a placed session whose content isn't approved yet is held back from the public schedule rather than published anyway, so the printed programme never shows a talk nobody has signed off on.",
    },
  ],
};
