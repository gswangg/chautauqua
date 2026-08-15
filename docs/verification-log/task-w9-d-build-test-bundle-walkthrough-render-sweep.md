# task-w9-d — build+test+bundle+walkthrough+render-sweep @ 79f7b7ae

Log-only lane (per DEC-069/DEC-453 scope): nothing under `src/`, `app/src/`,
`scripts/`, `test/`, `migrations/`, `decisions/`, or `package.json` was
touched. Fresh worktree off `main`, sha `79f7b7aeb051c40e790f191655edae874ff15098`
(short `79f7b7ae`). This is the first runtime receipt since
`## 2026-08-13 task-w37-d — build+test+bundle @ 68289a92`; waves w1-w8 have
landed on main since, with no runtime (walkthrough/render-sweep) evidence in
that gap — only build+test receipts existed.

## 1. `npm ci` + `npm run build`

Clean. `tsc --noEmit` (root) and `tsc --noEmit -p app/tsconfig.json` both 0
errors; `vite build --config app/vite.config.ts` succeeded, `✓ built in 1.08s`.

## 2. Full suite — `sh scripts/with-test-lock.sh npx vitest run`

**1008 test files passed (1008), 11029 tests passed (11029)**, 0 failures, 0
skipped. Duration 199.66s. No lock contention encountered (lock acquired
immediately).

## 3. `npm run bundle:check`

Entry bundle (`index-*.js` + `index-*.css`) = **69.12 kB gzip** against the
SPEC §7 300 KB budget. `bundle:check PASSED`.

## 4. `npm run db:migrate` + `npm run seed` + `npx wrangler dev --port 8817`

- `db:migrate`: all 36 migrations applied (`0001_init.sql` .. `0036_task_instructions.sql`), all ✅.
- `seed`: D1 rows + 35 R2 objects inserted, no errors.
- **Operational note (not a product defect):** a fresh worktree has no
  `.dev.vars` (DEC-183/DEC-187: `.dev.vars` is gitignored and only created by
  the `predev` npm hook via `scripts/ensure-dev-vars.ts`, which runs before
  `npm run dev` but NOT before a bare `npx wrangler dev` invocation). Running
  `npx wrangler dev --port 8817` directly, as this task's literal
  instructions specify, boots with `DEV_MODE` unset, which 404s `/dev/mailbox`
  (mounted only when `env.DEV_MODE === '1'`, `src/server/app.ts:91`). Ran
  `npx tsx scripts/ensure-dev-vars.ts` (execution only, no file edited under a
  restricted path) to materialize `.dev.vars` from the committed
  `.dev.vars.example`, then restarted wrangler with
  `--var PUBLIC_BASE_URL:http://localhost:8817` (the `.dev.vars.example`
  comment itself instructs overriding `PUBLIC_BASE_URL` when not on the
  default port 8787). Future w9-d-shaped lanes that invoke `wrangler dev`
  directly (bypassing `npm run dev`'s `predev` hook) will hit the same gap.
- Listener verified as this worktree's own process at each restart via
  `lsof -i :8817` (workerd PIDs 48715 -> 50171 -> 53107 across the three
  restarts below); confirmed via `curl http://localhost:8817/health` ->
  `{"ok":true}` each time.
- Three server lifecycles were used in this lane:
  1. First boot (no `.dev.vars`) — used only to discover the `/dev/mailbox`
     404 above; killed.
  2. Second boot (with `.dev.vars` + `PUBLIC_BASE_URL` override) — used for a
     scratch walkthrough run that hit 409/state-pollution because the DB
     still held the first run's inserted rows (not re-seeded); killed.
  3. Re-seeded (`npm run seed` again, which `DELETE FROM`s tables before
     reinserting), then third boot — this is the clean, single-pass
     walkthrough run reported in section 5 below.

## 5. `npm run walkthrough -- --url http://localhost:8817` (clean single pass, third server lifecycle)

Order: producer -> review -> speaker -> public -> data -> scale.

```
PASS producer
PASS review
FAIL speaker
FAIL public
FAIL data
FAIL scale
```

Genuine (reproducible, not environmental) findings, each grep'd for `FAIL`/`PLANNER:`:

1. **`scripts/walkthrough/speaker.ts:460`** — check "complete a general task
   via its own form action" fails: `task list does not show the task as
   Completed after marking it`. After POSTing the task-completion form
   action, `/portal/tasks` does not render "Completed" for that assignment.
2. **`scripts/walkthrough/public.ts:436`** — check "J10 /sessions: cards +
   track filter nav present" fails: `no track filter nav found`. The
   `/e/devflow-conf-2027/sessions` HTML does not contain "Track filters".
3. **`scripts/walkthrough/data.ts:467`** — "J12: showflow.csv fixed columns"
   fails on a header mismatch:
   `expected: ref,title,description,day,start,end,room,tracks,speakers,deck_file,deck_url`
   `actual:   ref,title,description,day,start,end,room,tracks,speakers,deck_file,deck_url,kind`
   — the live export has grown a trailing `kind` column the walkthrough
   script's expected-header constant doesn't know about. Ambiguous which
   side is stale (script vs. product); flagging, not fixing.
4. **`scripts/walkthrough/scale.ts:394`** (`readMailboxCount`) — `fetch(
   \`${BASE_URL}/dev/mailbox\`)` is called with no cookie jar / credentials.
   Per `src/decisions-data/part3.ts:133` (`DEC_546`), `/dev/mailbox` became
   organizer-only and org-scoped ("the wave-18 'public by design'
   disposition rested on a false premise") — an unauthenticated GET now
   receives the `/login` page (200 OK, HTML) rather than the mailbox view,
   so the `(\d+) message\(s\)/` regex never matches. This walkthrough
   helper was not updated when DEC-546 landed; it fails on every run since
   (reproduced from a fully clean, freshly-seeded state, so this is not
   test-order pollution). Same underlying cause failed step5 twice earlier
   in this lane (see section 4) with a slightly different symptom
   (`assertStatus` 404 pre-`.dev.vars`, `assertTrue` message-count-not-found
   post-`.dev.vars`/login-page).

No `PLANNER:` lines appeared in any walkthrough output.

## 6. `npm run gate:render-sweep`

Own server, own port (61989), auto torn down by the script. Chromium already
installed (`npx playwright install chromium` no-op).

### Desktop pass (fresh seed, first table in the run)

45 PASS / 15 FAIL out of 60 rows. Failing rows and their offending selectors:

- `/admin/submissions/forms` (organizer) — 2 vertical clip offenders:
  `div.chq-forms-header-titles` (clip=3px, scrollHeight 57 > clientHeight 54),
  `h1` (clip=3px, scrollHeight 31 > clientHeight 28).
- `/portal/preview` (organizer) — 1 console error: 404 Not Found resource load.
- `/e/devflow-conf-2027/sessions`, `/speakers`, `/gallery`, `/agenda` (public)
  and their `/embed/devflow-conf-2027/...` counterparts — repeated vertical
  clip offenders on `label.chq-visually-hidden` / `button.chq-visually-hidden`
  (clip=18px, scrollHeight 19 > clientHeight 1); `/speakers` and its embed
  twin additionally clip `div.chq-pub-speaker-list-photo` (clip=4px,
  scrollHeight 84 > clientHeight 80).
- `/logout` (organizer, speaker) and `/login` (public) — `h1.chq-auth-wordmark`
  clip=3px (scrollHeight 31 > clientHeight 28).
- `/admin/*` (organizer) — empty rendered text + 1 console error (404 Not Found).
- `/embed/e/seed_embed_0001` (public) — same visually-hidden clip pattern as above.

### Public mobile pass (390x844)

15 PASS / 11 FAIL. Same `chq-visually-hidden` clip pattern repeats across
`/sessions`, `/speakers`, `/agenda`, `/gallery` (public + embed variants) and
`/embed/e/seed_embed_0001`; `/login` repeats the `chq-auth-wordmark` clip.
One distinct new failure: **`/portal/tasks`** — horizontal overflow 170px
(`scrollWidth 560 > viewport 390`, widest offender `main.chq-measure`
`w=560px right=560px`).

### Admin mobile pass (390x844, advisory)

24 PASS / 4 FAIL:
- `/admin/submissions` — control height 26px < the 44px tap-target floor
  (`input.chq-input.chq-submissions-filterbar-search`).
- `/admin/submissions/forms` — same header/h1 clip as the desktop row (scaled
  down: clip=3px, scrollHeight 54>51 and 28>25).
- `/portal/preview` — status 404 !== 200.
- `/logout` — `h1.chq-auth-wordmark` clip=3px (scrollHeight 31 > clientHeight 28).

### Font-floor pass (10px minimum)

114/114 PASS.

### Type-role pass (advisory)

6/7 PASS. FAIL: `.chq-overview-deadline-value` (group), role
`deadline-strip-nearest` — expected exactly 1 cell at font-weight 700,
observed 2 (weights: 400,700,700,400).

### Contrast pass (WCAG AA, advisory)

59/60 PASS. FAIL: `/admin/review/plans/seed_evaluation_plan_0001` (organizer)
— worst ratio 2.43 on `label.chq-review-checkbox-label`
(fg `rgb(142,138,122)` / bg `rgb(221,216,200)`), also
`button.chq-link-button.chq-review-editor-footer-delete` at ratio 3.06.

### Interaction-state pass (B8 focus/hover/disabled, advisory)

2/4 PASS. FAILs:
- `review-anonymize-disabled` (disabled kind): selector
  `.chq-review-field-disabled .chq-review-checkbox-label` never resolved
  (instrument-blocked) on one of the two probed instances.
- `cfp-primary-focus` (focus kind) on `.chq-cfp-step-next`: outline-width 3px
  !== expected 2px; outline-style none !== expected solid; outline-color
  `#F7F9F0` !== expected `#4E5C31`; outline-offset 0px !== expected 2px.

### Overall gate exit code

Re-ran `npm run gate:render-sweep` (full, silenced) a second time to check
the process exit code independent of the advisory/blocking table labels:
**exit code 1** (non-passing).

## Summary counts

- build: PASS (0 errors)
- full suite: PASS (1008 files / 11029 tests)
- bundle:check: PASS (69.12 kB gzip / 300 kB budget)
- walkthrough: 2/6 areas clean (producer, review); 4/6 areas have exactly one
  new-content failing check each (speaker, public, data, scale — the scale
  failure and one of the two early scratch-run mailbox 404s share the same
  root cause, DEC-546 vs. stale walkthrough helper)
- render-sweep: desktop 45/60, public-mobile 15/26, admin-mobile 24/28,
  font-floor 114/114, type-role 6/7 (advisory), contrast 59/60 (advisory),
  interaction-state 2/4 (advisory); gate exit code 1
