# Route sub-state coverage — the query sub-states no live gate has ever visited

DEC-144 (wave-154 amendment) makes `app/src/routeManifest.ts` the exhaustive
population every live gate walks (the desktop render sweep, the mobile
render sweep, the overflow probe, the tap-floor pass, the contrast pass).
Waves 154–156 correctly widened it with `?tab=`/`?view=`/`?section=` rows for
Content, Comms, Contacts and Settings, and `app/src/routeManifest.test.ts`
parity-checks those four keys against each page's own closed-set union so a
fifth value can never land silently. This doc is the DEC-144 amendment for
wave 27: the same closed-set derivation, extended to every `searchParams
.get(...)` read site `routeManifest.test.ts` does **not** already cover.

**Instrument**: `test/route-substate-coverage.scan.test.ts`. Source-scans
`app/src/pages/**` (never hand-listed, DEC-180/DEC-808) for every
`searchParams.get('<key>')` call, resolves each key's admissible values from
the same file (a `=== '<literal>'` or `!== '<literal>'` comparison — the
`tab`/`section`/`view` unions/arrays `routeManifest.test.ts` already owns
are excluded here to avoid DEC-613's "second copy of a vocabulary" trap),
and diffs the derived `(route, key, value)` triples against
`ROUTE_MANIFEST`, imported, never re-typed.

**Wave 23 (task w23-f, DEC-144 wave-23 amendment)**: `app/src/routeManifest
.ts` was widened with the three rows this doc used to roster as unvisited —
`/admin/settings?section=your-data&edit=1&intent=new`, `/admin/contacts
?import=1`, and `/admin/submissions/seed_submission_0001?history=0`. All
three resolve against `npm run seed` data (reusing `EVENT_SLUG` /
`SUBMISSION_ID` — no id or slug was invented). Re-measured
`ROUTE_SUBSTATE_UNVISITED_CEILING` at **0** and lowered it from 3 in the
same commit as the manifest widening. The tables below are kept as the
historical record of what those rows were and why each one mints a real,
reachable screen; none remain unvisited.

`ROUTE_SUBSTATE_UNVISITED_CEILING = 0` (two-sided: `test/route-substate
-coverage.scan.test.ts` fails on a rise above 0 and on an unaccounted drop
below 0 — DEC-808 wave-85 amendment).

## Formerly-unvisited rows (0 remain unvisited; 3 closed in wave 23)

### `/admin/settings` — the B10 edit-drill family (7 rows)

Reader: `app/src/pages/Settings.tsx` — `editing = urlSection !== null &&
searchParams.get('edit') === '1'`. Settings.tsx's own comment: *"a settings
section URL carrying `edit=1` (SummarySection's openEdit) is a SCREEN, not a
scroll target — only that one panel mounts inside `.chq-settings-content`,
the page's own title becomes that section's label, and the tertiary back
control ... becomes reachable at desktop too."* `docs/design/DESIGN
-RULINGS.md`'s **B10 — Settings edit views on desktop** rules the same
family: *"all five drawn ... Event, Tracks and rooms, Call for papers,
Speaker portal, People and roles"* (B10's frame citations name five; the
code's own `SECTIONS` array in Settings.tsx declares an `editTitle` — the
gate this instrument keys off — for **six**: the five B10 names plus
`your-data`, `"Edit your data settings"`, `Chautauqua Settings.dc.html:1137`.
That sixth section is a code/frame-citation-count divergence this instrument
does not adjudicate — it is out of this wave's narrow scope — but its own
row is filed below since the code path is live and reachable either way).

| Row | Frame citation (Settings.tsx `editTitle`) |
| --- | --- |
| `/admin/settings?section=event&edit=1` | `Chautauqua Settings.dc.html:724` "Edit the event" |
| `/admin/settings?section=cfp&edit=1` | `Chautauqua Settings.dc.html:633` "Edit the form" |
| `/admin/settings?section=tracks-rooms&edit=1` | `Chautauqua Settings.dc.html:814` "Edit tracks and rooms" |
| `/admin/settings?section=portal&edit=1` | `Chautauqua Settings.dc.html:895` "Edit the speaker portal" |
| `/admin/settings?section=your-data&edit=1` | `Chautauqua Settings.dc.html:1137` "Edit your data settings" |
| `/admin/settings?section=people&edit=1` | `Chautauqua Settings.dc.html:976` "Edit people and roles" |

(`public-pages` is correctly excluded: its `SECTIONS` entry carries no
`editTitle` — *"No editTitle: the pack drops an edit view for this section
(DEVIATIONS §6 defers the `:1046` saved-embed drill)"* — so it mints no
edit-drill screen and no row.)

| Row | Reader / ruling |
| --- | --- |
| `/admin/settings?section=your-data&edit=1&intent=new` | `app/src/pages/settings/ApiTokensPanel.tsx` — `searchParams.get('intent') !== 'new'`, mounted non-`readOnly` only inside `YourDataPanel.tsx`'s edit view (a third level nested under the `your-data` edit row above). DEC-919 wave-155 amendment: *"the read drill gets its own 'New token' render site ... which opens the edit drill with `intent=new` already set."* |

### `/admin/contacts` — the CSV importer (1 row)

| Row | Reader / ruling |
| --- | --- |
| `/admin/contacts?import=1` | `app/src/pages/contacts/ContactsApp.tsx` — `showImport = searchParams.get('import') === '1'`. DEC-827: *"Speakers links into the importer with `?import=1` (the toolbar's 'Import CSV' button shares this same opener/URL-state path, so there is one way in, not two)."* |

### `/admin/submissions/<id>` — edit and history-collapsed (2 rows)

Base row: `ROUTE_MANIFEST`'s single `/admin/submissions/<id>` entry carrying
`params.id` (currently `seed_submission_0001`) — read off the manifest by
the instrument itself, never re-typed.

| Row | Reader / ruling |
| --- | --- |
| `/admin/submissions/seed_submission_0001?edit=1` | `app/src/pages/submissions/SubmissionDetailPage.tsx` — `editing = searchParams.get('edit') === '1'`. DEC-998: *"editing/historyOpen are derived from the URL, not their own `useState` — `setSearchParams` is the single writer for both."* |
| `/admin/submissions/seed_submission_0001?history=0` | `app/src/pages/submissions/SubmissionDetailPage.tsx` — `historyOpen = searchParams.get('history') !== '0'`. DEC-908 wave-42 amendment: *"History renders EXPANDED by default (the frame lists entries inline) — absent is open, `?history=0` is the one way to reach the collapsed state, so a bookmarked/shared link still round-trips through the toggle."* |

## OPEN-VALUED keys (recorded, not expanded)

Per the task's own instruction: a key whose values are an arbitrary id/
number, not a closed set, is recorded here with its reader and left
unexpanded — a hand-rolled enumeration of ids would be DEC-180's "hand-listed
population" failure in the opposite direction.

| Key | Reader | Shape |
| --- | --- | --- |
| `batch` | `app/src/pages/comms/HistoryTab.tsx` | an email-batch key (`?tab=history&batch=<key>` hand-off from a compose "Open" link) |
| `templateId` | `app/src/pages/comms/HistoryTab.tsx` | an arbitrary template id (chip-row active facet, DEC-603 wave-56 amendment) |
| `eventId` | `app/src/pages/contacts/ContactsApp.tsx` | an arbitrary event id (importer preselect, DEC-662 amendment wave-55) |
| `openContact` | `app/src/pages/contacts/ContactsApp.tsx` | an arbitrary contact id (one-shot, stripped after read — DEC-788) |
| `ids` | `app/src/pages/contacts/MergePage.tsx` | a comma-separated arbitrary contact-id list |
| `keep` | `app/src/pages/contacts/MergePage.tsx` | an arbitrary contact id (member of `ids`) |
| `page` | `app/src/pages/content/ContentApp.tsx` | an arbitrary 1-based page number |
| `embed` | `app/src/pages/settings/EmbedsPanel.tsx`, `app/src/pages/settings/PublicPagesPanel.tsx` | an arbitrary saved-embed id (DEC-822 edit-mode hand-off) |
| `ids` | `app/src/pages/submissions/DeleteSubmissionsPage.tsx` | a comma-separated arbitrary submission-id list |

## Keys this doc does not re-derive

`tab` (Comms.tsx, ContactsApp.tsx), `view`/`tab` (ContentApp.tsx), `section`
(Settings.tsx) are already parity-checked against `ROUTE_MANIFEST` by
`app/src/routeManifest.test.ts`'s DEC-144 describe blocks — re-deriving them
here would be a second copy of the same vocabulary (DEC-613). Their own
default-fallback values (`compose`, `directory`, `needs_decision`/
`worklist`, `null`/index) are likewise already the bare-route baseline those
tests already reason about.
