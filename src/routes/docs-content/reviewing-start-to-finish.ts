import type { DocsArticle } from "./types";

export const reviewingStartToFinish: DocsArticle = {
  slug: "reviewing-start-to-finish",
  group: "for-reviewers",
  title: "Reviewing, start to finish",
  standfirst:
    "Your queue is exactly what you've been assigned, sorted so the submissions with the fewest ratings so far come first. Score with the plan's scorecard, and step aside from anything you shouldn't be scoring.",
  blocks: [
    { kind: "heading", text: "Your queue" },
    {
      kind: "prose",
      text: "When you log in as a reviewer, your queue holds exactly the submissions an organizer assigned you on a review plan — nothing more. You never see the whole submission pool, only your slice of it.",
    },
    {
      kind: "prose",
      text: "The queue is sorted fewest-ratings-first: whichever of your assigned submissions currently has the fewest scores from anyone on the plan appears at the top. That ordering exists so that, across a whole team of reviewers working in parallel, no submission is left thin on ratings just because reviewers keep picking from the top of an unsorted list.",
    },
    {
      kind: "figure",
      shotId: "for-reviewers-reviewing-start-to-finish-01",
      caption:
        "The reviewer queue: each row shows your own status for that submission — scored (with your score) or not yet — not a shared rating count. Work down the list rather than picking around.",
    },
    { kind: "heading", text: "The scorecard" },
    {
      kind: "prose",
      text: "Opening a submission from your queue puts you on its scorecard — the set of criteria the organizer defined for this review plan. Criteria can be a numeric scale or a set of choices; some plans weight criteria differently when they compute an overall score. Enter your scores and, where the plan allows it, written comments, then submit.",
    },
    { kind: "heading", text: "Anonymization" },
    {
      kind: "prose",
      text: "If the plan is anonymized, the speaker's name and any identifying details (company, prior talk titles) are stripped out before the submission ever reaches your screen — this happens on the server, not by hiding fields client-side, so there's nothing in the page for you to inspect around. Score what's in front of you; it's the same text every other reviewer on the plan sees.",
    },
    { kind: "heading", text: "Recusal" },
    {
      kind: "prose",
      text: "If you have a conflict of interest on a submission — you know the speaker, you work together, anything that should keep you from scoring it — recuse yourself from it directly in the queue. A recused submission drops out of your queue and your progress counts, and stops needing your rating at all; it doesn't get reassigned to you later.",
    },
    {
      kind: "figure",
      shotId: "for-reviewers-reviewing-start-to-finish-02",
      caption:
        "Recusing from a submission: it leaves your queue immediately and your assigned/progress counts adjust to match — a recusal is a permanent step-aside, not a snooze.",
    },
  ],
};
