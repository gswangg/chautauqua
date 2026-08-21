# Comms v12 phone audit (task w1-d)

Findings surfaced replacing the DEC-621 three-way phone chooser with the
v12 landing against `docs/design/Chautauqua Comms.dc.html:177` ('Comms'
390). Scope is `app/src/pages/comms/**` only (Comms.tsx counts as a page
file, not a shell file, per the task). The items below need a decision or
land outside this task's scope.

1. **RESOLVED (v12 mobile campaign w5, DEC-621 wave-87 amendment).** The
   ruling: the card becomes real, because deleting it loses the frame and
   the frame is the authority. `app/src/pages/comms/composeDraft.ts` is the
   single-purpose localStorage contract this finding asked for --
   `ComposeWizard.tsx` writes a record (template name, resolved subject,
   recipient count, updatedAt) on each step advance (never on keystroke, so
   this stays clear of DEC-967's wave-54 silent-pre-fill ban) and clears it
   on a successful send; `Comms.tsx` reads it on mount and hands it to
   `PhoneDraftCard`, rendering nothing when absent. The frame's "reviewer
   feedback merged" provenance clause (line 191) is dropped, not
   fabricated -- no signal for it exists anywhere in the app, so the card
   renders the recipient count alone. Original finding text below, for the
   record.

   **"Draft in progress" cannot honestly render — no draft source exists.**
   Frame lines 188-193 draw a card naming the in-progress compose draft's
   subject, recipient count, and provenance ("reviewer feedback merged").
   `ComposeWizard`'s step state (selection, template, rendered previews) is
   entirely component-local `useState`, never lifted to `CommsPage`, never
   persisted to `localStorage`/a server draft record, and never derivable
   from any endpoint the page already calls (`email-log`, `templates`,
   `submissions`). This task's scope forbids adding a server endpoint and
   the house "fail loudly, never invent a number the payload can't answer"
   rule forbids fabricating a proxy signal. `PhoneDraftCard.tsx` is built to
   the frame's exact shape and unit-tested with a fabricated prop, but
   `Comms.tsx` wires it with `draft={null}` unconditionally, so the card
   never renders in the shipped app. A future task needs to either (a) lift
   compose draft state into `CommsPage` and persist it (localStorage at
   minimum, so a phone visitor's own in-progress draft survives a reload),
   or (b) rule that this card is aspirational until compose gains real
   draft persistence.

2. **RESOLVED (v12 mobile campaign w5, task w5-q, DEC-621 wave-109
   amendment).** Confirmed live (Tier 0 S2 break in
   `docs/probes/metafid-phoneA-2026-08-19.md`: "Comms Templates/History
   unreachable on phone without a localStorage draft; phoneEntered ignores
   ?tab=; landing has zero nav without a draft") and given a task, rather
   than left for a planner ruling. Two changes:

   - `phoneEntered` now initialises from `?tab=` (`isTab(rawTab)`) instead
     of always `false` — a visitor who already named a screen (bookmark,
     deep link, browser back/forward, DEC-710) skips the landing outright.
   - The landing itself now always carries a route into all three tabs
     even with no `?tab=` and no stored draft. The draft-card slot (frame
     lines 188-193) carries the route into Compose either way:
     `PhoneDraftCard` renders its normal frame-shaped card when a draft
     exists, and an equivalent empty-state card — same geometry
     (`.chq-comms-phone-draft-card`'s border/radius/background), same 44px
     control (`.chq-comms-phone-draft-read`) — labelled "Compose" (taken
     verbatim from the tab strip's own `TABS` vocabulary in `Comms.tsx`)
     when it does not. The "Recent sends" head band (frame lines 196-197,
     `padding:22px 0 8px; border-bottom:2px solid #1B1D17;
     margin-bottom:4px`) carries the two remaining routes, Templates and
     History, as a small button pair (`.chq-comms-phone-recent-head-
     actions` / `-link`, each meeting the 44px floor) added beside the
     existing "Recent sends" label — the frame draws no button in this
     band, so this is new geometry, not a frame quote, and is documented
     as such in `comms.css`'s own comment rather than cited to a specific
     frame line. Labels are the tab strip's own "Templates"/"History", no
     new copy invented. Original finding text below, for the record.

   **Consequence of (1): a phone visitor with no in-progress draft has no
   way to reach Compose, Templates, or History from this landing screen.**
   The frame draws exactly three things on this screen — title/subtitle,
   the draft card, and a read-only Recent Sends list — with the visible
   entry point being "Read the draft" (frame line 193). It draws no
   Compose/Templates/History chooser (the DEC-621 three-way chooser this
   task deletes) and no other link. Given (1), a fresh phone session
   (nothing in `recentBatches` yet fetched, or a genuinely fresh event) can
   land on this screen with literally nothing tappable except whatever
   footer nav the shell provides (out of this task's scope — "build no page
   dock here" per the task). This is the frame's own composition, taken at
   face value per the "narrowest reasonable interpretation" instruction,
   not an implementation shortcut — but it is a real dead-end worth a
   planner ruling: either the shell's global nav is expected to carry
   Compose/Templates/History reach on phone (in which case that should be
   confirmed, not assumed), or this landing needs a supplementary entry
   point the frame doesn't currently draw.

3. **The phone subtitle's "last send" clause carries more than the frame's
   literal text.** Frame line 184 reads `4 sent in 7 days · last Tue
   4:12pm` — weekday + time, no calendar date. `lib/dates.ts` is out of this
   task's file scope (`app/src/pages/comms/**` only), and no existing
   exported formatter produces exactly "weekday, time" with no day/month.
   `formatPhoneSendRhythm` (`app/src/pages/comms/sendRhythm.ts`) reuses the
   existing `formatDateTimeWeekday` ("Tue 11 Aug, 4:12pm") rather than
   hand-rolling a new one-off formatter outside its scope-permitted files,
   so the shipped subtitle carries the day+month the frame's phone line
   omits. Numerically honest (same rhythm figures as desktop, never
   re-derived), just not byte-identical to the frame's shorter string. A
   future task with `lib/dates.ts` in scope could add a dedicated
   "weekday, time only" formatter if the extra day+month is judged a real
   fidelity gap rather than an acceptable difference.

4. **The recent-sends "short" tally reuses the batch-count grammar, not a
   frame-specific abbreviation.** Frame line 201's `{{ h.short }}` is
   presented as opaque mock data (no literal string to match), so
   `.chq-comms-phone-recent-when` renders the same `sentCountLabel` grammar
   ("N sent · N skipped · N failed") the desktop Recent Sends rows already
   use (now exported from `RecentSends.tsx` for reuse), rather than
   inventing a new, shorter phrasing with no frame text to anchor it.

None of the above blocked landing the DEC-621 chooser deletion or the
frame's title/subtitle/recent-sends geometry, which are built and tested
against the frame per the task's Tier 0 scope.

---

<!-- w14-sa (DEC-976 wave-157/158) -->

## task-w14-sa: per-frame verdict, all three 390 frames — Comms was closed on grep, never rendered

Comms is a Tier-0 wave-1 cluster whose phone rows were previously closed on
source-scan evidence (a `comms-phone-frames`-style test that reads
stylesheet text and never dispatches a request — the same shape wave-158's
field guide entry names for Portal/Public/Home/Account/Docs). Its three 390
frames had never been rendered against the tree. This task actually
rendered all three, entered through `CommsPage`'s real route
(`<MemoryRouter initialEntries={['/comms?tab=<tab>']}><CommsPage /></MemoryRouter>`,
never a tab component mounted directly). Render receipts:
`app/src/pages/Comms.frame-verdicts.render.test.tsx` (3 passing tests, one
per frame, each opening with a DEC-967 `verbatimLine` citation of the
frame's own 390-card opening line).

| Frame | Verdict | What diverges |
| --- | --- | --- |
| `:177` Comms (landing) | DIVERGES | Structurally matches the frame's own composition (title, draft-card slot, "Recent sends" band) — the empty-state "Compose" card (finding 2 above) and the "Recent sends" band's Templates/History links (also finding 2) both render as built. The divergence is a jsdom artefact, not a content gap: `.chq-comms-phone-landing` stays mounted (CSS `display:none`, never unmounted) whichever tab is active, so jsdom — which evaluates no `@media` rule — renders the landing dashboard SIMULTANEOUSLY with the page-level tab head (`role="tablist"`) and whichever tab body is showing, something the frame itself never draws side-by-side. Any assertion against this frame must scope to `.chq-comms-phone-landing` (or its own text is ambiguous against the compose-tab RecentSends mount, which repeats the same batch subject elsewhere in the DOM). |
| `:286` Templates · 390 | DIVERGES | Head (back `‹ Comms`, H1 `Templates`, count line), row-then-editor composition, and the Save/"Use in a send" footer render as drawn, and the editor auto-selects the first template (DEC-890 amendment-4) — matching the frame's own assumption that the editor is already open. One real content gap: frame `:311-315` draws "Insert a field · open", a merge-field panel rendered permanently open with every field row visible; DEC-993 replaced that shape app-wide with a single closed `Insert a field ▾` trigger (`InsertFieldMenu.tsx`) whose panel only mounts after a click (`aria-expanded="false"`, no `role="menu"` in the DOM at rest). A deliberate, already-ruled product change (DEC-993), not an unbuilt gap. |
| `:335` Send history · 390 | MATCHES | Head (back `‹ Comms`, H1 `History`, count line), and per-row order (when·short, subject, template, toggle) match. The frame's `See the recipients` copy (`:350`) is present verbatim: `RecentSends`' `columnHeads` mount (History's own) renders two sibling spans — `.chq-comms-batch-toggle-label-desktop` "Open" and `.chq-comms-batch-toggle-label-phone` "See the recipients" (DEC-833) — both live in the DOM at once since jsdom applies no `@media` rule to hide either; the button's accessible name stays pinned to "Open" via an explicit `aria-label` (same DEC-833 comment), which is the one caveat a screen-reader-shaped query needs to know, not a content gap. |

No CSS or component file was touched by this task (measurement only, per
its own scope). The Templates divergence above is the DEC-993 dropdown
replacement, already a ruled product decision, not a new finding.

## Amendment (wave 159, task w15-ti, DEC-919)

**`:177` Comms (landing) — jsdom-artefact caveat CLOSED.** The row above
records the divergence as "a jsdom artefact, not a content gap" because
`.chq-comms-phone-landing` used to stay MOUNTED at every width (only its
`-show` class was gated by `phoneEntered`/CSS) — DEC-919's rule is that a
hidden control with no offset is still on the screen, and the same holds
for an unconditionally *mounted* one: at real DESKTOP widths the landing
dashboard sat in the DOM duplicating the compose tab's own `RecentSends`
mount (same batch subjects, twice), not merely a test-harness illusion.
`Comms.tsx` now gates the landing block's MOUNT itself on `useIsPhone()`
(the same seam the page already trusted to gate the tab head at line
`:323`) — desktop (`isPhone` false) no longer mounts the block at all,
byte-identical otherwise. `Comms.frame-verdicts.render.test.tsx` carries
the receipt: a desktop case asserting `.chq-comms-phone-landing` is
`null` with no matchMedia stub (jsdom's real default), and a phone case
(matchMedia stubbed, the `PipelineBoard.render.test.tsx` pattern)
asserting the frame's composition (title, draft-card slot, "Recent
sends" band) as before. The *within-landing scoping* the old row called
out is still correct and still needed in the phone-stubbed case — the
tab body underneath is CSS-hidden by width, not mount-gated, so it still
coexists with the landing in a jsdom render where `isPhone` is stubbed
true; that seam is unchanged and out of this task's scope.
