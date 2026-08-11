# task-w8-f - triage-closure @ 80b811d

FROZEN SHA: 80b811d250285de0d37417ddc12f65445ce27f96

## Protocol

Worktree #1 (this lane's own branch worktree, cut from `main`) verified
`git merge-base --is-ancestor 80b811d250285de0d37417ddc12f65445ce27f96
refs/heads/main` returns 0 (ancestor confirmed). A second, detached
worktree at the observed `refs/heads/main` tip
(`50354380d299969b12d0b46548cb77d28e861c9d`) was used only to re-check the
two DEC-285 known-in-flight rows and confirm no other file:line evidence
had drifted; every other row below was read directly against the frozen
sha `80b811d250285de0d37417ddc12f65445ce27f96` in worktree #1. No product
code, tests, decisions/, field-guide/, or docs/eval-findings.md was
touched by this lane. `npm run predev` was re-run once in worktree #1
purely to mechanically confirm `public/admin/index.html` is produced
(closing fresh-clone OPEN ITEM #1 below) — no source file was edited.

## Sources read (campaign-2, sha ancestor-confirmed per DEC-129)

`task-w2-a-build-test.md` (S=`e330aef...`, ancestor: yes),
`task-w2-e-spec-audit.md` (S=`e002bc9...`, ancestor: yes),
`task-w2-f-triage-closure.md` (S=`e4e7b03...`, ancestor: yes),
`task-w3-a-c2-wave2-closeout.md` (S=`f3d0140...`), `task-w3-c-c2-content-
browser.md` (HEAD `516f2b1`), `task-w4-e-c2-rubric-coverage.md` (commit
`0da9876`), `task-w4-f-c2-fresh-clone.md` (commit `e522a6f`), plus
`task-w7-c-pre-battery-gate.md` (MAIN SHA AT START: `80b811d...` — this is
the DEC-284 pre-battery gate lane mid-run arrival the task scope
anticipated; it landed on `main` as commit `5f54097` inside the POST-S
DELTA, is GREEN with 0 open items, and is cited below only as CLOSING
evidence, not as a new open-item source), and `docs/eval-findings.md`
(still exactly sections A-D at S — `grep -n '^## [A-Z]\.'` returns only
A/B/C/D — nothing new to disposition beyond what `task-w2-f` already
restated CLOSED/WAIVED).

**Excluded as first-campaign homonyms (DEC-129, no `FROZEN SHA:` / wrong
sha family):** `task-w2-d-interim-gate.md`, `task-w2-e-findings-
closure.md` (both confirmed by `task-w3-a`'s own homonym check — no
`FROZEN SHA:` line, pre-dates DEC-256), `task-w3-a-wave2-closeout.md`
(no `-c2-` infix; different content), `task-w3-b/d/e/g` non-`-c2-`
duplicates, and every `task-w[5,6,7,9,11-27]-*.md` file whose heading sha
is not an ancestor of `80b811d` (spot-checked `task-w5-b/c/e` and `task-
w7-a/b/c/d/e`: all cite DEC-091/094/096/102-family decisions and sha
families disjoint from this campaign's `de2da75`.. lineage — first-
campaign homonyms, excluded). No other `task-w[5-7]-*-c2-*.md` file exists
in the tree at S (glob returns only `task-w7-c-pre-battery-gate.md`,
already included above).

## Adjudication — one row per OPEN ITEM

| item | source file:line | verdict |
|---|---|---|
| S drifted mid-gate (`de2da75d..`→`1e08bc84e7..`) during build+test | task-w2-a-build-test.md:131-141 (OPEN 1) | CLOSED — superseded: `task-w7-c-pre-battery-gate.md` (commit `5f54097`, in this campaign's ancestry) runs `npm ci`+`build`+`test`+`bundle:check`+`gate:render-sweep` as one atomic pass at a single frozen `main` sha (`80b811d`) with 0 drift and GREEN verdict, which is exactly the coherence this item was chasing. |
| wave-1 baseline doc (185f/1584t) vs. task-w2-a's fresh measurement (184f/1573t) at `c663cf2` | task-w2-a-build-test.md:142-151 (OPEN 2) | STILL OPEN — a stale count in `task-w1-a-origin-walkthrough.md`, no DEC addresses it, not a product file to patch. Harmless (doesn't affect any PASS/FAIL determination). |
| 5 attribution FK columns (`authorContactId`/`authorUserId`/`createdByUserId`/`editorUserId`/`uploadedByContactId`) unindexed | task-w2-e-spec-audit.md:220-234 | CLOSED — `src/db/schema.ts:562-563` (`file_comment_author_contact_id_idx`, `file_comment_author_user_id_idx`), `:621` (`api_token_created_by_user_id_idx`), `:708` (`submission_revision_editor_user_id_idx`), `:545` (`file_uploaded_by_contact_id_idx`) — all 5 now indexed, guarded by `test/schema-fk-indexes.test.ts` (confirmed present + passing in `task-w7-c-pre-battery-gate.md`). |
| no prefetch-on-hover/focus on admin nav | task-w2-e-spec-audit.md:191-196 | CLOSED — `app/src/App.tsx:93-94` `onMouseEnter={() => prefetch(section.path)}` / `onFocus={() => prefetch(section.path)}`. |
| `(event_id,slug)` composite index inapplicable-by-schema | task-w2-e-spec-audit.md:398-402 | CLOSED — re-confirmed at S: `src/db/schema.ts:114` is still the only `slug` column (`event_slug_idx`), `event` still has no separate `event_id` FK — the clause genuinely does not apply to the current schema shape, unchanged since w2-e's read. |
| S re-derivation at end of section e yielded a different sha (`e4e7b03...`) than the audit ran against | task-w2-e-spec-audit.md:359-387 | CLOSED — superseded, same evidence as the first row (`task-w7-c-pre-battery-gate.md` single-atomic-S pass). |
| co-presenter add renders blank Name/Email until reload | task-w2-f-triage-closure.md:127-141 (item 8) | CLOSED — DEC-265. `src/server/repo/participants.ts:38-43` (`ParticipantRow` carries `firstName`/`lastName`/`email`), `:106-107` (invite response includes `name`/`email`), `:153-171` (PATCH path joins contact). `test/participant-attribution.test.ts` present and is the reload-equivalence regression DEC-265 specifies. |
| Contacts directory search misses multi-word full-name queries | task-w2-f-triage-closure.md:143-156 (item 9) | CLOSED — DEC-266. `src/domain/contacts.ts:229-244` (`tokenizeContactQuery`, AND-across-tokens/OR-across-columns doc comment names "Priya Raman" as the fixed case), `src/server/repo/contacts.ts:376-393` (tokens consumed per-token). `test/contacts-rules-param.test.ts` present. |
| task-w2-a OPEN 1 restated (S drift) | task-w3-a-c2-wave2-closeout.md:50-64 | CLOSED — superseded, same evidence as row 1. |
| task-w2-a OPEN 2 restated (baseline count typo) | task-w3-a-c2-wave2-closeout.md:65-77 | STILL OPEN — same item as row 2, not independently resolved. |
| wave-2 section e (spec/clarifications audit) never landed | task-w3-a-c2-wave2-closeout.md:29-30,78-86 | CLOSED — `task-w2-e-spec-audit.md` exists on `main` and is ancestor-confirmed campaign-2 (see Sources above); the section has since run. |
| wave-2 section f (wave-1 triage closure) never landed | task-w3-a-c2-wave2-closeout.md:30,78-86 | CLOSED — `task-w2-f-triage-closure.md` exists on `main`, ancestor-confirmed. |
| wave-2 section g (DEC-257 fresh-clone bootstrap) never landed | task-w3-a-c2-wave2-closeout.md:31,78-86 | CLOSED — `task-w4-f-c2-fresh-clone.md` (DEC-264 evidence lane for the fresh-clone bootstrap) exists on `main` and was read in full above. |
| wave-2 section h (116 rubric ids → file:line) never landed | task-w3-a-c2-wave2-closeout.md:32,78-86 | CLOSED — `task-w4-e-c2-rubric-coverage.md` (116/116 ids mapped, confirmed by its own count check) exists on `main`; `docs/verification-log/task-w2-h-rubric-coverage.md` (cited by DEC-271) also present. |
| FROZEN-SHA non-uniformity across sections b/c/d | task-w3-a-c2-wave2-closeout.md:87-93 | CLOSED — superseded, same evidence as row 1 (`task-w7-c-pre-battery-gate.md` runs the equivalent of b/c/d's checks together at one identical S). |
| `drizzle-kit generate` snapshot staleness (meta/ stuck at 0004) | task-w3-a-c2-wave2-closeout.md:161-173 | CLOSED — DEC-263 (`db:generate` npm script DELETED — confirmed absent from `package.json`'s `scripts` block; hand-authored migrations declared canonical; guarded by `test/migration-parity.test.ts`, present at S). |
| public `/e/:slug/sessions/:id` 404 carries a 60s `Cache-Control` header (set before the not-found branch), so a real browser can show a stale 404 up to 60s after organizer approval in the same tab | task-w3-c-c2-content-browser.md:183-197 | STILL OPEN — re-read at S: `src/routes/public/index.tsx:97-101` still calls `setCacheHeaders(c)` on line 97, unconditionally, before the `if (!session) return c.text("Session not found.", 404)` branch at line 101. `git log --oneline 516f2b1..80b811d -- src/routes/public/index.tsx src/routes/public/shell.tsx` is empty — untouched since this was logged. |
| ABS-12 (conflict-of-interest / recusal): no implementation found | task-w4-e-c2-rubric-coverage.md:50,162 | CLOSED — DEC-271. `src/db/schema.ts:354-368` (`review_recusal` table + 3 indexes + unique composite), `migrations/0017_review_recusal.sql`, routes `src/routes/review.ts:785` (POST recusal), `:815` (DELETE), `:636-646` (queue exclusion + `recused` key), `:738-739` (409 on scoring after recusal); pure set-logic `src/domain/evaluation.ts:431-455` (`splitByRecusal`/`excludeRecused`, no real-D1 harness per DEC-266 lesson). `test/review-recusal.test.ts` present. This proves the SERVER half, not just an app/ UI stub, per this task's explicit instruction. |
| ABS-14 (AI-assisted triage): no implementation found | task-w4-e-c2-rubric-coverage.md:52,163 | WAIVED — DEC-272 (explicit: "must not be listed as an open item again"; rubric's own escape clause plus stage-1 zero-secret constraint make it out of scope by construction). |
| SPK-03: no event-speaker-roster-scoped CSV import (only org-level contacts import + separate add-to-event) | task-w4-e-c2-rubric-coverage.md:60,164 | STILL OPEN — re-grepped at S: no `csv` reference in `app/src/pages/Speakers.tsx` or `app/src/pages/speakers/*.tsx`; no roster-scoped import route added to `src/routes/api/contacts.ts` beyond the existing org-level `/contacts/import`. No DEC addresses this gap. |
| SPK-15: no first-class travel-preference/logistics field, only generic `customFields` JSON | task-w4-e-c2-rubric-coverage.md:72,165 | STILL OPEN — `grep -n "travel\|logistic" src/db/schema.ts` returns no hits at S; unchanged since w4-e's read. No DEC addresses this gap. |
| EMB-15: embed panel offers only iframe-snippet-per-surface, no branding/color/content-filter/field-selection config | task-w4-e-c2-rubric-coverage.md:125,167 | STILL OPEN — `app/src/pages/Settings.tsx` still has no `format`/`branding`/`filter` config near `embedSnippet` at S. No DEC addresses this gap. |
| Fresh-clone OPEN ITEM #1: `/admin` and every `/admin/*` route 404 after the literal 4-command README Quickstart (missing build step) | task-w4-f-c2-fresh-clone.md:87-135,273-276 | CLOSED — DEC-268. `package.json:6` `"predev": "tsx scripts/ensure-dev-vars.ts && vite build --config app/vite.config.ts"`; README's Quickstart prose updated (line 29: "`npm run dev` builds the admin SPA bundle first via its `predev` hook (DEC-268)"); `src/routes/root.tsx:37,41` fails loudly with an actionable message instead of a bare 404 when `public/admin/index.html` is missing. Mechanically re-verified in this lane's own worktree: `rm -rf public/admin app/dist && npm run predev` produced `public/admin/index.html` and the full asset chunk set with no manual `npm run build` invocation. |
| Fresh-clone OPEN ITEM #2: emailed absolute links resolve to `http://chautauqua.cc` (live off-machine production host) instead of `http://localhost:8787`, even though the real request carries loopback `Origin`/`Referer` headers DEC-252's `resolveBaseUrl()` is documented to accept | task-w4-f-c2-fresh-clone.md:158-229,277-285 | STILL OPEN — `git log --oneline e522a6f..80b811d -- src/server/origin.ts wrangler.jsonc` is empty: `resolveBaseUrl()` (`src/server/origin.ts:80-99`) and `wrangler.jsonc`'s `routes`/`custom_domain: chautauqua.cc` entry (lines 32-35) are byte-identical to the state this defect was reproduced against. No DEC addresses the `wrangler dev` route-shadowing root cause task-w4-f identified. |
| DEC-285 known in-flight #1: `contacts.ts:207` — only 6 of 7 contact FK tables repointed on merge; `pipeline.ts:161` throws org-wide after a duplicate merge | field guide DEC-285; `src/server/repo/contacts.ts:207` at S | CLOSED at RECHECK SHA `50354380d299969b12d0b46548cb77d28e861c9d` — `CONTACT_FK_TABLES` (`src/server/repo/contacts.ts:200-208`) now lists all 7 tables including `"pipeline_entry"` (DEC-282 comment at :192-199 documents the fix). `test/contacts-merge-integrity.test.ts` (new, 250 lines) and `test/contacts-repo.test.ts` extended. This landed via `merge task-w7-a` (commit `c3b0932`) plus `50a2947` ("DEC-282: make CRM merge total over pipeline_entry"), both inside the POST-S DELTA. |
| DEC-285 known in-flight #2: `tasks.ts:263` — unfiltered `listAcceptedContactIds` | field guide DEC-285; `src/server/repo/tasks.ts:263` at S | CLOSED at RECHECK SHA `50354380d299969b12d0b46548cb77d28e861c9d` — `listAcceptedContactIds` (`src/server/repo/tasks.ts:274-280`) now filters through `isActiveParticipant(r.inviteStatus)`, per the DEC-283 comment at `:262-274`. `test/tasks-assign-all-accepted-invite-gate.test.ts` (new, 142 lines) added. Landed via `merge task-w7-a` (commit `c3b0932`) plus `7f003dd` ("DEC-283: gate listAcceptedContactIds through isActiveParticipant"), both inside the POST-S DELTA. |

## POST-S DELTA

```
5ccd4d6 merge task-w8-a
93fa147 task-w8-a: build+test battery @ 80b811d — PASS, 0 open items
5035438 scribe wave 8
c3b0932 merge task-w7-a
50a2947 DEC-282: make CRM merge total over pipeline_entry (fixes org-wide pipeline 500)
d430611 merge task-w7-c
5f54097 task-w7-c: pre-battery mechanical gate (DEC-284) -- GREEN
c9fab62 merge task-w7-b
7f003dd DEC-283: gate listAcceptedContactIds through isActiveParticipant
```

Non-empty, as expected (task-w7-a/task-w7-c landed mid-battery; this is a
DELTA, not a STOP, per DEC-280/DEC-270). Every file the delta touches
(`src/server/repo/contacts.ts`, `src/server/repo/tasks.ts`,
`src/decisions.ts`, and their four test files) is exactly the DEC-285
known-in-flight scope; both rows re-checked above and closed at:

RECHECK SHA: 50354380d299969b12d0b46548cb77d28e861c9d

## OPEN ITEMS: 7

RESULT: FAIL — 7 rows remain STILL OPEN (baseline-count doc typo x2
restatements, the public-404-cache-header bug, SPK-03, SPK-15, EMB-15,
and the emailed off-origin-link bug), out of 26 total adjudicated rows.
None is a fabricated or invented new item — every row traces to an item a
prior campaign-2 log explicitly raised, re-checked directly against the
frozen sha (or the recheck sha for the two DEC-285 rows). 19 of 26 rows
are CLOSED or WAIVED with file:line/DEC evidence read at S; per this
task's own scope, closure of the remaining 7 is out of a triage-closure
lane's fix authority (adjudicate and log only, never fix).
