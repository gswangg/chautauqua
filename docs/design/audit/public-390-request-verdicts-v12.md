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
| Public agenda (:367-409) | `GET /e/:eventSlug/agenda` | MATCHES: day-switcher (`chq-pub-day-switcher`, `Jump to day`) + terminal My-schedule pill; per-session action control; dock band (`chq-pub-agenda-dock`) carries filled Download .ics + bordered Speakers, exactly the two controls drawn. **Divergence noted, not a defect**: the frame's own static mockup leads with the event title as a bare `<span>`, never an `<h1>`; the real route's only `<h1>` is the dynamic `chq-pub-surface-title` (day + session-count text), which the frame's sample never shows because it is a single static snapshot. | `test/public-390-frame-verdicts.test.ts` (`` `frame :371 Public agenda -- MATCHES...` ``) and `test/public-agenda-phone-frames.render.test.ts` (`` `frame :371-409 Public agenda` `` describe block) |
| My schedule · /schedule (:861-893) | `GET /e/:eventSlug/schedule` | MATCHES: exactly one `<h1>My schedule</h1>`; no day switcher (this surface has no day facet of its own — a structural divergence from the agenda frame, not a defect); per-row action reads "Remove" (never Save/Saved); dock band (`chq-pub-schedule-dock`) carries filled Download .ics + bordered All sessions. Honest sample divergence: the SSR subtitle placeholder reads "0 saved · 0 overlaps" pre-hydration; the frame's static sample shows "4 saved · 2 overlaps · no account needed" (client JS fills the real count and the trailing clause after paint). | `test/public-390-frame-verdicts.test.ts` (`` `frame :864 My schedule · /schedule -- MATCHES...` ``) and `test/public-agenda-phone-frames.render.test.ts` (`` `frame :861-893 My schedule · /schedule` `` describe block) |
| Submit a talk (:1014-1070) | `GET /submit/:eventSlug` | DIVERGES (label wording only, structure MATCHES): phone two-step chrome ("Step 1 of 2 · your talk" progress label/bar) matches exactly; the Format fieldset's `<legend>` reads "Session format" where the frame draws the bare "Format"; the dock's second (save) button reads "Save draft" where the frame draws "Draft". The dock's primary reads "Next: about you", matching the frame exactly. | `test/public-390-frame-verdicts.test.ts` (`` `frame :1017 Submit a talk -- DIVERGES (label wording)...` ``) |
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
   ruled at `docs/design/DEVIATIONS.md:765`: "CFP wizard dock's `Save
   draft` vs the frame's `Draft` — ALREADY RULED, recorded here only so
   the ledger stops re-filing it. `src/routes/public/cfp.css.ts` states the
   disposition in the sheet itself: the accessible name stays 'Save draft'
   per DEC-613's wave-96 amendment, one control with one name at every
   width, and the frame's `Draft` is a drawing abbreviation rather than a
   label to ship." No lane action follows from this row; both halves were
   already dead before this wave, this entry only stops the ledger
   re-filing them.
3. **No action needed on the six public-site frames' request coverage
   itself** — it is real, passing, and citation-receipted. Any further
   phone-parity work on this cluster should target the 8 unclaimed-by-this-
   lane portal frames (the sibling lane's scope) or the one Submit-a-talk
   label DIVERGES above.
