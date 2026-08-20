# Code-comment citation audit (DEC-967 doc-integrity lens widened to code comments)

Task w11-aa (INSTRUMENT ONLY -- no repairs performed in this lane).
Instrument: `test/code-comment-citation.scan.test.ts`. Ratchet:
`CODE_COMMENT_CITATION_CEILING = 37`, measured on this branch by forcing
the constant to `-1` and reading the printed offender list.

## Measured count differs from the task's estimate -- trusting the measurement

The task estimated "roughly 8 dead anchors and 11 drifted quotes (measured
on main `757a3f98`)" -- a total near 19. This scan measures **37** on this
branch. Per the task's own instruction ("if your number differs, trust
your measurement and say so"), 37 is what is shipped. Concrete reasons the
two counts plausibly diverge, none of them a bug found during authoring:

- **Resolution ladder needed a basename-search rung, not literal
  concatenation.** The task specifies five rungs ending "...then src/,
  then app/src/, then docs/design/". A literal `join(root, "src",
  rawPath)` / `join(root, "app/src", rawPath)` reading of those last two
  rungs only matches a citation that happens to name a path relative to
  that subtree's own top level -- it does not resolve the far more common
  shape in this corpus, a **bare basename** naming a file that lives
  several directories deep (e.g. `overview.css`'s comment `"Overview.tsx
  :314"` citing `app/src/pages/Overview.tsx`, one level above its own
  `overview/` subdirectory). This scan's rungs 3-5 instead do a recursive
  basename search scoped to each subtree (unique match only -- an
  ambiguous basename, e.g. `types.ts` with 17 matches under `src/` +
  `app/src/`, is correctly left unresolved rather than guessed at, same
  discipline as `test/decision-doc-citation.scan.test.ts`'s own
  `resolvePath`). This finds real files a literal-concatenation reading
  would have wrongly convicted as dead, but it ALSO still counts the
  citations above as offenders where the true target genuinely does not
  exist (`src/db/schema.ts`, `settings.css` colliding ambiguously with the
  one real `app/src/pages/settings/settings.css`, etc.) or where a match
  resolved but its quote had drifted -- so it raises real signal, not
  noise.
- **`.dc.html` frame citations (`Speakers.dc.html:263` and ~400 siblings)
  are excluded from this scan's grammar entirely**, mirroring
  `decision-doc-citation.scan.test.ts`'s own exclusion for the same
  reason: every one names a bare basename with no directory, and the real
  frame files on disk carry a `Chautauqua ` prefix and a literal space
  (`docs/design/Chautauqua Speakers.dc.html`) that no in-comment citation
  ever spells. Counting these literally would have manufactured ~400
  offenders out of a naming shorthand convention, not a broken citation --
  they are excluded, not silently included and then miscounted.
- **DRIFT_WINDOW is 12 characters** (per this task's own grammar spec,
  narrower than `decision-doc-citation.scan.test.ts`'s 25/400-char
  windows tuned for long decision-doc paragraphs) and the drift check
  widens to firstLine +/-2 (also per spec) -- both widen or narrow what
  counts as "receipted" relative to the sibling scan's tuning, and this
  scan's population (terse one-line code comments) has a different shape
  than decision-doc's paragraphs.

None of the 37 offenders below is a scan defect found during authoring --
each was hand-spot-checked (e.g. `review.css:1062` genuinely reads
`.chq-review-criterion-row-readonly {`, not `grid-template-columns: 1fr`,
confirming real drift) before being accepted into this ceiling.

## Offenders (37), by owning cluster

Repair lanes: **v12m-w11-bb** owns `src/**`, **v12m-w11-cc** owns
`app/src/**`. Neither citation is repaired in this lane.

### agenda (app/src/**) -- 1

| file:line | citation | reason |
| --- | --- | --- |
| `app/src/pages/agenda/BreaksPanel.tsx:168` | `breaks.ts:144` | dead anchor -- does not resolve on any rung |

### comms (app/src/**) -- 1

| file:line | citation | reason |
| --- | --- | --- |
| `app/src/pages/comms/HistoryTab.tsx:174` | `app/src/pages/settings/ExportsPanel.tsx:87` | dead anchor -- target file has only 83 lines |

### contacts (app/src/**) -- 5

| file:line | citation | reason |
| --- | --- | --- |
| `app/src/pages/contacts/contacts-panels.css:1280` | `PipelineBoard.tsx:374-380` | drifted quote -- `` `.chq-contacts-pipeline-phone-stages` `` not within +/-2 of `PipelineBoard.tsx:374` |
| `app/src/pages/contacts/contacts-panels.css:1819` | `styles.css:2262` | drifted quote -- `` `.chq-main:has([data-chq-phone-dock])` `` not within +/-2 of `app/src/styles.css:2262` |
| `app/src/pages/contacts/contacts-panels.css:1848` | `styles.css:2302` | drifted quote -- selector not within +/-2 of `app/src/styles.css:2302` |
| `app/src/pages/contacts/contacts.css:995` | `ContactsApp.tsx:385` | drifted quote -- markup not within +/-2 of `ContactsApp.tsx:385` |
| `app/src/pages/contacts/contacts.css:1129` | `contacts.css:449` | drifted quote -- `` `.chq-contacts-record-value` `` not within +/-2 of its own file's line 449 |

### forms (app/src/**) -- 1

| file:line | citation | reason |
| --- | --- | --- |
| `app/src/pages/forms/forms.css:794` | `contacts.css:449` | drifted quote -- cross-cluster citation into contacts.css, same drift as above |

### overview (app/src/**) -- 2

| file:line | citation | reason |
| --- | --- | --- |
| `app/src/pages/overview/types.ts:54` | `scheduling.ts:101` | dead anchor -- no unique `scheduling.ts` under src/ or app/src/ |
| `app/src/pages/overview/types.ts:90` | `scheduling.ts:167` | dead anchor -- same missing target |

### review (app/src/** + src/**) -- 7

| file:line | citation | reason |
| --- | --- | --- |
| `app/src/pages/review/review.css:2469` | `review.css:1062` | drifted quote -- `` `grid-template-columns: 1fr` `` not near cited line (that line now reads `.chq-review-criterion-row-readonly {`) |
| `app/src/pages/review/review.css:2641` | `review.css:1208` | drifted quote -- same class of drift, second occurrence |
| `app/src/styles.css:391` | `app/src/pages/review/review.css:2088` | drifted quote -- rule not within +/-2 of cited line |
| `src/routes/review/reviewer.ts:286` | `src/server/repo/agenda.ts:316-330` | dead anchor -- `src/server/repo/agenda.ts` does not exist |
| `src/server/repo/review/recusal.ts:32` | `src/db/schema.ts:376` | dead anchor -- `src/db/schema.ts` does not exist anywhere in the tree |
| `src/server/repo/review/submissions.ts:19` | `src/server/repo/files-library.ts:39` | dead anchor -- target has only 33 lines |
| `src/server/repo/review/submissions.ts:845` | `src/server/repo/agenda.ts:316-330` | dead anchor -- same missing file as reviewer.ts:286 |

### settings (app/src/**) -- 6

| file:line | citation | reason |
| --- | --- | --- |
| `app/src/pages/settings/formState.ts:144` | `events.ts:416-536` | dead anchor -- `events.ts` ambiguous (2 matches: `src/server/repo/events.ts`, `src/routes/api/events.ts`) |
| `app/src/pages/settings/settings-drill-rows.css:160` | `YourDataPanel.tsx:267` | drifted quote -- markup not within +/-2 |
| `app/src/pages/settings/settings.css:2513` | `app/src/styles.css:1776` | drifted quote -- declaration not within +/-2 |
| `app/src/pages/settings/settings.css:2518` | `settings.css:1469` | drifted quote -- own-file self-citation drifted |
| `app/src/pages/settings/tracksRooms/types.ts:39` | `events.ts:416-536` | dead anchor -- same ambiguous `events.ts` |
| `app/src/phone-overflow-scan/cascade.ts:8` | `settings.css:1142` | drifted quote -- resolves to `app/src/pages/settings/settings.css:1142` but quote not within +/-2 |

### speakers (app/src/**) -- 4

| file:line | citation | reason |
| --- | --- | --- |
| `app/src/pages/speakers/speakers.css:805` | `ceda66f2.md:127-133` | dead anchor -- no such file anywhere in src/, app/src/, or docs/design/ |
| `app/src/pages/speakers/speakers.css:1229` | `RosterPanel.tsx:484` | drifted quote -- markup not within +/-2 |
| `app/src/pages/speakers/speakers.css:1819` | `OnboardingGrid.tsx:973-988` | drifted quote -- markup not within +/-2 |
| `app/src/pages/speakers/task-view.css:268` | `TaskView.tsx:646` | drifted quote -- markup not within +/-2 |

### shared shell (app/src/**) -- 2

| file:line | citation | reason |
| --- | --- | --- |
| `app/src/styles.css:2526` | `styles.css:235-238` | drifted quote -- self-citation drifted |
| `app/src/styles.css:2627` | `styles.css:1037-1041` | drifted quote -- self-citation drifted |

### domain/lib (src/**) -- 2

| file:line | citation | reason |
| --- | --- | --- |
| `src/domain/brand-url.ts:15` | `types.ts:18` | dead anchor -- `types.ts` ambiguous (17 matches) |
| `src/lib/home-hub.ts:41` | `schema.ts:116-117` | dead anchor -- no unique `schema.ts` (bare basename does not exist; only `app/src/pages/settings/settings.css` etc. share no such name) |

### public routes (src/**) -- 3

| file:line | citation | reason |
| --- | --- | --- |
| `src/routes/public/saved-embed.tsx:49` | `./index.tsx:89-90` | drifted quote -- `` `.use("/embed/*", ...)` `` not within +/-2 of `src/routes/public/index.tsx:89` (the sibling citation at line 48, `./index.tsx:61`, resolves and matches cleanly -- only this one drifted) |
| `src/server/auth-session.ts:7` | `src/routes/auth.tsx:384-387` | dead anchor -- target has only 40 lines |

### server/repo (src/**) -- 4

| file:line | citation | reason |
| --- | --- | --- |
| `src/server/repo/import/sessionboard.ts:179` | `schema.ts:289` | dead anchor -- no unique `schema.ts` |
| `src/server/repo/pipeline.ts:254` | `src/db/schema.ts:669` | dead anchor -- `src/db/schema.ts` does not exist |
| `src/server/repo/portal-config.ts:107` | `src/db/schema.ts:505` | dead anchor -- same missing file |
| `src/server/repo/tasks/reminders.ts:632` | `src/routes/comms/send.ts:283-299` | drifted quote -- `` `status: * "skipped"` `` not within +/-2 of cited line |

## Population sanity

- `POPULATION_FILES` (src/** + app/src/**, `.test.` excluded, via
  `enumerateSourceFiles`): > 100 files (asserted in the scan itself).
- Total `path:line` comment citations found across that population:
  > 50 (asserted; measured count is in the hundreds once `.dc.html` is
  excluded and before resolution is attempted).
- 37 of those citations are unresolved (dead anchor) or drifted
  (quote mismatch); the remainder resolve and, where a receipt quote
  immediately follows, match verbatim within the +/-2 line window.
