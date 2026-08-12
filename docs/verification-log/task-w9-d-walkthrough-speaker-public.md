# task-w9-d — speaker + public walkthrough repair (DEC-412)

SHA: `45ac3d8d64a672d77725f6764a8b51a9a5296c97` (worktree `main` tip at
start of this lane's run; `git -C
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w9-d
rev-parse HEAD`).

Scope per DEC-412: `scripts/walkthrough/speaker.ts` and
`scripts/walkthrough/public.ts` only. Both had never run to completion
during the redesign (docs/verification-log/task-w6-g-walkthrough-redesign.md
records both NOT RUN — the fixed-order orchestrator aborted at producer's
J2). This lane runs each module standalone against a fresh migrate+seed
on port 8812.

## RESULT

- `npx tsx scripts/walkthrough/speaker.ts --url http://localhost:8812` — **exit 0**
- `npx tsx scripts/walkthrough/public.ts --url http://localhost:8812` — **exit 0**

Both run clean against the same booted server, in sequence, from a fresh
`npm run db:migrate && npm run seed`.

## Setup notes (for the next lane running this stack)

- `npx wrangler dev --port 8812` alone does NOT create `.dev.vars` —
  `predev` (`tsx scripts/ensure-dev-vars.ts && vite build --config
  app/vite.config.ts`) only runs under `npm run dev`. Running `wrangler dev`
  directly (needed here to pin a non-default port) skips it, so
  `GET /dev/mailbox` 404s ("DEV_MODE must be '1'") until you run
  `npx tsx scripts/ensure-dev-vars.ts` (or `npm run dev` once) yourself
  first. Also pass `--var PUBLIC_BASE_URL:http://localhost:8812` — the
  `.dev.vars.example` default (`:8787`) otherwise mismatches the pinned
  port for absolute links.
- A stray earlier partial run (before `.dev.vars` existed) had already
  mutated D1 state (accepted a submission) — `rm -rf .wrangler/state &&
  npm run db:migrate && npm run seed` before every re-run once you've
  touched the API with a broken server.
- Mid-task the assigned worktree directory and branch (`task-w9-d`) were
  found deleted partway through setup (a concurrent lane's cleanup, not
  this lane's doing) — recreated via `git worktree add ... -b task-w9-d
  main` at the then-current `main` tip; no work had been lost since it
  happened before any edits were made.

## Assertions changed, each with its mock justification (DEC-412 repair policy)

All failures were markup/copy drift from the portal (`src/routes/portal/
tasks.tsx` against `docs/design/'Chautauqua Public and Portal.dc.html'`
lines ~179-188) and public (`src/routes/public/{cards,speakers,agenda}.tsx`
against `public.css.ts`) redesigns — every one re-pinned to a smaller,
stable token; none softened to a tautology or deleted. No product-code
defect was found; every check that failed was checking a copy/markup token
that legitimately changed under the redesign, confirmed against the mock.

### scripts/walkthrough/speaker.ts

1. **Portal task rows: `<li>...</li>` → `<div class="chq-portal-row">`
   boundary.** Pre-redesign task rows were `<li>` inside a `<ul>`;
   `src/routes/portal/tasks.tsx`'s `TaskRow`/`TasksPage` never render a
   `<ul>`/`<li>` for rows anymore (only the nested `CommentThread` still
   uses `<ul><li>`), they're each a top-level `<div class="chq-portal-row">`.
   The mock (design doc lines 179-188, `sc-for list="{{ tasks }}"`) confirms
   each row is its own `<div>` block, not a list item. Added a
   `NEXT_TASK_ROW` constant (`<div class="chq-portal-row">`) and re-pinned
   four regexes (general-task complete/Pending lookup, Hotel form link
   lookup, ad hoc form task link lookup, and the 'Finalize bio + headshot'
   deliverable-panel row match) from a `(?!<\/li>)` boundary to a
   `(?!NEXT_TASK_ROW)` boundary — same "smallest stable token" pattern as
   DEC-407's `/\bcloses\b/i`.
2. **`<section aria-label="Uploaded file">` exact-tag match →
   `aria-label="Uploaded file"` substring.** The redesign added a
   `class="chq-card"` onto that section
   (`src/routes/portal/tasks.tsx:198`) for styling, so the old exact-tag
   string no longer appears verbatim. Re-pinned to the attribute substring,
   which is unaffected by any future class addition.
3. **Public session card lookup: `chq-card` → `chq-pub-session-row`, plus a
   capture-boundary fix.** `src/routes/public/cards.tsx`'s `SessionCard`
   renders `<div class="chq-pub-session-row" id="chq-session-{id}">`
   (pre-redesign was `chq-card`), and now nests `chq-pub-session-when`/
   `chq-pub-session-body` divs inside the card, so the old lazy match to
   the FIRST `</div>` silently truncated at the first nested div's close
   instead of the whole card. Re-pinned to the new class name and bounded
   the match to "up to the next card" (same `(?!...)` technique as above)
   instead of "up to the first `</div>`", so the captured block actually
   contains the full card (including the speaker-name paragraph the next
   check reads).
4. **Speakers page block match: `<strong>Name</strong>` → `<a
   class="chq-pub-speaker-name">Name</a>`.** DEC-173's
   `<strong><a href=...>Name</a></strong>` wrapper is gone;
   `src/routes/public/speakers.tsx`'s `SpeakersContent` now renders the
   speaker name as a bare `<a class="chq-pub-speaker-name" href=...>` with
   no `<strong>` anywhere on the card. Re-pinned the block-boundary regex
   to open on that anchor's class instead of `<strong>`; the `</ul>`
   closing boundary is unchanged (the per-speaker session list is still a
   `<ul>`).

### scripts/walkthrough/public.ts

5. **`class="chq-card"` (sessions cards) → `class="chq-pub-session-row"`**
   — same rename as speaker.ts item 3 above.
6. **Speakers grid: `chq-speaker-grid` region + `<strong>` name extraction
   → `chq-pub-speaker-grid` + `<a class="chq-pub-speaker-name">`
   extraction.** Same rename/markup change as speaker.ts item 4; also
   re-pinned the sibling `chq-headshot-fallback` → `chq-pub-headshot-fallback`
   substring check (`src/routes/public/speakers.tsx:40`,
   `src/routes/public/detail.tsx:31`).
7. **Agenda grid marker: `chq-agenda-day` → `chq-pub-agenda-day`**
   (`src/routes/public/agenda.tsx:41`) — same page-prefixing pattern as
   DEC-402's table-class convention, applied here to the agenda's day
   columns.
8. **Gallery grid marker: `chq-speaker-grid` → `chq-pub-gallery-grid`.**
   The gallery surface (`GalleryContent` in `src/routes/public/speakers.tsx`)
   is its own grid class, distinct from the speakers-page grid — pre-
   redesign both apparently shared one `chq-speaker-grid` class; post-
   redesign each surface has its own page-prefixed class
   (`chq-pub-speaker-grid` vs `chq-pub-gallery-grid`).
9. **Settings embed-generator check: literal `<EmbedsPanel` JSX tag →
   import + `SECTIONS` config-array wiring.** DEC-375's Settings redesign
   turned every panel mount from a literal `<XPanel />` JSX tag into a
   `SECTIONS: {key,label,Panel}[]` array rendered via one shared
   `<Panel />` in a `.map()` (`app/src/pages/Settings.tsx`). `EmbedsPanel`
   is still imported and still mounted (as `Panel = section.Panel` for
   `section.key === 'embeds'`), just never spelled `<EmbedsPanel` as a JSX
   tag anymore. Re-pinned to check the still-present `import {
   EmbedsPanel }` line and the `{ key: 'embeds', label: 'Embeds', Panel:
   EmbedsPanel }` config entry instead of the now-absent literal tag
   string. `embedSnippet.ts`/`EmbedsPanel.tsx` assertions (buildEmbedUrl,
   `.json` suffix, live `/embed/<slug>/sessions` 200) were unaffected and
   left as-is.

## No product fixes

Every failure investigated above was a stale copy/markup assertion in the
walkthrough script itself, confirmed against
`docs/design/'Chautauqua Public and Portal.dc.html'` and the live
`src/routes/{portal,public}/*` render output — none required a change to
`src/`. No SPEC section 9 J-bar regression was found in either area; DEC-108/
DEC-111/DEC-175/DEC-244/DEC-274 behaviors all round-tripped correctly once
the assertions were re-pinned to current tokens.

## Portal date rendering — reported, not fixed here

Per this task's instructions, lane w9-f owns `src/routes/portal/*.tsx` date
rendering this wave (DEC-413). No portal date-rendering defect was observed
during this run (`/portal/tasks` due-date lines render `new Date(t.dueDate)
.toISOString().slice(0, 10)`, unrelated to DEC-413's per-row event-timezone
scope, which is about listing surfaces spanning multiple events — this
lane's speaker persona only ever sees her own event's rows) — flagging this
explicitly as "nothing found," not a defect report, per the instruction to
report rather than edit those files.

## OPEN ITEMS: 0
