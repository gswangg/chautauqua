import type { DocsArticle } from "./types";

export const runningTheSoftware: DocsArticle = {
  slug: "running-the-software",
  group: "running-the-software",
  title: "Running the software",
  standfirst:
    "Chautauqua is one deployable unit, and it runs locally with zero secrets. This page gives you the quickstart, the seeded demo event with its three persona logins, and the items that only a real deployment needs.",
  blocks: [
    { kind: "heading", text: "Quickstart" },
    {
      kind: "prose",
      text: "A fresh clone needs four commands: install the dependencies, apply the migrations to a local database, seed a demo event, and start the dev server. Nothing else is required. Stage 1 runs completely against local, Miniflare-backed storage. Email goes to a local dev sink instead of a real provider. So you do not set up an API key or an account before you can use the app.",
    },
    {
      kind: "code",
      lines: ["npm i", "npm run db:migrate", "npm run seed", "npm run dev"],
    },
    { kind: "heading", text: "The seeded demo event" },
    {
      kind: "prose",
      text: "The seed script creates one fully populated demo event: DevFlow Conf 2027. It also creates the users that you need to sign in: an organizer, a reviewer, and two speakers. The product tour in the other articles assumes that this seeded event exists. If a page looks empty, make sure that db:migrate and seed both ran before dev.",
    },
    {
      kind: "figure",
      shotId: "running-the-software-running-the-software-01",
      caption:
        "The admin console after the seed, signed in as the organizer persona. The dashboard of DevFlow Conf 2027 is populated with real seeded data, not an empty state.",
    },
    { kind: "heading", text: "The three roles" },
    {
      kind: "prose",
      text: "Every login lands on the surface for that role. An organizer signs into the full admin console: the call for papers, triage and decisions, contacts, the agenda, and publication. A reviewer signs into the same admin console, but a narrower one: their queue of assigned submissions and the scoring surfaces. A reviewer does not see the settings or the contacts of the organizer. A speaker gets no admin login at all. A speaker lands in the speaker portal, which is scoped to their own submissions, tasks, and profile.",
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
      text: "An operator deploys the product. No CI job runs the deploy. One command applies the pending database migrations to the remote database and then deploys the worker. The command is safe to run again at any time. But before you point it at a real origin, set the one variable that a local clone never needs.",
    },
    {
      kind: "aside",
      weight: "cannot-be-undone",
      label: "Cannot be undone",
      text: "The deploy command changes the schema of the remote database. It applies the pending migrations before it deploys the worker. There is no separate dry run.",
    },
    {
      kind: "prose",
      text: "PUBLIC_BASE_URL must be set on every deployed origin. Every emailed link — a claim link, a portal link, a password reset — is built from it. If the variable is missing, bulk email sending fails outright. It does not silently mail a broken or local-looking link. Locally, you do not see this variable, because the dev template ships a working default. On a real deployment, you must set it yourself.",
    },
    {
      kind: "prose",
      text: "/dev/mailbox is the local dev email sink: here you can read every sent email without a real mail provider. The sink mounts only when dev mode is on. On a deployed instance, the sink is off by design, so /dev/mailbox returns a 404 there. That 404 is not a broken link. On a real deployment, a real inbox does the job.",
    },
    {
      kind: "figure",
      shotId: "running-the-software-running-the-software-02",
      caption:
        "The dev mailbox with the messages that were sent during local development. On a deployed instance, this route is intentionally absent, not broken.",
    },
  ],
};
