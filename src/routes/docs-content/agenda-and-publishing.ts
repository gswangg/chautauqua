import type { DocsArticle } from "./types";

export const agendaAndPublishing: DocsArticle = {
  slug: "agenda-and-publishing",
  group: "running-an-event",
  title: "Agenda and publishing",
  standfirst:
    "You build the schedule when you place accepted sessions into rooms and time slots. You can place a session by hand, by drag, or with auto-schedule. The publish step decides what a visitor sees.",
  blocks: [
    { kind: "heading", text: "Tracks and rooms" },
    {
      kind: "prose",
      text: "Before you can place a session, the event needs its tracks and rooms. Tracks group sessions by theme. Rooms are the places where you put sessions. If you rename a room, the sessions that are scheduled in it stay in place. The placement follows the room.",
    },
    { kind: "heading", text: "The day grid" },
    {
      kind: "prose",
      text: "The grid shows one day at a time, with the rooms across the top and the time down the side. An unplaced session sits in a tray beside the grid. To place the session, drag it onto a slot. Or click the session to arm it, then click the slot that you want. Both methods give the same result. Placement never requires a mouse that can drag.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-agenda-and-publishing-01",
      caption:
        "The day grid: the rooms across the top, the sessions placed into time slots, and the tray of unplaced sessions beside the grid.",
    },
    { kind: "heading", text: "Conflicts" },
    {
      kind: "prose",
      text: "The grid does not block a conflict. If two sessions with the same speaker overlap in time, or if a room is double-booked, a conflict chip marks the affected cards. You see the collision and you decide: move a session, or leave it. The grid never refuses the placement silently.",
    },
    { kind: "heading", text: "Breaks" },
    {
      kind: "prose",
      text: "A break is not scoped to one room. Examples are lunch, a coffee gap, and the close of the day. When you add a break, it blocks that time band in every room at once. A break is a fact about the day, not about the schedule of one track.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-agenda-and-publishing-02",
      caption: "A new break: one band that blocks the same time slot in every room for the day.",
    },
    { kind: "heading", text: "Auto-schedule" },
    {
      kind: "prose",
      text: "Auto-schedule fills as many unplaced sessions as it can in one pass. Then it reports what happened: how many sessions it placed, how many it could not place, and the reason. For example, no rooms are configured, or no slot is free. The report also states that conflicts from before the run stay in place — the run did not cause them. Auto-schedule is a bulk first draft. The same room and track constraints as in placement by hand apply.",
    },
    { kind: "heading", text: "Publishing" },
    {
      kind: "prose",
      text: "The publish step is the switch that makes the schedule public. It does not publish every placed session without checks. It holds back a session whose content is not yet approved, even if the session sits in a room on the grid. The confirmation names all three counts: how many sessions are public, how many are held back, and the reason. A held-back session is never a silent gap.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-agenda-and-publishing-03",
      caption:
        "The publish confirmation: the total placed count, the count that went public, and the held-back count with its reason.",
    },
    { kind: "heading", text: "Calendar feeds" },
    {
      kind: "prose",
      text: "After you publish, the public schedule offers a .ics feed. A visitor can subscribe to the feed from their own calendar app. If you move a session to a different room or time after you publish, the feed increases the sequence number of that entry. It does not create a duplicate entry. A calendar that already imported the feed updates the existing entry.",
    },
  ],
};
