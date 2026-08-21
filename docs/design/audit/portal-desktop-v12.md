# Portal/Submit v12 DESKTOP (1600) per-frame render verdicts (task w24-i, DEC-613/DEC-651 wave-24 amendments)

Per-frame render VERDICTS for seven of `Chautauqua Public and Portal.dc.html`'s
desktop and window-state frames — the CFP form's open state, its two closed
window states, the fresh-empty public sessions state, a rejected-on-submit
state, the desktop Portal edit view, and the organizer Portal preview —
entered through the app's real routes (`app.request(...)`) and asserted
against the returned HTML STRING. This supersedes
`test/desktop-frames-public.test.ts` and `test/desktop-frames-portal.test.ts`'s
citation-only claims for these seven frames specifically: every MATCHES/
DIVERGES row below was RENDERED off a real request, not merely cited against
source text. Receipts live in
`test/portal-submit-desktop-frame-verdicts.test.ts`.

**HARNESS RULE (DEC-613 wave-24 amendment):** every harness in that file is
copied unchanged from an existing `buildApp` — the mock-free `Hono<AppEnv>` +
`publicSubmitRoutes`/`publicRoutes` shape from
`test/public-390-frame-verdicts.test.ts` for the /submit and public-sessions
frames, and the four `vi.mock` blocks + `buildApp()` + `speakerAuth` from
`test/portal-390-frame-verdicts.test.ts` for the two /portal frames. Only
path, auth and fixture VALUES vary.

**STATE-DRIVEN, NEVER DIRECTLY MOUNTED (DEC-651 wave-24 amendment):** the two
CFP-window states and the fresh-empty sessions state are reached by setting
real fixture dates/row counts and letting the route's own
`formWindowState`/`isFresh` predicate decide the branch — never by importing
`ClosedPage`/`NotYetOpenPage` and mounting it directly.

STRICTLY MEASUREMENT ONLY (the mandate's desktop freeze): this document and
its test file render, verdict, and file divergences in prose — they move no
desktop byte and edit no route module or `*.css.ts`, even where a real
divergence is found below.

## Frame :894 "Submit a talk · /submit/:slug" (open window state)

**MATCHES.** Entered via `GET /submit/:eventSlug` at the open window state
(`formWindowState` resolves `open` from a form with no `openDate`/
`closeDate`).

- The h1 reads `Submit a talk` (frame :902), rendered by
  `submit-views.tsx`'s `SubmitPage`.
- The Track/Format two-column row (frame :930-943, `display:grid;
  grid-template-columns:1fr 1fr; gap:18px`) MATCHES structurally —
  `.chq-cfp-track-format-row` wraps a `<legend>Track</legend>` fieldset
  beside a `<legend>Session format</legend>` fieldset, in that order.
  `test/desktop-frames-public.test.ts` already claimed the class token by
  source citation (`:894 Submit a talk -- the Track/Format two-column row is
  .chq-cfp-track-format-row`); this verdict is the first to prove the token
  actually renders in a real response.
- The dock (frame :989-990, `Submit this talk` primary + `Save draft`
  secondary) MATCHES both labels verbatim.

## Frame :1101 "CFP closed" (window state)

**MATCHES.** Entered via `GET /submit/:eventSlug` with a fixture
`closeDate` in the past — the SAME route as the open-state frame above,
driven into the closed branch by `formWindowState`, never by mounting
`ClosedPage` directly (DEC-651).

- Heading `The call for papers has closed` (frame :1103) MATCHES verbatim.
- Body opens `Submissions closed on` (frame :1104) MATCHES.
- The one link, `Browse the sessions ›` (frame :1107), MATCHES.
- Confirmed the branch is real, not an accident of a shared template: the
  same request never renders `.chq-cfp-track-format-row`, the open-state
  frame's own form-field marker.

## Frame :1532 "CFP not open yet · /submit/:slug" (window state)

**MATCHES** (DESIGN-RULINGS "CFP — the third window state"). Entered via
`GET /submit/:eventSlug` with a fixture `openDate` in the future, driven
into the `not_yet_open` branch by `formWindowState`.

- The heading LEADS with the date the form opens (`The call for papers
  opens on`, frame :1540) rather than an apology — the dateless
  "Submissions aren't open yet" wording DESIGN-RULINGS reserves for a form
  with no `open_date` set never renders for this (real-`openDate`)
  fixture.
- `You will not need an account.` (frame :1543's clause) MATCHES.
- DEC-986 (wave-130 amendment, cited in `submit-views.tsx`): the frame's
  "Three tracks, five formats." clause is deliberately NOT adopted here —
  `submit-get.tsx` returns before fetching tracks for this window state, so
  a track count would be fabricated. A previously-filed and settled
  divergence, not new debt.

## Frame :1167 "Public sessions · nothing published" (fresh-empty state)

**MATCHES.** Entered via `GET /e/:eventSlug/sessions` with a fixture that
resolves zero visible sessions — the route's own `isFresh` predicate
(`!anyFilterActive && grandTotal === 0`) decides the branch, never a
hand-set `SessionsContent` prop (DEC-651).

- The headline `The programme is not out yet` (frame :1174, adjacent
  reason sentence diverges — see below) renders inside
  `.chq-pub-sessions-fresh-layout`.
- **DIVERGENCE NAMED, not force-fit** (DEC-745 wave-107 amendment,
  restated here per this task's own instruction rather than re-filed): the
  frame's reason sentence names a CFP close DATE ("...closed on 16
  August."); this app's reason sentence
  ("Sessions appear here once the schedule is published.") stays, because
  a day label derived from a stored instant is a timezone bomb (DEC-522)
  and the bare close date is not actionable for a visitor with no CFP form
  to act on.
- The `Last year` aside (frame :1187-1198, a 300px `<aside>` linking the
  prior edition's session list) MATCHES. `test/desktop-frames-portal.test.ts`
  (branch v12m-w5-c) filed this as an unclaimed divergence ("No such
  feature exists anywhere in the tree"), and
  `test/public-sessions-lastyear.test.ts` later built it via a direct
  `SessionsContent(...)` call (predating DEC-651's wave-24 state-driving
  rule). This verdict is the first to prove it live off a REAL request:
  supplying a qualifying prior edition through the fixture db and letting
  the route's own `getPriorPublicEvent` call render the aside, unprompted
  by any hand-built prop.

## Frame :1211 "Submit a talk · rejected on submit" (state)

**MATCHES.** Entered via a real `POST /submit/:eventSlug` whose body
withholds a required field (`field__description`), supplies a malformed
email, and omits a track choice — a real product validation failure, not a
re-typing of the frame's own illustrative sample copy (an over-limit
abstract, an unpicked track, a malformed email).

- The top-of-form band (frame :1214-1220) MATCHES structurally:
  `.chq-error-summary[role="alert"]` opens with an `<h2>` reading "N things
  need fixing before this can be sent" (this fixture's own problem count —
  asserted via the shared `thingsNeedFixingHeading` stem, not a hardcoded
  "Three" the way the frame's sample happens to read), lists each problem
  as a link, and closes with "Nothing was lost. Everything you typed is
  still below." (frame :1220) verbatim.
- Both actions still render below the summary (frame :1290-1292, `Submit
  this talk` + `Save draft`) — the frame's own rule that nothing typed is
  discarded on a rejected submit.

## Frame :1373 "Portal · Edit your session · desktop" (form view)

**MATCHES** (DEC-029 wave-108). Entered via authenticated `GET
/portal/submissions/:id/edit` (speaker auth).

- `Edit your session` h1, `On this session` participant list section, and
  `Add a co-presenter` section all MATCH (frame :1387/:1418/:1444), in
  that order, inside exactly one `<form id="chq-portal-edit-form">`.
- **DEC-029 (wave-108): the co-presenter Add control is a SECOND SUBMIT of
  the one form, never a second `<form>`.** Every co-presenter input
  (`cp-first-name`, `cp-last-name`, `cp-role`) carries
  `form="chq-portal-edit-form"`, and the Add button additionally carries
  `formaction="/portal/submissions/:id/participants"` +
  `formenctype="multipart/form-data"` — so in-progress title/abstract/
  track edits ride along with an Add submission, exactly as the frame's
  footer row (`Cancel` / `Save changes`, frame :1465-1466) implies a single
  save surface.
- `test/desktop-frames-portal.test.ts` already claimed this frame's copy by
  source citation; this verdict is the first to prove the DEC-029 wiring
  live off a real authenticated request.

## Frame :1473 "Portal preview · /portal/preview" — UNREACHED

**UNREACHED** via the mandated `test/portal-390-frame-verdicts.test.ts`
harness (DEC-613 wave-24 amendment). `src/routes/portal/preview.tsx`'s `GET
/preview` handler reads `getEventForOrg` (from
`src/server/repo/events.ts`) and, on a resolved event,
`getPortalSettingsForEvent`/`listResourcesForEvent` (from
`src/server/repo/portal-config.ts`) directly against `c.var.db` — none of
which are among the portal-390 harness's four `vi.mock` targets
(`src/server/repo/portal`, `src/server/repo/forms`,
`src/server/repo/portal-edit`, `src/server/repo/profile`). That harness's
`buildApp()` sets `c.set("db", {} as never)` precisely because every route
it exercises reaches the db only through a mocked repo function; reaching
`/portal/preview`'s real welcome/resources render would need a fake `db`
select-chain (the `test/public-390-frame-verdicts.test.ts` harness's
`makeChain` idiom) answering `getEventForOrg`'s and
`getPortalSettingsForEvent`'s/`listResourcesForEvent`'s own selects — which
this task's own instruction forbids building as a fifth mock stack.

**MISSING CAPABILITY:** a `db` fixture reachable by both harnesses at once —
either the portal-390 harness's `vi.mock` set extended to cover
`repo/events`/`repo/portal-config`, or a documented exception letting a
`/portal/preview`-specific lane build the `makeChain`-style fake db the
public-390 harness already establishes. Either is a planning decision, not
a call this measurement-only lane can make unilaterally.

## Summary

| Frame | Verdict |
| --- | --- |
| :894 Submit a talk · /submit/:slug (open) | MATCHES |
| :1101 CFP closed | MATCHES |
| :1532 CFP not open yet · /submit/:slug | MATCHES |
| :1167 Public sessions · nothing published | MATCHES (reason-sentence divergence, DEC-745, previously filed) |
| :1211 Submit a talk · rejected on submit | MATCHES |
| :1373 Portal · Edit your session · desktop | MATCHES (DEC-029) |
| :1473 Portal preview · /portal/preview | UNREACHED (missing capability: repo/events + repo/portal-config db fixture) |

6 of 7 frames MATCH as rendered off a real request; one previously-filed,
already-adjudicated reason-sentence divergence (:1167, DEC-745/DEC-522)
carries forward unchanged; one frame (:1473) is UNREACHED via the mandated
harness and is named here rather than force-reached with a fifth mock
stack. No desktop byte was moved to produce this verdict.
