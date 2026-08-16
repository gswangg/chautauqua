import type { DocsArticle } from "./types";

export const startHere: DocsArticle = {
  slug: "start-here",
  group: "getting-started",
  title: "Start here",
  standfirst:
    "Chautauqua runs the speaker pipeline of a conference from start to end. It holds the call for papers, the review and the scores, the accept and decline decisions, and the speaker portal that follows. This page is the twenty-minute tour.",
  blocks: [
    {
      kind: "prose",
      text: "Most events run their speaker program on spreadsheets and email. Chautauqua replaces that pile with one system. The system holds the call for papers, the review queue, the speaker portal, and the public agenda, and all of them read the same data. When a status changes in one place, every other place shows the change immediately. Nobody copies data by hand.",
    },
    { kind: "heading", text: "Four roles" },
    {
      kind: "list",
      items: [
        "Organizer — the organizer builds the call for papers, runs triage, sets up review plans, manages tasks and communications, and publishes the agenda. The organizer has the admin login and sees every event that they belong to.",
        "Reviewer — the reviewer scores an assigned set of submissions against the scorecard of a plan. The reviewer has a login, but sees only the review queue and their own scores, never the full admin console.",
        "Speaker — the speaker sends a submission. If the event accepts the submission, the speaker works in the speaker portal: status, tasks, deadlines, and their bio. The speaker signs in with a private link and does not need an account.",
        "Public — the public is every person who reads the published agenda, the session pages, or the speaker directory. The public does not log in and sees only the content that an organizer made visible.",
      ],
    },
    { kind: "heading", text: "The first twenty minutes for an organizer" },
    {
      kind: "prose",
      text: "If you set up a new event, this is the shortest path from an empty event to a live call for papers.",
    },
    {
      kind: "list",
      items: [
        "Create the event and set its dates, timezone, and slug. The slug becomes the public URL.",
        "Build the call-for-papers form. Select the built-in fields that you need and add your custom questions. Then set the open and close dates of the submission window.",
        "Publish the public link of the form and share it. Submissions start to arrive immediately, and each submission arrives with the pending status.",
        "Set up a review plan after submissions arrive. Assign the reviewers, select a scorecard, and distribute the submissions across the plan.",
        "Run triage as reviews arrive. Move submissions from pending into the accept queue or the decline queue, then decide. A decision never sends an email on its own. You choose when to send the notification.",
      ],
    },
    {
      kind: "figure",
      shotId: "getting-started-start-here-01",
      caption:
        "The admin home for an event. It shows the pipeline counts, the progress of the review queue, and the shortcuts into the CFP, review, and portal tools that this tour covers.",
    },
    {
      kind: "prose",
      text: "Each later subject has its own article: richer forms, a multi-round review, tasks and file uploads, and the published agenda. This page is the map.",
    },
  ],
};
