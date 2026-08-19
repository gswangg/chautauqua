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

2. **Consequence of (1): a phone visitor with no in-progress draft has no
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
