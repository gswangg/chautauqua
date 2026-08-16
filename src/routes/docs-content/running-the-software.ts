import type { DocsArticle } from "./types";

export const runningTheSoftware: DocsArticle = {
  slug: "running-the-software",
  group: "running-the-software",
  title: "Running the software",
  standfirst:
    "Chautauqua deploys as one unit, and it runs locally with zero secrets. This page gives you the quickstart, the seeded demo event with its three persona logins, and the items that only a live deployment must have.",
  blocks: [
    { kind: "heading", text: "Quickstart" },
    {
      kind: "prose",
      text: "A clean clone must have four commands: install the dependencies, apply the migrations locally, seed a demo event, and start the dev server. No other step is necessary. All of Stage 1 runs against local, Miniflare-backed storage. Email goes to a local dev sink, not to a live provider. Thus, you do not set up an API key or an account before you can use the app.",
    },
    {
      kind: "code",
      lines: ["npm i", "npm run db:migrate", "npm run seed", "npm run dev"],
    },
    { kind: "heading", text: "The seeded demo event" },
    {
      kind: "prose",
      text: "The seed script makes one fully seeded demo event: DevFlow Conf 2027. It also makes the users that let you sign in: an organizer, a reviewer, and two speakers. The other articles show this seeded event on their screens. If a page looks empty, make sure that 'db:migrate' and 'seed' ran before 'dev'.",
    },
    {
      kind: "figure",
      shotId: "running-the-software-running-the-software-01",
      caption:
        "The admin console after the seed, signed in as the organizer persona. The dashboard of DevFlow Conf 2027 is full of seeded data, not an empty view.",
    },
    { kind: "heading", text: "The three roles" },
    {
      kind: "prose",
      text: "Each login goes to the surface for that role. An organizer signs into the full admin console: the call for papers, triage and decisions, contacts, the agenda, and publishing. A reviewer signs into the same admin console, but a smaller one: their queue of assigned submissions and the scoring surfaces. A reviewer does not see the settings or the contacts of the organizer. A speaker gets no admin login. A speaker goes into the speaker portal, which shows only their submissions, tasks, and profile.",
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
      text: "A person deploys the software manually. No CI job runs the deploy. One command applies the pending database migrations to the remote database and then deploys the worker. The command is always safe to run again. But before you point it at a live origin, set the one variable that a local clone does not have.",
    },
    {
      kind: "aside",
      weight: "cannot-be-undone",
      label: "Cannot be undone",
      text: "The deploy command changes the schema of the remote database. It applies the pending migrations before it deploys the worker. There is no dry run.",
    },
    {
      kind: "prose",
      text: "PUBLIC_BASE_URL must be set on each deployed origin. Each emailed link — a claim link, a portal link, a password reset — is made from it. If the variable is missing, bulk email sending stops with an error immediately. It does not send a bad or local link to a recipient. Locally, you do not see this variable, because the dev template has a good default. On a live deployment, you must set it yourself.",
    },
    {
      kind: "prose",
      text: "/dev/mailbox is the local dev email sink: here you can read each sent email without a live mail provider. The sink is on only when dev mode is on. On a deployed instance, the sink is off, and this is correct: /dev/mailbox shows a 404 there. That 404 is not an error in your deployment. On a live deployment, email goes to the inbox of each recipient.",
    },
    {
      kind: "figure",
      shotId: "running-the-software-running-the-software-02",
      caption:
        "The dev mailbox with the messages that were sent locally in dev mode. On a deployed instance, this route is off because that is correct, not because the software is broken.",
    },
  ],
};
