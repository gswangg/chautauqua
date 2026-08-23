# Public-site 390 request verdicts (task w28-g, DEC-976 wave-28 amendment)

Measured at sha `df55360702068950b0bb1d9743680cc97682ad9e` (branch `v12m-w28-g`, off `main`).

## What a request verdict proves, and does not

A request verdict dispatches a real request through the actual route module
(`Hono<AppEnv>` + `registerErrorHandler` + `app.request(...)`, against a
mocked `db`/`KV`/`FILES`) and asserts against the returned HTML string. It
proves **markup and text**: which elements exist, their class/id/href/aria
attributes, their text content, their order, and their presence/absence
under a given server-side state (fresh submission vs. pre-existing contact
vs. existing account, etc). It does **not** prove computed geometry — box
size, spacing, colour, breakpoint behaviour — that is the CSS-text scan's
job (`test/public-agenda-phone-frames.test.ts` for the agenda cluster,
`test/cfp-phone-submit-relining.test.ts` for the CFP cluster). The two are
companions, never substitutes for each other (DEC-976 wave-28 amendment,
the ruling this task implements).

## Population derivation (never hand-listed, DEC-808)

`docs/design/Chautauqua Public and Portal.dc.html` carries 28 labelled
frames (a label line is `font-size:19px` + `>TITLE<`; a frame's extent runs
from its label to the next label line, or EOF for the last). A labelled
frame is a **phone** frame iff its extent contains both `width:390px` and
`height:844`. Re-derived directly against the file at the measured sha (a
small Node walk, not copied from any prior wave's count):

```
367-409   PHONE  Public agenda
410-472   PHONE  Speaker portal
473-501   PHONE  Portal · Your tasks
502-527   PHONE  Portal · Hotel stay form
528-559   PHONE  Portal · Your profile
560-596   PHONE  Portal · Your session
597-679   PHONE  Portal · Edit your session
861-893   PHONE  My schedule · /schedule
1014-1070 PHONE  Submit a talk
1071-1100 PHONE  Submitted
1120-1143 PHONE  Submitted · email already known
1144-1166 PHONE  Submitted · has an account
1300-1372 PHONE  Portal · co-presenter rejected
1557-1822 PHONE  Portal · Resources
```

**14 phone frames total** — confirms the brief's "largest single phone
population in the pack" claim. Of these, **8 are Portal frames** (Speaker
portal dashboard, Your tasks, Hotel stay form, Your profile, Your session,
Edit your session, co-presenter rejected, Resources) — every one of them
styled and routed under the authenticated `/portal/*` surface, not
`/e/:eventSlug/*`. **Correction to the brief**: the brief names "the three
portal frames at :414/:476/:531" as the set to skip; the actual count,
re-derived directly against this sha, is **eight**, not three (verified by
checking each extent for a real, distinct `width:390px; height:844px` frame
box — see the derivation script's output above; none of the eight is a
false positive). This reads as the same "a ledger's claim about the tree
undercounts the tree" pattern the field guide names repeatedly (waves
19-27) — noted here as a finding, not corrected by hand-editing the
brief. All eight are the speaker-portal cluster's own sibling lane's
responsibility and are **out of scope for this ledger**.

The remaining **6 frames are the public-site half** this ledger covers —
the `/e/:eventSlug/*` and `/submit/:eventSlug` surfaces (never
authenticated): Public agenda, My schedule, Submit a talk, and the three
DEC-098 confirmation states (Submitted / Submitted · email already known /
Submitted · has an account).

## Coverage: all 6 public-site phone frames already carry real request verdicts

**Correction to the brief's VERIFIED line**: the brief states "none of its
public-site half has ever been verdicted at the markup level." Re-measured
directly: this is no longer true on `main` at the sha above. All 6
in-scope frames already carry real `app.request`-dispatched verdicts,
landed across two files:

- `test/public-390-frame-verdicts.test.ts` (task w14-sf, DEC-976 wave-158
  SSR amendment) — covers all 6 frames, real request dispatch through
  `publicRoutes`/`publicSubmitRoutes`, `verbatimLine` citation receipts,
  explicit MATCHES/DIVERGES verdicts per frame.
- `test/public-agenda-phone-frames.render.test.ts` (this task, NEW) — a
  narrower companion scoped to the same two frames
  `test/public-agenda-phone-frames.test.ts` (the CSS-text sibling) owns:
  Public agenda and My schedule. Independent assertions (day-switcher
  structure, dock-band content, per-row action label, the h1-absence
  divergence on the agenda frame) rather than a second copy of
  `test/public-390-frame-verdicts.test.ts`'s own assertions for those two
  frames (DEC-613: "a second copy of a vocabulary is a trap with a delay
  fuse").

This ledger's own contribution is the population derivation above, the
correction to the brief's two stale claims, and the per-frame verdict
table below — not a third copy of the request assertions themselves.

## Per-frame verdicts (markup level only)

| Frame | Route | Verdict | Receipt |
|---|---|---|---|
| Public agenda (:367-409) | `GET /e/:eventSlug/agenda` | MATCHES: day-switcher (`chq-pub-day-switcher`, `Jump to day`) + terminal My-schedule pill; per-session action control; dock band (`chq-pub-agenda-dock`) carries filled Download .ics + bordered Speakers, exactly the two controls drawn. **Divergence noted, not a defect** (DEC-099 wave-34 clause (a): citation named in this verdict's own paragraph, not left implicit): the frame's own static mockup leads with the event title as a bare `<span>`, never an `<h1>`; the real route's only `<h1>` is the dynamic `chq-pub-surface-title` (day + session-count text), which the frame's sample never shows because it is a single static snapshot — a sampling artifact of a static drawing versus a live route, not a repairable gap. | `test/public-390-frame-verdicts.test.ts` (`` `frame :371 Public agenda -- MATCHES...` ``) and `test/public-agenda-phone-frames.render.test.ts` (`` `frame :371-409 Public agenda` `` describe block) |
| My schedule · /schedule (:861-893) | `GET /e/:eventSlug/schedule` | MATCHES: exactly one `<h1>My schedule</h1>`; no day switcher (this surface has no day facet of its own — a structural divergence from the agenda frame, not a defect); per-row action reads "Remove" (never Save/Saved); dock band (`chq-pub-schedule-dock`) carries filled Download .ics + bordered All sessions. Honest sample divergence: the SSR subtitle placeholder reads "0 saved · 0 overlaps" pre-hydration; the frame's static sample shows "4 saved · 2 overlaps · no account needed" (client JS fills the real count and the trailing clause after paint). | `test/public-390-frame-verdicts.test.ts` (`` `frame :864 My schedule · /schedule -- MATCHES...` ``) and `test/public-agenda-phone-frames.render.test.ts` (`` `frame :861-893 My schedule · /schedule` `` describe block) |
| Submit a talk (:1014-1070) | `GET /submit/:eventSlug` | DIVERGES (label wording only, structure MATCHES) -- ADJUDICATED, both wording halves already ruled, neither is open debt: phone two-step chrome ("Step 1 of 2 · your talk" progress label/bar) matches exactly; the Format fieldset's `<legend>` reads "Session format" where the frame draws the bare "Format" -- `src/routes/public/submit-views.tsx` renders `<legend>{field.label}</legend>`, the organiser's own stored field label (DATA), and the frame's bare word is sampled fixture data, not product copy, so the pack has no authority over it: ruled a blessed deviation in DEC-976 (DEVIATIONS §7), never a rename of a live field; the dock's second (save) button reads "Save draft" where the frame draws "Draft" -- one control, one name at every width per DEC-613 wave-96 (`src/routes/public/cfp.css.ts`'s `.chq-cfp-save-draft` comment), the frame's "Draft" is a drawing abbreviation, not a label to ship, and the product label stays "Save draft" at every width. The dock's primary reads "Next: about you", matching the frame exactly. | `test/public-390-frame-verdicts.test.ts` (`` `frame :1017 Submit a talk -- DIVERGES (label wording)...` ``) |
| Submitted (:1071-1100) | `POST /submit/:eventSlug`, fresh contact | MATCHES (DEC-908 wave-16 amendment): eyebrow "SUBMITTED · <ref>"; h1 "That's in. Check your email."; confirmation card carries title + format/track/level meta line + the frame's third speaker·company line (fresh state only); "Set a password now" block with a real `/claim/<token>` primary; way-forward link reads "Browse the sessions". | `test/public-390-frame-verdicts.test.ts` (`` `frame :1074 Submitted -- MATCHES...` ``) |
| Submitted · email already known (:1120-1143) | `POST /submit/:eventSlug`, pre-existing contact, no account | MATCHES: no `/claim/` token rendered on screen (DEC-098); card carries title + exactly one meta line (no third speaker line — DEC-908 scopes that to fresh state only); "Already have a password?" body + exactly one `/login` anchor reading "Log in ›". | `test/public-390-frame-verdicts.test.ts` (`` `frame :1124 Submitted · email already known -- MATCHES...` ``) |
| Submitted · has an account (:1144-1166) | `POST /submit/:eventSlug`, pre-existing contact + account | MATCHES: "You already have an account here." line; filled `.chq-btn-primary` anchor to `/login` reading "Log in to track it"; no `/claim/` path minted or rendered. | `test/public-390-frame-verdicts.test.ts` (`` `frame :1147 Submitted · has an account -- MATCHES...` ``) |

## Findings for the planner

1. **The brief's two VERIFIED-style claims were stale**, in opposite
   directions: it undercounted the portal-frame exclusion (three named,
   eight actual) and overcounted the remaining gap (claimed zero
   public-site request coverage; six of six frames already covered). Both
   corrected above with re-derivation, not by editing the brief.
2. **RETIRED (wave-8, DEC-976): both label pairs are already ruled, not an
   open gap.** `Format`/`Session format` is ruled by the row in
   docs/design/audit/cfp-legend-register-v12.md (D:942, P:1051,
   STORED-FIELD-LABEL, `Format` vs `Session format`) — the tree's
   `<legend>{field.label}</legend>` renders the organiser's
   own stored field label, and the frame's bare word is a sampled fixture
   value, not a string to ship (DEC-613 wave-27). `Save draft`/`Draft` is
   ruled at docs/design/DEVIATIONS.md`ALREADY RULED` (quoting: "CFP wizard
   dock's `Save draft` vs the frame's `Draft` — ALREADY RULED, recorded here only so
   the ledger stops re-filing it. `src/routes/public/cfp.css.ts` states the
   disposition in the sheet itself: the accessible name stays 'Save draft'
   per DEC-613's wave-96 amendment, one control with one name at every
   width, and the frame's `Draft` is a drawing abbreviation rather than a
   label to ship.") No lane action follows from this row; both halves were
   already dead before this wave, this entry only stops the ledger
   re-filing them.
3. **No action needed on the six public-site frames' request coverage
   itself** — it is real, passing, and citation-receipted. Any further
   phone-parity work on this cluster should target the 8 unclaimed-by-this-
   lane portal frames (the sibling lane's scope) or the one Submit-a-talk
   label DIVERGES above.

## Classless-interactive-element roster (task w35-h, DEC-996 wave-35)

**Moved** (custodian task custodian-docs_design_audit_public_390_request_verdicts_v12_md,
contention decomposition — this file had drawn 4 merge conflicts): the
full "Classless-interactive-element roster" section, and its "Public-row
verdicts" follow-on (task w39-e, DEC-996 wave-39 amendment), now live in
`docs/design/audit/public-390-classless-roster-v12.md`, verbatim, no
wording or verdict changed. This file keeps only the pointer above the
old section heading so nothing above line 133 shifts and every existing
`public-390-request-verdicts-v12.md:<line<=133>` citation into the
sections above keeps resolving.

**Population: 59 classless interactive elements, none reaching any enclosing `chq-` token** (every row below reads `(no enclosing chq- token)` — no CSS rule anywhere in the tree could reach any of them by class selector, so none of these 59 can be VERIFIED, UNVERIFIABLE, or FALSE under `tap-floor-exempt-premise`'s grammar; they are simply invisible to it). 37 of the 59 are `<input type="hidden">` — inert, unrendered, out of the tap-floor population by construction (no visible surface, nothing to tap) — leaving **22 real candidate rows**: 15 `<a>`, 6 visible `<input>` (text/checkbox-shaped, not hidden), 1 `<select>`.

Row shape (wave 40): the File:line column and the Tag column are never
adjacent in citation shape (no bare `path:line` immediately followed by a
backtick quote) — `path:line` sat next to a backtick-quoted `<a>`/`<input>`/
`<select>` and both citation-form-drift.scan.test.ts's LINE_KEYED_CITATION
lens and decision-doc-citation.scan.test.ts's WIDENED_UNRESOLVED_CITATION
lens read that pair as a quoted code receipt, which it never was — a
classification label, not a citation. The line numbers below were measured
at wave-35-h's own sha and are the roster's ORIGINAL evidence coordinate;
several have already drifted under later edits (views.tsx's row now reads a
`<p class="chq-portal-detail">` at that line; the submit-views.tsx rows for
630, 787, 928, 954, 967 and 972 sit inside prose/comment regions today) and
are marked STALE below rather than silently re-asserted as still-accurate.

| File (evidence: line at wave-35-h sha `1e38e4182`) | Tag | Note |
|---|---|---|
| src/routes/portal/edit.tsx (line 240) | input | visible |
| src/routes/portal/edit.tsx (line 484) | select | visible |
| src/routes/portal/tasks/views.tsx (line 292, STALE — now line 294) | input | visible |
| src/routes/portal/tasks/views.tsx (line 319, STALE — no longer resolves) | a | visible |
| src/routes/portal/tasks/views.tsx (line 327, STALE — no longer resolves) | input | visible |
| src/routes/public/agenda-grid.tsx (line 200) | a | visible |
| src/routes/public/agenda-rail.tsx (line 131) | a | visible |
| src/routes/public/agenda-rail.tsx (line 163) | a | visible |
| src/routes/public/sessions.tsx (line 82) | a | visible |
| src/routes/public/shell.tsx (line 259) | a | visible |
| src/routes/public/submit-views.tsx (line 128) | a | visible |
| src/routes/public/submit-views.tsx (line 203) | a | visible |
| src/routes/public/submit-views.tsx (line 205) | a | visible |
| src/routes/public/submit-views.tsx (line 264) | input | visible |
| src/routes/public/submit-views.tsx (line 304) | input | visible |
| src/routes/public/submit-views.tsx (line 348) | input | visible |
| src/routes/public/submit-views.tsx (line 630, STALE — no longer resolves) | a | visible |
| src/routes/public/submit-views.tsx (line 787, STALE — no longer resolves) | a | visible |
| src/routes/public/submit-views.tsx (line 928, STALE — no longer resolves) | a | visible |
| src/routes/public/submit-views.tsx (line 954, STALE — no longer resolves) | a | visible |
| src/routes/public/submit-views.tsx (line 967, STALE — no longer resolves) | a | visible |
| src/routes/public/submit-views.tsx (line 972, STALE — no longer resolves) | a | visible |

The remaining 37 (`<input type="hidden">`, every one under `src/routes/portal/{edit,index,profile,shared,tasks/views}.tsx` and `src/routes/public/{agenda-controls,sessions,speakers,submit-views}.tsx`) are listed for completeness but are not candidate defects: an unrendered form field carries no hit-box to floor.

~~Not a fix lane: per this wave's `PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING` and `ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING` field-guide findings, a raw roster like this one is not itself a defect count until each row is individually graded against a real CSS rule (most of these 22 sit inside a parent that DOES carry a class — e.g. `.chq-cfp-links a`, `.chq-portal-actions input` — the walk here only proves the ELEMENT itself carries no class, not that it is unreachable; several may already be grounded the same way this lane's `chq-pub-agenda-day-footer-next` was). A later lane's job is to grade these 22, not this one's.~~ **SUPERSEDED (task w39-e, DEC-996 wave-39 amendment)** — the public half of these 22 (the 17 `src/routes/public/**` rows above; the 5 `src/routes/portal/**` rows remain ungraded, out of this task's scope per `v12m-w38-a`/`v12m-w38-f`'s in-flight writes to `src/routes/portal/portal.css.ts`) is graded below.

### Public-row verdicts (task w39-e, DEC-996 wave-39 amendment)

Re-derived against the current tree (`v12m-w39-e`, off `main`) rather than trusted at the sha-`1e38e4182` line numbers above — two of the original nine `submit-views.tsx` anchors have since gained their own class token and dropped out of the classless population entirely (noted below); every other row's line number is unchanged. Verdict grammar (DEC-996 wave-39): **VERIFIED** — an ancestor-scoped selector effective at 390 (top-level or inside a `@media (max-width: <=700px)` block) declares `min-height >= 44px` plus non-zero horizontal padding, reaching the element; **EXEMPT** — an executable `tap-floor-exempt:` receipt naming a checkable companion; **OFFENDER** — nothing reaches it (none found this wave — see below). `test/public-390-request-verdicts-classless-roster.scan.test.ts` re-derives the population live (the same `classlessTagSites` walk this section's header names, scoped to `src/routes/public/**`) and pins every verdict below against the live CSS text, so this table cannot rot silently.

| File:line | Tag | Verdict | Reaching selector / receipt |
|---|---|---|---|
| `src/routes/public/agenda-grid.tsx:200` | `<a>` | VERIFIED | `.chq-pub-agenda-block-title a` (`src/routes/public/css/rail.css.ts`, terminal phone block) — `min-height:44px; display:flex; align-items:center; padding:0 4px` |
| `src/routes/public/agenda-rail.tsx:131` | `<a>` | VERIFIED | `.chq-pub-rail-day-row a` (`src/routes/public/css/rail.css.ts`, terminal phone block) — same floor, shared by `RoomsRailSection`/`TrackHighlightRailSection`/`DayIndexRailSection` |
| `src/routes/public/agenda-rail.tsx:163` | `<a>` | VERIFIED | `.chq-pub-rail-day-row a` (same rule as above — `TrackHighlightRailSection`'s row shares the identical ancestor class) |
| `src/routes/public/sessions.tsx:82` | `<a>` | VERIFIED | `.chq-pub-rail-day-row a` (same rule — `DayIndexRailSection`'s row) |
| `src/routes/public/shell.tsx:259` | `<a>` | VERIFIED | `.chq-nav a` (`src/views/theme.ts`, terminal phone block) — `min-height:44px` (:775-777) plus `padding-inline:12px` restated on a second same-selector rule (:791-794, DEC-393 wave-w17-i) |
| `src/routes/public/submit-views.tsx:128` | `<a>` | VERIFIED | `.chq-cfp-links a` (`src/routes/public/cfp.css.ts`, terminal phone block) — `min-height:44px` (:320-321) + `display:flex` (:478) + `padding:0 2px` (:320-321) |
| `src/routes/public/submit-views.tsx:203` | `<a>` | VERIFIED | `.chq-cfp-links a` (same rule) |
| `src/routes/public/submit-views.tsx:205` | `<a>` | VERIFIED | `.chq-cfp-links a` (same rule) |
| `src/routes/public/submit-views.tsx:264` | `<input>` | VERIFIED | `label.chq-cfp-option`, the immediate parent (`src/routes/public/cfp.css.ts:147-158`) — `min-height:46px; padding:0 14px`, top-level (effective at every width, including 390); native `<label>` click-delegation makes the label the input's real hit box, the exact `label.chq-cfp-option > input` shape DEC-996 wave-39's ruling names |
| `src/routes/public/submit-views.tsx:304` | `<input>` | VERIFIED | `label.chq-cfp-option` (same rule) |
| `src/routes/public/submit-views.tsx:348` | `<input>` | VERIFIED | `label.chq-cfp-option` (same base rule) plus `.chq-cfp-option.chq-cfp-pill { min-height: 44px }` (`cfp.css.ts:306`, terminal phone block, this row's pill variant) |
| `src/routes/public/submit-views.tsx:630` (now `:640`) | `<a>` | **DRIFTED, EXEMPT** | No longer classless — now `<a class="chq-cfp-intro-cta-link" ...>Create an account</a>`. EXEMPT via the empty-rule receipt `.chq-cfp-intro-cta-link, .chq-cfp-identity-note-link {}` (`cfp.css.ts:502`), a rung-3 DEVIATIONS ground per DEC-393 wave-35's own amendment (neither the desktop nor 390 "Submit a talk" frame extent draws this as a control, and no same-surface floored twin reaches `#chq-cfp-submit-form`) |
| `src/routes/public/submit-views.tsx:787` (now `:806`) | `<a>` | **DRIFTED, EXEMPT** | No longer classless — now `<a class="chq-cfp-identity-note-link" ...>Sign in to the speaker portal</a>`. Same receipt as above, same rung-3 ground (destination `/login`) |
| `src/routes/public/submit-views.tsx:928` (now `:947`) | `<a>` | EXEMPT | `.chq-cfp-confirm-actions a:not(.chq-btn)` (`cfp.css.ts:489`) — inline-in-prose receipt (DEC-393 wave-142): "Already have a password? Log in ›" is a phrase inside one running sentence, not a standalone row |
| `src/routes/public/submit-views.tsx:954` (now `:973`) | `<a>` | EXEMPT | Same receipt as above (the confirmation page's other branch renders the identical phrase) |
| `src/routes/public/submit-views.tsx:967` (now `:986`) | `<a>` | VERIFIED | `.chq-cfp-links a` (same rule as :128 — the fresh-confirmation tail-links row shares the class) |
| `src/routes/public/submit-views.tsx:972` (now `:991`) | `<a>` | VERIFIED | `.chq-cfp-links a` (same rule) |

**Zero offenders.** All 17 public rows resolve VERIFIED or EXEMPT — every one was already reachable by a rule an earlier wave (w17-d/w14-dd/w17-i/w35-b) built for an ancestor or sibling this roster's element-only walk never cross-referenced; nothing needed a new phone-media floor this wave. No CSS changed.
