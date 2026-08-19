# Desktop frame claim ledger (v12)

Derived by `test/desktop-frame-ledger.scan.test.ts` (DEC-976, wave-99
amendment; task v12m-w2-f). This document is the human-readable snapshot of
what that scan measures on this branch; the scan itself is the source of
truth and will drift from this file the moment the pack or the test suite
changes. Re-run the scan (or re-derive with the method below) before trusting
any number here past the commit that introduced it.

## Why this exists

The campaign's goal is "every screen matches its v12 frame on desktop AND
phone". `test/phone-frame-ledger.scan.test.ts` has instrumented the phone
half since wave 83 -- a derived population of 53 phone frames, a claim
mechanism, and a two-sided ratchet. The desktop half had none of that:
"desktop is frozen and already conformant" was eighteen waves of assumption
with no instrument behind it (field guide, DEC-976 wave-99 amendment). This
ledger is that instrument for desktop.

## Population, derived

`readdirSync docs/design` for `*.dc.html` (13 files, never a hand-listed
list). Within each file, every `font-size:19px ... >TITLE<` label span (the
phone ledger's own title grammar, widened here to accept any closing tag --
not only `</span>` -- because some desktop labels sit on an `<a>`, e.g.
`Chautauqua Home.dc.html:205`) opens a frame. A frame's extent runs from its
own label line up to, but not including, the next label line in that file,
or to EOF for the file's last label.

- **Total label spans across the pack: 161.**
- A frame is **desktop** when its extent contains no
  `width:390px`+`height:844` line anywhere in it (that combination is the
  phone ledger's own frame marker -- a desktop frame never carries it).
- **Desktop frames before exclusion: 108.** (161 total labels − 53 phone
  frames, which is exactly the phone ledger's own population count --
  confirms the two ledgers partition the same 161 labels rather than
  double-counting or dropping any.)

## Exclusions

Two kinds, both written, justified, and asserted against the pack inside the
scan so a re-cut of `docs/design` cannot silently grow either list.

### 1. Template interpolations (pattern exclusion)

A label whose entire title is a `{{ ... }}` Mustache-style interpolation
documents a data binding, not a screen a v12 frame draws. The exclusion is a
**pattern** (`/^\{\{.*\}\}$/` against the title), not a hand-picked list --
the scan asserts the pattern's current reach explicitly so growth is visible
rather than silent. It reaches exactly three labels today:

| File | Line | Title |
|---|---|---|
| `Chautauqua Home.dc.html` | 205 | `{{ e.name }}` |
| `Chautauqua Comms.dc.html` | 695 | `{{ e.name }}` |
| `Chautauqua Public and Portal.dc.html` | 716 | `{{ s.name }}` |

### 2. Explainer panels (hand-picked, exact citation)

The pack's own documentation panels -- not screens, so not desktop frames. A
title-pattern cannot tell an explainer panel from a real screen, so this is a
hand-picked, exact `file:line:title` list. The scan asserts each entry still
resolves to its cited line and title, so the list rots loudly (fails, not
silently drops coverage) the moment the pack is re-cut:

| File | Line | Title |
|---|---|---|
| `Chautauqua Overview.dc.html` | 353 | `Widths · what a wide monitor gets` |
| `Chautauqua Home.dc.html` | 326 | `Rules you can't see on the page` |
| `Chautauqua Docs.dc.html` | 210 | `How the screenshots are made` |

**Desktop frames after exclusion: 108 − 3 − 3 = 102.**

### Per-file breakdown (after exclusion)

| File | Desktop frames |
|---|---|
| Chautauqua Account.dc.html | 8 |
| Chautauqua Agenda.dc.html | 2 |
| Chautauqua Comms.dc.html | 9 |
| Chautauqua Contacts.dc.html | 12 |
| Chautauqua Content.dc.html | 4 |
| Chautauqua Docs.dc.html | 3 |
| Chautauqua Home.dc.html | 3 |
| Chautauqua Overview.dc.html | 5 |
| Chautauqua Public and Portal.dc.html | 13 |
| Chautauqua Review.dc.html | 8 |
| Chautauqua Settings.dc.html | 17 |
| Chautauqua Speakers.dc.html | 10 |
| Chautauqua Submissions.dc.html | 8 |
| **Total** | **102** |

## Claim mechanism

Identical to the phone ledger: a frame is CLAIMED when some `*.test.ts` /
`*.test.tsx` file under `test/` or `app/src/` (enumerated via `readdirSync`,
never named) contains a citation of the form `docs/design/<file>.dc.html:<line>`
whose first line number lands inside that frame's extent.

## Seeded floor

`CLAIMED_FLOOR = 16` -- the count measured on branch `v12m-w2-f`. This is a
two-sided ratchet, mirroring the phone ledger's wave-85 amendment: one test
fails if the measured count drops below the floor (regression), a companion
test fails if it rises above the floor without the floor being raised to
match (a stale floor licenses stagnation). The floor may only ever be
**raised**, and only as a merge-train act after real desktop-parity
citations land -- never a worker's edit mid-lane, never lowered to paper over
a regression.

`goalComplete` for the desktop half of the v12 mobile campaign is
`CLAIMED_FLOOR` reaching 102 of 102.

## Claimed today (16 of 102)

| Frame | Claimed by |
|---|---|
| `Chautauqua Comms.dc.html:750` -- Compose · send blocked | `app/src/pages/comms/RecentSends.render.test.tsx` |
| `Chautauqua Contacts.dc.html:28` -- Directory · 1600 | `app/src/pages/contacts/ContactsTable.render.test.tsx` |
| `Chautauqua Contacts.dc.html:672` -- Import CSV · step 3 of 3 | `app/src/pages/contacts/ImportWizard.review-table-columns.render.test.tsx` |
| `Chautauqua Content.dc.html:28` -- Worklist · 1600 | `app/src/pages/content/SessionList.render.test.tsx` |
| `Chautauqua Content.dc.html:288` -- Files library | `app/src/pages/content/FilesLibrary.render.test.tsx` |
| `Chautauqua Docs.dc.html:28` -- Docs · an article | `test/public-page-title-register.scan.test.ts` |
| `Chautauqua Docs.dc.html:119` -- Docs · the index | `test/public-page-title-register.scan.test.ts` |
| `Chautauqua Docs.dc.html:226` -- Docs · the element library | `test/docs-block-vocabulary.test.ts` |
| `Chautauqua Home.dc.html:28` -- Event hub · desktop | `test/public-home-full-bleed.test.ts` |
| `Chautauqua Overview.dc.html:28` -- What needs you today · 1600 | `app/src/App.render.test.tsx` |
| `Chautauqua Review.dc.html:28` -- Organiser view · 1600 | `app/src/App.render.test.tsx` |
| `Chautauqua Review.dc.html:718` -- New plan · /review/plans/new | `app/src/pages/review/PlanEditor.render.test.tsx` |
| `Chautauqua Settings.dc.html:607` -- Settings · editing the call for papers | `app/src/pages/settings/SettingsEditForm.render.test.tsx` |
| `Chautauqua Speakers.dc.html:28` -- Onboarding grid · 1600 | `app/src/pages/Speakers.render.test.tsx` |
| `Chautauqua Speakers.dc.html:319` -- Speaker detail · /admin/speakers/:contactId | `app/src/pages/speakers/SpeakerDetailPage.render.test.tsx` |
| `Chautauqua Speakers.dc.html:598` -- One task, every speaker | `test/theme.test.ts` |

## Unclaimed (86 of 102)

`<file> :<line> -- <title>`, exactly as the scan's own failure message names
them, so a planner can schedule coverage:

```
Chautauqua Account.dc.html :28 -- Sign in · a card, not a stretched phone
Chautauqua Account.dc.html :69 -- Change password · /account/password
Chautauqua Account.dc.html :101 -- Not found · /admin/*
Chautauqua Account.dc.html :182 -- Reset · ask for a link
Chautauqua Account.dc.html :209 -- Reset · link sent
Chautauqua Account.dc.html :235 -- Reset · choose a new one
Chautauqua Account.dc.html :266 -- Reset · link no longer valid
Chautauqua Account.dc.html :290 -- Sign in · rejected
Chautauqua Agenda.dc.html :28 -- Day grid · 1600
Chautauqua Agenda.dc.html :209 -- Breaks · Tue 12 May
Chautauqua Comms.dc.html :28 -- Compose · step 3 of 4 · 1600
Chautauqua Comms.dc.html :222 -- Templates
Chautauqua Comms.dc.html :360 -- Compose · step 1 of 4
Chautauqua Comms.dc.html :453 -- Compose · step 4 of 4
Chautauqua Comms.dc.html :544 -- Comms · nothing sent yet
Chautauqua Comms.dc.html :589 -- Comms · history
Chautauqua Comms.dc.html :686 -- What each template renders
Chautauqua Comms.dc.html :712 -- DevFlow Conf 2027
Chautauqua Contacts.dc.html :229 -- Contact · drawer
Chautauqua Contacts.dc.html :279 -- Import CSV · step 2 of 3
Chautauqua Contacts.dc.html :312 -- Pipeline · invitations for next year
Chautauqua Contacts.dc.html :352 -- Duplicates · merge
Chautauqua Contacts.dc.html :546 -- Bulk email
Chautauqua Contacts.dc.html :582 -- Add to an event
Chautauqua Contacts.dc.html :617 -- Add to the pipeline
Chautauqua Contacts.dc.html :720 -- Pipeline · an empty stage
Chautauqua Contacts.dc.html :770 -- Import CSV · the file will not do
Chautauqua Contacts.dc.html :808 -- New contact
Chautauqua Content.dc.html :111 -- Session deliverables · /content/:submissionId
Chautauqua Content.dc.html :434 -- Upload rejected
Chautauqua Home.dc.html :181 -- Between cycles · desktop
Chautauqua Home.dc.html :269 -- Fresh deploy · desktop
Chautauqua Overview.dc.html :308 -- New event
Chautauqua Overview.dc.html :432 -- Overview · a brand-new event
Chautauqua Overview.dc.html :476 -- States · hover, pending, drag
Chautauqua Overview.dc.html :689 -- Loading · the first paint
Chautauqua Public and Portal.dc.html :28 -- Sessions and agenda · 1600
Chautauqua Public and Portal.dc.html :132 -- Agenda · 1600
Chautauqua Public and Portal.dc.html :249 -- Agenda · a track highlighted
Chautauqua Public and Portal.dc.html :680 -- Speakers · list view
Chautauqua Public and Portal.dc.html :730 -- Speakers · grid view
Chautauqua Public and Portal.dc.html :779 -- My schedule · /e/:slug/schedule
Chautauqua Public and Portal.dc.html :894 -- Submit a talk · /submit/:slug
Chautauqua Public and Portal.dc.html :1101 -- CFP closed
Chautauqua Public and Portal.dc.html :1167 -- Public sessions · nothing published
Chautauqua Public and Portal.dc.html :1211 -- Submit a talk · rejected on submit
Chautauqua Public and Portal.dc.html :1373 -- Portal · Edit your session · desktop
Chautauqua Public and Portal.dc.html :1473 -- Portal preview · /portal/preview
Chautauqua Public and Portal.dc.html :1532 -- CFP not open yet · /submit/:slug
Chautauqua Review.dc.html :183 -- Reviewer scorecard · /review/plans/:id/submissions/:id
Chautauqua Review.dc.html :351 -- Reviewer queue · /review/plans/:id
Chautauqua Review.dc.html :451 -- Plan editor · /review/plans/:id
Chautauqua Review.dc.html :675 -- Plan editor · criteria frozen
Chautauqua Review.dc.html :830 -- Your plans · /review
Chautauqua Review.dc.html :875 -- Plan editor · save rejected
Chautauqua Settings.dc.html :28 -- Event, form, publishing, data · 1600
Chautauqua Settings.dc.html :698 -- Settings · editing the event
Chautauqua Settings.dc.html :788 -- Settings · editing tracks and rooms
Chautauqua Settings.dc.html :869 -- Settings · editing the speaker portal
Chautauqua Settings.dc.html :950 -- Settings · editing people and roles
Chautauqua Settings.dc.html :1021 -- Settings · editing one saved embed
Chautauqua Settings.dc.html :1111 -- Settings · editing your data
Chautauqua Settings.dc.html :1215 -- Settings · save rejected by the server
Chautauqua Settings.dc.html :1271 -- Invite someone
Chautauqua Settings.dc.html :1319 -- Invite · the one-time password
Chautauqua Settings.dc.html :1352 -- Invite · rejected
Chautauqua Settings.dc.html :1392 -- Confirm · reversible
Chautauqua Settings.dc.html :1414 -- Confirm · irreversible
Chautauqua Settings.dc.html :1440 -- Portal resource · add
Chautauqua Settings.dc.html :1477 -- Reset a password
Chautauqua Settings.dc.html :1507 -- Import from Sessionboard
Chautauqua Speakers.dc.html :187 -- New task
Chautauqua Speakers.dc.html :228 -- Task response
Chautauqua Speakers.dc.html :288 -- Participation · open
Chautauqua Speakers.dc.html :442 -- Speakers · search found nothing
Chautauqua Speakers.dc.html :491 -- Review these reminders
Chautauqua Speakers.dc.html :549 -- Speakers · a write failed
Chautauqua Speakers.dc.html :665 -- One task · still waiting
Chautauqua Submissions.dc.html :28 -- Triage at volume · 1600
Chautauqua Submissions.dc.html :187 -- Submission detail · /submissions/:id
Chautauqua Submissions.dc.html :399 -- CFP form builder · /submissions/forms
Chautauqua Submissions.dc.html :495 -- New submission
Chautauqua Submissions.dc.html :531 -- Save this view
Chautauqua Submissions.dc.html :561 -- Submissions · before the CFP opens
Chautauqua Submissions.dc.html :605 -- Submissions · triage queue clear
Chautauqua Submissions.dc.html :655 -- CFP form · edit a question
```

## Divergences found while claiming

Filed by claim lanes as they cite frames, per DEC-976 wave-103: a frame the
tree contradicts stays UNCLAIMED (or is claimed only against its correct
current behaviour, with the stale line explicitly not asserted) rather than
having its assertion weakened to match. Format: frame line, drawn value,
shipped value.

- **`Chautauqua Submissions.dc.html:187` (task v12m-w3-q).** Drawn: the
  co-presenter row's explainer reads "A new co-presenter is emailed a
  portal link · the lead presenter is not changed". Shipped:
  `SubmissionDetailPage.tsx:1747-1752` reads "Adding a co-presenter here
  sends no email — sending a portal invite is a separate, explicit action.
  The lead presenter is not changed." -- DEC-604 (wave-70 amendment)
  deliberately corrected the frame's claim; `POST
  /submissions/:id/participants` never sent an email. Consistent with the
  field guide's w79 note that the portal-side co-presenter door states the
  same fact and "neither door sends". `test/desktop-frames-submissions.test.ts`
  claims this frame against the corrected, current copy rather than the
  frame's stale line.
