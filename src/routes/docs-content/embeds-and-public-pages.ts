import type { DocsArticle } from "./types";

export const embedsAndPublicPages: DocsArticle = {
  slug: "embeds-and-public-pages",
  group: "running-an-event",
  title: "Embeds and public pages",
  standfirst:
    "The public hub, the public surfaces, and the embeds on other sites all apply the same three conditions: accepted, visible, and content-approved. No surface applies a weaker set.",
  blocks: [
    { kind: "heading", text: "The public hub" },
    {
      kind: "prose",
      text: "Every event gets a public hub page that shows a tile for each surface with content: sessions, speakers, agenda, schedule, and gallery. The hub is the one URL you give to anyone who wants to look at the event, and it links out to every surface.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-embeds-and-public-pages-01",
      caption: "The public hub: one page per event, with tiles for the surfaces that have content.",
    },
    { kind: "heading", text: "The surfaces" },
    {
      kind: "prose",
      text: "Sessions, speakers, and gallery are searchable lists with a track filter. The agenda is the day-by-day schedule with a track highlight rather than a filter: every session stays in view, and the highlight only marks one track's sessions. The schedule page is a smaller version of the agenda with no track control, and the programme is a different surface: one print-first page that shows the full event.",
    },
    { kind: "heading", text: "What a visitor sees" },
    {
      kind: "prose",
      text: "Public surfaces need no login, and none of them shows content an organizer did not approve. A session appears only after its submission is accepted and its content approved; a speaker appears only while their participation is active. A submission still in review, or one without approved content, is simply absent; it does not appear with a pending mark.",
    },
    { kind: "heading", text: "Saved embeds" },
    {
      kind: "prose",
      text: "A saved embed is a named snippet you can reuse: you choose a surface, set its options, and the builder gives you an iframe to paste into another site. Sessions has the most options: track, format, room, day, search, a result limit, the fields to show, and an accent color. Speakers and gallery have track, search, the limit, and the accent.",
    },
    {
      kind: "prose",
      text: "Agenda and schedule drop the room, format, and field options; schedule also drops the track option, because that surface does not read it. When an option does not apply to a surface, the embed removes it entirely rather than applying part of it.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-embeds-and-public-pages-02",
      caption: "The embed builder: the surface, its options, and the snippet it produces, with one saved row per embed.",
    },
    { kind: "heading", text: "Turning an embed off" },
    {
      kind: "prose",
      text: "Turning off a saved embed breaks it on every site where it is pasted. The list shows each embed as on or off, and the panel states this effect clearly before you continue. The control is not just a mark in the list; it stops the embed on every site. Be careful before you turn off an embed that is live on another site.",
    },
  ],
};
