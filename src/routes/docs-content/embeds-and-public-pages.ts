import type { DocsArticle } from "./types";

export const embedsAndPublicPages: DocsArticle = {
  slug: "embeds-and-public-pages",
  group: "running-an-event",
  title: "Embeds and public pages",
  standfirst:
    "The public hub, the public surfaces, and the embeds on different sites all apply the same three conditions: accepted, visible, and content-approved. Not one surface applies a second, weaker set of conditions.",
  blocks: [
    { kind: "heading", text: "The public hub" },
    {
      kind: "prose",
      text: "Each event gets a public hub page. The hub shows a tile for each surface that has content: sessions, speakers, agenda, schedule, and gallery. The hub is the one URL that you give to a person who wants to look at the event. It links out to each surface.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-embeds-and-public-pages-01",
      caption: "The public hub: one page for each event, with tiles for the surfaces that have content.",
    },
    { kind: "heading", text: "The surfaces" },
    {
      kind: "prose",
      text: "Sessions, speakers, and gallery are lists that you can search, with a track filter. The agenda is the day-by-day schedule with a track highlight, not a filter. All sessions stay in view, and the highlight only marks the sessions of one track. The schedule page is a smaller version of the agenda, with no track control. The programme is a different surface: one print-first page. It shows the full event on one page for print.",
    },
    { kind: "heading", text: "What a visitor sees" },
    {
      kind: "prose",
      text: "A login is not necessary on a public surface. No public surface shows content that an organizer did not approve. A session shows only after its submission is accepted and its content is approved. A speaker shows only while their participation is active. A submission in review, or one without approved content, is not there. It is not shown with a pending mark.",
    },
    { kind: "heading", text: "Saved embeds" },
    {
      kind: "prose",
      text: "A saved embed is a named snippet that you can use again. You select a surface and set its options, and the builder gives you an iframe to paste into a different site. Sessions has the most options: track, format, room, day, search, a result limit, the fields to show, and an accent color. Speakers and gallery have track, search, the limit, and the accent.",
    },
    {
      kind: "prose",
      text: "Agenda and schedule do not have the room, format, and field options. Schedule also does not have the track option, because that surface does not read it. If an option is not applicable to a surface, the embed removes the option fully — it does not apply only a part of it.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-embeds-and-public-pages-02",
      caption: "The embed builder: the surface, its options, and the snippet that it makes, with one saved row for each embed.",
    },
    { kind: "heading", text: "Turning an embed off" },
    {
      kind: "prose",
      text: "When you turn a saved embed off, the embed breaks in each site where it is pasted. The list shows each saved embed as on or off. The panel tells you this effect clearly before you continue. This control is not only a mark in the list: it stops the embed in each site. Be careful before you turn off an embed that is live on a different site.",
    },
  ],
};
