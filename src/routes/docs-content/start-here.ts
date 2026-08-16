import type { DocsArticle } from "./types";

export const startHere: DocsArticle = {
  slug: "start-here",
  group: "getting-started",
  title: "Start here",
  standfirst:
    "Chautauqua runs a conference's speaker pipeline end to end: a call for papers, review and scoring, the accept/decline decision, and the onboarding portal that follows. This page is the twenty-minute tour.",
  blocks: [
    {
      kind: "prose",
      text: "Chautauqua replaces the spreadsheet-and-email pile most events run their speaker program on. One system holds the call for papers, the review queue, the accepted-speaker portal, and the public agenda that publishes from the same data — so a status change in one place is visible everywhere else immediately, not copied by hand.",
    },
    { kind: "heading", text: "Four roles" },
    {
      kind: "list",
      items: [
        "Organizer — builds the call for papers, runs triage, sets up review plans, manages tasks and communications, and publishes the agenda. Has the admin login and sees every event they belong to.",
        "Reviewer — scores an assigned slice of submissions against a plan's scorecard. Has a login, but only sees the review queue and their own scores — never the full admin.",
        "Speaker — submits a talk, then (once accepted) lives in the speaker portal: status, tasks, deadlines, and their bio. Authenticates by a private link, no account required.",
        "Public — anyone reading the published agenda, session pages, or speaker directory. No login, and only sees what's been explicitly made visible.",
      ],
    },
    { kind: "heading", text: "A producer's first twenty minutes" },
    {
      kind: "prose",
      text: "If you're setting up a new event, this is the shortest path from nothing to a live call for papers.",
    },
    {
      kind: "list",
      items: [
        "Create the event and set its dates, timezone and slug — the slug becomes the public URL.",
        "Build the call-for-papers form: pick the built-in fields you need and add any custom questions, then set the submission window's open and close dates.",
        "Publish the form's public link and share it — submissions start arriving immediately, each landing as pending.",
        "Set up a review plan once submissions are in: assign reviewers, choose a scorecard, and distribute submissions across the plan.",
        "Run triage as reviews come in: move submissions from pending into the accept or decline queue, then decide. Deciding never sends email on its own — you choose when to notify.",
      ],
    },
    {
      kind: "figure",
      shotId: "getting-started-start-here-01",
      caption:
        "The admin home for an event: pipeline counts, the review queue's progress, and the shortcuts into the CFP, review and portal tools that this tour covers.",
    },
    {
      kind: "prose",
      text: "Everything past this point — building richer forms, running a multi-round review, managing tasks and file uploads, publishing the agenda — is covered in its own article. This one is the map.",
    },
  ],
};
