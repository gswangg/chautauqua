# task-w16-e — triage-closure @ main 5692a6d

Log-only lane (DEC-077): this file and the `docs/verification-log.md`
append are the only writes in this worktree. Branched from `main` at
`5692a6d` ("merge task-w16-b"), i.e. after task-w16-b's walkthrough gate
merged, so its output could be swept per the task.

## 1. `PLANNER:` sweep of merge-commit bodies `0ee30dd..HEAD`

```
git log --format='%h %B' 0ee30dd..HEAD | grep -n 'PLANNER:'
```

One hit, at line 20 of the harvested log — it is inside task-w15-f's own
commit message, reporting the *result* of its own identical sweep
("Harvests merge-commit bodies 0ee30dd..HEAD for PLANNER: notes (none
found; reflog/branch-list re-checked per field guide, no dropped
branches)"). It is prose describing a negative result, not a live
`PLANNER:` marker requiring disposition. Re-running the same sweep at the
current (later) HEAD confirms this remains the only hit and it is the same
w15-f commit body.

**Disposition: no outstanding `PLANNER:` markers exist in the commit log.**
w15-f already closed the three w12-c items (below) before wave-16 began;
wave-16 (a/b) added no new commit-body `PLANNER:` notes.

## 2. The three w12-c items (per DEC-075)

All three were dispositioned as closed by task-w15-f
(`docs/verification-log/task-w15-f-triage-closure.md`) and remain closed
at the current sha:

1. **Co-presenter invites** — `POST /api/v1/submissions/:id/participants`
   (`src/routes/api/submissions.ts:138`, `requireOrganizer` +
   `csrfJson`), backed by `inviteParticipant` in
   `src/server/repo/participants.ts` (DEC-070). Route + repo tests in
   `test/api-participants.test.ts`.
2. **Co-presenter visibility toggle** —
   `PATCH /api/v1/submissions/:id/participants/:participantId`
   (`src/routes/api/submissions.ts:175`), DEC-070. Same test file covers
   the visibility toggle and IDOR rejection (two "cross-org isolation"
   tests at lines 190/259 per task-w15-e's spec-audit).
3. **Cross-org export isolation, all export kinds** —
   `test/exports-cross-org.test.ts` (DEC-075): iterates
   `EXPORT_KINDS` from `src/server/repo/exports.ts` (verified via
   `isExportKind` sanity check at line 79-82) so every export kind is
   covered, not just `submissions`; a separate `describe` block
   (line 101) covers the DEC-055 `showflow.csv` route on its own path.
   All cases assert a 404 for org B's organizer against org A's real
   `eventId`, with a no-op query on the wrong-org path.

**Disposition: closed, cites hold at current sha.**

## 3. Eight external review-lens findings — re-verified at `5692a6d`

All eight were previously verified fixed on `main @ 0ba550c`; re-checked
each cite directly against the file contents at the current sha (some
line numbers shifted by a few lines from the task's hints due to later
commits, but the code and comments are present and unchanged in
substance):

1. **Claim peek-then-consume** (DEC-064) — `src/routes/auth.tsx:192-206`.
   Comment: "DEC-064: peek the record without consuming it. Any
   validation failure below ... must leave the one-time link claimable —
   only consume it right before the user insert." Confirmed present,
   `readClaimToken` called before body/password validation.
2. **Task-upload serving authz** (DEC-065) —
   `src/server/repo/files.ts:216-273`: `getTaskFileScope` (reverse-joins
   `task_assignment.fileId -> task -> event` for org scope, returns null
   when no assignment references the file) and `canAccessTaskFile`
   (organizer org-match; speaker must be the assignment's contact or the
   uploader). Confirmed present and unchanged in substance.
3. **Reviewer file access** (DEC-066) — `src/server/repo/files.ts:119-121`
   (reviewer branch: `return opts?.reviewerAssignedToEvent === true;`)
   and `reviewerHasPlanForEvent` at `files.ts:128-136` (existence check
   against `plan_reviewer` joined to `evaluation_plan` for the event).
   Confirmed present.
4. **Headshot visibility gate** (DEC-067) —
   `src/server/repo/profile.ts:192-224`, `getHeadshotServeScope`: kind
   must be exactly `'headshot'`, reverse-lookup via `contact.headshotUrl`
   pointing back at this fileId (so a superseded upload 404s), and
   `publiclyVisible` reuses `visibleSubmissionConditions()` from
   `repo/public.ts` verbatim. Confirmed present.
5. **Portal-link absolute origin** (DEC-071) —
   `src/routes/comms.ts:247-254` (`origin = new URL(c.req.url).origin`
   passed into `resolvePortalLink`) and `src/routes/api/contacts.ts`
   (`resolvePortalLink` at line 346, `origin` derived the same way at
   line 385, returns `${origin}/portal` or `${origin}/claim/${token}` —
   never a bare relative path). Confirmed present in both files.
6. **Login limiter per-email + per-IP** (DEC-072) —
   `src/routes/auth.tsx:107-130`: two independent
   `checkAndIncrementScopedLimit` calls, one scoped `"login-user"` by
   email, one scoped `"login-ip"` by IP; either failing blocks login (429).
   Confirmed present.
7. **Slot roomId event-scoping** (DEC-073) — `src/routes/agenda.ts:60`
   (`roomBelongsToEvent(c.var.db, body.roomId, ownership.eventId)` guard
   before slot placement) and `src/server/repo/agenda.ts:120`
   (`roomBelongsToEvent` implementation: `and(eq(room.id, roomId),
   eq(room.eventId, eventId))`). Confirmed present.
8. **Portal-edit track validation** (DEC-074) —
   `src/routes/portal/edit.tsx:197`
   (`validateTrackChoice(selectedTrackIds, data.offeredTrackIds)`, only
   when `tracksEditable`). Confirmed present.

**Disposition: all eight remain VERIFIED FIXED at the current sha.**

## 4. Sweep of task-w16-b's walkthrough section

`docs/verification-log.md`'s task-w16-b section and its detail file
(`docs/verification-log/task-w16-b-walkthrough.md`) report a full
J1-J12 run (producer/review/speaker/public/data, 5/16/50/29/20 checks)
with an explicit `grep -n -iE 'FAIL|PLANNER:'` over the full walkthrough
output returning **zero matches**. Independently re-grepped the detail
file for `FAIL` and `PLANNER:` in this worktree: no matches other than
the sentence describing the zero-match grep result itself.

**Disposition: no walkthrough defects to sweep; nothing to disposition.**

## Summary

| # | Item | Disposition | Cite |
|---|------|-------------|------|
| 1 | Commit-log `PLANNER:` sweep | closed (no live markers) | git log 0ee30dd..HEAD (1 hit, prose in w15-f body) |
| 2a | w12-c co-presenter invite | closed | src/routes/api/submissions.ts:138, repo/participants.ts (DEC-070) |
| 2b | w12-c visibility toggle | closed | src/routes/api/submissions.ts:175 (DEC-070) |
| 2c | w12-c cross-org export isolation | closed | test/exports-cross-org.test.ts (DEC-075) |
| 3.1 | claim peek-then-consume | verified fixed | src/routes/auth.tsx:192-206 (DEC-064) |
| 3.2 | task-upload serving | verified fixed | src/server/repo/files.ts:216-273 (DEC-065) |
| 3.3 | reviewer file access | verified fixed | src/server/repo/files.ts:119-136 (DEC-066) |
| 3.4 | headshot visibility gate | verified fixed | src/server/repo/profile.ts:192-224 (DEC-067) |
| 3.5 | portal_link absolute origin | verified fixed | src/routes/comms.ts:247-254, src/routes/api/contacts.ts (DEC-071) |
| 3.6 | login limiter per-email+IP | verified fixed | src/routes/auth.tsx:107-130 (DEC-072) |
| 3.7 | slot roomId event-scoping | verified fixed | src/routes/agenda.ts:60, repo/agenda.ts:120 (DEC-073) |
| 3.8 | portal-edit track validation | verified fixed | src/routes/portal/edit.tsx:197 (DEC-074) |
| 4 | w16-b walkthrough sweep | nothing found | docs/verification-log/task-w16-b-walkthrough.md |

All rows closed with a cite. No code changes made (log-only lane,
DEC-077).

OPEN ITEMS: 0
