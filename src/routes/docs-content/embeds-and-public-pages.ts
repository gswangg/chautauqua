import type { DocsArticle } from "./types";

export const embedsAndPublicPages: DocsArticle = {
  slug: "embeds-and-public-pages",
  group: "running-an-event",
  title: "Embeds and public pages",
  standfirst:
    "The public hub, its individual surfaces, and the embeds you can paste into another site all read from the same gate: accepted, visible, and content-approved. Nothing gets a second, looser door.",
  blocks: [
    { kind: "heading", text: "The public hub" },
    {
      kind: "prose",
      text: "Every event gets a public hub page — sessions, speakers, agenda, schedule and gallery, whatever the event has enough of to be worth a tile. It's the one URL you'd hand someone who just wants to look at the event, and it links out to each surface rather than trying to be all of them at once.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-embeds-and-public-pages-01",
      caption: "The public hub: one page per event, tiled out to whichever surfaces have content.",
    },
    { kind: "heading", text: "The surfaces" },
    {
      kind: "prose",
      text: "Sessions, speakers and gallery are searchable lists with a track filter. Agenda is the day-by-day schedule with a track highlight rather than a filter — every session still shows, the highlighted track's sessions are just called out — and schedule is the same idea pared back further, with no track control at all. The programme is a separate, print-first single page laid out for someone who wants the whole thing on paper rather than clicking through days.",
    },
    { kind: "heading", text: "What a visitor sees" },
    {
      kind: "prose",
      text: "None of these surfaces need a login, and none of them show anything an organizer hasn't cleared. A session only appears once its submission is accepted and its content is approved; a speaker only appears while their participation is active. A submission sitting in review, or one whose content hasn't been signed off yet, simply isn't there — not shown-but-marked-pending, just absent.",
    },
    { kind: "heading", text: "Saved embeds" },
    {
      kind: "prose",
      text: "A saved embed is a named, reusable snippet — pick a surface, set its knobs, and the builder gives you an iframe to paste into another site. Each surface only honors the knobs that make sense for it: sessions takes the most (track, format, room, day, search, a result cap, which fields show, an accent color); speakers and gallery take track, search, cap and accent; agenda and schedule drop the room/format/field knobs entirely, and schedule drops the track knob too, since nothing on that surface reads it. Ask a surface for a knob it doesn't support and it's silently dropped rather than partially honored.",
    },
    {
      kind: "figure",
      shotId: "running-an-event-embeds-and-public-pages-02",
      caption: "The embed builder: surface, its knobs, and the generated snippet, one saved row per embed.",
    },
    { kind: "heading", text: "Turning an embed off" },
    {
      kind: "prose",
      text: "Saved embeds are listed with an on/off state, not just created and forgotten. Turning one off breaks it wherever it's pasted — the panel says so plainly before you confirm — so it's a real switch, not a cosmetic label, and worth pausing before you use it on an embed you know is live somewhere.",
    },
  ],
};
