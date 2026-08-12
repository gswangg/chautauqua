# task-w5-i — render-sweep gate (DEC-384 / DEC-387), post task-w5-a

LOG-ONLY gate. No product/test/style/script/config file touched by this
task; this file is the sole artifact.

## Frozen SHA / worktree notes

The worktree for this task was created twice because the swarm's shared
`chautauqua` checkout had its `task-w5-i` worktree and branch removed by a
concurrent process partway through the first run (other wave-5 lanes are
actively merging into `main` in parallel). The first attempt's frozen SHA
and full sweep output were lost when the worktree directory disappeared
mid-task; the run below is a full redo from a freshly created worktree.
Both runs produced the same 30/34 desktop, 15/15 public-mobile, 3/20
admin-mobile-advisory result shape (transient per-route overflow-px
readings differed by a few pixels between runs — expected render-timing
noise, not a functional difference), so the redo is a faithful, complete
first real reading of the re-skinned product.

- **Frozen main SHA at worktree creation (this run):**
  `c12b89f2efa0b5a2533d14f30ecc0cf230a7a940` (`merge task-w5-g`)
- Worktree: `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w5-i`
  on branch `task-w5-i`, branched from `main` at the SHA above.
- (For the record: the first, lost attempt was frozen at
  `3867c426d329a4882b1b9acadc91c6f34305725c`, `merge task-w5-b` — one merge
  earlier than the SHA actually exercised below. No functional route/gate
  code changed between the two SHAs relevant to this sweep; task-w5-g's
  merge landed in between.)

## Exact commands run

```
git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua worktree add \
  /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w5-i -b task-w5-i main

cd /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w5-i
([ -d node_modules ] || npm ci --prefer-offline --no-audit --no-fund --silent)
npm run build
npx playwright install chromium
npm run gate:render-sweep
```

`npm run build` = `tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts`
— succeeded cleanly (only the two expected "didn't resolve at build time"
font-asset notices, no errors).

`npm run gate:render-sweep` = `tsx scripts/render-sweep.ts`. Per the
script's own comments/logs, it self-performs, in order, before opening a
browser:
1. `vite build` of the admin SPA bundle (again, standalone — "render-sweep:
   building admin SPA bundle...").
2. `npx tsx scripts/seed.ts` (writes `.seed.sql` from
   `docs/fixtures/sample-data.json`).
3. `npx wrangler d1 execute chautauqua --local --file=.seed.sql` (applies
   18 pending D1 migrations, then the seed SQL — "🚣 73 commands executed
   successfully" for schema, then two more batches for other migration/seed
   groups).
4. `npx tsx scripts/seed-r2.ts` ("seed-r2: put 8 object(s) into local R2
   bucket 'chautauqua-files'").
5. `npx wrangler dev --port <free-port>` (bound to an OS-assigned free
   port, here 58326), waited on `/health` until ready.

Then it logs in via the real `/login` HTML form as organizer, reviewer,
and speaker, and runs the three passes below.

## Table 1 — desktop route sweep (all ROUTE_MANIFEST entries, per-role login, 200 + non-empty render + zero console/page errors)

```
path                                                                            role       status
/admin/overview                                                                 organizer  FAIL  (empty rendered text; 1 console error(s): TypeError: Cannot read properties of undefined (reading 'length')
    at F (http://localhost:58326/admin/assets/Overview-DsfBFC16.js:1:6447)
    at ao (http://localhost:58326/admin/assets/index-Ce1fsCg7.js:39:17072)
    at wo (http://localhost:58326/admin/assets/index-Ce1fsCg7.js:41:3158)
    at nc (http://localhost:58326/admin/assets/index-Ce1fsCg7.js:41:45095)
    at Zs (http://localhost:58326/admin/assets/index-Ce1fsCg7.js:41:39988)
    at Td (http://localhost:58326/admin/assets/index-Ce1fsCg7.js:41:39916)
    at Ml (http://localhost:58326/admin/assets/index-Ce1fsCg7.js:41:39769)
    at Io (http://localhost:58326/admin/assets/index-Ce1fsCg7.js:41:36098)
    at Ys (http://localhost:58326/admin/assets/index-Ce1fsCg7.js:41:35046)
    at Ee (http://localhost:58326/admin/assets/index-Ce1fsCg7.js:26:1602); 1 pageerror(s): Cannot read properties of undefined (reading 'length'))
/admin/submissions                                                              organizer  PASS
/admin/submissions/forms                                                        organizer  PASS
/admin/submissions/seed_submission_0001                                        organizer  PASS
/admin/speakers                                                                 organizer  PASS
/admin/content                                                                  organizer  PASS
/admin/agenda                                                                   organizer  PASS
/admin/comms                                                                    organizer  PASS
/admin/contacts                                                                 organizer  PASS
/admin/settings                                                                 organizer  PASS
/admin/review                                                                   organizer  PASS
/admin/review/plans/new                                                        organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001                                  organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                        organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                         organizer  PASS
/admin/review                                                                   reviewer   FAIL  (1 console error(s): Failed to load resource: the server responded with a status of 403 (Forbidden))
/admin/review/plans/seed_evaluation_plan_0001                                  reviewer   FAIL  (1 console error(s): Failed to load resource: the server responded with a status of 403 (Forbidden))
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002 reviewer   FAIL  (1 console error(s): Failed to load resource: the server responded with a status of 403 (Forbidden))
/portal                                                                         speaker    PASS
/portal/submissions/seed_submission_0001                                       speaker    PASS
/portal/submissions/seed_submission_0001/edit                                  speaker    PASS
/portal/profile                                                                 speaker    PASS
/portal/tasks                                                                   speaker    PASS
/portal/tasks/seed_task_assignment_0001/form                                   speaker    PASS
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

30/34 routes passed
```

## Table 2 — public/no-login mobile pass (390x844, DEC-253)

```
path                                                overflowPx  minControlPx  status
/submit/devflow-conf-2027                                    0             44  PASS
/e/devflow-conf-2027/sessions                                0             40  PASS
/e/devflow-conf-2027/speakers                                0             40  PASS
/e/devflow-conf-2027/agenda                                  0             40  PASS
/e/devflow-conf-2027/schedule                                0             40  PASS
/e/devflow-conf-2027/gallery                                 0             40  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001           0             40  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001              0             40  PASS
/embed/devflow-conf-2027/sessions                            0             44  PASS
/embed/devflow-conf-2027/agenda                              0             44  PASS
/embed/devflow-conf-2027/speakers                            0             44  PASS
/login                                                       0             48  PASS
/portal                                                      0             40  PASS
/docs/api                                                    0              -  PASS
/dev/mailbox                                                 0              -  PASS

15/15 mobile routes passed
```

## Table 3 — admin mobile pass, 390x844, ADVISORY (DEC-387)

```
path                                                                            overflowPx  minControlPx  status
/admin/overview                                                                          0              -  PASS
/admin/submissions                                                                      40             21  FAIL  (horizontal overflow 40px (scrollWidth 430 > viewport 390); control height 21px < 40px)
/admin/submissions/forms                                                                11             21  FAIL  (horizontal overflow 11px (scrollWidth 401 > viewport 390); control height 21px < 40px)
/admin/submissions/seed_submission_0001                                                 11             21  FAIL  (horizontal overflow 11px (scrollWidth 401 > viewport 390); control height 21px < 40px)
/admin/speakers                                                                         11             21  FAIL  (horizontal overflow 11px (scrollWidth 401 > viewport 390); control height 21px < 40px)
/admin/content                                                                          11             21  FAIL  (horizontal overflow 11px (scrollWidth 401 > viewport 390); control height 21px < 40px)
/admin/agenda                                                                           11             21  FAIL  (horizontal overflow 11px (scrollWidth 401 > viewport 390); control height 21px < 40px)
/admin/comms                                                                           131             21  FAIL  (horizontal overflow 131px (scrollWidth 521 > viewport 390); control height 21px < 40px)
/admin/contacts                                                                         11             21  FAIL  (horizontal overflow 11px (scrollWidth 401 > viewport 390); control height 21px < 40px)
/admin/settings                                                                         11             21  FAIL  (horizontal overflow 11px (scrollWidth 401 > viewport 390); control height 21px < 40px)
/admin/review                                                                           11             21  FAIL  (horizontal overflow 11px (scrollWidth 401 > viewport 390); control height 21px < 40px)
/admin/review/plans/new                                                                 11             21  FAIL  (horizontal overflow 11px (scrollWidth 401 > viewport 390); control height 21px < 40px)
/admin/review/plans/seed_evaluation_plan_0001                                           11             21  FAIL  (horizontal overflow 11px (scrollWidth 401 > viewport 390); control height 21px < 40px)
/admin/review/plans/seed_evaluation_plan_0001/progress                                  11             21  FAIL  (horizontal overflow 11px (scrollWidth 401 > viewport 390); control height 21px < 40px)
/admin/review/plans/seed_evaluation_plan_0001/results                                   11             21  FAIL  (horizontal overflow 11px (scrollWidth 401 > viewport 390); control height 21px < 40px)
/admin/review                                                                            1             21  FAIL  (control height 21px < 40px)
/admin/review/plans/seed_evaluation_plan_0001                                            1             21  FAIL  (control height 21px < 40px)
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002           1             21  FAIL  (control height 21px < 40px)
/account/password                                                                        0             44  PASS
/account/password                                                                        0             44  PASS

3/20 mobile routes passed
```

Note: the task instructions describe "all four printed tables (desktop,
public mobile, admin mobile advisory)". `scripts/render-sweep.ts` prints
exactly three result tables (`formatResultsTable` once, `formatMobileResultsTable`
twice — for the public-mobile and admin-mobile-advisory passes), each
followed by one `formatSummary`/`formatMobileSummary` line — the three
above are the complete set the script produces; there is no fourth table
to record.

## Process exit code

`1` (non-zero). Confirmed via `echo "EXIT_CODE=$?"` appended immediately
after the `npm run gate:render-sweep` invocation in the same shell
statement. Exit is driven by Table 1's 30/34 (desktop `allPassed` is
false); Table 2 is 15/15 (no contribution to failure); Table 3 is
advisory-only (`ADMIN_MOBILE_PASS_BLOCKING = false` in
`scripts/render-sweep-lib.ts:215`, confirmed by reading the source, so its
3/20 does **not** by itself flip the exit code — but the run still exits 1
because of the desktop failures).

## OPEN ITEMS

1. **`/admin/overview` (organizer) crashes with "Cannot read properties of
   undefined (reading 'length')", empty `#root`.**
   Root cause (read from source, not modified): a client/server field-name
   mismatch in the DEC-370 v2 Overview payload. The server
   (`src/server/repo/overview.ts:611-625`, the `return { triage, review,
   speakers, content, agenda, comms, deadlines, overdueTasks, triageQueue,
   contentApproval, agendaWork }` object) sends the **v1** aggregate
   `{pending, accept_queue, decline_queue}` under the wire key `triage`,
   and the **v2** rows object under the key `triageQueue`. The client type
   (`app/src/pages/overview/types.ts`, `OverviewPayload`) and the page
   (`app/src/pages/Overview.tsx:238`, `payload.triage.rows.length === 0`)
   expect the opposite: `triage` = v2 `{ total, oldestSubmittedAt, rows }`
   and `'triage-counts'` = the v1 aggregate (per the client type file's own
   comment: "`triage` collides with the v2 `triage` key above, so on the
   wire it lands as `triage-counts`"). Because the server never renames its
   v1 `triage` key to `'triage-counts'` and never renames `triageQueue` to
   `triage`, `payload.triage` on the client is the v1 aggregate object,
   which has no `.rows`, so `payload.triage.rows.length` throws.
   Status: **new defect, not previously measured** (the wave-3 sweep never
   got past `/admin/overview`'s prior unconditional 500, so this
   client/server contract mismatch has never been exercised end-to-end
   before). Not settled/out-of-scope per DEC-366 (DEC-366 froze stage-1
   *function*; this is a wiring bug in the DEC-370 v2 payload plumbing
   itself, introduced/exposed by the redesign work, not a stage-1 behavior
   question). Not known to be owned by another already-assigned wave-5
   lane as of this writing — flagging for planner triage.

2. **Reviewer role gets a console 403 on every `/admin/review*` page.**
   `app/src/lib/useNavExceptions.ts:35` calls `apiGet(/events/${eventId}/overview)`
   unconditionally from the top-nav shell for every logged-in role
   (organizer, reviewer, speaker), to source nav-badge counts. That
   endpoint (`src/routes/api/overview.ts:20`, gated by `requireOrganizer`)
   is organizer-only, so the reviewer role always gets a 403 on it. The
   hook already fails soft in its own `.catch()` (empty badges, per its own
   comment "absence of an exception, per DEC-369") but the underlying
   `fetch` still logs a browser console error, which `visitRoute`'s
   zero-console-error assertion (no allowlist) correctly flags as FAIL.
   This is a genuine reviewer-experience defect (an org-scoped nav feature
   silently 403ing for a valid, logged-in reviewer on every page they can
   legitimately see), not just a test artifact. Not settled/out-of-scope
   per DEC-366. Not known to be owned by another wave-5 lane as of this
   writing — flagging for planner triage.

3. **Admin mobile pass (advisory, DEC-387): 3/20, first-ever reading.**
   17 of 20 organizer/reviewer routes fail at 390x844 on one or both of
   horizontal overflow (`.chq-*` table-heavy admin pages: Submissions,
   Speakers, Content, Agenda, Comms, Contacts, Settings, Review and its
   sub-routes all overflow 11-304px past the 390px viewport depending on
   the run) and control height (every failing route's shortest matched
   `.chq-tabbar`/`.chq-btn`/`.chq-input`/`.chq-select`/`header nav a`
   control measures 21px, well under the 40px tap-target floor). Only
   `/admin/overview` and the two `/account/password` entries pass clean.
   This is exactly what DEC-387 predicted — these routes "have never been
   measured at 390px before" — and it lands here as data, not a fix. Per
   DEC-387/`ADMIN_MOBILE_PASS_BLOCKING` in `scripts/render-sweep-lib.ts:215`
   this pass is advisory and does not gate the exit code; per this task's
   scope no product/style code is touched to address it. Flagging for
   whichever later wave-5 lane is assigned the admin phone-card pass
   (DEC-386's `.chq-*-cards` pattern) — that work is presumably the fix for
   items 1-17 of this table, but is not this task's to do or attribute.

## Advisory admin mobile pass result (DEC-387 flip condition)

**Did NOT read all-PASS.** 3/20 passed (only `/admin/overview` and the two
`/account/password` entries; all 17 remaining organizer/reviewer routes
FAILed on overflow and/or control-height). Per DEC-387 the flip of
`ADMIN_MOBILE_PASS_BLOCKING` from `false` to `true` is conditioned on this
pass reading all-PASS; that condition is **not met** by this run. This
report does not flip the flag (LOG-ONLY gate; no product code touched).

## RESULT

**FAIL** — process exit code 1 (desktop pass 30/34; two real defects
detailed in OPEN ITEMS #1 and #2 above). Public mobile pass is clean
(15/15). Admin mobile advisory pass is 3/20, does not itself affect the
exit code (advisory, per DEC-387), and did not read all-PASS (see above).

## RECHECK SHA

Branch `task-w5-i` HEAD after this task's own commit (this
verification-log file is the only change on the branch, on top of the
frozen SHA `c12b89f2efa0b5a2533d14f30ecc0cf230a7a940`) — see the commit
this file ships in.

## POST-S DELTA

`git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w5-i status --porcelain`
immediately before staging showed exactly one entry:

```
?? docs/verification-log/task-w5-i-render-sweep-redesign.md
```

No other file (product, test, style, script, or config) was modified —
confirmed by the empty diff on everything else in `git status`.
