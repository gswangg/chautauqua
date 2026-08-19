# Portal v12 fidelity audit — phone (w3-a)

Findings the task window could not resolve. Frame citations are verbatim
literals from `docs/design/Chautauqua Public and Portal.dc.html` per
DEC-976.

## 1. The delegating task described the landing frame's H1 as the 27px cluster-landing register; the frame's own bytes say 25px, same as both drill frames

w3-a's brief states: "The drill frames (:476, :531) open with a 44px back
link and a 25px H1; the landing (:414) uses the 27px register." The frame
bytes disagree with the second half of that sentence:

`<span style="font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Two things to do</span>` (:420)

— the landing frame's own H1-equivalent is 25px, byte-identical to the
drill frames' `font-size:25px` at :479 ("Your tasks") and :534 ("Your
profile"). All three of this task's frames draw the SAME register.

Per "the frame in the repo outranks a measurement of the frame," this task
implemented `.chq-portal-hero`'s phone rule as
`var(--chq-type-page-title-phone-drill)` (25px) uniformly across the whole
`/portal/*` family, rather than conditioning it on back-link presence — the
portal has no cluster nav to land on in the first place, so a uniform
one-level-below-entry register is the coherent reading. Flagging here in
case a future wave's design pass intended the 27px register for the portal
home specifically and the frame itself needs a ruling/correction, not the
code.

## 2. Frames "Portal · Your tasks" (:476-501) and "Portal · Your profile" (:531-559) draw a fixed bottom DOCK with primary/secondary action buttons; the current markup renders those actions inline in the scrolling body instead

Both drill frames draw a `flex-shrink:0` dock, separate from the scrolling
body, holding a primary + secondary action pair at `min-height:48px`:

`<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">` (:492, "Mark the release signed" / "Later")

`<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">` (:550, "Save" / "Cancel")

Today `src/routes/portal/profile.tsx`'s Save action (`.chq-portal-actions`
inside the "Profile details" `<section>`) scrolls away with the rest of the
body — it is not pinned to a bottom dock, and there is no Cancel control at
all. `src/routes/portal/tasks.tsx` (w3-b's file, not touched here) likely
has the same gap for its own action row.

This task's CSS already gives `.chq-portal-shell > .chq-portal-footer` the
correct dock ANATOMY (ink border-top, sunk background, `12px 16px 16px`
padding — verified against both frames by
`test/portal-phone-frames.test.ts`), because every `/portal/*` page already
renders that footer via `PortalLayout`. What's missing is CONTENT: routing
a page's primary action pair into `PortalLayout`'s existing `footerExtra`
slot (already used by the portal home's "name · company / Profile" band)
so it renders inside the dock instead of the scrolling body, plus adding
the profile page's missing Cancel control. That is a markup change to
`profile.tsx` (and `tasks.tsx`, outside this task's file ownership) beyond
this task's CSS-only "move the phone block, extend it" scope — recorded
here rather than attempted piecemeal within the time budget.
