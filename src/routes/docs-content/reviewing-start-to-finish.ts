import type { DocsArticle } from "./types";

export const reviewingStartToFinish: DocsArticle = {
  slug: "reviewing-start-to-finish",
  group: "for-reviewers",
  title: "Reviewing, start to finish",
  standfirst:
    "Your queue holds only the submissions that are assigned to you. The submissions with the fewest ratings come first. Score each submission with the scorecard of the plan. If you have a conflict of interest, recuse yourself on the scorecard.",
  blocks: [
    { kind: "heading", text: "Your queue" },
    {
      kind: "prose",
      text: "When you log in as a reviewer, your queue holds exactly the submissions that an organizer assigned to you on a review plan. You never see the whole submission pool. You see only your assigned set.",
    },
    {
      kind: "prose",
      text: "The queue puts the submission with the fewest ratings first. The count includes the scores from every reviewer on the plan. This order has a purpose. When a team of reviewers works in parallel, the order makes sure that no submission stays short of ratings.",
    },
    {
      kind: "figure",
      shotId: "for-reviewers-reviewing-start-to-finish-01",
      caption:
        "The reviewer queue. Each row shows your own status for that submission: scored, with your score, or not scored yet. The row does not show a shared rating count. Start at the top of the list and score the submissions in order.",
    },
    { kind: "heading", text: "The scorecard" },
    {
      kind: "prose",
      text: "When you open a submission from your queue, you land on its scorecard. The scorecard holds the criteria that the organizer defined for this review plan. A criterion can be a numeric scale or a set of choices. Some plans give different weights to the criteria when they compute an overall score. Enter your scores and, if the plan allows them, add written comments. Then submit.",
    },
    { kind: "heading", text: "Anonymization" },
    {
      kind: "prose",
      text: "If the plan is anonymized, the server removes the name of the speaker and other identifying details before the submission reaches your screen. These details include the company of the speaker and the titles of their past talks. The removal happens on the server, not in your browser, so the page contains no hidden fields. Score the text in front of you. Every other reviewer on the plan sees the same text.",
    },
    { kind: "heading", text: "Recusal" },
    {
      kind: "prose",
      text: "A recusal removes the submission from your queue immediately. If you have a conflict of interest on a submission, open the submission. A conflict of interest means, for example, that you know the speaker or that you work together. Check 'Recuse me from this one' on the scorecard. The submission then moves to the recused rows at the end of your queue. The plan no longer needs your rating for it, and it does not assign the submission to you again.",
    },
    {
      kind: "figure",
      shotId: "for-reviewers-reviewing-start-to-finish-02",
      caption:
        "A recused submission is marked RECUSED in your queue, and your assigned and progress counts adjust to match. While the plan is open, you can undo the recusal from the scorecard or from the queue. After the plan closes, only an organizer can undo it.",
    },
  ],
};
