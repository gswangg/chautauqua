# Wave-41 falsifiability discharge — batch A (task-w41-d, DEC-358/DEC-069)

Source: the run-on batch in `docs/eval-findings.md` ending "This whole
block: UNFALSIFIABLE — owner: wave-40 lane" (lines ~306-334 at this wave's
start), minus the two items wave 39 already pulled out (edit-lock/DEC-041,
pipeline-fit) and minus the two phone-block items already exempted inline
(they cite `app/src/phone-block-visibility.test.ts` directly in the batch
text). Six items opened this wave, cheapest first. Per DEC-358's wave-41
amendment, this lane does NOT edit `docs/eval-findings.md` itself — that
rebase belongs to task-w41-f, which folds these lines in.

## DISCHARGED THIS WAVE

- Per-person reminder scope on send AND preview
  (`src/routes/tasks.ts:564-613`, DEC-694) — FALSIFYING CHECK:
  `test/reminders-contact-scope.test.ts` :: "DEC-694: contactIds scoping is
  identical between preview and send" (all three `it` blocks) — calls the
  real `previewRemindNow`/`remindNow` (`src/server/repo/tasks/reminders.ts`)
  against a fake-drizzle db that evaluates the actual `where` predicates,
  and asserts the returned draft/send recipient sets. Reverting either
  function to ignore its `contactIds` parameter (scoping only one of the two
  paths, or neither) fails these assertions.

- Comms preview `.ics` chip formatted in the event's own timezone
  (`app/src/pages/comms/icsChip.ts:18-19`, DEC-494) — FALSIFYING CHECK:
  `app/src/pages/comms/icsChip.test.ts` :: "is independent of the ambient
  machine timezone (DEC-494) > renders the same chip text under
  America/New_York and Asia/Tokyo ambient zones" — calls the real
  `formatIcsChip` under two different `process.env.TZ` values for a session
  whose event timezone is `America/Los_Angeles`, asserting identical output
  containing "9:00"/"PDT" and never the UTC-shifted "12:00". Reverting the
  formatter to use the ambient zone (e.g. dropping the explicit `timeZone`
  param) fails this.

- Reviewer multi-track scope renders a list and never "All tracks"
  (`src/domain/evaluation/progress.ts:39`, DEC-845) — FALSIFYING CHECK:
  `test/evaluation.test.ts` :: "resolveReviewerScopeTrackIds (DEC-845
  amendment)" (two/three-track cases) and "formatReviewerScopeLabel
  (DEC-845 amendment) > joins three track names sorted, no truncation" —
  calls the real functions with rows naming two and three distinct tracks
  and asserts the full sorted, joined list is returned, never collapsed to
  `[]`/null ("All tracks"). Reverting the multi-track fold back to the
  pre-DEC-845 bug (returning `[]` whenever any track id is present) fails
  the two/three-track cases.

- EMB session-card speaker title/company
  (`src/routes/public/cards.tsx:102-116`) — FALSIFYING CHECK:
  `test/public-speaker-identity-line.test.ts` :: "SessionCard's speaker line
  carries the title/company clause" — renders the real `SessionCard`
  component with a speaker carrying `title`/`company` and asserts the
  rendered HTML contains "Engineer, Acme" and the
  `chq-pub-speaker-identity` class. Reverting `speakerIdentityClause`/
  `SpeakerNames` to drop the clause fails this.

- Seeded dates all relative to one seed clock (`scripts/seed.ts:261-278`,
  DEC-591) — FALSIFYING CHECK: `test/tier0-falsifiability.test.ts` ::
  "scripts/seed.ts: the seed has ONE clock (DEC-591) > shifts every seeded
  instant by exactly the CHQ_SEED_NOW delta, leaving the event's fixed
  calendar dates untouched" — WRITTEN this wave (no prior test ran the real
  seed script under two distinct `CHQ_SEED_NOW` values). Runs `tsx
  scripts/seed.ts` twice via `execFileSync` under `CHQ_SEED_NOW` 31 days
  apart, parses the emitted `.seed.sql`'s `event` row, and asserts (a)
  `created_at`/`updated_at` shift by exactly the 31-day delta between the
  two runs, (b) the event's fixture-constant `start_date`/`slug` stay
  byte-identical across both runs. A sibling test asserts an unparseable
  `CHQ_SEED_NOW` throws rather than silently falling back to `Date.now()`.
  Verified by hand this wave (not committed): decoupling `BASE_TS` from
  `SEED_NOW` (hardcoding it) makes assertion (a) fail with `+0` instead of
  the expected delta — the test is a real falsifier, not a tautology.

- Portal edit-toggles (`app/src/pages/settings/PortalSettingsPanel.tsx:306`)
  — FALSIFYING CHECK:
  `app/src/pages/settings/PortalSettingsPanel.render.test.tsx` (both the
  read-row assertions around line 82-88 and the edit-form assertions around
  line 300-307) — renders the real `PortalSettingsPanel` in both read and
  edit modes and asserts `Bio`/`Headshot`/`Links` carry `is-active` while
  `Session title`/`Abstract` do not, in BOTH renders. Reverting
  `SPEAKER_EDIT_FIELDS`'s editable flags, or rendering a second/different
  pill list in one of the two modes, fails these.

## STILL UNFALSIFIABLE

Carried from the source batch. Four items discharged wave-46
(`task-w46-f`, DEC-358 amendment — see `docs/eval-findings.md`): saved
embeds exist, `/account/password` Cancel + 820 bare-page column, Overview
§01 skips-last-hour caption, Home footer media rule. Five items discharged
wave-49 (`task-w49-f`, DEC-358 — the batch-A remainder pointer had decayed
to UNOWNED per task-w47-h's re-homing; this branch is the owner) — see
below. Nothing remains open from this batch.

**DISCHARGED wave-49 (`task-w49-f`, DEC-358): five items, each CONFIRMED
TRUE at this worker's own runtime before writing a real exercised
falsifying check.**

- `npm run deploy` exists — `package.json:26` (line moved since the batch
  was first filed; script unchanged). FALSIFYING CHECK:
  `test/tier0-falsifiability-w49-batch-a.test.ts` (item i) — asserts
  `package.json`'s `scripts.deploy` runs `wrangler d1 migrations apply
  --remote` then `wrangler deploy`, and that `npm run` (no script name,
  network-free) actually resolves and lists that command line under the
  name "deploy" — proving npm's own script resolution finds it, not just a
  `JSON.parse` of the file. Never invokes wrangler for real (STAGE 1: no
  external account/secret required to run this repo's tests).
- Settings edit-view field widths are tokens, not literals —
  `app/src/pages/settings/settings.css:17-21` (DEC-896). FALSIFYING CHECK:
  `test/tier0-falsifiability-w49-batch-a.test.ts` (item ii) — parses the
  real CSS, asserts the four `--chq-field-w-*` custom properties exist on
  `:root` and that each of the four per-kind field rules
  (`.chq-settings-field-date` etc.) sets `width: var(--chq-field-w-*)`,
  with no bare literal px width in the same rule. Verified by hand: reverting
  one rule to a literal `width: 200px` fails the assertion.
- Phone agenda N-aware clash caption —
  `app/src/pages/agenda/PhoneAgenda.tsx:186`. FALSIFYING CHECK:
  `app/src/pages/agenda/PhoneAgenda.w49.render.test.tsx` (item iii) — mounts
  the real `PhoneAgenda` with a two-way and a separately a three-way room
  clash, asserting "2 sessions in this slot" / "3 sessions in this slot"
  respectively (each test also asserts the OTHER count's caption is
  absent). Verified by hand: collapsing the caption to a fixed "Sessions in
  this slot" string fails both cases.
- Phone agenda "Place here anyway" —
  `app/src/pages/agenda/PhoneAgenda.tsx:167-176,199-208`. FALSIFYING CHECK:
  `app/src/pages/agenda/PhoneAgenda.w49.render.test.tsx` (item iv) — arms a
  session then clicks the real "Place here anyway" control on both a plain
  `placed` slot and a `clash` slot, asserting the real `onPlace` prop is
  actually invoked with the armed session's id/duration and the occupied
  slot's own `startMin` — not merely asserting the button exists. Verified
  by hand: stubbing the button's `onClick` to a no-op fails both cases.
- Phone password fixed footer + Cancel — `src/routes/auth.css.ts` (the
  phone media block that was cited at `:318-336` has since shifted to
  roughly `:298-329` under wave-48's `:has()` re-scoping amendment; same
  behaviour). FALSIFYING CHECK:
  `test/tier0-falsifiability-w49-batch-a.test.ts` (item v) — asserts
  `.chq-auth-cancel` is `display: none` by default and only becomes
  `display: inline-flex` inside the `max-width: 700px` block; that inside
  that same block `.chq-bare-page:has(.chq-auth-fields)` is a full-height
  flex column whose sole scrolling child is `.chq-auth-fieldstack` (`flex:
  1; overflow-y: auto`), leaving the actions row fixed below it; and that
  the real `PasswordPage` renders its Cancel control inside
  `.chq-auth-actions` (the fixed footer), never inside the scrolling
  `.chq-auth-fieldstack`. Verified by hand: reverting the phone
  `.chq-auth-cancel` rule back to `display: none` fails the visibility
  assertion.

Already exempt from the UNFALSIFIABLE label (per the source batch's own
text, not re-checked this wave): `app/src/phone-block-visibility.test.ts`
covers both the phone-block override assertion (lines 186-205) and the
comms phone landing (lines 109-121, DEC-621) inline.

## GAPS FOR THE NEXT CODE WAVE

None found. All six items examined this wave were confirmed correct
against their real implementations (or, for the seed clock, newly proven
correct by a hand-verified falsifier) — no product defect to file.
