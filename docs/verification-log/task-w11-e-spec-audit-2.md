# 2026-08-10 task-w11-e — spec-audit @ 3b7ed3d

Full detail for the `## 2026-08-10 task-w11-e — spec-audit @ 3b7ed3d` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `RESULT` summary).

DEC-115's `d`/`e`/`f` gates chain behind `task-w11-a` (SHA `3b7ed3d`,
"merge task-w11-a" — the DEC-113 walkthrough re-land of DEC-112's
probes, the only file touched is `scripts/walkthrough/speaker.ts`, which
is code-bearing script content, not name-only). Per DEC-091/DEC-114 this
merge is the newest code-bearing sha on `main` as of this run — no
commit since it changes anything other than the walkthrough script, and
that script change is itself code-bearing (new probe assertions), so
`3b7ed3d` is the sha this spec-audit is scoped to. This is a log-only
lane per DEC-077: no product/test/script/config changes were made by
this task.

This run specifically re-verifies the wave-9/10 landings named in the
task brief, reading the tree at `3b7ed3d` directly (not relying on
prior log prose):

**DEC-108 invite gate — `src/server/repo/public.ts`.** The shared gate
`visibleSubmissionConditions()` (lines 32-40) includes
`inArray(schema.participant.inviteStatus, ["none", "accepted"])` at
line 38, alongside `submission.status='accepted'`,
`submission.contentStatus='approved'`, `participant.visible=true`. The
standalone speaker-hydration query in `hydrateSessions` (the function
does not call `visibleSubmissionConditions()` since it hydrates an
already-visibility-checked id list) repeats the same
`inArray(schema.participant.inviteStatus, ["none", "accepted"])` clause
at line 239, inside the `speakerRows` query's `where(and(...))`, next to
`eq(schema.participant.visible, true)`. Both sites match the DEC-108
text and the SPEC §9 public-visibility requirement (only speakers who
never needed to accept, or who accepted, appear on public/embed
surfaces). Confirmed: `src/server/repo/public.ts:38`,
`src/server/repo/public.ts:239`.

**DEC-109 stored-file-answer carry-over — `src/routes/portal/edit.tsx`.**
Lines 61-65: file-kind fields never read submitted body values; the
stored answer (if any) is carried over so validation sees the existing
file rather than a missing one. Lines 201-205: `required` is forced to
`false` only for `f.kind === "file"` fields
(`data.fields.map((f) => (f.kind === "file" ? { ...f, required: false } : f))`)
before running validation in the portal-edit path — the comment at
lines 202-203 states public submit's `validateAnswers` still enforces
required files, and a scan of `src/forms/validate.ts` confirms no
file-kind special-casing exists there (its required check applies
uniformly to all field kinds), so the public submit path's file
requiredness is untouched by this portal-edit-only forcing. Confirmed:
`src/routes/portal/edit.tsx:61-65`, `src/routes/portal/edit.tsx:201-205`;
`src/forms/validate.ts` unmodified by DEC-109.

**DEC-110 rules JSON escaping — `src/views/form-render.tsx`.** Line 145:
`safeJson = json.replace(/</g, "\\u003c")` before line 176 embeds it via
`<script type="application/json" ... dangerouslySetInnerHTML={{ __html: safeJson }} />`;
the companion inline-JS `<script>` at line 177 is static template
content (no interpolated user data), so no separate escaping is needed
there. The CFP-03 conditional-visibility logic (`apply()`/`matches()`,
lines 154-172) reads the escaped rules JSON at runtime and toggles field
wrapper `display` and `required`, matching SPEC's conditional-logic
requirement. Confirmed: `src/views/form-render.tsx:145`,
`src/views/form-render.tsx:176-177`.

**DEC-111 backing forms + self-heal — `src/server/repo/submissions/status.ts`,
`src/domain/acceptance.ts`.** `status.ts` line 16 imports
`FORM_TASK_FIELD_SPECS`/`planAcceptance` from `../../../domain/acceptance`
and line 19 has a `void DEC_111;` compile-checked tripwire comment.
`getOrCreateFormTaskForm` (around line 36) creates the form with
`isDefault: false` and null open/close (line 41 area). The self-heal
path (lines 78-82): when an already-existing 'form' task is found with a
null `formId`, `getOrCreateFormTaskForm` is called and the task row is
updated in place (`db.update(schema.task).set({ formId, updatedAt: now })`).
No `mail`/mailer import anywhere in `status.ts` (only the DEC-009
invariant comments at lines 1, 5, 104, 163 reference it in prose) —
grep for `mail` in both files turns up zero import statements, only
comments; `domain/acceptance.ts` line 3 states in its own header comment
that it performs no I/O and no email, consistent with the pure-core
DEC-002 boundary (`src/domain/*` importing nothing from `node:`/
`cloudflare`). `FORM_TASK_FIELD_SPECS` (line 40 of `acceptance.ts`) is
plain data, no I/O. Confirmed: `src/server/repo/submissions/status.ts:16,
19, 36-41, 78-82`; `src/domain/acceptance.ts:3, 40`; zero mail imports in
either file.

**DEC-099 pubcache hit-path — `src/server/pubcache.ts`.** Line 49:
`CLIENT_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300"`;
line 87 re-serves cache hits with this header
(`restored.headers.set("Cache-Control", CLIENT_CACHE_CONTROL)`), while
the stored-copy-only override `CLIENT_CACHE_CONTROL_OVERRIDE =
"public, max-age=86400"` (line 44) is applied only when writing to the
underlying Cache API store (line 94), never returned to a client.
Confirmed: `src/server/pubcache.ts:44, 49, 87, 94`.

**DEC-100 atomic seq subquery — `src/server/repo/submissions/seq.ts`,
both call sites.** `submissionSeqSubquery(eventId)` builds
`(SELECT COALESCE(MAX(seq), 0) + 1 FROM submission WHERE event_id = ?)`
as a single `SQL<number>` fragment (lines 8-14), threaded straight into
the INSERT's `seq` column — no SELECT-then-INSERT race window. Both
production call sites confirmed: `src/server/repo/submit.ts:168` (new
public submission INSERT) and `src/server/repo/submissions/create.ts:59`
(new submission) and `:102` (duplicate/withdrawn re-submit path) — three
call sites total, all via the one shared helper, matching the task
brief's "both call sites" (submit.ts and submissions/create.ts as the
two *modules*).

**DEC-101 six-FK merge + dedupe — `src/server/repo/contacts.ts`.**
`buildMergeRepointOps` (lines 175-184) returns repoint ops for exactly
six tables: `participant, task_assignment, email_log, user, file,
file_comment` — matching DEC-101's text verbatim (the four-table
DEC-026 list plus `file.uploaded_by_contact_id` and
`file_comment.author_contact_id`). `mergeContacts` (lines 473-534)
applies them in the documented load-bearing order: dedupe-delete
same-submission `participant` duplicates first (lines 494-512, keyed off
`keepSubmissionIds` computed from the keep contact's existing
participant rows, chunked via `chunkIds` per DEC-078/104), then all six
repoints via a `for (const op of ops)` switch (lines 514-531), then the
merged-contact row delete (line 534, confirmed by the surrounding
function). Same-submission participant dedupe runs strictly before the
participant repoint, preventing a UNIQUE-violation on
`(submission_id, contact_id)`. Confirmed:
`src/server/repo/contacts.ts:175-184, 473-534`.

All decision constants referenced above (`DEC_099`, `DEC_100`,
`DEC_101`, `DEC_108`, `DEC_109`, `DEC_110`, `DEC_111`) are present and
compile-checked in `src/decisions.ts` (lines 104-106, 113-116) and are
`void`-referenced or otherwise imported at their landing sites (e.g.
`status.ts:16,19`), so the DEC-NNN -> `src/decisions.ts` binding this
project requires holds for every decision this audit re-verified.

No inconsistency, drift, or missing citation was found against SPEC.md
§8/§9 or docs/clarifications.md for any of the seven re-verified items.
This is a re-confirmation run, not a first landing — task-w11-a's only
change was to `scripts/walkthrough/speaker.ts` (runtime probes), so none
of the seven source files audited here differ from their state at the
prior wave-10/11 spec-audit passes; this run independently re-read each
file at `3b7ed3d` rather than trusting prior log prose, per DEC-091.

RESULT: PASS
