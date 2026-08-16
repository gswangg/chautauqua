import type { DocsArticle } from "./types";

export const embedsAndPublicPages: DocsArticle = {
  slug: "embeds-and-public-pages",
  group: "running-an-event",
  title: "Embeds and public pages",
  standfirst:
    "The public hub, the public surfaces, and the embeds that you paste into another site all read the same gate: accepted, visible, and content-approved. No surface has a second, less strict gate.",
  blocks: [
    { kind: "heading", text: "The public hub" },
    {
      kind: "prose",
      text: "Every event gets a public hub page. The hub shows a tile for each surface that has content: sessions, speakers, agenda, schedule, and gallery. The hub is the one URL that you give to a person who wants to look at the event. It links out to each surface.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-embeds-and-public-pages-01",
      caption: "The public hub: one page per event, with tiles for the surfaces that have content.",
    },
    { kind: "heading", text: "The surfaces" },
    {
      kind: "prose",
      text: "Sessions, speakers, and gallery are searchable lists with a track filter. The agenda is the day-by-day schedule with a track highlight, not a filter. Every session still shows, and the highlight only marks the sessions of one track. The schedule page is a simpler version of the agenda, with no track control at all. The programme is a separate, print-first single page. It shows the whole event on one page for print.",
    },
    { kind: "heading", text: "What a visitor sees" },
    {
      kind: "prose",
      text: "No public surface needs a login. No public surface shows content that an organizer did not clear. A session appears only after its submission is accepted and its content is approved. A speaker appears only while their participation is active. A submission in review, or one without approved content, is simply absent. It is not shown with a pending mark.",
    },
    { kind: "heading", text: "Saved embeds" },
    {
      kind: "prose",
      text: "A saved embed is a named, reusable snippet. You pick a surface and set its options, and the builder gives you an iframe to paste into another site. Sessions takes the most options: track, format, room, day, search, a result cap, the fields to show, and an accent color. Speakers and gallery take track, search, the cap, and the accent. Agenda and schedule drop the room, format, and field options, and schedule also drops the track option, because nothing on that surface reads it. If a surface does not support an option, the embed drops the option completely and never honors it partially.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-embeds-and-public-pages-02",
      caption: "The embed builder: the surface, its options, and the generated snippet, with one saved row per embed.",
    },
    { kind: "heading", text: "Turning an embed off" },
    {
      kind: "prose",
      text: "When you turn a saved embed off, the embed breaks in every place where it is pasted. The list shows each saved embed with an on and off state. The panel states this consequence plainly before you confirm. The switch is real, not a cosmetic label. Take care before you turn off an embed that is live on another site.",
    },
  ],
};
