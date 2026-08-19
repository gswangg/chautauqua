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
