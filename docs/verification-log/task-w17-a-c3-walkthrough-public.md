# task-w17-a — scripts/walkthrough/public.ts (DEC-274 probe repair)

FROZEN SHA (S, main at worktree creation): `1fbc7f6b9cfa77c0efe33a0069206b14ef3ecf17`
RECHECK SHA (this worktree's HEAD when the module ran green): `1fbc7f6b9cfa77c0efe33a0069206b14ef3ecf17`
(no src/app/migrations commits landed on main between worktree creation and this run)

## OPEN ITEMS

task-w15-b-c3-walkthrough-fix.md OPEN ITEM 1 — the check
`J10 visibility gate: hidden participant is absent from every surface`
(scripts/walkthrough/public.ts ~:604-651) asserted the session TITLE
vanished from every public/embed surface + the .ics after hiding its
only participant. This contradicts DEC-274: `visibleSessionConditions()`
(src/server/repo/public/gates.ts) has no participant reference, so a
session with all-hidden participants stays public with `speakers: []`;
only the speaker-rooted queries (`getPublicSpeakers`,
`getPublicSpeakerDetail` in public/speakers.ts, public/detail.ts) apply
the composite (session + participant-visible) gate. The probe's premise
was backwards.

STATUS: **CLOSED** by this task. No product code was touched (src/,
app/, test/, migrations/ are all outside this task's scope and were
left untouched — confirmed by `git status` below and the empty
POST-S DELTA).

## REPAIR

- `createThrowawaySubmission` (scripts/walkthrough/public.ts ~:558) now
  takes optional `firstName`/`lastName` params (defaulting to the
  original "Wk"/"Fixture") instead of hardcoding them, so callers can
  give a fixture an unambiguous speaker-name marker independent of the
  submission title.
- The third `J10 visibility gate` check (renamed to
  `J10 visibility gate (DEC-274): hidden participant's name vanishes
  everywhere but the session stays public with speakers:[]`) was
  rewritten to assert **both directions**:
  - (i) the speaker NAME marker (`WkHidden<stamp> SpeakerMarker`) is
    absent from all five `/e/<slug>/{sessions,speakers,agenda,schedule,
    gallery}`, all five `/embed/<slug>/{...}`, and
    `/e/<slug>/schedule.ics?ids=<id>`.
  - (ii) the session TITLE is still present on `/e/<slug>/sessions?q=
    <title>` (unfiltered list is PER_PAGE=12-capped, per the existing
    comment), `/e/<slug>/agenda?day=<day>`, `/e/<slug>/schedule?day=
    <day>`, and the `.ics?ids=<id>` still carries a VEVENT with a UID
    referencing the submission id.
  - (iii) the speaker name marker is also absent from the two
    speaker-rooted surfaces `/speakers` and `/gallery` (these DO apply
    the composite gate, per DEC-274).
- The two preceding checks (non-accepted, content-unapproved) and
  `assertAbsentEverywhere` were left untouched — their premises
  (title-absence for non-visible sessions) are correct and unrelated to
  DEC-274.

## SETUP

```
npm ci --prefer-offline --no-audit --no-fund
npm run build                       # tsc --noEmit x2 + vite build — clean
rm -rf .wrangler/state
npm run db:migrate                  # 0001..0017, all ✅
npm run seed
cp .dev.vars.example .dev.vars      # PUBLIC_BASE_URL=http://localhost:8791
npx wrangler dev --port 8791
```

## RESULT

`npx tsx scripts/walkthrough/public.ts --url http://localhost:8791`
exited 0. Full verbatim output (every check, including the DEC-108
invite-visibility tail at ~:690-790, which had never executed before in
this campaign because the module always aborted earlier):

```
ok   devflow-conf-2027 event resolvable via API
ok   J9 GET agenda: rooms and tracks (with colors) list
ok   J9 unscheduled tray is accepted-only
ok   J9 placing a session into a slot persists
ok   J9 room-overlap: both writes succeed (non-blocking), conflict surfaces
ok   J9 same-speaker-overlap: both writes succeed (non-blocking), conflict surfaces
ok   J9 'N unplaced / M conflicts' counts are correct
ok   J9 auto-schedule places remaining sessions without introducing conflicts
ok   J9 unscheduling returns a session to the tray
ok   J10 /e/devflow-conf-2027/sessions returns 200 with content
ok   J10 /e/devflow-conf-2027/speakers returns 200 with content
ok   J10 /e/devflow-conf-2027/agenda returns 200 with content
ok   J10 /e/devflow-conf-2027/schedule returns 200 with content
ok   J10 /e/devflow-conf-2027/gallery returns 200 with content
ok   J10 /sessions: cards + track filter nav present
ok   J10 /speakers: alphabetical by surname, headshot/title/company
ok   J10 /agenda: per-day time grid, track colors present in markup
ok   J10 /schedule: itinerary key + .ics link carries ?ids=
ok   J10 /gallery returns headshot grid
ok   J10 schedule.ics downloads twice with identical UID lines
ok   J10 /embed/devflow-conf-2027/sessions renders chromeless, no frame-blocking headers
ok   J10 /embed/devflow-conf-2027/speakers renders chromeless, no frame-blocking headers
ok   J10 /embed/devflow-conf-2027/agenda renders chromeless, no frame-blocking headers
ok   J10 /embed/devflow-conf-2027/schedule renders chromeless, no frame-blocking headers
ok   J10 /embed/devflow-conf-2027/gallery renders chromeless, no frame-blocking headers
ok   J10 Settings embed-generator snippet URLs match live /embed routes
ok   J10 visibility gate: non-accepted submission is absent from every surface
ok   J10 visibility gate: accepted-but-content-unapproved session is absent from every surface
ok   J10 visibility gate (DEC-274): hidden participant's name vanishes everywhere but the session stays public with speakers:[]
ok   J10 DEC-108 invite-visibility gate: accepted invitee shown, pending and declined invitees absent

walkthrough/public.ts OK — all J9/J10 checks passed
```

All checks `ok`, exit code 0. No genuine product defects found — DEC-274
is correctly implemented; the probe was the sole defect (DEC-329
category: stale premise in the walkthrough file, repaired here).

## POST-S DELTA (DEC-280: non-empty delta is never a STOP)

```
git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua log --oneline 1fbc7f6..refs/heads/main -- src app migrations scripts test
```

Output: empty (no commits landed on `main` under those paths between
worktree creation and this run). RECHECK SHA == FROZEN SHA.

## SCOPE

Only `scripts/walkthrough/public.ts` was edited under this task, per the
SOLE-OWNER constraint. No files under `src/`, `app/`, `test/`, or
`migrations/` were touched.
