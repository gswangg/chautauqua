import type { DocsArticle } from "./types";

export const agendaAndPublishing: DocsArticle = {
  slug: "agenda-and-publishing",
  group: "running-an-event",
  title: "Agenda and publishing",
  standfirst:
    "You build the schedule by placing accepted sessions into rooms and time slots: by hand, by drag, or with auto-schedule. The publish step controls what a visitor sees.",
  blocks: [
    { kind: "heading", text: "Tracks and rooms" },
    {
      kind: "prose",
      text: "Before a session can go on the grid, the event needs its tracks and rooms. A track is a group of sessions with related content; a room is a place where sessions run. Renaming a room moves nothing: the sessions scheduled in it stay where they are, because the position follows the room.",
    },
    { kind: "heading", text: "The day grid" },
    {
      kind: "prose",
      text: "The grid shows one day at a time (rooms across the top, time down the side) with a tray beside it for sessions that are not yet scheduled. To schedule one, drag it onto a slot, or click the session to arm it and then click the slot you want. Both methods give the same result, so you never need a mouse that can drag.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-agenda-and-publishing-01",
      caption:
        "The day grid: rooms across the top, sessions in their time slots, and the tray of sessions not yet scheduled.",
    },
    { kind: "heading", text: "Conflicts" },
    {
      kind: "prose",
      text: "The grid does not stop a conflict: two sessions with the same speaker at the same time, or two sessions in one room. A conflict chip marks the affected cards; you see the overlap and you decide whether to move a session or leave it. The grid never blocks the move, and it never hides a conflict from you.",
    },
    { kind: "heading", text: "Breaks" },
    {
      kind: "prose",
      text: "A break belongs to the day, not to any one room; 'Lunch', 'Coffee', and the close of the day are the usual examples. Adding a break closes that time period in every room at once, so it is a fact about the whole day rather than about one track's schedule.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-agenda-and-publishing-02",
      caption: "A new break: one strip that closes the same time slot in every room for the day.",
    },
    { kind: "heading", text: "Auto-schedule" },
    {
      kind: "prose",
      text: "Auto-schedule fills the grid from the tray in one run, then reports what happened: how many sessions it placed, how many it could not, and why. A session can stay unplaced because the event has no rooms or because no slot is free. The report also notes that conflicts from before the run stay as they were; the run did not cause them. The result is a bulk first draft, built under the same room and track limits that apply when you place sessions by hand.",
    },
    { kind: "heading", text: "Publishing" },
    {
      kind: "prose",
      text: "The publish step makes the schedule public — with checks. A session whose content is not approved is held back, and a slot on the grid does not change that. The publish report gives all three numbers: the total on the grid, how many went public, and how many were held back; every held-back session appears with its cause.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-agenda-and-publishing-03",
      caption:
        "The publish report: the total sessions on the grid, the number that went public, and the held-back number with its cause.",
    },
    { kind: "heading", text: "Calendar feeds" },
    {
      kind: "prose",
      text: "Once you publish, the public schedule carries an `.ics` feed that visitors can subscribe to from their calendar apps. If you then move a session to a different room or time, the feed increments that entry's sequence number instead of adding a duplicate. A calendar that already imported the feed updates the same entry.",
    },
  ],
};
