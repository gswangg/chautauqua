import type { DocsArticle } from "./types";

export const agendaAndPublishing: DocsArticle = {
  slug: "agenda-and-publishing",
  group: "running-an-event",
  title: "Agenda and publishing",
  standfirst:
    "You make the schedule when you put accepted sessions into rooms and time slots. You can put a session manually, by drag, or with auto-schedule. The publish step controls what a visitor sees.",
  blocks: [
    { kind: "heading", text: "Tracks and rooms" },
    {
      kind: "prose",
      text: "Before you can put a session on the grid, the event must have its tracks and rooms. A track is a group of sessions with related content. Rooms are the locations into which you put sessions. If you change the name of a room, the sessions that are scheduled in it stay where they are. The position follows the room.",
    },
    { kind: "heading", text: "The day grid" },
    {
      kind: "prose",
      text: "The grid shows one day at a time, with the rooms across the top and the time down the side. A session that is not on the grid stays in a tray next to the grid. To put the session on the grid, drag it onto a slot. Or click the session to arm it, then click the slot that you want. The two methods give the same result. A mouse that can drag is not necessary.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-agenda-and-publishing-01",
      caption:
        "The day grid: the rooms across the top, the sessions in their time slots, and the tray of sessions that are not scheduled.",
    },
    { kind: "heading", text: "Conflicts" },
    {
      kind: "prose",
      text: "The grid does not stop a conflict. A conflict is an overlap: two sessions with the same speaker at one time, or two sessions in one room. A conflict chip marks those cards. You see the conflict and you make the decision: move a session, or keep it there. The grid does not stop your move, and it does not keep a conflict out of view.",
    },
    { kind: "heading", text: "Breaks" },
    {
      kind: "prose",
      text: "A break is not attached to one room. Examples are 'Lunch', 'Coffee', and the close of the day. When you add a break, it closes that time period in all rooms at the same time. A break is a fact about the day, not about the schedule of one track.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-agenda-and-publishing-02",
      caption: "A new break: one strip that closes the same time slot in all rooms for the day.",
    },
    { kind: "heading", text: "Auto-schedule" },
    {
      kind: "prose",
      text: "Auto-schedule fills as many sessions from the tray as it can in one run. Then it reports what occurred: how many sessions it put on the grid, how many it could not, and the cause. For example, the event has no rooms, or no slot is free. The report also tells you that conflicts from before the run stay as they were — the run did not cause them. Auto-schedule makes a first version of the schedule in bulk. The same room and track limits apply as when you put sessions manually.",
    },
    { kind: "heading", text: "Publishing" },
    {
      kind: "prose",
      text: "The publish step is the control that makes the schedule public. It does not publish all sessions on the grid without checks. It holds back a session whose content is not approved — a slot on the grid does not change this. The publish report names all three numbers: how many sessions are public, how many are held back, and the cause. A held-back session always shows in the report with its cause.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-agenda-and-publishing-03",
      caption:
        "The publish report: the total number of sessions on the grid, the number that went public, and the held-back number with its cause.",
    },
    { kind: "heading", text: "Calendar feeds" },
    {
      kind: "prose",
      text: "After you publish, the public schedule has a .ics feed. A visitor can subscribe to the feed from their calendar app. If you move a session to a different room or time after you publish, the feed increases the sequence number of that entry. It does not make a duplicate entry. A calendar that imported the feed before updates the same entry.",
    },
  ],
};
