# task-w3-c-c2 — J8 content lifecycle browser pass (organizer + speaker) @ 516f2b1

DEC-259 lane: J8 content lifecycle, driven with a real Playwright/chromium
browser against a freshly migrated + seeded `npx wrangler dev --port 8832
--var PUBLIC_BASE_URL:http://localhost:8832` in this lane's own
worktree/branch (`task-w3-c`, cut from `main` @ `cf35a87`, "merge
task-w2-h"). Fixture personas from `docs/fixtures/sample-data.json`:
`sbek-organizer@example.com` and `sbek-speaker@example.com`, against event
`devflow-conf-2027`. Driver script lived at
`.scratch/j8-content-browser.mjs`, deleted before this commit (never
committed). Zero-allowlist console error capture (`page.on('console', ...
type()==='error')` + `page.on('pageerror', ...)`) on both persona contexts
throughout.

Mid-task note for the scribe (same failure mode already flagged by
task-w1-e): partway through this task, with an uncommitted fix + driver
script in progress, this worktree was wiped down to an empty directory
(only `.wrangler/` survived — a gitignored dir, so this was not a `git
clean`), and `git -C .../chautauqua worktree list` showed the worktree AND
its branch gone entirely. Recovered by `git worktree remove --force` +
`git branch -D task-w3-c` + `git worktree add ... -b task-w3-c main`
against main's then-current tip and redoing the fix, test, and browser
pass from scratch. All work in this log is from the POST-recovery run;
timestamps/commit above reflect that.

## (1) Speaker upload -> organizer worklist counts AND Files tab agree, no manual refresh [CNT-07]

As Priya Raman (`sbek-speaker@example.com`), uploaded a real PDF
(`browser-upload-v1.pdf`) against the "Finalize bio + headshot"
file_request task on `/portal/tasks` -> task flipped to Completed. As the
organizer, on `/admin/content` (SPA, no page reload) switched the Worklist
sub-tab to "All" and confirmed SES-001 (Priya's own accepted submission,
Presentation column showing count 2 — the pre-existing seed slides chain
root + the new upload's chain root, per DEC-247 chain-root counting).
Clicked the "Files" top-level tab (same SPA session, no navigation) and
confirmed exactly one Files-tab row for `browser-upload-v1.pdf` (Kind
Presentation, Session SES-001, Speaker Priya Raman) appeared without any
manual refresh — the worklist count and the Files-tab row are both backed
by the same upload and agree. docs/eval-findings.md Section C's P2
(worklist/Files disagreement) stays fixed and is re-confirmed live here.

## (2) Re-upload mints v2, chained by previous_file_id, both versions downloadable, Versions is a real link [CNT-04]

Opened the Files-tab row's clickable filename button (an actual
`<button class="chq-link-button">`, not decorative text) into
DeliverableDetail. As the speaker, used the "Replace file" form on the now-
Completed task row to re-upload `browser-upload-v2.pdf`. Reloaded the
organizer's DeliverableDetail: `VersionList` shows both
`browser-upload-v1.pdf` (v1) and `browser-upload-v2.pdf` (v2) as two
distinct `<a href="/files/:id">` download links with two DIFFERENT file
ids (chained via `previous_file_id`, per `orderVersionChains` — the
independent-chain-numbering fix from task-w1-e stays correct: the seed's
own `slides-v1/v2.pdf` chain still separately shows "Latest"/"v1", never
cross-mislabeled with the task-upload chain). Both v1 and v2 fetched
`GET /files/:id` as the organizer session: both 200. CNT-04 confirmed.

## (3) Producer comment + speaker reply, full thread in order [CNT-05]

Note (same known, non-bug seed-timestamp artifact task-w1-e already
documented, reconfirmed here): DeliverableDetail's single per-kind comment
box binds to `grouped[kind][0]`, the overall-newest chain head across ALL
independent chains for that kind — in this seeded demo the seed chain's
fixture timestamps are dated into the fictional future event month (Jan
2027), which sorts newer than today's real 2026 wall-clock task upload, so
the "Presentation" comment box in the admin UI is bound to the SEED chain,
not the task-upload chain, purely because of the seed data's own
timestamps (in a real deployment all uploads share one real clock, so this
never happens). To exercise CNT-05 against the actual chain the speaker
portal targets, posted via the same `POST /api/v1/files/:id/comments`
endpoint the admin UI itself calls, directly against the task-upload
chain's current chain-latest file id (resolved via
`GET /api/v1/submissions/:id/files`). Reloaded `/portal/tasks` as the
speaker: the organizer's comment appeared in the file_request task row's
thread. Posted a speaker reply from that same portal thread form; reloaded
via the API (`GET /api/v1/files/:id/comments`, the same data both UIs
read): both the organizer's comment and the speaker's reply present, in
chronological order (organizer's comment index < reply index). CNT-05
confirmed at the data layer both roles' UIs actually read from.

## (4) Content approval gates the public surface [CNT-12]

Flipped SES-001's `content_status` to `changes_requested` via
`POST /api/v1/submissions/:id/content-status` — `GET
/e/devflow-conf-2027/sessions/seed_submission_0001` (fresh incognito-style
browser context, see note below) returned 404, and `page.content()`'s raw
HTML never contained the deck filename. Flipped back to `approved` -> same
URL, fresh context, 200. Confirmed via `page.content()` (raw HTML), not
the rendered DOM/React state, per the task's own instruction.

**Real defect found, logged as an OPEN ITEM (out of this lane's fix
authority — the files are `src/routes/public/index.tsx` +
`src/routes/public/shell.tsx`, not in this lane's owned-file list):**
`setCacheHeaders(c)` in the `/e/:eventSlug/sessions/:sessionId` handler
runs unconditionally BEFORE the "session not found" 404 branch, so the
404 response itself carries `Cache-Control: public, max-age=60,
stale-while-revalidate=300` (confirmed via `curl -I` against a
nonexistent session id). A real chromium browser (`page.goto`, unlike a
bare `fetch`/`curl`) honors that header and caches the 404 client-side for
60s — so flipping `content_status` back to `approved` within that window
still shows a stale cached 404 in the SAME browser context/tab that
previously hit the unapproved URL. Reproduced directly: `page.request.get`
(bypasses the disk cache Chromium's `page.goto` uses) showed 200
immediately after approving, while `page.goto` in the SAME context that
had just seen the 404 still returned 404. Worked around in this lane's own
verification by using a fresh `browser.newContext()` per navigation (so
gating logic itself — status 404 unapproved / 200 approved, deck HTML
presence — is verified correctly); the underlying error-response-caching
bug is real and would be user-visible for an organizer approving content
and then hitting reload in the same tab within 60s. Not fixed here.

## (5) Rejection paths [SPEC §6] — REAL DEFECT FOUND AND FIXED (in-authority)

**Found:** a disallowed-extension (`malware.exe`) or over-cap-size upload
against a file_request task threw `ApiError`, which the global
`onError` handler (`src/server/http.ts`) turns into a raw
`{"error":{"code":"invalid","message":"..."}}` JSON response. For a
full-page HTML `<form>` POST (not a fetch/XHR), that meant the browser
navigated to an unstyled JSON blob at the upload endpoint's own URL — not
"a clear on-screen error" by any reading of SPEC §6's requirement.
Reproduced live: POSTing `malware.exe` returned
`400 application/json` body `{"error":{"code":"invalid","message":"File
type '.exe' isn't allowed",...}}`, rendered by the browser as a bare JSON
page, no My Tasks chrome, no styled error.

**Fixed** (owned file: `src/routes/portal/tasks.tsx`): factored the
`/tasks` GET handler's data-loading into `loadTasksPageData`, and changed
the `/upload` route's missing-file and validation-failure branches from
`throw new ApiError(...)` to a `reRenderWithError` helper that re-renders
`TasksPage` inline (HTTP 400, not a redirect) with the field error
attached to the offending assignment row via the already-existing
`errorFor` prop (mirrors the pre-existing, working pattern the
`/tasks/:id/form` route already used for its own validation failures).
Verified live post-fix: both the disallowed-extension upload and a 26 MB
PDF (over the 25 MB doc cap) now stay on `/portal/tasks/:id/upload`
(400, `text/html`, NOT the JSON envelope) and render `My Tasks` with a
`role="alert"` paragraph showing "File type '.exe' isn't allowed" /
"File exceeds the 25 MB cap for .pdf files." respectively. Regression
test added: `test/task-upload-content.test.ts`, new case "disallowed
extension: re-renders /portal/tasks inline with a clear on-screen error,
not the raw JSON error envelope" — asserts 400 + `text/html` + absence of
the JSON error-envelope string + presence of `role="alert"` + the actual
message text.

Served-file content-type check: fetched the speaker's own current
deliverable via its portal download link — `content-type:
application/pdf`, never `text/html`, confirmed on both the valid-file
happy path and after the two rejected uploads (which never reach the
store/serve path at all, so the previously-served valid file's
content-type was re-checked to confirm the rejection paths didn't
regress it).

## (6) Completed file_request task stays speaker-self-service without an organizer reopening it [D4]

After the Completed-task re-upload (step 2) and again after both rejected
uploads (step 5, which correctly did NOT flip status back to Pending),
confirmed the task row still showed: the current file's real download
link (`/portal/tasks/:id/file`, DEC-244, distinct from the organizer
`/files` route), a working "Replace file" re-upload form, and the comment
thread — all without any organizer action. D4 (eval-findings.md Section
D, already DEC-251-fixed) reconfirmed live; no regression.

## Console errors

Zero console/page errors on the organizer context throughout. Two
benign, expected entries on the speaker context: `Failed to load
resource: the server responded with a status of 400 (Bad Request)` x2 —
Chromium's own diagnostic log for a top-level document response that
carries a 4xx status, which is inherent to rendering the on-screen error
inline at 400 (the same status the pre-existing `/tasks/:id/form`
validation-failure path already used before this lane's fix) rather than
silently swallowing the error; not a JS exception, not a defect.

## Files touched (fix authority: portal tasks route)
- `src/routes/portal/tasks.tsx` — `loadTasksPageData` helper (shared by
  GET /tasks and the new inline-error path); `/upload` route re-renders
  `TasksPage` inline (400) instead of throwing `ApiError` to the raw JSON
  envelope on missing-file / disallowed-extension / over-cap-size.
- `test/task-upload-content.test.ts` — new regression case for the above.

`npm run build` clean (dual `tsc --noEmit` + vite build). `npm test`:
187 test files / 1613 tests, all green.

## OPEN ITEMS: 1

- `src/routes/public/index.tsx` (`setCacheHeaders` applied before the
  session-not-found 404 branch) + `src/routes/public/shell.tsx`
  (`setCacheHeaders` definition): the public session-detail 404 response
  carries a 60s public `Cache-Control` header, so a real browser caches an
  unapproved-session 404 client-side and can still show it for up to 60s
  after the organizer approves content in the same tab/session. Not fixed
  — out of this lane's owned-file list (`app/src/pages/Content.tsx`,
  `app/src/pages/content/**`, `src/routes/files.ts`,
  `src/server/repo/files*.ts`, `src/routes/portal/tasks.tsx`). Suggested
  fix for whichever lane owns `src/routes/public/`: move
  `setCacheHeaders(c)` after the 404 checks (or give 404s their own
  short/no-cache header), consistent with `bumpPublicVersionMiddleware`'s
  existing version-salted-cache design for 200s.

## RESULT: PASS — J8 content lifecycle (organizer + speaker) verified
end-to-end with a real chromium browser against fixture personas on event
`devflow-conf-2027`: upload/worklist-Files agreement (CNT-07), version
chaining + real download links (CNT-04), cross-role comment thread order
(CNT-05), content-approval gating of the public raw HTML (CNT-12,
grepped via `page.content()`), and D4 self-service. One real defect found
and FIXED in-authority (rejection-path raw-JSON page instead of an
on-screen error, SPEC §6) with a regression test; one real defect found
and logged as an OPEN ITEM (public 404 caching), out of this lane's fix
authority. `npm run build` and `npm test` green at this lane's HEAD
(516f2b1).
