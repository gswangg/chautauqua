# Comms 390 landing frame verdict (task w30-e, DEC-976, DEC-385)

Per-frame verdict for the phone Comms landing, frame
`docs/design/Chautauqua Comms.dc.html:177` ("Comms", 390), extent 177-221
(the frame line to the next `font-size:19px` label line, per
`test/phone-frame-ledger.scan.test.ts`'s own extent walk). Entered through
`CommsPage`'s real route (`MemoryRouter` + `?tab=`, DEC-710), never a
sub-component mounted directly. Render receipt:
`app/src/pages/Comms.frame390.render.test.tsx`. This is an ADDITIVE
companion to `app/src/pages/Comms.frame-verdicts.render.test.tsx`
(w14-sa/w15-ti, owned by another lane and not edited here) — that file
already pins the landing's structural composition against the no-draft
empty state; this file covers the ground it deliberately leaves ungraded.

A finding recorded here is a claim about the tree, not a permanent record —
re-derive against current code before scheduling, per DEC-976 wave-106.

## 1. Wordmark + event-name row (:180-181) — shell scope, MATCHES

The `chautauqua` wordmark and the event-name line are shell chrome
(`app/src/App.tsx`'s `<header>`, `.chq-wordmark`), not rendered by
`Comms.tsx` itself. Confirmed by the render receipt: `CommsPage` mounted
alone (no `<App>`) renders no `chautauqua` text. No divergence — the frame
draws every 390 screen's shell chrome identically; Comms.tsx correctly
does not duplicate it.

## 2. Page title "Comms" (:183) — MATCHES

`Comms.tsx`'s ONE accessible heading name is `h1.chq-page-title`
(`.chq-comms-head-titles`, lines 276/285/326), present at every width. The
phone landing's own title (:429, `.chq-comms-phone-landing-title`) is a
styled `<p>`, not a second `<h1>` — pinned by the sibling receipt file's
own tagName assertion and Comms.tsx's own doc comment at that element.

## 3. Phone send-rhythm subtitle (:184) — MATCHES (shape), one fidelity gap

`4 sent in 7 days · last Tue 4:12pm` is seeded sample data (DEC-967) —
graded by shape: `formatPhoneSendRhythm` (`app/src/pages/comms/
sendRhythm.ts`) produces `"N sent in 7 days · last <when>"`, rendered into
`.chq-comms-phone-landing-subtitle`, a `<p>` (never a second `<h1>`).
Confirmed by render receipt.

- **Noted, not a defect, already recorded (sendRhythm.ts's own doc
  comment).** `lastSentAt` renders through `formatDateTimeWeekday`
  ("Tue 11 Aug, 4:12pm") rather than the frame's terser "Tue 4:12pm" — the
  day+month ride along in the output. `lib/dates.ts` is outside this
  task's file scope (`Comms.tsx` / `comms.css` terminal block /
  `comms/composeDraft.ts` off-limits); left as-is.

The no-sends complement (`isFreshEmpty`, DEC-380 wave-140): the shared head
subtitle (`.chq-comms-head-subtitle`, Comms.tsx:352) reads "No sends on
this event" verbatim in place of the rhythm sentence when `recentBatches`
is empty and both seven-day totals are zero. Confirmed by render receipt.
This branch belongs to the page-level head (rendered regardless of
phone/desktop, since the head is only stood down for Templates/History),
not a phone-landing-specific line — the phone landing's own subtitle has
no separate "no sends" branch (it renders `"0 sent in 7 days"` via the same
formatter, no divergence from the frame since the frame draws no
zero-state for this line).

## 4. "Draft in progress" card (:188-193) — MATCHES the populated branch; one documented drop

`PhoneDraftCard` (`app/src/pages/comms/PhoneDraftCard.tsx`, off-limits to
this task, read-only) renders the frame's exact populated-state shape when
`composeDraft.ts`'s localStorage record exists: eyebrow "Draft in
progress" (:189), the draft's subject line (:190), a recipients line
(:191), the honesty note "Better on a laptop" verbatim (:192), and a
`min-height:44px` "Read the draft" control (:193) that routes into the
compose tab (`choosePhoneTab('compose')`) — never a dead end. Confirmed by
render receipt, including the onward-route assertion (pressing the control
selects the Compose tab).

- **Documented drop, not fabricated (already recorded, PhoneDraftCard.tsx's
  own doc comment + `docs/design/audit/comms-v12.md` finding 1).** The
  frame's line 191 draws `23 recipients · reviewer feedback merged`; the
  app renders `"N recipients"` alone. No signal in the app answers WHY a
  draft carries reviewer feedback (no `provenance` field anywhere in the
  payload) — the house "fail loudly, never invent a signal the payload
  can't answer" rule forbids fabricating that clause. Confirmed absent by
  the render receipt (`queryByText(/reviewer feedback merged/)` is null).

**Re: the task brief's "card ABSENT when no draft record exists" clause.**
Narrowed on inspection: the shipped behaviour (DEC-621 wave-109 amendment,
task w5-q, already landed and covered by the sibling receipt file) is an
EQUIVALENT empty-state card — same geometry, same 44px control, labelled
"Compose" — not an absent card. A genuinely absent card was the wave-87
starting point (finding 1 above) and was superseded because it left the
landing's only entry into Compose with zero controls (Tier 0 S2 break,
`docs/probes/metafid-phoneA-2026-08-19.md`). This task's brief pre-dates
that amendment; taking the narrower, non-editing interpretation here since
`PhoneDraftCard.tsx`/`composeDraft.ts` are outside this task's file
ownership and the shipped shape is itself frame-derived (no chooser
reintroduced). Flagged per the task's own instruction to flag design gaps
rather than resolve them unilaterally.

## 5. "Recent sends" band (:196-205) — MATCHES

The head row (:196-197, padding/border/margin geometry unchanged) plus the
DEC-751 four-row cap (`COMPOSE_RECENT_SENDS_LIMIT`, the SAME constant the
Compose-tab `RecentSends` mount uses — never a second cap value) and the
per-row template `{{ h.when }} · {{ h.short }}` / subject / template
(:201-203). Graded by shape (placeholder mock data). Confirmed by render
receipt: five seeded batches render exactly four rows, newest four, in the
list's own order; the row missing a `templateId` renders an em dash, never
a blank cell (`RecentSends`' own convention, reused not re-derived).

- **New geometry, not a frame quote, already documented (comms.css's own
  comment).** The band also carries two small route buttons into Templates
  and History (`.chq-comms-phone-recent-head-actions`/`-link`, DEC-621
  wave-109 amendment) — the frame draws no button here. Not re-litigated;
  out of this task's fix scope (composeDraft/PhoneDraftCard-adjacent, but
  this specific pair lives in Comms.tsx and was already built correctly).

## 6. Bottom tab strip (:210-214, `list="{{ tabs }}"`) — shell scope, MATCHES

Per `docs/design/audit/phone-dock-membership-v12.md`'s discriminator, a
band whose body contains `list="{{ tabs }}"` is the shell's own tab bar
(`app/src/App.tsx`'s `<PhoneTabBar />`), never page-local geometry.
Confirmed by render receipt: `CommsPage` mounted standalone renders no such
band — its own tab strip (Compose/Templates/History, `role="tab"`) is a
distinct, page-local control, not a duplicate of the shell's 5-item dock.

## Summary

No new fix landed against `Comms.tsx` or `comms.css`'s terminal
`@media (max-width: 700px)` block this task — every row above was already
frame-complete on `main` at this branch's base. This task's own
contribution is the render receipt
(`app/src/pages/Comms.frame390.render.test.tsx`) proving it, plus this
verdict document, plus recording the one open design-gap flag in §4 above
for a planner to adjudicate (whether the task brief's "card absent" clause
should retroactively override the standing DEC-621 wave-109 amendment —
this task takes the narrower reading: it should not, absent a new ruling).
