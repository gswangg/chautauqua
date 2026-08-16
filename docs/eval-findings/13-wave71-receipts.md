# Wave 71 receipts (docs-only lane, task-w71-j)

Runtime: main at `96496eaa` ("merge task-w70-e") in this worktree at the time
of this read. Per DEC-069 wave 71 is a CODE wave, so this lane files no
`docs/verification-log/index/` section — this file is the whole deliverable.
Every citation below was re-derived against that tip, not copied from the
planner's brief; line numbers are noted where they drifted.

## Section 1 — closures re-read CLOSED at this runtime

1. **GATE-11 small #1, "Skipped: unknown"** — CLOSED. `app/src/pages/review/ProgressPanel.tsx:22-49` (`formatReminderResult`) builds the result line from `sent`/`skipped`/`remaining`, all three typed as required (non-optional) on the closed `ReminderResult` interface per the DEC-238 (wave-66 amendment) comment at the same lines. No "unknown" branch exists.

2. **GATE-11 small #2, comms TEMPLATE cell "—"** — CLOSED. `app/src/pages/comms/RecentSends.tsx:300` renders a real `Template` column head, and `:313-314` computes `templateLabel` from `batch.templateId`/`templatesById`. `app/src/pages/comms/ComposeWizard.tsx:915-935` (`onChange` for the template `<select>`) calls `setTemplateId(found.id)` on every template pick per the DEC-832/DEC-846 (wave-66) comment inline, so a template-based send carries its provenance through to History.

3. **GATE-11 small #3, API-tokens + deep-link remainder** — CLOSED. `app/src/pages/settings/YourDataPanel.tsx:198` (summary rows) and `:224` (`<ApiTokensPanel />` in the edit branch) both carry the API-tokens row. `app/src/pages/settings/PortalSettingsPanel.tsx` reads `editing = searchParams.get('section') === SECTION_KEY && searchParams.get('edit') === '1'` (~:109) and the edit branch renders a writable `<ResourcesPanel />` inside `SettingsEditForm` at the tail of the component (confirmed at the file's closing `</SettingsEditForm>` block, ~:320). A `?section=portal&edit=1` deep link opens the real edit branch.

4. **GATE-10, ProgressPanel two reminder scopes on one surface** — CLOSED. `ProgressPanel.tsx` has "Remind laggards (N)" in the toolbar (~:200-208, disabled-when-zero per DEC-733) and a separate "Remind the N not started" link inside the section head (~:217-232, absent-when-zero per DEC-760/DEC-733) — two distinct reminder actions with two distinct populations, on the one ProgressPanel surface, exactly as filed.

5. **User-filed DEC-817 api*-verb scan gap** — CLOSED. `test/spa-mutation-contract.scan.test.ts:340`: `const CALL_NAME_RE = /\b(apiGet|apiList|apiPost|apiPatch|apiPut|apiDelete|apiUpload|apiPostBlob)\b/g;` — all eight call names are in the scan's regex.

6. **design/README.md:226-232, two composer actions on content notes** — CLOSED. `src/routes/content-notes.ts` accepts `requestChanges: boolean` (:78-81) and mails every resolved participant regardless of that flag (`for (const participant of participants) { ... mailer.send(...) }`, :172-200) — the flag only gates a status move to `changes_requested` (:116-118) and the mail `reason` string's clause (:190). Both composer actions (note-only, note+status-change) go through the same one send loop.

7. **design/README.md:261-271, pipeline card age / decline reason / fit+rationale** — CLOSED. `src/server/repo/pipeline.ts` declares `declineReason: string | null` (~:144) and `fitScore`/`rationale` (~:146-147) on the pipeline entry projection, with `declineReasonByEntryId` populated from the newest move-to-declined activity (~:241). `app/src/pages/contacts/PipelineBoard.tsx` renders the fit pill/rationale inline (~:193-196, ~:554-564) and a fit-only PATCH dialog (`saveFit`, ~:193) that never touches `stage`.

8. **design/README.md:275-284, saved-embed anatomy** — CLOSED. `app/src/pages/settings/SavedEmbedsPanel.tsx`: the on/off count line (~:179-180), the "Turning one off breaks it wherever it is pasted" caption (~:180-182), the per-row recipe built through the one shared `formatEmbedRecipe` (~:199-221), the fixed-width name/path cell (~:255), and the toggle-off `ConfirmDialog` explaining the permalink stops serving but the recipe/name/code survive (~:321-323) are all present.

9. **design/README.md:100-118, the anonymous event hub** — CLOSED. `src/routes/root.tsx` renders the three grouped sections when `state === "full"`: "Open for submissions" (`sections.openCfp`, ~:355-365), "Programme published" (`sections.published`, ~:367-376), "Already happened" (`sections.past`, ~:378-386). `/admin` and `/admin/*` (:83-100) handle the authenticated redirect/404 paths separately, consistent with the anon hub being the unauthenticated `/` surface.

10. **design/README.md:211, per-person remind** — CLOSED. `app/src/pages/speakers/SpeakerDetailPage.tsx` passes `{ contactIds: [detail.contact.id] }` to both `POST /events/:id/onboarding/remind/preview` (~:163) and `POST /events/:id/onboarding/remind` (~:190) — the single-speaker detail page reaches the same per-person remind endpoints the roster's bulk action uses, scoped to one contact.

All ten rows in Section 1 are CLOSED as of `96496eaa`; none needs a lane.

## Section 2 — DO-NOT-CHASE: ruled contradiction, portal-invite status write

`docs/design/README.md:314` (unchanged at this runtime): "Send portal invite... sets this to Invited." This literal sentence is FALSE against the shipped behavior, and it is FALSE ON PURPOSE — `decisions/DEC-830.md` rules the menu's "Send portal invite" row is an ACTION that writes NO participation status (the four named states — Not invited/Invited/Confirmed/Declined — are the only status writers; the invite send stays DEC-805's existing send with one writer). `decisions/DEC-830.md`'s wave-19 amendment even names the exact defect the README sentence tries to restate: "the one row that SENDS is the only row that does not state its consequence — the exact thing DEC-830's title promises" (build renders no caption on that row; the vendored frame's caption is "Emails a claim link and sets this to Invited", which the title amendment says outranks a research render but does not require a literal status write).

`app/src/pages/speakers/ParticipationMenu.render.test.tsx:1-7` states this in its header comment (DEC-830: "the portal invite is an ACTION in that menu, not a state it writes") and `:111` (`it('the "Send portal invite" action item POSTs to /portal-invites and never PATCHes a status'...)`) pins the behavior with a real render/mock assertion.

Precedence: `decisions/` binds over `docs/design/README.md` (design docs are vendored source, decisions/ is the synthesized authority per docs/README.md precedence rules). Record: this is a RULED CONTRADICTION, not an open defect. Do not re-file it as a bug against `README.md:314`; the correct reading is DEC-830's ruling, and the design README sentence is stale prose that decisions/ has already overridden.

## Section 3 — namespace trap (this repo shares its git history with an earlier campaign)

`.git/packed-refs` in `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua` carries `refs/heads/task-w71-a`, `task-w71-c`, `task-w71-d`, `task-w71-e`, and `task-w72-a` through `task-w72-j` — all residue of an EARLIER campaign that shares this repository and reached wave 72 before this campaign existed. Because those branch names are already taken, wave 71 of THIS campaign used the suffixes `-b/-f/-g/-h/-i/-j` instead of the natural `-a` through `-j` run.

The same collision reaches `decisions/`: an `## Amendment (wave N)` heading is not unique by wave number in this repo. At this runtime:
- `decisions/DEC-010.md:9` already carries `## Amendment (wave 71)` — and it is on THIS campaign's own subject (the conflict engine seeing breaks), not a stale one, so a naive "grep for wave 71 -> assume foreign" heuristic would have wrongly skipped it.
- `decisions/DEC-022.md:17`, `decisions/DEC-029.md:5`, `decisions/DEC-056.md:9`, and `decisions/DEC-557.md:9` also carry `## Amendment (wave 71)` headings, each on this campaign's own current subject matter (break-in-place editing, resource title editability, public docs coverage, conflict participant lists).

Rule for every future lane before filing a `## Amendment (wave N)` heading on any `decisions/DEC-*.md`: grep the target DEC file for an EXISTING `## Amendment (wave N)` heading at your own wave number first. If one already exists, read it in full — it may already be this campaign's own content (as with all five DECs above), in which case do not duplicate it; append your finding as prose under the existing heading, or use the next available heading only if the existing one is genuinely a different subject.

Separately, and worth recording precisely because it is easy to miss: `decisions/DEC-358.md` itself already carries an `## Amendment (wave 71)` heading (at `:124`, landed in commit `617f7a22` "Wave 69 mandate hygiene: receipts file + DEC-358 amendment", present on main since before this lane started work). Its content is this exact namespace-collision finding (branch suffixes `-b/-f/-g/-h/-i/-j`, the five DEC files above, and a summary of ruled rows). This lane's task brief asked to "file `## Amendment (wave 71)` on decisions/DEC-358.md," but that amendment was already filed by an earlier lane in this same wave — re-filing it would be a second `## Amendment (wave 71)` heading on the same file for the same subject, which Section 3's own rule (above) says not to do. This receipts file records that closure instead of duplicating the amendment. **No edit was made to `decisions/DEC-358.md` by this lane.**

## Section 4 — wave-70 fence: branch state re-derived at this runtime

At plan time all seven wave-70 branches were reported as sitting at their base commit with zero commits. Re-derived against `.git` in this worktree (base for all seven is a commit at or before `5305cc7c`/`1b998068`):

- `task-w70-a` (requireCookieSession on POST /account/password + credential-primitive scan) — **zero commits ahead of main**; the scope landed directly on `main` as commit `2b48e132` ("DEC-027 wave-70 amendment: requireCookieSession on POST /account/password") and `main` already carries `merge task-w70-a` (`b7455940`). MERGED. Do not re-file.
- `task-w70-b` (getTaskFileScope deterministic authz) — zero commits ahead; landed on main as `6227eda4` ("DEC-248 wave-70 amendment..."), `merge task-w70-b` (`8ef5d4e6`) present. MERGED. Do not re-file.
- `task-w70-c` (`src/lib/fanout.ts` bounded send pool) — zero commits ahead; landed on main as `b1653fdd` ("Mail fan-out write side: worker-pool concurrency for five send loops (DEC-530 wave-70)"), `merge task-w70-c` (`44fd92e5`) present. MERGED. Do not re-file.
- `task-w70-d` (contacts drawer Save clipping + organizer co-presenter copy) — zero commits ahead; landed on main as `4b1a3fc8` ("Contacts drawer footer never clips + co-presenter door names its non-effect"), `merge task-w70-d` (`75d18bf2`) present. MERGED. Do not re-file.
- `task-w70-e` (seed duplicate personas) — zero commits ahead; landed on main as `1445ce95` ("DEC-823 wave-70 amendment: remove vestigial Priya/Marcus near-dup contacts"), `merge task-w70-e` (`96496eaa`, main's current tip in this worktree) present. MERGED. Do not re-file.
- `task-w70-f` (TaskKind one vocabulary) — **carries one real commit NOT reachable from main**: `96c29262` ("DEC-613 wave-70 amendment: task-kind is one vocabulary, declared once"), adding `src/domain/task-kinds.ts` and `app/src/pages/speakers/task-kind-parity.test.ts`. `git merge-base --is-ancestor task-w70-f main` returns false. **STILL UNMERGED** as of this runtime. Do not re-file this scope — it exists and is committed, only not yet merged.
- `task-w70-g` (wave-70 receipts) — zero commits ahead of its base and zero commits anywhere in `--all` history; no `docs/eval-findings/12-wave70-receipts.md` exists anywhere in the repo (`git log --all --oneline -- docs/eval-findings/12-wave70-receipts.md` returns nothing, and no file by that name exists in the working tree on any branch checked). The field guide's wave-70 entry cites `docs/eval-findings/12-wave70-receipts.md` as though it landed, but at this runtime **that file does not exist anywhere in this repository's history**. Flagging this as a gap for the scribe: either the wave-70 receipts lane never produced its file, or it produced content that was never committed. This lane does not create `12-wave70-receipts.md` — that filename is reserved for the wave-70 lane's own single-owner deliverable per DEC-358, and this lane's own file (`13-wave71-receipts.md`) is a different filename by design so it cannot collide.

Summary: six of seven wave-70 branches (`-a,-b,-c,-d,-e,-g`) are settled — five merged, one (`-g`) empty with no artifact anywhere. One (`-f`, TaskKind vocabulary) has real unmerged work still pending a merge. No wave-70 scope was re-filed or re-implemented by this lane.
