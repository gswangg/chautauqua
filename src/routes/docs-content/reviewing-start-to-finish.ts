import type { DocsArticle } from "./types";

export const reviewingStartToFinish: DocsArticle = {
  slug: "reviewing-start-to-finish",
  group: "for-reviewers",
  title: "Reviewing, start to finish",
  standfirst:
    "Your queue holds only the submissions assigned to you, fewest ratings first. Score each one against the plan's scorecard, and if you have a conflict of interest, recuse yourself on the scorecard.",
  blocks: [
    { kind: "heading", text: "Your queue" },
    {
      kind: "prose",
      text: "When you log in as a reviewer, your queue holds the submissions an organizer assigned to you on a review plan, and no others. The event's full set of submissions is never shown; you see only your assigned set.",
    },
    {
      kind: "prose",
      text: "The queue puts the submission with the fewest ratings first, counting scores from every reviewer on the plan. That ordering has a purpose: when reviewers work in parallel, it makes sure no submission is left with too few ratings.",
    },
    {
      kind: "figure",
      shotId: "for-reviewers-reviewing-start-to-finish-01",
      caption:
        "The reviewer queue. Each row shows your status for that submission (scored, with your score, or not scored) but not how many ratings it has from other reviewers. Start at the top and score in order.",
    },
    { kind: "heading", text: "The scorecard" },
    {
      kind: "prose",
      text: "Opening a submission from your queue takes you straight to its scorecard, which holds the criteria the organizer set for this review plan. A criterion can be a numeric scale or a choice from a closed set, and some plans weight the criteria differently when they calculate the total score. Give your scores, add written comments if the plan allows them, and submit.",
    },
    { kind: "heading", text: "Anonymization" },
    {
      kind: "prose",
      text: "If the plan is anonymized, the server strips the speaker's name and other identifying details (their company, the titles of their past talks) before the submission reaches your screen. The stripping happens on the server, not in your browser, so the removed data is never in the page at all. Score the text in front of you; every other reviewer on the plan sees the same text.",
    },
    { kind: "heading", text: "Recusal" },
    {
      kind: "prose",
      text: "A recusal removes the submission from your queue immediately. If you have a conflict of interest (you know the speaker, or you work with them), open the submission and check **Recuse me from this one** on the scorecard. The submission moves to the recused rows at the end of your queue. Your rating is no longer needed for the plan, and the plan never assigns that submission to you again.",
    },
    {
      kind: "figure",
      shotId: "for-reviewers-reviewing-start-to-finish-02",
      caption:
        "A recused submission is marked **RECUSED** in your queue, and your assigned and progress numbers adjust to match. While the plan is open, you can undo the recusal from the scorecard or from the queue; after the plan closes, only an organizer can undo it.",
    },
  ],
};
