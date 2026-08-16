import type { DocsArticle } from "./types";

export const runningTheSoftware: DocsArticle = {
  slug: "running-the-software",
  group: "running-the-software",
  title: "Running the software",
  standfirst:
    "Chautauqua is one deployable unit that runs with zero secrets locally — a quickstart, a seeded demo event with three persona logins, and a short list of things a real deployment needs that a local clone doesn't.",
  blocks: [
    { kind: "heading", text: "Quickstart" },
    {
      kind: "prose",
      text: "A fresh clone needs four commands: install dependencies, apply migrations to a local database, seed a demo event, and start the dev server. Nothing else is required — Stage 1 runs entirely against local, Miniflare-backed storage, with email delivered to a dev sink instead of a real provider, so there's no API key or account to set up before you can click around.",
    },
    {
      kind: "code",
      lines: ["npm i", "npm run db:migrate", "npm run seed", "npm run dev"],
    },
    { kind: "heading", text: "The seeded demo event" },
    {
      kind: "prose",
      text: "The seed script creates one fully-populated demo event — DevFlow Conf 2027 — along with the users you need to sign in and look around: an organizer, a reviewer, and two speakers. Everything in the product tour that follows assumes this seeded event exists; if a page looks empty, check that db:migrate and seed both ran before dev.",
    },
    {
      kind: "figure",
      shotId: "running-the-software-running-the-software-01",
      caption:
        "The admin console after seeding, signed in as the organizer persona — DevFlow Conf 2027's dashboard populated with real seeded data, not an empty state.",
    },
    { kind: "heading", text: "The three roles" },
    {
      kind: "prose",
      text: "Every login lands somewhere specific to what that role can see. An organizer signs into the admin console with the full run of the product: building the CFP, triaging and deciding submissions, managing contacts, building the agenda, and publishing the public pages. A reviewer signs into the same admin console but a narrower one — their queue of assigned submissions and the scoring surfaces, not the organizer's settings or contacts. A speaker doesn't get an admin login at all; they land in the speaker portal, scoped to their own submissions, tasks and profile, and nothing else.",
    },
    {
      kind: "deflist",
      rows: [
        { term: "Organizer", definition: "Full admin console: CFP, triage, contacts, agenda, publishing." },
        { term: "Reviewer", definition: "Admin console narrowed to their assigned review queue." },
        { term: "Speaker", definition: "The speaker portal only: their submissions, tasks and profile." },
      ],
    },
    { kind: "heading", text: "Deploying" },
    {
      kind: "prose",
      text: "Deploying is an operator action, not something the product does on its own — no CI job runs it. One command applies any pending database migrations to the remote database and then deploys the worker, so it's safe to re-run any time. Before pointing it at a real origin, though, there's a variable a local clone never has to think about that a deployed instance can't skip.",
    },
    {
      kind: "aside",
      weight: "cannot-be-undone",
      label: "Cannot be undone",
      text: "Deploying applies pending migrations to the remote database before it deploys the worker. There's no separate dry run — running the deploy command against a real origin changes that database's schema.",
    },
    {
      kind: "prose",
      text: "PUBLIC_BASE_URL must be set on any deployed origin. Every emailed link — a claim link, a portal link, a password reset — is built from it, and bulk email sending fails outright rather than silently mailing a broken or local-looking link if it's missing. Locally this is invisible because the dev template already ships a working default; on a real deployment it's a required variable you set yourself.",
    },
    {
      kind: "prose",
      text: "/dev/mailbox — the local dev email sink where every sent email can be read without a real mail provider — only mounts when dev mode is turned on. It's deliberately off on a deployed instance, so /dev/mailbox 404s there by design; that's not a broken link, it's the sink refusing to exist somewhere a real inbox should be doing the job instead.",
    },
    {
      kind: "figure",
      shotId: "running-the-software-running-the-software-02",
      caption:
        "The dev mailbox listing sent messages during local development — this route is intentionally absent, not broken, on a deployed instance.",
    },
  ],
};
