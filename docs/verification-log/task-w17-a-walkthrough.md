# task-w17-a: Walkthrough gate (DEC-060/DEC-062/DEC-069 amendment)

Tip measured: `5fc3db38a9bb1f7a1f29ca6374cb17c519c8fbe5` (main's HEAD at the
time task-w17-a's worktree was created — later than the `9b21309c` floor
named in the task; wave 16's merges plus wave 17's scribe commit landed in
between). Port 8871 owned exclusively for this task; no other lane's
`wrangler dev` was left bound to it during the final measured run (an earlier
`wrangler dev --port 8871` process belonging to worktree `task-w16-c`
(PID 38552, started 09:33:37, stale — that lane's own walkthrough never ran,
per the w17 scribe note) was found squatting the port before this task
started and was killed so this task's own server could bind it).

RESULT: PASS

## Commands run (local only — no remote D1, no deploy)

```
npx tsx scripts/ensure-dev-vars.ts
npx vite build --config app/vite.config.ts
npm run db:migrate          # wrangler d1 migrations apply chautauqua --local
npm run seed                # tsx scripts/seed.ts && wrangler d1 execute ... && tsx scripts/seed-r2.ts
npx wrangler dev --port 8871   # backgrounded, waited for 200 on GET /
npx tsx scripts/walkthrough.ts --url http://localhost:8871
```

Local dev config note: `.dev.vars` (gitignored, created fresh by
`ensure-dev-vars.ts`) ships `PUBLIC_BASE_URL=http://localhost:8787` by
default (DEC-296) — updated to `http://localhost:8871` for this run so
emailed absolute links (CFP claim link, etc.) resolve on-origin for the
walkthrough's off-origin-href guard (`resolveScrapedHref`,
`scripts/walkthrough/producer.ts:101`). This is local dev-vars config, not a
source change.

Between diagnostic attempts the local D1/R2/KV state was reset
(`rm -rf .wrangler/state/v3/{d1,r2,kv}` + re-migrate + re-seed) so every
PASS/FAIL below reflects a single clean run from a fresh seed, not
accumulated cross-run state.

## Per-area result (final clean run)

| Area | Result |
|---|---|
| producer (J1, J2, J3, J5, J9) | PASS |
| review (J4) | PASS |
| speaker (J6, J7, J8) | PASS |
| public (J9, J10) | PASS |
| data (J11, J12) | PASS |
| scale (throughput + no-auto-email + purge-refresh) | PASS |

All six `scripts/walkthrough/{producer,review,speaker,public,data,scale}.ts`
modules passed in the orchestrator's fixed order on the final run.

## Harness repairs made (own-scope only — SCOPE RULE)

Every fix below is a probe correcting itself against a product surface that
had legitimately changed (or a probe assumption that was never true of the
current markup/behavior), not a product change. `npx vitest run
test/walkthrough-lib.test.ts` was run after each round of edits (45/45
passed every time) and the full suite was never run (task-w17-c's scope).

1. **`scripts/walkthrough/speaker.ts`** — "Done"/"To do" is the DEC-366-frozen
   on-screen wording for a task assignment's status flag
   (`src/routes/portal/tasks/views.tsx:237-238`); the probe was asserting the
   literal strings "Completed"/"Pending", which the product never renders.
   Fixed two assertions (general-task complete round-trip, form-task complete
   round-trip).
2. **`scripts/walkthrough/public.ts`** — the "v7 filter bar" redesign
   (DEC-919 wave-40 amendment) replaced the pill-row nav labeled "Track
   filters" with a single auto-submitting `<select name="trackId">`
   (`src/routes/public/sessions.tsx:285-292`); no "Track filters" text exists
   anywhere in current markup. Re-pinned the probe to `name="trackId"`.
3. **`scripts/walkthrough/data.ts`** — `showflow.csv`'s header gained a
   trailing `kind` column per DEC-022's wave-66 amendment (breaks interleaved
   into showflow as clearly-typed non-session rows via an explicit kind
   marker — `src/server/repo/exports/showflow.ts` `SHOWFLOW_HEADER`); the
   probe's expected-header constant was pre-DEC-022.
4. **`scripts/walkthrough/scale.ts`** (`readMailboxCount`) — DEC-546 put
   `guardDevMailbox` (organizer-session-required) in front of `/dev/mailbox`;
   the probe was calling it with a bare unauthenticated `fetch`, silently
   following the redirect to the 200 login page and finding no message
   count. Switched to the module's own `jarFetch`/organizer cookie jar. Also
   fixed the count regex: `countOf()` (`src/domain/count-copy.ts`) renders
   "N message"/"N messages", never the "N message(s)" shorthand the probe
   looked for.
5. **`scripts/walkthrough/public.ts`** (Settings embed-generator check) —
   `EmbedsPanel` is no longer a standalone `SECTIONS` entry in
   `app/src/pages/Settings.tsx`; it was folded one level down into
   `app/src/pages/settings/PublicPagesPanel.tsx` (imported + mounted as
   `<EmbedsPanel />` there, alongside `SavedEmbedsPanel`, under the
   'public-pages' section). Re-pinned the source-scan assertions to that
   file.
6. **`scripts/walkthrough/speaker.ts`** (file_request upload block) — three
   compounding bugs, all in the same test block:
   - `PROFILE_TASK_TITLE = "Finalize bio + headshot"` (`src/domain/
     acceptance.ts:24`) was repurposed to a `kind='general'` profile-save task
     back in wave 59 (DEC-009 amendment); it has never had an upload form.
     The probe's row-scan regex used a stale `</li>` boundary sentinel that
     never appears in the current `<div class="chq-portal-row">` markup, so
     the scan ran straight through into the NEXT file_request task's row
     ("Upload your slide deck", the DEC-739 event-specific replacement) and
     silently tested that instead. Retargeted the probe to "Upload your
     slide deck" and fixed the boundary to the `NEXT_TASK_ROW` sentinel
     already used correctly elsewhere in this file.
   - DEC-891 ("conditional-and-quiet"): once a speaker has 2+ eligible
     sessions for a file_request task, the real upload form grows a required
     `<select name="submissionId">` (`DeliverableSelect`,
     `src/routes/portal/tasks/views.tsx:158-179`). By the point this test
     runs, the walkthrough's own earlier invite-visibility fixtures (A/B/C)
     have given the seeded speaker exactly that 2+-session case. Scrape and
     echo the select's first `<option value>`, mirroring what a real
     browser submit does.
   - `scripts/seed.ts`'s DEC-739 loop pre-completes "Upload your slide deck"
     (with a real file at `version_no=1`) for every `contactIdx % 3 === 0`
     speaker, which includes the DEC-172-pinned primary seeded speaker this
     walkthrough logs in as — so the probe's own upload is a REPLACE onto an
     already-complete assignment and lands at version 2, not version 1. Fixed
     the expected version string.
7. **`scripts/walkthrough/speaker.ts`** (comment-cap refusal message) —
   DEC-422's one over-cap refusal grammar (`src/domain/cap-copy.ts
   overCapSentence`) reads "Reply is 4,001 characters — 1 over the
   4,000-character limit.", never the literal words "too long" the probe was
   grepping for.
8. **`scripts/walkthrough/speaker.ts`** (portal profile save) —
   `src/routes/portal/profile.tsx:422-423` does PRG (POST-redirect-GET) to
   `/portal/profile?saved=1` on a successful save, not a 200 inline
   re-render with "Profile saved." in the POST response body. The probe was
   asserting `res.status === 200` on the POST itself. Fixed to expect 302
   then follow up with a GET of the `?saved=1` URL for the confirmation text.
9. **`scripts/walkthrough/speaker.ts`** (close-date edit-lock probes) — the
   probe set `closeDate: Date.now() - 60*60*1000` intending "the form closed
   an hour ago", but `closeDate` is a DAY LABEL expanded to event-local
   END-OF-DAY before comparison (`src/lib/submit-core.ts isFormClosed`/
   `dayLabelEndInstant`) — "1 hour ago" is still *today's* day label in most
   timezones, whose end-of-day instant is still in the future, so the form
   never actually read as closed and the "Editing closed" assertions failed.
   Changed to `Date.now() - 3*24*60*60*1000` (3 full days back) so the day
   label is unambiguously in the past regardless of the event's timezone
   offset.
10. **`scripts/walkthrough/scale.ts`** (purge-refresh probe, `/submit`) —
    the public submit form's redesign since this probe was written: no more
    `<select>` elements (dropdown-kind custom fields — session format,
    audience level — now render as RADIO GROUPS) and a single `speaker_name`
    text control instead of separate `field__first_name`/`field__last_name`
    inputs (`scripts/walkthrough/producer.ts`'s J2 test already had the
    correct up-to-date handling for this same form; mirrored its
    radio-group-fill logic and `speaker_name` field into `scale.ts`'s
    `purgeRefreshProbe`).
11. **`scripts/walkthrough/scale.ts`** (purge-refresh probe, portal edit) —
    a second, separate bug in the same probe: the portal edit page (unlike
    `/submit`) DOES render the custom dropdown-kind fields as real
    `<select>` elements, but the edit-form POST was reusing `dropdownValues`
    parsed from the `/submit` page's body (empty, since that page has no
    `<select>` at all post-redesign) instead of parsing the edit page's own
    selects. Added a separate `editDropdownValues` parse of `editGetBody`.
12. **`scripts/walkthrough/data.ts`** (duplicate-merge test) — the most
    significant find: "J11: per-contact history" picks the first contact
    (by `sort=recent`) with both submission and email history, then "J11:
    duplicate merge" folds that contact into a fresh throwaway contact. By
    the time `data.ts` runs after `speaker.ts`/`public.ts`, the seeded
    PRIMARY SPEAKER fixture identity (`sbek-speaker@example.com`, used as a
    load-bearing login by every later check in `data.ts` itself and by any
    module that might run after it) is the most-recently-touched contact
    with rich history, so the merge test was silently merging it away.
    `src/server/repo/contacts/merge.ts` correctly repoints the surviving
    user row's `contactId` to the keeper and (DEC-479) rewrites its `email`
    to the merge's planned canonical email — so the underlying account and
    password survive, but the ORIGINAL fixture email
    (`sbek-speaker@example.com`) stops resolving to any user row, and every
    later `login(fixture.identities.speaker.email, ...)` call 401s with the
    generic "that email and password do not match" (existence-hiding by
    design, so the real cause never showed up in the error). Fixed by
    excluding every load-bearing walkthrough identity email
    (organizer/speaker/speaker2/reviewer, read from
    `docs/fixtures/sample-data.json`) from the merge-test's candidate scan.
    This was reproduced deterministically (bisected module-by-module against
    a fresh seed each time) before and after the fix.

## OPEN ITEMS

None outstanding. Every failure encountered during this gate run was
resolved as a harness (probe) defect within the stated SCOPE RULE — no
product code was touched, and no product defect was found that required
deferral. Re-verify with a fresh `rm -rf .wrangler/state/v3/{d1,r2,kv}` +
`db:migrate` + `seed` cycle before trusting a re-run against leftover state:
several of the fixes above (items 6b/6c, 12) only manifest once the fixture
has accumulated enough state (2+ eligible sessions, a recently-touched
history-bearing contact) — a partial/dirty re-run from stale `.wrangler`
state can mask or falsely reproduce them.
