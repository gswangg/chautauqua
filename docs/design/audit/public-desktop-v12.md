# Public desktop (1600) SSR frame verdicts (task w24-h, DEC-613 wave-24 amendment)

Per-frame render VERDICTS for the six public-surface desktop (1600) frames
in `docs/design/Chautauqua Public and Portal.dc.html`, entered through the
real Hono route and asserted against the returned HTML STRING's markup
only — never a computed style (an SSR response carries no layout). Receipts
live in `test/public-desktop-frame-verdicts.test.ts`, whose harness is a
verbatim copy of `test/public-390-frame-verdicts.test.ts`'s own `Hono<AppEnv>`
+ `publicRoutes` + `registerErrorHandler` + `app.request(route)` shape (DEC-613
wave-24 amendment, "a desktop SSR verdict COPIES an existing buildApp
harness verbatim — a fifth mock stack is a second vocabulary"), varying only
path and fixture values.

STRICTLY MEASUREMENT ONLY (the mandate's desktop freeze): this document and
its test file render, verdict, and file divergences in prose — they move no
desktop byte and edit no route module or `.css.ts`, even where a real
divergence is found below. Frame `:716` (a `{{ s.name }}` template
interpolation) is excluded from the desktop population by
`test/desktop-frame-ledger.scan.test.ts` and is not verdicted here.

## Frame :28 "Sessions and agenda · 1600"

**RESOLVED-BY-RULING (DEC-593)** on one point; everything else MATCHES.
Entered via `GET /e/conf/sessions` (`src/routes/public/sessions.tsx`'s
`SessionsContent`).

- The frame's header nav (`Sessions / Speakers / Agenda / My schedule /
  Gallery`) draws five items. The tree's nav renders only FOUR — `shell.tsx`'s
  `NAV_SURFACES` is `SURFACES.filter((s) => s !== "gallery")`, per the
  DEC-593 amendment recorded in that file's own comment: "a photo-led twin
  is not a nav destination — a view switch (the /speakers List/Grid toggle)
  must not present as leaving the section." This is a real, previously-ruled
  divergence from the frame's literal nav list, not new debt — Gallery
  stays reachable only through the Speakers surface's own List/Grid toggle
  (frames :680/:730 below).
- The per-session row (frame's `sc-for` block, gutter time/room + title/
  speaker/track+format + `{{ s.action }}`) MATCHES: `SessionCard`
  (`src/routes/public/cards.tsx`) renders `chq-pub-session-row` with the
  same anatomy, and the action span is the shared `ItineraryToggle`
  (`chq-itinerary-toggle`) rendering "Save"/"Saved".
- The right rail's three sections ("Your schedule" / day index / "Call for
  papers") MATCH: `SessionsContent`'s three `chq-pub-rail-section`s render
  the ics link, the per-day index, and the CFP out-link in that order.
- The search box placeholder MATCHES the sessions-specific literal
  ("Search sessions or speakers…", DEC-808 wave-128 amendment).

## Frame :132 "Agenda · 1600"

**MATCHES.** Entered via `GET /e/conf/agenda` (`AgendaContent`).

- The day header (h1 + count) and the Tue/Wed/Thu day switcher render as
  drawn, each switcher entry a real `?day=` link.
- The time-anchored block grid (`chq-pub-agenda-day-blocks` /
  `chq-pub-agenda-block`) renders one content-sized card per session, no
  room-column matrix — matching the frame's own "time-anchored, not a room
  grid" subtitle.
- The right rail's "Rooms in use today" and "Print" sections both render.
- **DEC-999 block anatomy** ("a content-sized box in its own lane; the day
  grid neither clips a block nor lets one lane overrun another") is
  inherently a CSS fact — an SSR response carries no computed layout — so
  it is verdicted against `src/routes/public/css/agenda.css.ts`'s own
  stylesheet TEXT rather than the rendered string. That file's own comment
  on the rule reads `a block is a content-sized card -- column flexbox so`,
  and separately `NO overflow clipping, NO -webkit-line-clamp: DEC-768
  already established that a fixed-height clipped block was the bug, not
  the fix` — matching both clauses, the `.chq-pub-agenda-block` rule itself
  declares `display: flex; flex-direction: column` and carries no
  `overflow` or `-webkit-line-clamp` property.

## Frame :249 "Agenda · a track highlighted"

**MATCHES.** Same route/component as :132, entered with `?trackId=track1`
active — a STATE of the same surface, per the mandate's instruction to
budget frames sharing one route as one route with two fixtures.

- The track-highlight `<select>` (`chq-pub-highlight-track`) carries the
  active track's own name as its selected `<option>`, and a `Clear` link
  renders beside it — the frame's own `AI Engineering ▾` / `Clear` pair
  (its rendered value, not a hand-picked fixture literal).
- The right rail's room-count section narrows to the highlighted track's
  own heading ("N in <track name>") in place of the un-highlighted frame's
  "Rooms in use today" — `TrackHighlightRailSection`'s render-level filter,
  never a second SQL predicate (DEC-851 amendment wave 5: "track is a
  render-level HIGHLIGHT on this surface, never a SQL predicate — every
  session still renders").
- Highlighted blocks still carry the SAME `chq-pub-agenda-block` class the
  un-highlighted frame draws (DEC-999's content-sized-card geometry is
  identical in both states — a highlight changes paint, never the box
  model).

## Frame :680 "Speakers · list view"

**MATCHES.** Entered via `GET /e/conf/speakers` (`SpeakersContent`).

- The List/Grid segmented toggle (`aria-label="Speaker view"`) renders both
  options with `List` carrying `aria-current="page"` on this route.
- The search box placeholder reads `Search speakers…` at this call site —
  the settled prior fix this task's own brief names as closed (`src/routes/
  public/speakers.tsx` reads `placeholder="Search speakers…"` at both call
  sites, a Cut-2 eval item).
- Each row (`chq-pub-speaker-list-row`) carries the headshot
  (`chq-pub-speaker-list-photo`), name, the joined `title, company` role
  line, and a `chq-pub-speaker-sessions` list of the speaker's own session
  titles — the frame's full anatomy, `SpeakerListRow`
  (`src/routes/public/speakers.tsx`).

## Frame :730 "Speakers · grid view"

**MATCHES.** Entered via `GET /e/conf/gallery` (`GalleryContent`), the SAME
page reached through the List/Grid toggle's `Grid` option (`aria-current=
"page"` on this route).

- Each tile (`chq-pub-speaker-card`) carries the headshot, name, and the
  company ALONE — no role, no session list. This is the DEC-990 amendment
  (wave 40) the frame itself already reflects: "the grid tile's subtitle is
  the company ALONE — one line on every card... the list row above keeps
  the fuller role, company line." `SpeakerGridTile` renders no `chq-pub-
  speaker-sessions` element at all, matching the frame's "no session list"
  design (frame's own subtitle: "Same page, photographs first").

## Frame :779 "My schedule · /e/:slug/schedule"

**RESOLVED-BY-RULING (DEC-967, same as its 390 twin)** on the sample byte
only; everything else MATCHES. Entered via `GET /e/conf/schedule`
(`ScheduleContent`) — the SAME route and SAME markup
`test/public-390-frame-verdicts.test.ts`'s frame `:864` verdict already
covers; only `agenda.css.ts`'s media query differs between the two widths,
never the HTML.

- The h1 ("My schedule") and per-row anatomy (time/room gutter, title,
  speaker, a `chq-pub-schedule-remove` "Remove" action — never "Save"/
  "Saved") MATCH exactly.
- The frame draws the POST-hydration sample subtitle, `4 saved · 2
  overlaps`. The SSR response is pre-hydration and renders the JS-fillable
  placeholder `0 saved · 0 overlaps` instead — `#chq-schedule-subtitle`'s
  real bytes are filled in client-side by `agenda-itinerary-script.tsx`'s
  `updateLink` once `localStorage` is read. The SAME divergence
  `public-390-verdicts-v12.md` already files for this route's 390 twin —
  filed here again for the desktop entry point rather than silently
  matched, since a divergence real on one width is real on both when the
  markup is shared. DEC-967's "frame sample data is not product copy"
  resolves this without a lane: the frame's populated sample is not
  reproducible pre-hydration, real bytes.
- The desktop-only "Take it with you" rail (`ScheduleRail`,
  `src/routes/public/agenda-rail.tsx`) renders the ics-count caption and the
  `#chq-ics-link` control — this section has no counterpart on the 390
  frame, which relies on the dock band alone for the same capability.
  MATCHES the desktop frame's own two-column layout (main column + rail).
- The dock band (`chq-pub-schedule-dock`) renders the filled "Download
  .ics" control (`chq-ics-link-dock`) and the bordered "All sessions"
  cross-link, in that order — MATCHES.

## Summary

| Frame | Verdict |
| --- | --- |
| :28 Sessions and agenda · 1600 | RESOLVED-BY-RULING (DEC-593 — nav drops Gallery) |
| :132 Agenda · 1600 | MATCHES |
| :249 Agenda · a track highlighted | MATCHES |
| :680 Speakers · list view | MATCHES |
| :730 Speakers · grid view | MATCHES |
| :779 My schedule · /e/:slug/schedule | RESOLVED-BY-RULING (DEC-967 — pre-hydration subtitle placeholder, same as the 390 twin) |

4 of 6 frames MATCH exactly as rendered; the other two rows are both
resolved-by-ruling, previously-ruled intentional divergences (a nav
simplification per DEC-593, and a pre-hydration placeholder shared with the
already-audited 390 twin of the same route, per DEC-967), not new debt. No
desktop byte was moved to produce this verdict.
