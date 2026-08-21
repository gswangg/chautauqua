# Content v12 phone conformance — audit findings

Findings surfaced while implementing w1-e (TIER 0, DEC-825 amendment: phone
Select mode). Filed here per SCOPE LIMIT rather than fixed in-place, since
the fix belongs to a different lane's files.

## Select mode should suppress `.chq-tabbar`

**Frame**: docs/design/Chautauqua Content.dc.html:278 `border-top:1px solid
#1B1D17; background:#EFEBDF; padding:12px 16px 16px` — the "selecting"
390 frame's footer is a single docked `Approve N` band; the tab bar the
"rest" frame's footer draws (:229) is gone entirely in the "selecting"
frame, replaced rather than stacked.

**Current implementation (this task)**: `app/src/pages/content/content.css`
renders the dock as a page-owned `position: sticky; bottom: 0` band inside
`.chq-main` (the app's own scrolling region), which visually docks it
*above* `.chq-tabbar` since the tab bar is a sibling flex-shrink:0 region
outside `.chq-main`'s scroll box (DEC-989) — so nothing overlaps and no
shell file is touched. But `.chq-tabbar` itself is never hidden: entering
Select mode on phone leaves the tab bar mounted and visible underneath the
dock's own space, at the very bottom of the viewport, which the frame does
not draw. The frame's footer is ONE region (the dock, full stop), not two
stacked bands.

**Why not fixed here**: `.chq-tabbar` is shell chrome, not `app/src/pages/
content/**` — this task's file scope is Content only, and the task text
names this exact deferral: "file 'select mode should suppress .chq-tabbar'
as a finding for the shell lane."

**Suggested fix (shell lane)**: shell geometry needs some signal (a route
param, a data attribute on `.chq-main`/`.chq-page`, or a shared context)
that a page's own phone Select mode is active, and a rule hiding
`.chq-tabbar` under `@media (max-width: 700px)` when that signal is set —
mirroring how other page-owned docked bars (if any) already suppress it, or
establishing that pattern if none do yet.

**Update (w13-ra, wave 157)**: this finding now reads STALE against the
current tree — `ContentApp.tsx` sets `data-chq-phone-dock` while
`phoneSelectMode` is on, and `FilesLibrary.tsx` sets the same attribute
whenever its own dock is mounted, both wired to a `.chq-main:has([data-chq-
phone-dock]) ~ .chq-tabbar` suppression rule the ContentApp.tsx comment
cites in `styles.css`. Not re-verified by this task (out of file scope —
`app/src/styles.css`/`app/src/App.tsx` are this task's forbidden files), so
left as a marginal note rather than struck, but the shell-lane deferral
above appears to have already landed.

<!-- w13-ra (DEC-976 wave 157) -->

## task-w13-ra: per-frame verdict, all four width:390px Content frames — closing the phoneA "44 of 53 phone frames never rendered" gap for this cluster

Content is recorded as `DONE` in `docs/mobile-campaign.md` on the strength
of an earlier probe; before this task, NONE of Content's four
`width:390px` frames (`docs/design/Chautauqua Content.dc.html` :198 "Content",
:247 "Content · selecting", :338 "Files · 390", :373 "Session · deliverable")
had ever been rendered against the tree through the app's real route. This
task renders all four, entered through `ContentApp`'s real route
(`<MemoryRouter initialEntries={['/content...']}><Routes>…<ContentApp/>
…</Routes></MemoryRouter>`, matching `ContentApp.render.test.tsx`'s own
`renderContentApp` helper — never a sub-component mounted directly), and
records a verdict per frame below. Render receipts:
`app/src/pages/Content.frame-verdicts.render.test.tsx` (4 passing tests,
one per frame, each opening with a DEC-967 `verbatimLine` citation of the
frame's own caption line).

**All four frames diverge.** None of the four divergences found is a
phone-CSS/markup-ORDER fix (DEC-385) — every one is either a genuine
content/control gap (a combined status+title+meta card collapsed into
table cells; a header summary line that never yields the stage to the
"selecting" meta row; a chip-strip/copy vocabulary mismatch; a two-column
detail body where the frame draws one linear stack) or a wording/format
difference (bytes always carrying one decimal place; "Recording" for the
domain kind the frame calls "Video"). None was fixed here (out of scope —
this task measures, it does not touch `app/src/pages/content/**.css` or
`ContentApp.tsx`); each is flagged for whichever lane owns that surface.

| Frame | Verdict | What diverges |
| --- | --- | --- |
| `:198` Content (worklist) | DIVERGES | The frame draws each row as one stacked card — status pill, then title, then "speaker · file, when" on one line, then an Approve/Open action row, with no selection control anywhere. The real row is a `<table>` `<tr>` whose first cell is a per-row selection checkbox (DEC-825 amendment) ahead of the Session cell, with Speaker / Latest file / Status as three separate cells rather than one combined meta line, and status trailing the title rather than leading it. |
| `:247` Content · selecting | DIVERGES | The frame's per-row check-mark glyph is the SAME plain checkbox input the rest-state row already used (DEC-825's one selection model — matches in spirit, not in glyph). More significantly: the header's "N selected / All N / Done" meta row (:255-257) DOES render and DOES match, but it renders *alongside* the idle "N need a decision · M re-uploaded" summary line rather than replacing it — the summary-line clause in `ContentApp.tsx` carries no `!phoneSelectMode` guard, so both rows are mounted at once, which the frame never draws. The docked "Approve N" footer (:278-283) also renders inside `.chq-content-worklist` as a sibling of the table, not as the header block's own footer band. |
| `:338` Files · 390 | DIVERGES | Chip-strip vocabulary: the frame's plain "All" chip reads "All types" (SessionList's tab-strip wording carried over unchanged), and the frame's "Video · 4" chip reads "Recording · 4" (the domain kind is `recording`, not `video` — `DELIVERABLE_LABELS`, `app/src/pages/content/types.ts`). The stat line matches in shape but always carries one decimal place ("412.0 MB", not the frame's bare "412 MB" — `formatBytes`, `src/domain/files.ts`, always calls `.toFixed(1)`). The frame reserves "Download all"/"Search" for the sticky footer dock only (:365-367); the real header row (`.chq-content-files-header-row`) ALSO mounts a scoped "Download …(.zip)" secondary beside the stat line — a second copy of the same capability (a deliberate wave-125 amendment per the component's own comment), not what the frame draws. The footer dock itself DOES match: a primary "Download …(.zip)" beside a bordered "Search" secondary, both min-height 48px. |
| `:373` Session · deliverable | DIVERGES | The header (back link, H1 title, "Speaker · CODE" subtitle, content-status band with a same-row Approve) matches. The frame stacks ONE scrolling column below it — version rows, then a 2px-ruled "Notes on the &lt;kind&gt;" label, then comment rows, then the "Upload a file for the speaker" link, then the note textbox, all as later siblings of one shared list. The real body instead splits into two side-by-side DOM columns (`.chq-content-files-col` / `.chq-content-comments-col`, DOM siblings of `.chq-content-group-body`) — versions plus the upload zone in the left column, "Notes on the slides" plus the comment thread in the right column — never one linear stack. |

**Nothing in this list is a phone-block-CSS or markup-order fix.** Every
row is a genuine architectural/content gap (a table-row worklist vs. a
card grammar, a two-column detail body vs. a single stack, an unguarded
summary-line clause, a vocabulary mismatch) each requiring new markup or a
conditional this task's SCOPE LIMIT (measure, don't fix) puts out of
bounds — flagged here per the task's design-gap instruction, consistent
with the disposition every prior per-frame-verdict lane in this campaign
(Settings, `settings-v12.md`) already used for the same family of finding.
