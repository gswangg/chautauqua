# Portal + public-empty SSR desktop frame verdicts (task w26-h)

3 of Public-and-Portal's 13 desktop frames — the last three no ledger owns.

`docs/design/audit/desktop-frame-ledger-v12.md`'s population lists 108
desktop frames across the pack, 20 of them in
`docs/design/Chautauqua Public and Portal.dc.html`. That ledger's own
"Divergences found while claiming" section records that its six
portal/refusal frames (:1101, :1167, :1211, :1373, :1473, :1532) are
"claimed by `test/desktop-frames-portal.test.ts`, which asserts all six by
line number ... RESOLVED, not a gap in this ledger" — but
`test/desktop-frames-portal.test.ts` is a **source scan**
(`readFileSync` over `src/routes/...` plus a nearby `expect()`, never a
dispatched request), the same "SSR phone-frames tests were source scans not
requests" shape wave-25's field-guide entry names for the phone half. A
citation is not a render (DEC-967). This file supplies the missing render
verdict for the three of those six frames this task was assigned — :1373,
:1473, :1167 — via `test/portal-desktop-frame-verdicts.test.ts`, which
dispatches a real request through a `Hono<AppEnv>` with the actual route
sub-app mounted and asserts the returned HTML string's structure and order.

**Sibling lanes**, per this same ledger's claim map:

- `:1101` (CFP closed), `:1211` (Submit a talk · rejected on submit), `:1532`
  (CFP not open yet) — the other three of the six `test/desktop-frames-
  portal.test.ts` cites — remain **source-scan-only**, still open for a
  future render-verdict lane (out of this task's scope, which named exactly
  :1373/:1473/:1167).
- `:28, :132, :249, :680, :730, :779, :894` — the seven non-portal public
  frames in this file — are claimed by `test/desktop-frames-public.test.ts`
  (also a source scan; not touched here).
- The remaining ten Public-and-Portal desktop frames (Agenda/Speakers/
  Submit/Submitted states, :1017-1211 CFP flow, etc.) sit outside both this
  task and the two source-scan files above.

MEASUREMENT ONLY (DEC-651 wave-26): this task fixed nothing, and touched no
route module and no `.css.ts`.

## 1. `:1373` "Portal · Edit your session · desktop" — MATCHES

`GET /portal/submissions/:id/edit` (`src/routes/portal/edit.tsx`'s
`EditPage`). Back link, H1, Title/Abstract/Session-length fields, the
"On this session" participants list, the "Add a co-presenter" section, and
the terminal Cancel/Save row all render in the frame's own top-to-bottom
order.

The one clause this task's brief called out by name — that the co-presenter
controls are a **second submit of `#chq-portal-edit-form`**, not a second
form (DEC-029's wave-108/114 amendment) — verdicts true: every co-presenter
input (`cp-first-name`, `cp-last-name`, `cp-email`, `cp-role`) carries
`form="chq-portal-edit-form"`, and the "Add co-presenter" button carries
`formaction="/portal/submissions/:id/participants"
formenctype="multipart/form-data"` on that same form id rather than opening
a form of its own. The page renders exactly three `<form>` elements total:
the one edit form, plus PortalLayout's own two shared sign-out forms
(header + footer, DEC-154 chrome every `/portal/*` page carries) — never a
fourth, standalone co-presenter form. The frame draws this section inline
below "On this session" with no visual seam marking it as a second door,
which is exactly what the second-submit wiring produces: one page, one
form, two submit buttons.

Not asserted: the frame's own `560px` "one portal view with a form" note.
That is a already-adjudicated, already-cited deviation
(`docs/design/DEVIATIONS.md` §6, "Portal measure WIDENED against the
frames: `--chq-portal-measure` 560px (drawn) -> `var(--chq-measure)` (the
820px admin/overview measure)", confirmed live at
`src/routes/portal/portal.css.ts:328`) — re-asserting it here would just be
a second citation of the same ruling, not a new finding.

## 2. `:1473` "Portal preview · /portal/preview" — MATCHES

`GET /portal/preview` (`src/routes/portal/preview.tsx`'s `PreviewPage`,
organizer-only). The identity slot ("Preview · no speaker"), the "Preview ·
read-only" banner (with the frame's own explanatory sentence verbatim), the
Welcome hero + configured welcome message, the Resources section, the "Not
shown here" chip row (Their submissions / Their tasks / Their uploaded
files), and the "‹ Back to settings" link all render in the frame's own
order. The one sanctioned disabled control (`Download`, DEC-747) is present
and inert; no other mutating control appears anywhere in the content the
frame draws — the page's only `<form>` is PortalLayout's shared footer
sign-out, chrome the frame's own annotation ("An organiser looking in · not
an impersonation") never depicts as part of this screen's content.

## 3. `:1167` "Public sessions · nothing published" — MATCHES

`GET /e/:eventSlug/sessions`, fresh-and-empty branch
(`src/routes/public/sessions.tsx`'s `SessionsContent`, fed by
`dispatch.tsx`'s `renderSurfaceContent`). This is the frame this task's
sibling ledger's own `test/desktop-frames-portal.test.ts` leaves
**UNCLAIMED**, with a header comment stating the frame's "Last year" aside
"has no feature behind it anywhere in the tree" (`grep -rn "Last year" src/`
returning nothing, as of that file's own wave). That claim has rotted
(DEC-976's recurring "grep the tree, not the ledger's own claim" lesson,
restated at field-guide waves 17/21/25/26): `dispatch.tsx:116` now calls
`getPriorPublicEvent` (DEC-745, wave-107 amendment) exactly on the
fresh-empty branch, and `sessions.tsx`'s `.chq-pub-lastyear-rail` renders
its result — the "Last year" aside genuinely exists and is wired end to
end. This file's render verdict supersedes that stale UNCLAIMED note for
:1167 specifically (the other two frames `test/desktop-frames-portal.test.ts`
marks UNCLAIMED-or-partial, `:1373`'s 560px note and any other file's own
findings, are untouched here).

Verdicted: the filter chrome (`chq-pub-filter-row`/`chq-pub-active-filters`)
is hidden entirely on the fresh-empty branch, matching DESIGN-RULINGS.md
B7's "fresh and empty hides the filter chrome entirely" rule and the
frame's own chrome-free anatomy at :1167-1210; the headline "The programme
is not out yet" renders via `PublicEmptyState`'s `fresh` variant; the
"Last year" aside names the prior event (`DevFlow Conf 2026`), its session
count ("48 sessions"), and a "Sessions ›" link to that event's own sessions
surface, matching the frame's card at :1187-1198 in shape (name, count,
escape link) — the visitor-facing structure the frame draws is what
renders.

One divergence, already named in this file's own source comment
(`sessions.tsx`, above the `PublicEmptyState` call) and left as-is per this
task's measurement-only scope: the frame's reason sentence names a CFP
close **date** ("The call for papers closed on 16 August."); the shipped
copy reads "Sessions appear here once the schedule is published." instead.
The comment there records why: a day label rendered as a headline sentence
without going through the event's own timezone is exactly DEC-522's
"day label from a sub-day clock offset is a timezone bomb" failure mode,
and DESIGN-RULINGS.md B7 rule 2 ("give the reason only when it is
actionable") does not require a bare close date specifically — this is a
considered, in-code-commented adjudication, not an oversight, so it is
named here rather than asserted around.

No button renders on this branch — B7 rule 3 ("no button at all" when the
visitor cannot act) and `PublicEmptyState`'s own `fresh` variant (which has
no action prop at all, by construction) agree, and the "Last year" aside's
own link is a plain `<a>` navigational escape to a different event's
surface, never a `.chq-btn-primary`.
