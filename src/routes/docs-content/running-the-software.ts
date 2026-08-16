import type { DocsArticle } from "./types";

export const runningTheSoftware: DocsArticle = {
  slug: "running-the-software",
  group: "running-the-software",
  title: "Running the software",
  standfirst:
    "Chautauqua deploys as one unit and runs locally with zero secrets. This page covers the quickstart, the seeded demo event with its three persona logins, and the few things only a live deployment needs.",
  blocks: [
    { kind: "heading", text: "Quickstart" },
    {
      kind: "prose",
      text: "A clean clone needs four commands and nothing else: install the dependencies, apply the migrations locally, seed a demo event, start the dev server. All of Stage 1 runs against local, Miniflare-backed storage, and email goes to a local dev sink rather than a live provider. So you never set up an API key or an account before you can use the app.",
    },
    {
      kind: "code",
      lines: ["npm i", "npm run db:migrate", "npm run seed", "npm run dev"],
    },
    { kind: "heading", text: "The seeded demo event" },
    {
      kind: "prose",
      text: "The seed script creates one fully seeded demo event, DevFlow Conf 2027, along with the users that let you sign in: an organizer, a reviewer, and two speakers. The other articles show this seeded event on their screens, so if a page looks empty, make sure `db:migrate` and `seed` ran before `dev`.",
    },
    {
      kind: "figure",
      shotId: "running-the-software-running-the-software-01",
      caption:
        "The admin console after the seed, signed in as the organizer persona. The DevFlow Conf 2027 dashboard is full of seeded data, not an empty view.",
    },
    { kind: "heading", text: "The three roles" },
    {
      kind: "prose",
      text: "Each login goes to the surface for that role. An organizer signs into the full admin console: call for papers, triage and decisions, contacts, agenda, and publishing. A reviewer signs into the same console but a narrower one: their queue of assigned submissions and the scoring surfaces, with no access to the organizer's settings or contacts. A speaker gets no admin login at all; the speaker portal shows only their submissions, tasks, and profile.",
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
      text: "You deploy the software by hand; no CI job runs the deploy. One command applies the pending database migrations to the remote database and then deploys the worker, and it is always safe to run again. But before you point it at a live origin, set the one variable a local clone does not have.",
    },
    {
      kind: "aside",
      weight: "cannot-be-undone",
      label: "Cannot be undone",
      text: "The deploy command changes the schema of the remote database: it applies the pending migrations before it deploys the worker, and there is no dry run.",
    },
    {
      kind: "prose",
      text: "`PUBLIC_BASE_URL` must be set on every deployed origin, because every emailed link (a claim link, a portal link, a password reset) is built from it. If the variable is missing, bulk email sending stops with an error immediately rather than sending a bad or local link to anyone. You never see this variable locally, since the dev template has a good default; on a live deployment you must set it yourself.",
    },
    {
      kind: "prose",
      text: "`/dev/mailbox` is the local dev email sink, where you can read every sent email without a live mail provider. The sink is on only in dev mode, so a deployed instance serves a 404 there, and that 404 is correct, not a deployment error. On a live deployment, email goes to each recipient's real inbox.",
    },
    {
      kind: "figure",
      shotId: "running-the-software-running-the-software-02",
      caption:
        "The dev mailbox with the messages sent locally in dev mode. On a deployed instance this route is off by design, not because the software is broken.",
    },
  ],
};
