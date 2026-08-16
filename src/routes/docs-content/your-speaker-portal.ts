import type { DocsArticle } from "./types";

export const yourSpeakerPortal: DocsArticle = {
  slug: "your-speaker-portal",
  group: "for-speakers",
  title: "Your speaker portal",
  standfirst:
    "Once you're accepted, the portal is where you track your status, complete tasks with deadlines, upload deliverables, and keep your bio and headshot current — no account needed, just your private link.",
  blocks: [
    { kind: "heading", text: "Submissions and status" },
    {
      kind: "prose",
      text: "The portal lists every submission you're a speaker on, with its current status. There's nothing to do here if a submission is still pending or in triage — status changes happen on the organizer's side, and the portal simply reflects them.",
    },
    { kind: "heading", text: "Tasks and deadlines" },
    {
      kind: "prose",
      text: "Being accepted turns on a list of tasks — things the organizer needs from you, each with its own due date: a bio, a headshot, a signed agreement, slides, whatever the event requires. Tasks show as open, and completed once you've done them; overdue ones are called out so you know what's slipping.",
    },
    {
      kind: "figure",
      shotId: "for-speakers-your-speaker-portal-01",
      caption:
        "The portal task list: each task's title, due date and status. An overdue task is marked distinctly from one that's simply still open.",
    },
    { kind: "heading", text: "Uploads and versions" },
    {
      kind: "prose",
      text: "A task that needs a file — slides, a signed form — takes an upload directly in the portal. Uploading again for the same task doesn't erase the last file; it adds a new version, and the task shows which version is current. If a comment thread is attached to the task, replies land against the version everyone's currently looking at.",
    },
    { kind: "heading", text: "Editing your bio and headshot" },
    {
      kind: "prose",
      text: "Your bio, headshot and contact details live in one profile. Editing it in the portal updates the same record the public speaker page reads from — there's no separate copy to keep in sync, so a bio you fix here is fixed everywhere it's shown.",
    },
    {
      kind: "figure",
      shotId: "for-speakers-your-speaker-portal-02",
      caption:
        "Editing your profile: bio, headshot and social links in one form. This is the only place you edit them, and the change is what the public speaker page shows too.",
    },
    { kind: "heading", text: "The close-date rule" },
    {
      kind: "prose",
      text: "The call-for-papers form has its own close date, after which submissions generally stop being editable. Once you're accepted, that stops applying to you: an accepted submission stays editable regardless of whether the form's window has closed. The form's close date only ever restricts editing for submissions that haven't been decided yet.",
    },
  ],
};
