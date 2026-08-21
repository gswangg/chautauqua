# Public 390 SSR frame verdicts (task w14-sf, DEC-976 wave-158 SSR amendment)

Per-frame render verdicts for the six public-surface 390 frames in
`docs/design/Chautauqua Public and Portal.dc.html`, entered through the real
Hono route (`test/public-390-frame-verdicts.test.ts`), per the DEC-976
wave-158 SSR amendment ("an SSR surface's per-frame verdict is a
`test/<surface>-390-frame-verdicts.test.ts` file ... entered by dispatching
a REAL request through a Hono app with the actual route module mounted").
Wave-158 measured that `test/public-agenda-phone-frames.test.ts` and its
siblings are pure source scans (`grep -c 'app.request'` = 0); this file is
the receipt each row below cites. MEASUREMENT ONLY — no route module or
`.css.ts` was touched to produce these verdicts.

A finding recorded here is a claim about the tree, not a permanent record.
It is re-derived against current code before it is scheduled, and once it
stops reproducing it is rewritten as RESOLVED with a `file:line` citation of
where the behaviour now lives (DEC-976 wave-106).

## 1. Public agenda (:371-405) — MATCHES

`GET /e/:eventSlug/agenda` (`src/routes/public/agenda.tsx`'s
`AgendaContent`). The day-pill strip (:378-380) plus the terminal "My
schedule" pill (:381) render via `agenda-controls.tsx`'s `DaySwitcher`; the
per-session action span (:395, `{{ s.action }}`) is the shared
`ItineraryToggle` Save/Saved control (`chq-pub-agenda-list-item`); the dock
band (:400-402, "Download .ics" filled + "Speakers" bordered) is
`.chq-pub-agenda-dock`, built by the wave-110/145/146 amendments already
recorded above in this cluster's DEC-976 history. No divergence found.

## 2. My schedule · /schedule (:864-888) — MATCHES

`GET /e/:eventSlug/schedule` (`ScheduleContent`). The h1 + subtitle
(`#chq-schedule-subtitle`), per-row "Remove" action (:880,
`.chq-pub-schedule-remove`), and dock band (:884-886, "Download .ics" +
"All sessions") all render as drawn — the dock band was already proven by a
real request in `test/public-schedule-dock.test.ts` (wave 110); this file
re-derives it independently rather than trusting that prior claim.

**Noted, not a defect**: the frame's subtitle line (:868) samples the
POST-hydration state, `"4 saved · 2 overlaps · no account needed"`. The SSR
response is necessarily pre-hydration and renders the JS-fillable
placeholder `"0 saved · 0 overlaps"` — `agenda-itinerary-script.tsx`'s
`updateLink()` appends the `"· no account needed"` clause and the real
counts client-side once `localStorage` is read (DEC-555: picks live in
localStorage, never server state). This is a structural match, not a byte
match, and is expected of any SSR render of a client-computed line.

## 3. Submit a talk (:1017-1065) — DIVERGES (label wording, two items)

`GET /submit/:eventSlug` (`submit-views.tsx`'s `SubmitPage`). The phone-only
two-step wizard chrome (:1022 `"Step 1 of 2 · your talk"`, the progress bar)
matches exactly (w14-f, DEC-986); the Track fieldset (:1042) matches
exactly.

- **Format legend text.** :1051 draws the bare legend `"Format"`.
  `FormatChoices` (`submit-views.tsx:288`) renders
  `<legend>{field.label}</legend>`, and the session-format field's stored
  label is `"Session format"` — the fixture value here matches the same
  seed data `test/submit-cfp-frame-copy.test.ts`'s `FIELD_ROWS` already
  uses. The legend is never trimmed to the frame's shorter word.
- **Dock's second control label.** :1063 draws the bordered control as
  `"Draft"`. The tree's equivalent control (`.chq-cfp-save-draft`, the same
  dock geometry per `cfp.css.ts`'s own `:428 "Draft"` comment) is labeled
  `"Save draft"` — one word longer than the frame's literal.

Both are copy-only mismatches; the surrounding anatomy (two controls in the
dock, filled primary "Next: about you" first, Track/Format fieldsets in
frame order) matches.

## 4. Submitted (:1074-1093) — RESOLVED (both items, DEC-908 wave-16 amendment)

`POST /submit/:eventSlug`, `ConfirmationPage`'s `"fresh"` state
(`submit-views.tsx:782`). Eyebrow ("SUBMITTED · <ref>"), title ("That's in.
Check your email."), the password block ("Set a password now" / "Create a
password" → `/claim/<token>`), and the spam note all match.

- **Card omits the third speaker · company line.** RESOLVED (DEC-908 wave-16
  amendment): `ConfirmationPage` now takes a `speakerLine` prop and renders it
  as a second `.chq-cfp-confirm-card-meta` span in the `"fresh"` state only,
  built in `submit-post.tsx` from the `firstName`/`lastName`/`resolvedCompany`
  the request just persisted (no extra query; bare name when there is no
  company; `null` renders nothing). Original finding follows. :1081 draws a third line
  inside the confirmation card, `"Priya Raman · Latticework Systems"` (the
  submitting speaker's name and company). `ConfirmationPage`
  (`submit-views.tsx:794-809`) renders exactly two children inside
  `.chq-cfp-confirm-card` — `chq-cfp-title` and, when non-empty,
  `chq-cfp-confirm-card-meta` (format/track/audience-level, per DEC-098
  wave-8 amendment / DEC-908 wave-148 amendment) — never a speaker identity
  line. This is the ONLY one of the three Submitted states whose frame draws
  a third card line (§5 and §6 below draw title + one meta line only, and
  the tree's shape matches those two exactly), so the gap is real and
  narrow: a speaker/company line is fetched nowhere in `submit-post.tsx`'s
  confirmation-render path and would need a new clause added to the `meta`
  composition at `submit-post.tsx:583-599`.
- **Way-forward link label.** RESOLVED (DEC-908 wave-16 amendment): the
  `.chq-cfp-links` row in `src/routes/public/submit-views.tsx` now renders the
  frame's own label to the same route; only the noun was wrong, the `href` was
  always correct. Original finding follows. :1092 draws `"Browse the sessions ›"`. The
  tree's `.chq-cfp-links` row renders the "programme" wording to the identical
  `/e/:eventSlug/sessions` route — the destination is correct, the label
  word differs ("programme" vs "sessions"). No DEVIATIONS.md or DEC entry
  names this
  specific wording choice (checked: the only nearby recorded deviation,
  DEVIATIONS.md's "CFP not-yet-open page's link now points at the prior
  edition" entry, concerns `NotYetOpenPage`'s own `"Browse the sessions
  ›"`/`"Browse last year's sessions ›"` pair, a different page).

Not flagged as a divergence: the frame's :1091 `"Submit another talk"` is
drawn as a bordered/filled control face; the tree renders it as a plain
`.chq-cfp-links` anchor (no button chrome) — `cfp.css.ts`'s own
`:460-461`/`:484` comments document this as a deliberate, already-settled
styling choice for the whole `.chq-cfp-links` row (flat brand-colour text
links, not boxed controls), so it is not a new finding.

## 5. Submitted · email already known (:1124-1138) — MATCHES

`POST /submit/:eventSlug`, `"pending-existing-contact"` state with
`emailDelivered: true`. Card carries title + exactly one meta line (frame
draws no third line for this state either); DEC-098's "no claim link on
screen" holds (`/claim/` never appears); the body sentence names the
password-setup mechanism; `"Already have a password?"` + exactly one
`/login` anchor render. No divergence found.

## 6. Submitted · has an account (:1147-1161) — MATCHES

`POST /submit/:eventSlug`, `"has-account"` state. `"You already have an
account here."` renders verbatim; the filled primary
`.chq-btn.chq-btn-primary` anchor reads `"Log in to track it"` to `/login`;
no `/claim/` path is minted or rendered. No divergence found.

## Summary

| # | Frame | Line | Verdict |
|---|-------|------|---------|
| 1 | Public agenda | :371 | MATCHES |
| 2 | My schedule · /schedule | :864 | MATCHES |
| 3 | Submit a talk | :1017 | DIVERGES (label wording ×2: "Session format" vs "Format", "Save draft" vs "Draft") |
| 4 | Submitted | :1074 | MATCHES (both findings resolved, DEC-908 wave-16 amendment) |
| 5 | Submitted · email already known | :1124 | MATCHES |
| 6 | Submitted · has an account | :1147 | MATCHES |
