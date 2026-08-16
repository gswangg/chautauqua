import type { DocsArticle } from "./types";

export const reviewingStartToFinish: DocsArticle = {
  slug: "reviewing-start-to-finish",
  group: "for-reviewers",
  title: "Reviewing, start to finish",
  standfirst:
    "Your queue holds only the submissions that are assigned to you. The submissions with the smallest number of ratings come first. Score each submission with the scorecard of the plan. If you have a conflict of interest, recuse yourself on the scorecard.",
  blocks: [
    { kind: "heading", text: "Your queue" },
    {
      kind: "prose",
      text: "When you log in as a reviewer, your queue holds the submissions that an organizer assigned to you on a review plan, and no others. You do not see the full set of submissions for the event. You see only your assigned set.",
    },
    {
      kind: "prose",
      text: "The queue puts the submission with the smallest number of ratings first. The number includes the scores from all reviewers on the plan. This sequence has a function. When reviewers do work in parallel, the sequence makes sure that no submission stays short of ratings.",
    },
    {
      kind: "figure",
      shotId: "for-reviewers-reviewing-start-to-finish-01",
      caption:
        "The reviewer queue. Each row shows your status for that submission: scored, with your score, or not scored. The row does not show how many ratings a submission has from the other reviewers. Start at the top of the list and score the submissions in sequence.",
    },
    { kind: "heading", text: "The scorecard" },
    {
      kind: "prose",
      text: "When you open a submission from your queue, you go directly to its scorecard. The scorecard holds the criteria that the organizer set for this review plan. A criterion can be a numeric scale or a selection from a closed set. Some plans give different weights to the criteria when they calculate the total score. Give your scores and, if the plan lets you, add written comments. Then submit.",
    },
    { kind: "heading", text: "Anonymization" },
    {
      kind: "prose",
      text: "If the plan is anonymized, the server removes the name of the speaker and other identifying data before the submission comes to your screen. This data includes the company of the speaker and the titles of talks that they gave before. The removal occurs on the server, not in your browser. The removed data is not in the page. Score the text in front of you. Each other reviewer on the plan sees the same text.",
    },
    { kind: "heading", text: "Recusal" },
    {
      kind: "prose",
      text: "A recusal removes the submission from your queue immediately. If you have a conflict of interest on a submission, open the submission. For example, you have a conflict of interest if you know the speaker or if you do work with them. Check 'Recuse me from this one' on the scorecard. The submission then moves to the recused rows at the end of your queue. Your rating is then not necessary for the plan, and the plan does not assign the submission to you again.",
    },
    {
      kind: "figure",
      shotId: "for-reviewers-reviewing-start-to-finish-02",
      caption:
        "A recused submission is marked RECUSED in your queue, and your assigned and progress numbers adjust to agree. While the plan is open, you can undo the recusal from the scorecard or from the queue. After the plan closes, only an organizer can undo it.",
    },
  ],
};
