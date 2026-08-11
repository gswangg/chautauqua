# task-w15-e - render-sweep @ f0d56ce (confirmation lane 3 of DEC-327/DEC-320(ii))

FROZEN SHA: f0d56cefd3c2949591526cebfd403290cdab244a
OPEN ITEMS: 0
RESULT: PASS
RECHECK SHA: f0d56cefd3c2949591526cebfd403290cdab244a

Code-frozen, log-only lane. Nothing outside this file was touched (no product code, no
scripts). Scope per the task brief: a render sweep over the two public MARKUP surfaces wave
14 changed — `/submit/<slug>` (DEC-321: three optional locked speaker fields — Job title,
Company, Bio) and `/e/<slug>/speakers/<contactId>` (DEC-322: social-links list) — both already
in `MOBILE_ROUTE_MANIFEST` (`scripts/render-sweep.ts:66-82`) and neither rendered since wave 14
landed.

S = worktree HEAD at branch creation = `f0d56cefd3c2949591526cebfd403290cdab244a` (`git -C
.../chautauqua worktree add .../task-w15-e -b task-w15-e main`).

## SETUP

```
[ -d node_modules ] || npm ci --prefer-offline --no-audit --no-fund --silent   (node_modules already present, skipped)
npm run build                                             -> tsc --noEmit x2 + vite build: clean, 0 errors
npx playwright install chromium                           -> already installed, no-op
rm -rf .wrangler/state
npm run db:migrate                                        -> 17/17 migrations applied clean
cp .dev.vars.example .dev.vars
npm run seed                                               -> seed + R2 asset upload (8 objects) clean
```

Manual spot-check server: booted `npx wrangler dev --port 8797` against the freshly
migrated+seeded state above and used it for the targeted markup inspection below (curl against
`http://localhost:8797`), then killed it before invoking the gate script.

Note carried forward from task-w13-d-c3-render-sweep.md (still true at this SHA): `npm run
gate:render-sweep` performs its OWN migrate+seed cycle internally against `.wrangler/state`
(`scripts/render-sweep.ts` `main()`, lines ~261-280) and always boots its own `wrangler dev` on
a `findFreePort()`-chosen port — it does **not** accept an external `--port`/env override to
point at an already-running server. The task brief's literal "boot wrangler dev on 8797 ...
then `npm run gate:render-sweep` pointed at that port" is not mechanically possible against the
current script: there is no CLI flag or env var the script reads for an external base URL, and
`findFreePort()` always binds a fresh ephemeral port (this run happened to land on 53219, not
8797). Ports 8791-8797 assigned to this wave are only relevant to lanes that manually boot
`wrangler dev` for inspection (as this lane did for the manual spot-check below); the gate
script itself is self-contained and its actual bind port is whatever the OS hands it. Followed
the same practice `rm -rf .wrangler/state` was run again immediately before `npm run
gate:render-sweep` to avoid the "manual seed already present" collision documented in
task-w13-d-c3-render-sweep.md. Flagging for the field guide since this is the second lane to
hit the same script/task-brief mismatch.

## Manual targeted markup check (before running the gate)

Booted `npx wrangler dev --port 8797` against the seeded DB from SETUP above; confirmed
`/health` returns 200, then curled the two changed surfaces directly.

### /submit/devflow-conf-2027 — three new speaker fields (DEC-321)

Verbatim relevant fragment from `GET /submit/devflow-conf-2027`:

```html
<div id="chq-field-wrap-job_title"><label>Job title<input type="text" id="field__job_title" name="field__job_title" data-field-id="job_title" value="" data-required="false"/></label></div>
<div id="chq-field-wrap-company"><label>Company<input type="text" id="field__company" name="field__company" data-field-id="company" value="" data-required="false"/></label></div>
<div id="chq-field-wrap-bio"><label>Speaker bio<textarea id="field__bio" name="field__bio" data-field-id="bio" data-required="false"></textarea></label></div>
```

- Real `<label>` associations: CONFIRMED — each field's `<input>`/`<textarea>` is nested
  directly inside its `<label>` element (implicit label ownership: "Job title", "Company",
  "Speaker bio"), the same pattern every other field on the form uses (compare `first_name`,
  `last_name`, `email` fields immediately preceding them in the same form).
- NOT marked required: CONFIRMED — all three carry `data-required="false"` and none has a bare
  `required`/`required=""` attribute, unlike the required fields on the same form (`title`,
  `description`, `first_name`, `last_name`, `email` all show `required="" data-required="true"`
  by contrast). The form's inline script (`scripts/render-sweep.ts` unrelated; see the page's
  own `<script>` at the bottom of the form) only flips `input.required` based on
  `dataset.required === 'true'`, so these three stay non-required in every branch state.
- Horizontal overflow at 390px: see the mobile table below —
  `/submit/devflow-conf-2027` reports `overflowPx: 0` with the new fields present in the DOM
  (this run's seed/build already includes DEC-321, so the mobile pass below is exercising the
  post-DEC-321 form, not a pre-change baseline).

### /e/devflow-conf-2027/speakers/seed_contact_0001 — social-links list (DEC-322)

Verbatim relevant fragment from `GET /e/devflow-conf-2027/speakers/seed_contact_0001` (a
speaker whose seeded `social_links_json` includes a LinkedIn URL, `scripts/seed.ts` ~line 427):

```html
<a href="https://www.linkedin.com/in/priya-raman-example" rel="noopener noreferrer nofollow" target="_blank">LinkedIn</a>
```

Rendered inside a `<ul><li>` per `src/routes/public/detail.tsx:38-48`'s
`speaker.socialLinks.length > 0 ? <ul>...</ul> : null` guard — CONFIRMED anchor rendering with
`rel="noopener noreferrer nofollow" target="_blank"` on the link.

Contact with NO social links — used `seed_synth_contact_0001` (`scripts/seed.ts`, synth-contact
loop, `social_links_json: null`, ~line 774), which is publicly listed on
`/e/devflow-conf-2027/speakers`. `GET
/e/devflow-conf-2027/speakers/seed_synth_contact_0001` body (`<main>` section, verbatim):

```html
<div class="chq-card"><img src="/headshots/seed_file_0013" alt="Alex Delgado" width="160"/><h2>Alex Delgado</h2><p>Software Engineer, Northwind Systems</p></div><h3>Sessions (1)</h3><ul><li>...</li></ul>
```

No empty list container: CONFIRMED — the `chq-card` div (the speaker profile card, same one
that would host the social-links `<ul>` per `detail.tsx:38-48`) contains no `<ul>` at all when
`socialLinks.length === 0`; the only `<ul><li>` present in the page belongs to the separate
"Sessions" section (a sibling `<h3>`+`<ul>` outside `chq-card`), not the social-links list. The
`null` branch of the ternary is what actually renders — no `<ul></ul>` with zero `<li>` children
anywhere near the card.

Manual server killed (`lsof -ti tcp:8797 | xargs kill`) before running the automated gate below.

## npm run gate:render-sweep — desktop route table (verbatim)

```
render-sweep: starting wrangler dev on port 53219...
render-sweep: wrangler dev is up
render-sweep: logging in as organizer (sbek-organizer@example.com)...
render-sweep: logging in as reviewer (sbek-reviewer@example.com)...
render-sweep: logging in as speaker (sbek-speaker@example.com)...

path                                                                            role       status
/admin/overview                                                                 organizer  PASS
/admin/submissions                                                              organizer  PASS
/admin/submissions/forms                                                        organizer  PASS
/admin/submissions/seed_submission_0001                                         organizer  PASS
/admin/speakers                                                                 organizer  PASS
/admin/content                                                                  organizer  PASS
/admin/agenda                                                                   organizer  PASS
/admin/comms                                                                    organizer  PASS
/admin/contacts                                                                 organizer  PASS
/admin/settings                                                                 organizer  PASS
/admin/review                                                                   organizer  PASS
/admin/review/plans/new                                                         organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                          organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                           organizer  PASS
/admin/review                                                                   reviewer   PASS
/admin/review/plans/seed_evaluation_plan_0001                                   reviewer   PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002  reviewer   PASS
/portal                                                                         speaker    PASS
/portal/submissions/seed_submission_0001                                        speaker    PASS
/portal/submissions/seed_submission_0001/edit                                   speaker    PASS
/portal/profile                                                                 speaker    PASS
/portal/tasks                                                                   speaker    PASS
/portal/tasks/seed_task_assignment_0001/form                                    speaker    PASS
/e/devflow-conf-2027/sessions                                                   public     PASS
/e/devflow-conf-2027/speakers                                                   public     PASS
/e/devflow-conf-2027/gallery                                                    public     PASS
/e/devflow-conf-2027/agenda                                                     public     PASS
/e/devflow-conf-2027/schedule                                                   public     PASS
/submit/devflow-conf-2027                                                       public     PASS
/account/password                                                               organizer  PASS
/account/password                                                               reviewer   PASS
/account/password                                                               speaker    PASS
/admin/*                                                                        organizer  PASS

34/34 routes passed
```

Zero collected console `error` + `pageerror` events reported per route (no allowlist, no
non-200 nav responses) — the "34/34 routes passed" summary confirms every assertion held; the
script prints a FAIL row and exits non-zero on any console-error/pageerror/non-200/blank-body
finding, and none appeared.

## npm run gate:render-sweep — mobile 390x844 table (verbatim)

```
render-sweep: mobile pass (390x844)...

path                                                overflowPx  minControlPx  status
/submit/devflow-conf-2027                                    0             40  PASS
/e/devflow-conf-2027/sessions                                0             40  PASS
/e/devflow-conf-2027/speakers                                0             40  PASS
/e/devflow-conf-2027/agenda                                  0             40  PASS
/e/devflow-conf-2027/schedule                                0             40  PASS
/e/devflow-conf-2027/gallery                                 0             40  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001           0             40  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001              0             40  PASS
/embed/devflow-conf-2027/sessions                            0             40  PASS
/embed/devflow-conf-2027/agenda                              0             40  PASS
/embed/devflow-conf-2027/speakers                            0             40  PASS
/login                                                       0             40  PASS
/portal                                                      0             40  PASS
/docs/api                                                    0              -  PASS
/dev/mailbox                                                 0              -  PASS

15/15 mobile routes passed
```

Zero page-level horizontal overflow (`overflowPx: 0`) on every mobile-manifest route, including
both DEC-321/DEC-322-affected routes — `/submit/devflow-conf-2027` (new job_title/company/bio
fields) and `/e/devflow-conf-2027/speakers/seed_contact_0001` (social-links list). Every primary
nav/filter/submit control on every route with any measures >= 40px tall (`minControlPx: 40`
throughout, per DEC-253); the two routes reporting `-` (`/docs/api`, `/dev/mailbox`) have no
primary nav/filter/submit controls at all (DEC-311 null-is-a-pass rationale, unchanged from
wave 13). No wave-11-style mobile overflow OPEN ITEM reappeared — no route in either table shows
nonzero `overflowPx`.

## Exit code

```
gate:render-sweep OK
EXIT_CODE=0
```

No FAIL rows in either table, no console-error/pageerror/blank-screen findings, no nonzero
mobile overflow anywhere in the manifest, both DEC-321/DEC-322 surfaces confirmed by direct
markup inspection above. No action failed during this lane, so per DEC-316 there is no OPEN
ITEM to log.

## POST-S DELTA

```
git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua log --oneline f0d56cefd3c2949591526cebfd403290cdab244a..refs/heads/main -- src app migrations scripts test
```

```
8c90b60 Fix schedule.ics empty-agenda bug and public onError cache leak (DEC-323, DEC-324)
```

One post-S commit landed on `main` after this lane's worktree was created: `8c90b60`
(DEC-323/DEC-324, `src/routes/public/index.tsx` + two new test files). Scoped to
`schedule.ics` (bare-request whole-agenda fix) and `publicRoutes.onError` cache-header
overwrite — neither touches `/submit/<slug>` markup, `src/routes/public/detail.tsx`, nor
anything in the DEC-321/DEC-322 surfaces this lane swept. Per DEC-280 this delta is
informational only, never a STOP, and does not invalidate the render-sweep run recorded above
(the run itself was executed against S's checked-out tree, unaffected by this unrelated
main-tip commit).
