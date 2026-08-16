import type { DocsArticle } from "./types";

export const startHere: DocsArticle = {
  slug: "start-here",
  group: "getting-started",
  title: "Start here",
  standfirst:
    "Chautauqua runs a conference's speaker pipeline from start to end: the call for papers, review and scoring, the accept and decline decisions, and the speaker portal that follows. This page shows you the system in 20 minutes.",
  blocks: [
    {
      kind: "prose",
      text: "Most events run their speaker program in spreadsheets and email; Chautauqua replaces them with one system. The call for papers, the review queue, the speaker portal, and the public agenda all read the same data. When a status changes in one view, every other view shows it immediately; nobody retypes the same data by hand.",
    },
    { kind: "heading", text: "Four roles" },
    {
      kind: "list",
      items: [
        "**Organizer** — makes the call for papers, does triage, sets up review plans, runs tasks and comms, and publishes the agenda. The organizer has the admin login and sees every event they have access to.",
        "**Reviewer** — scores an assigned set of submissions against a plan's scorecard. A reviewer has a login but sees only the review queue and their own scores, never the full admin console.",
        "**Speaker** — sends a submission, and if the event accepts it, uses the speaker portal: status, tasks, due dates, and their bio. The portal link signs them in, so no account is needed.",
        "**Public** — anyone who reads the published agenda, the session pages, or the speaker directory. The public does not log in and sees only the content an organizer set to visible.",
      ],
    },
    { kind: "heading", text: "The first 20 minutes for an organizer" },
    {
      kind: "prose",
      text: "If you are setting up a new event, this is the shortest sequence of steps from an empty event to a live call for papers.",
    },
    {
      kind: "list",
      items: [
        "Create the event and set its dates, timezone, and slug. The slug becomes the public URL.",
        "Build the call-for-papers form: choose the built-in fields you need, add your custom questions, and set the open and close dates of the submission period.",
        "Publish the form's public link and send it out. Submissions can start arriving immediately, each with the pending status.",
        "Set up a review plan once submissions arrive: assign the reviewers, choose a scorecard, and divide the submissions across the plan.",
        "Do triage while reviews come in: move submissions from pending into the accept queue or the decline queue, then make the decision. A decision never sends email. You choose when to send the notification.",
      ],
    },
    {
      kind: "figure",
      shotId: "getting-started-start-here-01",
      caption:
        "The admin home shows the pipeline numbers, the review queue's progress, and shortcuts into the CFP, review, and portal tools.",
    },
    {
      kind: "prose",
      text: "Each of those areas has its own article: the form builder, multi-round reviews, tasks and file uploads, the published agenda. This page is just the starting point.",
    },
  ],
};
