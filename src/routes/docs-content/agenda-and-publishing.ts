import type { DocsArticle } from "./types";

export const agendaAndPublishing: DocsArticle = {
  slug: "agenda-and-publishing",
  group: "running-an-event",
  title: "Agenda and publishing",
  standfirst:
    "Building the schedule is placing accepted sessions into rooms and time slots — by hand, by drag, or by letting auto-schedule fill what it can — and publishing is the one step that decides what a visitor actually sees.",
  blocks: [
    { kind: "heading", text: "Tracks and rooms" },
    {
      kind: "prose",
      text: "Before you can place anything, the event needs its tracks and rooms defined — tracks group sessions by theme, rooms are where sessions actually get placed. Renaming a room doesn't detach anything already scheduled into it; the placement follows the room.",
    },
    { kind: "heading", text: "The day grid" },
    {
      kind: "prose",
      text: "The grid lays out one day at a time, rooms across the top and time running down. An unplaced session sits in a tray beside the grid until you place it, either by dragging it onto a slot or by arming it with a click and then clicking the slot you want — the same result either way, so placement never requires a mouse that can drag.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-agenda-and-publishing-01",
      caption:
        "The day grid: rooms across the top, sessions placed into time slots, and the unplaced tray waiting beside it.",
    },
    { kind: "heading", text: "Conflicts" },
    {
      kind: "prose",
      text: "Placing two sessions with the same speaker at overlapping times, or double-booking a room, doesn't get blocked outright — it gets flagged. A conflict chip marks the affected cards so you can see the collision and decide whether to move something or leave it, rather than the grid silently refusing the placement.",
    },
    { kind: "heading", text: "Breaks" },
    {
      kind: "prose",
      text: "A break — lunch, a coffee gap, the end-of-day close — isn't scoped to one room. Adding one blocks that time band across every room at once, since a break is a fact about the day, not about a single track's schedule.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-agenda-and-publishing-02",
      caption: "Adding a break: one band, blocking the same time slot in every room for the day.",
    },
    { kind: "heading", text: "Auto-schedule" },
    {
      kind: "prose",
      text: "Auto-schedule fills as many unplaced sessions as it reasonably can in one pass and reports back exactly what happened: how many it placed, how many it couldn't and why (no rooms configured, no slot free, and so on), and that any conflicts already on the grid before the run were left in place rather than caused by it. It's a bulk first draft, not a black box — the same room and track constraints you'd hit placing by hand still apply.",
    },
    { kind: "heading", text: "Publishing" },
    {
      kind: "prose",
      text: "Publishing is the switch that makes the schedule public. It doesn't publish every placed session unconditionally: a session whose content hasn't been approved yet is held back, even if it's sitting in a room on the grid. The confirmation names all three counts — how many sessions are public, how many were held back, and why — so a held-back session is never a silent gap.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-agenda-and-publishing-03",
      caption:
        "The publish confirmation: total placed, how many went public, and the held-back count with its reason.",
    },
    { kind: "heading", text: "Calendar feeds" },
    {
      kind: "prose",
      text: "Once published, the public schedule offers a .ics feed a visitor can subscribe to from their own calendar app. Moving a session to a different room or time after publishing bumps that entry's sequence rather than creating a duplicate, so a calendar that already imported the feed updates the existing entry instead of doubling it.",
    },
  ],
};
