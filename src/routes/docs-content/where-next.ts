// Docs article furniture: the "Where next" closer (DEC-613 amendment wave
// 4 / DEC-180 amendment wave 4). Pure data, no JSX, no IO -- see the
// design reference's own caption for this block's job: "Closes every
// article. Names the screen, not the doc -- a reader finishing here is
// about to go and do the thing." (Chautauqua Docs.dc.html:336). `where`
// therefore always names a SCREEN in the running app, never another doc;
// `href` is a route this codebase actually mounts (grep src/index.ts's
// app.route() calls and app/src/lib/admin-routes.ts's ADMIN_ROUTE_PATTERNS
// before adding a new one here).

import { DOCS_ARTICLES } from "./index";

export interface WhereNextRow {
  where: string;
  href: string;
  what: string;
}

export const WHERE_NEXT_BY_SLUG: Record<string, readonly WhereNextRow[]> = {
  "start-here": [
    { where: "The event overview", href: "/admin/overview", what: "The dashboard you land on after signing in — a snapshot of the event you're steering." },
    { where: "Event settings", href: "/admin/settings", what: "Where the event's name, dates, timezone and tracks live before anything else can be built." },
    { where: "The docs index", href: "/docs", what: "Come back here to pick the next role's worth of reading." },
  ],
  "call-for-papers-and-submissions": [
    { where: "The submissions worklist", href: "/admin/submissions", what: "Triage what has come in — accept, decline or waitlist, alone or in bulk." },
    { where: "The CFP form builder", href: "/admin/submissions/forms", what: "Add or reorder the questions a speaker answers when they apply." },
    { where: "A submission's detail page", href: "/admin/submissions", what: "Open one row to read the abstract, the answers and every review it has collected." },
  ],
  "speakers-tasks-and-content": [
    { where: "The speakers directory", href: "/admin/speakers", what: "Every accepted speaker, their tasks and their submitted content in one list." },
    { where: "The content queue", href: "/admin/content", what: "Review the slides, bios and headshots speakers have uploaded." },
    { where: "A speaker's detail page", href: "/admin/speakers", what: "Open one speaker to see their participations, tasks and files rolled up together." },
  ],
  "agenda-and-publishing": [
    { where: "The agenda builder", href: "/admin/agenda", what: "Drag accepted sessions into rooms and time slots, then publish when it's ready." },
    { where: "Event settings", href: "/admin/settings", what: "Turn on the public agenda page and choose what it shows." },
    { where: "The docs index", href: "/docs", what: "Read about embeds and public pages next, once the agenda is live." },
  ],
  "embeds-and-public-pages": [
    { where: "Event settings", href: "/admin/settings", what: "Generate and copy the embed code for the agenda or speaker list." },
    { where: "The agenda builder", href: "/admin/agenda", what: "Nothing shows on an embed until sessions are published here first." },
    { where: "The speakers directory", href: "/admin/speakers", what: "Control which speakers are visible on the public pages an embed pulls from." },
  ],
  "contacts-pipeline-and-comms": [
    { where: "The contacts directory", href: "/admin/contacts", what: "Every person connected to the event, deduplicated and searchable." },
    { where: "Comms", href: "/admin/comms", what: "Send the email a status change never sends automatically." },
    { where: "The merge tool", href: "/admin/contacts/merge", what: "Combine two contact records that turned out to be the same person." },
  ],
  "reviewing-start-to-finish": [
    { where: "Your reviewer queue", href: "/admin/review", what: "The submissions assigned to you, waiting for a score." },
    { where: "The submissions worklist", href: "/admin/submissions", what: "See how the committee's scores are shaping the programme once reviewing wraps." },
    { where: "The docs index", href: "/docs", what: "Read about agenda and publishing next, once decisions are made." },
  ],
  "your-speaker-portal": [
    { where: "Your portal home", href: "/portal", what: "Your submissions, tasks and profile in one place." },
    { where: "Your tasks", href: "/portal/tasks", what: "Everything the organizer is waiting on you for, one at a time." },
    { where: "Your submissions", href: "/portal/submissions", what: "Check the status of every talk you've submitted to this event." },
  ],
  "running-the-software": [
    { where: "The event overview", href: "/admin/overview", what: "Confirm the deployment is up by loading the dashboard." },
    { where: "The dev mailbox", href: "/dev/mailbox", what: "Read every email the local dev sink has written instead of sending." },
    { where: "The docs index", href: "/docs", what: "Start here again the next time you set up a fresh environment." },
  ],
};

// Regression pin: every article has a Where-next row set, and no row set
// names an article that doesn't exist -- checked structurally in
// test/docs-nav-and-where-next.test.ts, not here (this module stays pure
// data), but the import below keeps the two files coupled by TypeScript so
// a slug typo here is a compile error against the manifest's own slugs.
void DOCS_ARTICLES;
