import type { DocsArticle } from "./types";

export const startHere: DocsArticle = {
  slug: "start-here",
  group: "getting-started",
  title: "Start here",
  standfirst:
    "Chautauqua operates the speaker pipeline of a conference from start to end. It holds the call for papers, the review and the scores, the accept and decline decisions, and the speaker portal that follows. This page shows you the system in 20 minutes.",
  blocks: [
    {
      kind: "prose",
      text: "Most events operate their speaker program in spreadsheets and email. Chautauqua replaces them with one system. The system holds the call for papers, the review queue, the speaker portal, and the public agenda, and all of them read the same data. When a status changes in one view, all other views show the change immediately. No person writes the same data again manually.",
    },
    { kind: "heading", text: "Four roles" },
    {
      kind: "list",
      items: [
        "Organizer — the organizer makes the call for papers, does triage, sets up review plans, controls tasks and comms, and publishes the agenda. The organizer has the admin login and sees all the events to which they have access.",
        "Reviewer — the reviewer scores an assigned set of submissions against the scorecard of a plan. The reviewer has a login, but sees only the review queue and their scores, not the full admin console.",
        "Speaker — the speaker sends a submission. If the event accepts the submission, the speaker uses the speaker portal: status, tasks, due dates, and their bio. The speaker signs in with their portal link, and an account is not necessary.",
        "Public — the public is each person who reads the published agenda, the session pages, or the speaker directory. The public does not log in and sees only the content that an organizer set to visible.",
      ],
    },
    { kind: "heading", text: "The first 20 minutes for an organizer" },
    {
      kind: "prose",
      text: "If you set up a new event, this is the shortest sequence of steps from an empty event to a live call for papers.",
    },
    {
      kind: "list",
      items: [
        "Make the event and set its dates, timezone, and slug. The slug becomes the public URL.",
        "Make the call-for-papers form. Select the necessary built-in fields and add your custom questions. Then set the open and close dates of the submission period.",
        "Publish the public link of the form and send it out. Submissions can start to come immediately, and each submission comes in with the pending status.",
        "Set up a review plan after submissions come in. Assign the reviewers, select a scorecard, and divide the submissions across the plan.",
        "Do triage while the reviews come in. Move submissions from pending into the accept queue or the decline queue, then make the decision. A decision does not send an email. You select when to send the notification.",
      ],
    },
    {
      kind: "figure",
      shotId: "getting-started-start-here-01",
      caption:
        "The admin home shows the pipeline numbers, the progress of the review queue, and the shortcuts into the CFP, review, and portal tools.",
    },
    {
      kind: "prose",
      text: "Each subsequent area has an article: the form builder, reviews with more than one round, tasks and file uploads, and the published agenda. This page is the start point.",
    },
  ],
};
