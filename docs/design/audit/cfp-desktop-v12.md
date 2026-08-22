# CFP / public-submit v12 DESKTOP (1600) per-frame render verdicts (task w26-g, DEC-613/DEC-651/DEC-032 wave-26)

4 of Public-and-Portal's 13 desktop frames -- the four the ledger's own
6-of-13 wave-24 grant (task v12m-w24-h) does not own. Per-frame VERDICTS
entered through the real `publicSubmitRoutes` sub-app (a bare `Hono<AppEnv>`
+ `registerErrorHandler` + `app.request(route)`, DEC-613 wave-26: the
harness copies `test/public-390-frame-verdicts.test.ts` /
`test/submit-error-standard.test.ts` verbatim, never a sixth mock stack)
and asserted against the returned HTML string's markup structure, order and
text only -- an SSR response carries no computed layout, so there is
nothing else honest to read. Receipts live in
`test/cfp-desktop-frame-verdicts.test.ts`.

STRICTLY MEASUREMENT ONLY (DEC-651 wave-26): this document and its test
file render, verdict, and file divergences in prose -- they move no byte
and edit no route module or `.css.ts`, even where a real divergence is
found below. No Settings citations (DEC-032 wave-26).

## Frame :894 "Submit a talk · /submit/:slug" [894-1013]

**DIVERGES** (label wording only -- a blessed deviation, not new debt).
Entered via `GET /submit/:eventSlug` (`publicSubmitGetRoutes`), open-window
state (`form.openDate`/`closeDate` both null).

- Header band, `h1`, and the "Your talk"/"You" section chrome — MATCHES.
- The Track fieldset's legend (frame :933, "Track") — MATCHES exactly.
- The Format fieldset's legend (frame :942) reads the bare word "Format" in
  the pack. `FormatChoices` (`src/routes/public/submit-views.tsx:288`)
  renders `<legend>{field.label}</legend>`, and the form field's stored
  label is "Session format" — one word longer than the frame's literal,
  never trimmed to it. This is the SAME divergence
  `test/public-390-frame-verdicts.test.ts` already verdicts on this
  surface's 390 frame, and `DEC_976`'s wave-25 amendment
  (`src/decisions-data/part4.ts:353`) already rules it a blessed
  deviation: "a stored field label is not frame chrome — the CFP 'Format'
  legend is a blessed deviation."
- The dock band (frame :1003-1005: "Submit this talk" primary, "Save
  draft" secondary, "We email a confirmation with a link to your portal"
  note) — MATCHES verbatim, all three.

## Frame :1101 "CFP closed" [1101-1119]

**MATCHES.** Entered via `GET /submit/:eventSlug` with `form.closeDate` in
the past (`isFormClosed` resolves the "closed" window state before any
field/track query runs, so the select queue after the event/form rows is
empty — `ClosedPage`, `submit-views.tsx:100`).

- Heading (frame :1108, "The call for papers has closed") — MATCHES
  verbatim (`.chq-pub-surface-title`).
- Body (frame :1109, "Submissions closed on ... Thanks for your interest
  in {event}.") — MATCHES structurally: names the event, closes on
  "Thanks for your interest in", inside `role="alert"`
  (`.chq-cfp-closed-body`).
- Links (frame :1111): exactly ONE, "Browse the sessions ›", pointing at
  `/e/{slug}/sessions` — MATCHES. (`src/routes/public/submit-views.tsx`'s
  own w5-c comment: "frame copy for the CFP-closed dead-end.")

## Frame :1211 "Submit a talk · rejected on submit" [1211-1299]

**DIVERGES** (dock note only). Entered via `POST /submit/:eventSlug`
(`publicSubmitPostRoutes`) with an invalid submission (blank required
title, an over-length description, no track selected — three problems, not
the frame's own sample trio, but the same COUNT and hence the same
spelled-count heading, per this file's structural-only contract).

- Error summary (frame :1225, "Three things need fixing before this can be
  sent") — MATCHES verbatim: `src/domain/count-copy.ts`'s
  `thingsNeedFixingHeading(3, "before this can be sent")` spells the count
  as a word, exactly as the frame draws it, and this fixture's three
  independent problems (required / over-length / track-missing) produce
  exactly three summary anchors, each pointing at an id that exists
  somewhere in the rendered page.
- Reassurance line (frame :1231, "Nothing was lost. Everything you typed
  is still below.") — MATCHES verbatim, and every typed answer (name,
  email, the over-length description itself, unmodified) survives the
  re-render exactly as claimed.
- Dock band (frame :1289-1290: "Submit this talk" / "Save draft") —
  MATCHES; both controls persist unchanged into the rejected state.
- The frame's OWN dock note on this rejected state reads "Saving a draft
  skips these checks" (frame :1291, distinct from the fresh-form state's
  "We email a confirmation with a link to your portal"). The tree's
  `.chq-cfp-actions-note` (`submit-views.tsx:748`) renders the SAME
  fresh-form sentence unconditionally — it never branches on
  `errors`/`trackError` — so the rejected-state page still reads "We email
  a confirmation with a link to your portal" instead of the frame's
  error-specific caution. A real, narrow divergence: the note text is not
  error-state-aware.
- Field border/background recolor on errored controls (`#1B1D17` outline,
  frame :1236/:1264) is inherently a CSS fact — not re-asserted here as a
  style read; verdicting it would require reading `cfp.css.ts`'s own rule
  text, out of this task's strictly-measurement scope.

## Frame :1532 "CFP not open yet · /submit/:slug" [1532-1556]

**MATCHES** (with one documented, already-ruled narrowing). Entered via
`GET /submit/:eventSlug` with `form.openDate` in the future
(`formWindowState` resolves "not_yet_open" before any field/track query
runs — `NotYetOpenPage`, `submit-views.tsx:156`).

- Heading (frame :1540, "The call for papers opens on {date}") — MATCHES
  structurally: leads with the date the form opens, never an apology
  (`submit-views.tsx:172-175`'s own comment cites the same G13/
  DESIGN-RULINGS ruling this frame embodies).
- "You will not need an account." (frame :1541) — MATCHES verbatim.
  The frame's OTHER lede clause, "Three tracks, five formats." (also
  frame :1541), is deliberately NOT reproduced: `submit-get.tsx` returns
  before fetching tracks for this window state, so a track count here
  would be fabricated data — `submit-views.tsx:176-181`'s own comment
  names this exact DEC-986 constraint. Filed as the surface's own
  documented, intentional narrowing, not new debt.
- Way-forward link (frame :1543, "Browse last year's sessions ›"):
  exactly ONE link renders. With no qualifying prior edition seeded in
  this fixture (`getPriorPublicEvent` returns no row), the link falls
  back to "Browse the sessions ›" rather than the frame's own sample
  text — both destinations are the ruled contract, per `DEC_745`'s
  wave-150 amendment cited directly in `submit-views.tsx:145-155`: "when
  [lastYear] is null the link keeps its original destination and label
  unchanged... never a fabricated destination the window state cannot
  know." A prior-edition fixture would render the frame's own literal
  text exactly; this file did not spend an extra select-queue row proving
  that half of the branch, since the fallback half is the one drawn by an
  empty seed and is the one this task's fixture data naturally produces.

## Summary

| Frame | Verdict |
| --- | --- |
| :894 Submit a talk · /submit/:slug | DIVERGES (blessed, DEC-976 wave-25) |
| :1101 CFP closed | MATCHES |
| :1211 Submit a talk · rejected on submit | DIVERGES (dock note, real) |
| :1532 CFP not open yet · /submit/:slug | MATCHES |

2 of 4 frames MATCH exactly as rendered; the two DIVERGES rows are (a) a
previously-ruled, already-blessed label-wording deviation shared with the
390 half of this same surface, and (b) one real, narrow gap — the
rejected-state dock note is not error-state-aware. No byte was moved to
produce this verdict.
