# task-w1-e — speaker + content browser persona pass @ 1e08bc8

DEC-254 lane: J6 onboarding + J7 portal + J8 content, driven with a real
Playwright/chromium browser against a freshly migrated+seeded `npx wrangler
dev --port 8805` in this lane's own worktree/branch (`task-w1-e`, cut from
`main` @ `1e08bc8`, "merge task-w1-h"). Fixture personas from
`docs/fixtures/sample-data.json` against event `devflow-conf-2027`.

Note for the scribe: this worktree (and its uncommitted work, twice) was
wiped down to an empty directory containing only `.wrangler/` by something
outside this agent's control, mid-run, on two separate occasions (once
after the organizer/speaker checks were done but before Content checks;
once again after the Content fix was written but before this log was
committed). Each time, `git -C .../chautauqua worktree list` showed the
worktree and its branch gone entirely (not just the files) — not a `git
clean`, since `.wrangler/` — a gitignored dir — survived both times. Losing
even the branch ref (not just checked-out files) means only committed,
still-referenced work survives; this lane recovered by re-running
`git worktree add ... -b task-w1-e main` against main's then-current tip
and redoing the affected steps. Flagging so the swarm can look at whatever
process is pruning active worker worktrees/branches — it cost real
re-work time on this task and could silently drop uncommitted diffs on
other lanes.

## Organizer: accept + onboarding tasks + reminders (J6) [CNT-01, CNT-07]

Logged in as `sbek-organizer@example.com`. Accepted a previously-pending
submission (SES-002, "Your AI Pair Programmer Is Lying to You", speaker
Marcus Okafor / `sbek-speaker2@example.com` — chosen because that contact
had zero pre-existing task_assignment rows, unlike the fixture speaker who
already has an accepted submission from seed). Verified via direct D1
query that exactly 5 `task_assignment` rows were created (Hotel stay
requirement form, Flight reimbursement form, Finalize talk description,
Finalize bio + headshot, Announce participation) matching
`DEFAULT_ONBOARDING_TASKS`. Re-accepted (toggled status pending -> accepted
again in the same submission-detail `<select>`, exercising the
DEC-079/DEC-009 "planning runs before the accepted_at commit, only on
first transition" path) and re-queried: still exactly 5 rows, same ids —
confirmed idempotent/exactly-once, no duplicates on re-accept.

Worked the Speakers onboarding grid (`/admin/speakers`): per-speaker x
per-task status cells render correctly (Pending/Complete pills), due dates
shown per task column header, Task/Status filters and the Overdue-only
checkbox all behave correctly (Task+"Any status" leaves all rows since
every speaker has a cell for that task; Overdue-only correctly showed "No
speakers match the current filters" since none of the seeded due dates are
in the past relative to the demo's fictional 2027 event). Clicked "Remind
everyone outstanding" -> confirmation modal ("This will email 10 contacts
with outstanding tasks. Continue?") -> Confirm and send. Checked
`/dev/mailbox`: 10 new "Action needed: outstanding tasks for DevFlow Conf
2027" rows appeared (`sent` status). Opened one detail page
(`/dev/mailbox/:id`): both Text body and HTML body render correctly,
listing the recipient's actual outstanding task titles and earliest due
date — `You have outstanding tasks for DevFlow Conf 2027: Hotel stay
requirement form, Finalize bio + headshot, Announce participation (due
2027-04-07).` CNT-01/CNT-07 both confirmed working.

## Speaker: file-request task, profile, invitation, scoping (J7) [SPK-07, SPK-08, CNT-02, CNT-03]

Logged in as `sbek-speaker@example.com` / `SbekTest!2027-spk` (Priya
Raman). On `/portal/tasks`, uploaded `docs/fixtures/slides.pdf` to the
"Finalize bio + headshot" file_request task -> task flips to Completed,
and the completed row still shows: a working download link (`GET
/portal/tasks/:id/file` -> 200, `content-type: application/pdf`,
`content-disposition: attachment`), a "Replace file" re-upload form, and a
comment box. Posted a comment as the speaker; it round-tripped and
rendered. Re-uploaded (Replace) -> version bumped 1 -> 2, comment thread
correctly followed the chain-latest file id (DEC-244). SPK-07 confirmed.

On `/portal/profile`: edited bio, Twitter, and GitHub fields, saved ->
persisted (confirmed by page reload showing the new values). Uploaded
`docs/fixtures/headshot.png` -> `?headshot=1` redirect, "Headshot
uploaded." status banner, and an updated `<img>` preview at the new
`/headshots/:id` URL (DEC-245/DEC-251 D3 confirmed still working). Cross-
checked both surfaces: the admin Contacts record and the public speaker
page (`/e/devflow-conf-2027/speakers`) both show Priya Raman with the new
headshot URL. CNT-02/CNT-03 confirmed.

Session invitation: as organizer, added Priya as a co-presenter to SES-002
(Marcus's talk), producing an `invite_status='invited'` participant row.
As Priya, `/portal` showed "Invited to co-present ... (SES-002)" with
Accept/Decline forms; clicked Accept -> invitation disappeared from the
pending list and SES-002 appeared under Sessions. Separately invited
speaker2 (Marcus) to SES-003 and declined as Marcus -> invitation cleared
without accepting. Both accept and decline paths verified.

Absolute scoping (SPK-08): as Priya, direct `fetch()` (session cookies,
`redirect: 'manual'`) against speaker2's own task-assignment ids returned
`403` for both `GET .../form` and `GET .../file` (existence-hiding via
403, matching the already-ratified DEC-175 speaker-lens contract re-
verified here, not a bug — task-assignment/file cross-speaker access is
403 by design, not 404; only cross-*submission* portal reads use 404
existence-hiding). `GET /admin` as a speaker session -> `302` to
`/portal`. `GET /api/v1/events/:id/submissions` (organizer-only API) as a
speaker session -> `403`. All consistent with DEC-175; no regression
found.

Logged (not fixed, out of this lane's file authority — `app/src/pages/
submissions/SubmissionDetailPage.tsx` / `src/routes/api/submissions.ts` /
`src/server/repo/participants.ts`): adding a co-presenter via the
submission-detail "Add co-presenter" search renders a participant row with
blank Name/Email cells until the next page load, because `POST
/submissions/:id/participants`'s 201 response (used to optimistically
append to the client's `participants` array) doesn't include the
contact's name/email, only id/contactId/role/order/visible/inviteStatus.
Cosmetic (a reload/refetch shows it correctly; the DB write is correct),
but worth a follow-up ticket. Also logged, same reason (not this lane's
files): Contacts search (`/admin/contacts`) treats the search box as a
single-field substring filter — searching "Priya Raman" (first + last)
returns zero rows even though "Priya" alone finds two contacts named
Priya Raman; a multi-word full-name search doesn't currently work.

## Organizer: Content — Files/worklist agreement, versions, comments, gating (J8) [CNT-04, CNT-05, CNT-12]

Confirmed today's speaker upload (the slides.pdf from the task above,
attributed to SES-001 per `resolveDeliverableSubmissionId`'s "lowest-seq
accepted submission for this contact" rule, DEC-240) appears in BOTH the
Content > Files tab (row `slides.pdf`, Kind Presentation, Session SES-001,
Speaker Priya Raman, Versions 1 initially) AND the Worklist's per-kind
counts (SES-001's Presentation count reflects it) — the two views agree;
docs/eval-findings.md section C's disagreement is fixed and re-confirmed
here. Re-uploaded (Replace) to mint v2 of that same task-upload chain.

**Found and fixed a real defect while checking the version chain** (files
in this lane's authority: `app/src/pages/content/version-chain.ts`,
`app/src/pages/content/VersionList.tsx`, plus new/updated tests
`version-chain.test.ts`, `VersionList.render.test.tsx`). SES-001's
Presentation deliverable group has TWO independent `previousFileId`
chains: the seed's own 2-version `slides-v1.pdf`/`slides-v2.pdf` chain,
and the new 2-version `slides.pdf` chain from the task upload above (the
grouping code, `groupByKindNewestFirst`, correctly and intentionally
tolerates multiple independent chains per kind — see its doc comment).
`VersionList`'s label, however, was computed from flat array index across
the WHOLE concatenated 4-file list (`` `v${versions.length - idx}` ``),
which mislabeled the two genuinely-unrelated 2-version chains as one fake
4-version lineage ("Latest", "v3", "v2", "v1") — implying the task-upload
chain's files were older versions of the *same document* as the seed
chain, when they're unrelated files that both happen to be presentations
for the same submission. Fixed by adding `orderVersionChains` (same
traversal as `orderVersionsNewestFirst`, but returns the chains as
separate arrays instead of one flattened list) and rewriting `VersionList`
to number each chain independently, reserving "Latest" for only the
single overall-newest file; other chains' heads get their own top version
number (e.g. "v2"), never "Latest". Verified live in-browser
post-fix: the seed chain now correctly shows "Latest" / "v1", and the
separate task-upload chain shows its own "v2" / "v1" — no cross-chain
mislabeling. Added a `version-chain.test.ts` case
("keeps independent chains separate...") and a new
`VersionList.render.test.tsx` (3 cases, including the exact two-chain
scenario found live) as the regression tests; both v1/v2 in each chain
remain independently downloadable (`/files/:id` links unchanged).

Producer comment / speaker reply (DEC-244 "one thread, two surfaces"):
posted an organizer comment via `/api/v1/files/:id/comments` on the task-
upload chain's current chain-latest file id (the same id the speaker
portal's file_request panel targets); reloaded `/portal/tasks` as the
speaker and confirmed the organizer's comment rendered in the same
thread, then posted a speaker reply and confirmed it appeared alongside
it. Note: the *admin* DeliverableDetail UI's own comment section binds to
`grouped[kind][0]` (the group's overall newest chain-head), which in this
specific demo run is the seed chain (its fixture timestamps are dated
into the fictional future event month, Jan 2027, which sorts newer than
today's real 2026 wall-clock uploads) rather than the just-uploaded task
chain — a seed-data timestamp artifact of this demo dataset, not a code
defect: in a real deployment all uploads share one real clock, so a
freshly task-uploaded file is always the actual newest and the two
surfaces coincide as DEC-244 intends. Not fixed (nothing to fix; flagging
for awareness only, in case a future seed touch-up wants uploaded-content
timestamps kept below any fixture "future event" dates).

Content approval gating (CNT-12): before approving, SES-003's public
detail page (`/e/devflow-conf-2027/sessions/seed_submission_0003`)
returned 200 but did not include the session ("Docs That Answer Back" not
present in that page's own accepted-and-approved list — public detail
pages 404/omit ungated sessions rather than 500). After clicking "Approve
content" on the submission detail page, `content_status` flipped to
Approved and the same public URL now renders the session. Content
approval gates the public sessions page as required.

## Files touched (fix authority: content/*)
- `app/src/pages/content/version-chain.ts` — added `orderVersionChains`
- `app/src/pages/content/VersionList.tsx` — per-chain version numbering
- `app/src/pages/content/version-chain.test.ts` — regression case
- `app/src/pages/content/VersionList.render.test.tsx` — new render tests

`npm run build` clean (dual `tsc --noEmit` + vite build). `npm test`:
187 test files / 1602 tests, all green.

## OPEN ITEMS: 0

(Two out-of-authority defects logged above for other lanes/a follow-up:
the co-presenter-add blank-name-until-reload cosmetic issue in
`SubmissionDetailPage.tsx`/`api/submissions.ts`/`repo/participants.ts`,
and the Contacts multi-word full-name search miss — neither blocks this
lane's own J6/J7/J8 scope, both logged for visibility only, not counted as
this lane's open items since they're in files this lane has no fix
authority over.)

## RESULT: PASS — organizer onboarding/reminders (J6), speaker
portal/profile/invitations/scoping (J7), and organizer Content
review/versioning/comments/approval-gating (J8) all verified working
end-to-end with a real chromium browser against fixture personas on event
`devflow-conf-2027`. One real defect found and fixed in-scope (Content
version-chain mislabeling across independent chains, with regression
tests); `npm run build` and `npm test` green at this lane's HEAD.
