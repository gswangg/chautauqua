# task-w16-c: DEC-063/DEC-060 walkthrough gate

- Port: **8871** (pinned per task instructions; DEC-060's wave-16 amendment
  warns two runtime lanes share this wave — 8871 was verified free of any
  sibling worktree's dev server before use: `ps aux | grep wrangler` showed
  other lanes bound to 8799/8891/8892/8893, never 8871).
- Worktree: `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w16-c`
- `git rev-parse HEAD` at the start of this task (the tip every PASS/FAIL
  verdict below was measured against, before this task's own harness-repair
  commit landed on top): `c557cff9f0e5bcd68d0d7815956d83a94eb9dc4e`

## Procedure

1. `npm ci` was not needed (`node_modules` already present in the fresh
   worktree checkout).
2. `npm run build` — green (tsc --noEmit x2 + vite build).
3. `npm run db:migrate` — all 38 migrations applied clean.
4. `npm run seed` — seed script + `.seed.sql` + `seed-r2.ts` (35 R2 objects)
   all succeeded.
5. `npx wrangler dev --port 8871` in the background.
   - **Gotcha (recorded for the field guide):** invoking `wrangler dev`
     directly (bypassing `npm run dev`'s `predev` hook) skips
     `scripts/ensure-dev-vars.ts`, so `.dev.vars` is never created and
     `DEV_MODE` is unset — every `/dev/mailbox` route silently 404s as if it
     doesn't exist (DEC-005's intended behavior for DEV_MODE-unset, but
     wrong for a walkthrough gate that needs the dev mailbox). Ran
     `npx tsx scripts/ensure-dev-vars.ts` by hand to clone
     `.dev.vars.example` -> `.dev.vars` (`DEV_MODE=1`) before starting the
     server.
   - Also edited the local (gitignored) `.dev.vars`'s `PUBLIC_BASE_URL` from
     the example's default `http://localhost:8787` to
     `http://localhost:8871`, matching the pinned port — the `.dev.vars.example`
     file itself says to do this "when running wrangler dev on another
     port." Without it, DEC-296's dev-loopback-origin exception did not
     override the stale absolute-URL default in the J2 claim-link flow.
6. `npx tsx scripts/walkthrough.ts --url http://localhost:8871` — the
   DEC-062 sequential runner over the DEC-060 modules, in order: producer ->
   review -> speaker -> public -> data -> scale. `scale` IS
   `scripts/walkthrough/stress.ts` (confirmed via
   `scripts/walkthrough-lib.ts`'s `WALKTHROUGH_AREAS` and `package.json`'s
   `gate:scale` script, which is literally `tsx scripts/walkthrough/stress.ts`)
   and is already included in this runner's fixed order — no separate
   `npm run gate:scale` invocation was needed.

Each full run below was preceded by `rm -rf .wrangler/state && npm run
db:migrate && npm run seed` to start from a clean, freshly-seeded local D1 +
R2 (the walkthrough is not safe to re-run against its own prior-run state —
see repair #6 below).

## Verdict (final clean run, all repairs applied)

| Module | Verdict |
|---|---|
| producer | **PASS** — J1, J2, J3, J5, J9, DEC-175 probes all ok |
| review | **PASS** — all 19 checks ok |
| speaker | **PASS** — all ~70 checks ok (after repairs #1, #2, #3, #4, #5) |
| public | **PASS** — all J9/J10 checks ok (after repair #2) |
| data | **PASS** — all J11/J12 checks ok (after repairs #4, #6) |
| scale | **PASS** — steps 1-6 ok (after repairs #3, #7) |

Final line: `walkthrough OK`.

## Repair scope (harness-only, per DEC-060; all in `scripts/walkthrough/*.ts`)

Every fix below is a stale-assertion or stale-fixture-assumption repair in
the walkthrough scripts themselves — none touch `src/` or `app/src/`
product code. Each is annotated in-place in the script with the file:line
of the product code it re-pins to.

1. **`scripts/walkthrough/speaker.ts` `NEXT_TASK_ROW` boundary regex was
   dead** (was `'<div class="chq-portal-row">'`, but the real markup is
   always `<div class="chq-portal-row" id="task-...">` —
   `src/routes/portal/tasks/views.tsx:228` — so the negative lookahead
   never fired and every row-scoped regex silently scanned past its
   intended row to the first match anywhere later in the page). Fixed to
   `'<div class="chq-portal-row" id="'`. This was masking a second, real
   bug: the walkthrough's premise that the seeded `'Finalize bio +
   headshot'` default onboarding task is `kind='file_request'` is stale —
   `src/domain/acceptance.ts:32-38` (DEC-009 amendment, wave 59) changed it
   to `kind='general'`, completed via `/portal/profile`, not an upload
   widget. Replaced that whole DEC-244 deliverable-panel section with an
   organizer-created ad hoc `kind='file_request'` task (same idiom the
   script already used for its ad hoc `kind='form'` task), so the DEC-244
   upload/version/comment-thread flow stays exercised end-to-end.
2. **Stale copy/markup assertions**, each re-pinned to current rendered
   output with a comment citing the source line:
   - `"complete a general task"` / the Flight-reimbursement-form row check:
     `views.tsx:237-238` renders `"Done"/"To do"`, never
     `"Completed"/"Pending"`.
   - `public.ts`'s `/sessions` "Track filters" nav: DEC-919's v7 filter bar
     redesign replaced the old pill-nav with a `<select
     id="chq-pub-filter-trackId">` (`src/routes/public/filters.tsx`
     `PublicFilterSelectForm`, `src/routes/public/sessions.tsx:285-292`).
   - `data.ts`'s `showflow.csv` header: DEC-022's wave-66 amendment added a
     trailing `kind` column for interleaved break rows
     (`src/server/repo/exports/showflow.ts:22-35`).
   - `public.ts`'s Settings embed-generator check: `EmbedsPanel` is no
     longer a top-level Settings `SECTIONS` entry — it was folded into
     `PublicPagesPanel.tsx` as an inline builder behind an "Embed code"
     toggle (`app/src/pages/settings/PublicPagesPanel.tsx:35,161-163,176-180`).
   - `scale.ts`'s dev-mailbox message-count regex: DEC-925's `countOf`
     pluralizes as `"1 message"/"N messages"`, never the literal `"(s)"`.
   - `speaker.ts`'s over-length comment refusal: DEC-422's unified cap
     grammar (`src/domain/cap-copy.ts` `overCapSentence`) composes `"Reply
     is 4,001 characters — 1 over the 4,000-character limit."`, never the
     literal `"too long"`.
   - `speaker.ts`'s `/portal/profile` save: the route now does a PRG
     redirect (302 -> `/portal/profile?saved=1`,
     `src/routes/portal/profile.tsx:421-423`), not an inline 200 re-render.
3. **`scale.ts`'s `/dev/mailbox` fetch had no auth cookie.** `/dev/mailbox`
   is org-scoped (`src/routes/dev/mailbox.tsx` reads `c.var.auth!.orgId`),
   so a bare unauthenticated `fetch()` 302-redirected to `/login` instead of
   200ing. Threaded the organizer's `CookieJar` through `readMailboxCount`.
4. **Public-submit / portal-edit form field shape drift**:
   `scale.ts`'s `purgeRefreshProbe` (step 6) hardcoded `field__first_name` /
   `field__last_name`, but the public `/submit` form now renders ONE `Name`
   control (`name="speaker_name"`, split server-side by
   `src/routes/public/submit-body.ts` `SPEAKER_NAME_FIELD`) — confirmed this
   was already the correct idiom in `producer.ts`'s J2, just not ported to
   `scale.ts`. Also added the DEC-489 radio-group fill loop `producer.ts`
   already had (custom dropdown-kind fields render as radios on the public
   form, not `<select>`). Separately, the **portal edit page** renders the
   same dropdown-kind field as a real `<select>` (unlike the public radio
   idiom) — `editForm` was reusing `dropdownValues` scraped from the
   *submit* page's body instead of scraping the edit page's own body, so
   the edit POST omitted a required `field__field_session_format` value and
   400d. Added a second `parseSelectFirstOptions(editGetBody)` scrape.
5. **`speaker.ts`'s upload-cap probe didn't handle DEC-891's
   conditional-and-quiet submission selector.** By the point in the
   walkthrough where the file_request upload runs, the seeded speaker has
   2+ accepted submissions, so
   `src/routes/portal/tasks/views.tsx` `DeliverableSelect` renders a
   required `<select name="submissionId">` that the walkthrough wasn't
   filling, 400ing with `"submissionId is required when more than one
   session is eligible"`. Scraped the rendered option and included it.
6. **PRODUCT-ADJACENT ORDERING BUG in `data.ts`'s duplicate-merge check,
   not a product defect: cross-fixture pollution.** `historyContactId` was
   picked as the first contact (by recency) with both submission and email
   history, with no exclusion — by the time `data.ts` runs (after
   producer/speaker/public modules have driven heavy activity through the
   seeded speaker persona), that contact IS the seeded speaker
   (`sbek-speaker@example.com`), and the very next check merges it away as
   the duplicate's "source," deleting its `user` row via cascade. This
   broke `data.ts`'s OWN later `J12: speaker-role session ... gets 403`
   check two checks later (`POST /login` 401 — the account no longer
   existed; confirmed via `wrangler d1 execute ... "SELECT ... WHERE email
   = 'sbek-speaker@example.com'"` returning zero rows post-merge, present
   pre-merge). Added a `protectedEmails` exclusion set built from
   `fixture.identities`'s emails so the merge-source scan always skips
   fixture personas.
7. **`scale.ts`'s form-close-date probe set a day-label field to an
   instant.** DEC-522: `closeDate` is a DAY LABEL, expanded to the
   event-local END OF DAY by `isFormClosed`/`dayLabelEndInstant`
   (`src/domain/edit-lock.ts:1-21`). Setting it to `Date.now() - 1hr` is
   still TODAY's day label on any realistic timezone offset, so
   `isFormClosed` stayed `false` and the "unaccepted speaker's edit is
   rejected past the close date" assertion never actually exercised a
   closed form. Backed the probe up two full days.

## PRODUCT DEFECTS FOUND

**None.** Every failure traced to a stale walkthrough assertion, a stale
fixture-shape assumption, a missing auth header in the harness itself, or
(repair #6) a same-module fixture-selection collision in the harness's own
duplicate-merge check. No defect requiring `src/` or `app/src/` changes was
found — nothing is being handed to the next wave from this run.

## Notes for the scribe / next wave

- `wrangler dev` invoked directly (not via `npm run dev`) skips the
  `predev` hook that creates `.dev.vars` — DEV_MODE stays unset and
  `/dev/mailbox` 404s silently as though DEV_MODE-unset were intended. Any
  future direct-`wrangler-dev` gate needs `npx tsx
  scripts/ensure-dev-vars.ts` run by hand first, and `.dev.vars`'s
  `PUBLIC_BASE_URL` edited to match a non-default port.
- The walkthrough is not idempotent against its own prior-run state — an
  in-place re-run (without `rm -rf .wrangler/state` + re-migrate + re-seed)
  fails at the `review` module's "provision second reviewer" 409 and at
  `speaker`'s "no pending submission found" (both because the previous
  run's writes are still there). Always reseed clean between runs.
