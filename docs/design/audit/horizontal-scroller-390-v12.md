# Horizontal-scroller premise ground-truth (DEC-367 wave-30 amendment, task v12m-w30-d)

Measured by `test/horizontal-scroller-premise.scan.test.ts`. Grounds the two
escape hatches `scripts/render-sweep.ts`'s mobile overflow probe relies on:

1. `inHorizontalScroller(el)` walks up an element's ancestors and excludes it
   from both `maxElementRight` and `overflowOffenders` the instant any
   ancestor computes `overflow-x: auto|scroll` (DEC-424's remedy for a
   deliberately wide matrix that scrolls inside its own container).
2. `KNOWN_CLIP_EXCEPTIONS` names offenders the vertical-clip probe is told to
   ignore outright.

Neither exclusion was previously checked against the design pack. The
round-4 horizontal-overflow probe's "zero offenders" verdict is equally
consistent with a page that is actually clean AND with a page whose real
overflow is hidden inside a scroller `inHorizontalScroller` excludes but no
`docs/design/*.dc.html` frame ever draws.

**RECORDING PRECEDES REPAIR**: nothing below was deleted or rewritten this
wave. A wrong deletion turns a hidden phone overflow into a visible one on
desktop, which is FROZEN (DEC-385 single-direction responsive).

## Population

Every `overflow-x: auto|scroll` and `overflow: auto|scroll` declaration
across `app/src/**/*.css` plus every SSR `*_CSS` module under `src/**`
(enumerated via `ssrCssSources()`, never a `*.css.ts` filename glob). 15 rows
total, comments stripped first.

## Escape hatch 1: `inHorizontalScroller` grounding

| File | Selector | Scope | Verdict | Pack citation |
|---|---|---|---|---|
| `app/src/styles.css` | `.chq-chipstrip` | base | GROUNDED | Shared base rule for the chip-strip pattern drawn repeatedly below; see concrete surfaces. |
| `app/src/pages/contacts/contacts.css` | `.chq-contacts-filter-chipstrip` | phone | GROUNDED | `Chautauqua Contacts.dc.html` `display:flex; gap:7px; overflow-x:auto; -webkit-overflow-scrolling:touch` (already cited in-code) |
| `app/src/pages/contacts/contacts.css` | `.chq-contacts-segment-pills` | phone | GROUNDED | `Chautauqua Contacts.dc.html` `border:1px solid #BAB6A6; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:500` (the wrapping chip row this pill sits in draws `overflow-x:auto`; already cited in-code) |
| `app/src/pages/contacts/contacts-panels.css` | `.chq-contacts-import .chq-steps` | phone | **UNGROUNDED-SCROLLER** | `Chautauqua Contacts.dc.html`'s phone "Import CSV · 390" frame draws a plain `speakers.csv · 214 rows · 2 of 5` text header, never a step-chip strip. `ImportWizard.tsx`'s own comment calls `.chq-steps` a "mock" of that text — the frame never draws this control at all, scrolling or otherwise. |
| `app/src/pages/speakers/speakers.css` | `.chq-speakers-grid-wrap` | base | GROUNDED | `Chautauqua Speakers.dc.html` `overflow-x:auto; -webkit-overflow-scrolling:touch` wrapping `min-width:1060px; display:grid; grid-template-columns:230px repeat(6, 1fr)` — the deliberately-wide task matrix this scan's own task description names as a legitimate scroller. |
| `app/src/pages/submissions/submissions.css` | `.chq-submissions-filterbar`, `.chq-submissions-filterbar .chq-status-pills`, `.chq-submissions-viewtabs` | phone | GROUNDED | `Chautauqua Submissions.dc.html` `display:flex; gap:7px; overflow-x:auto; -webkit-overflow-scrolling:touch` (already cited in-code) |
| `app/src/pages/submissions/submissions.css` | `.chq-submissions-table-wrap` | base | **UNGROUNDED-SCROLLER** | `Chautauqua Submissions.dc.html`'s desktop frames are a fixed `width:1600px` canvas; no `overflow-x` is drawn for the results table anywhere in the pack. The wrapper exists for the organizer-toggled custom-column picker (`.chq-submissions-columnpicker-panel`, a feature the static frame doesn't model), not for anything the frame draws. |
| `app/src/pages/overview/overview.css` | `.chq-overview-deadlines` | phone | GROUNDED | `Chautauqua Overview.dc.html` `display:flex; gap:7px; overflow-x:auto; -webkit-overflow-scrolling:touch` (deadline chip strip) |
| `app/src/pages/agenda/agenda.css` | `.chq-day-grid` | base | **UNGROUNDED-SCROLLER** | No `Chautauqua Agenda.dc.html` frame draws `overflow-x`/`overflow:auto` on the room-lane day-grid matrix. The room-column matrix *shape* resembles the Speakers grid's legitimate wide-matrix pattern, but shape resemblance is not a citation (DEC-180) — no frame quote pins this exact wrapper. |
| `app/src/pages/comms/comms.css` | `.chq-comms-preview-nav` | phone | **UNGROUNDED-SCROLLER** | `Chautauqua Comms.dc.html` contains ZERO `overflow-x`/`overflow:auto\|scroll` declarations anywhere — no scrolling region of any kind is drawn for this surface at all. |
| `src/routes/docs-site.css.ts` | `.chq-docs-code` | base | **UNGROUNDED-SCROLLER** | `Chautauqua Docs.dc.html`'s "Docs · an article" frame annotates "Reading measure 680" (matching `.chq-docs-code`'s own `max-width:680px`) but draws no `<pre>`/code-block example — no literal `overflow-x` anywhere in the frame. Plausibly a defensive affordance for markdown-sourced code the static mock never happened to render, but unverified against the pack. |
| `src/routes/tools.css.ts` | `.chq-tool-table-wrap`, `.chq-tool-pre` | base | **OUT-OF-SCOPE** | DEC-382 rules the three operator surfaces (`GET /`, `/docs/api`, `/dev/mailbox`) "chrome, not designed screens." There is no `Tools.dc.html` and none is expected — a pack join does not apply. |
| `src/routes/portal/portal.css.ts` | `table`, `pre` | phone | **UNGROUNDED-SCROLLER** | Own comment: a defensive "descendant containers that can otherwise impose an intrinsic width... a table or pre/code block gets its own scroll container instead of the page" catch-all. `Chautauqua Public and Portal.dc.html` draws no `<table>` element anywhere in the portal frames. |
| `src/routes/public/css/agenda.css.ts` | `.chq-pub-agenda-day-scroll` | base | **UNGROUNDED-SCROLLER** | Own comment (DEC-584 wave-64): kept as "a harmless no-op wrapper" since "no horizontal scroll is needed anymore (no room columns to overflow)". `Chautauqua Public and Portal.dc.html`'s Agenda frames draw no `overflow-x` for the day-row region. Self-documented as currently inert, but still an unrun-through the pack declaration. |
| `src/routes/public/css/agenda.css.ts` | `.chq-pub-day-switcher` (desktop, 210px joined group) | base | GROUNDED | The frame's phone day-switcher shape (`Chautauqua Public and Portal.dc.html` `display:flex; gap:7px; overflow-x:auto; -webkit-overflow-scrolling:touch`) is this component's phone override, already cited in-code; the desktop rule above is the same component's base geometry for the same 2-day content the frame's desktop rows draw. |
| `src/routes/public/css/agenda.css.ts` | `.chq-pub-day-pill` (phone strip container + one pill segment, `.${ACCENT_BOUND_CLASSES[1]}`) | phone | GROUNDED | `Chautauqua Public and Portal.dc.html` `display:flex; gap:7px; overflow-x:auto; -webkit-overflow-scrolling:touch` — cited in-code already; the pill segment's own `overflow-x:auto` restates the same contract on itself (own comment: "a truthful no-op"). |

**UNGROUNDED-SCROLLER total: 8** (`UNGROUNDED_SCROLLER_CEILING`, two-sided
ratchet — see `test/horizontal-scroller-premise.scan.test.ts`). Every one is
a real gap in what the mobile overflow probe's own escape hatch has been
verified against; none is asserted to be a bug, only unrun-through the pack.
The submissions/portal/docs/tools rows are plausibly-legitimate defensive
affordances for content the pack's static mock never rendered — the agenda
day-grid and comms preview-nav rows are the two with no defensive
justification recorded in their own comments either, and are the most worth
a follow-up wave's attention.

## Escape hatch 2: `KNOWN_CLIP_EXCEPTIONS` staleness

One member: `/admin/agenda::div.chq-session-card-title`, exempted as
"intentional 3-line `-webkit-line-clamp` truncation."
`app/src/pages/agenda/agenda.css`'s `.chq-session-card-title` rule still
exists and still declares `-webkit-line-clamp: 3` — a genuine, designed
truncation, the only admissible reason DEC-991 permits for this list. Not
stale.

**STALE-CLIP-EXCEPTION total: 0** (`STALE_CLIP_EXCEPTION_CEILING`).
