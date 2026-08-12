# MANDATE — root homepage: instance hub, not marketing (queued 2026-08-12)

**THE DESIGN HAS ARRIVED and is authoritative: design pack v2 at
`chautauqua-research/design-pack-v2.zip` (also `~/Downloads/home.zip`). It is the FULL
handoff bundle re-issued: new `Chautauqua Home.dc.html` + `screens/12-home.png`, an
expanded README (§Open decisions — read it in full, it IS the spec: data contract,
redirect rules, privacy test, grouping, three states), plus date-consistency touch-ups
in Overview/Public-Portal/Settings/Submissions. When applying mandates, RE-VENDOR v2
over `docs/design/` (replacing v1, minus `support.js`, per precedent). Rendered frames:
`chautauqua-research/design-frames/12-home--*.png` (3 states × 2 widths + notes panel).**

Key points the implementation must honor (from the v2 README):
- `/` renders for ANONYMOUS visitors only; signed-in organizer/reviewer → `/admin`,
  speaker → `/portal` (new redirects — today `/` ignores auth).
- Masthead is the ORG's name; the product appears exactly once, in the footer
  ("Running on ⚙ Chautauqua · open-source…", GitHub link — the pack's single SVG).
- List only events with an OPEN CFP (`formWindowState → open`) or published sessions;
  never unannounced/not-yet-open/empty events. Rows carry public-safe facts only —
  the test for any field: "would you mind a competitor reading it?"
- Groups: Open for submissions ("NO ACCOUNT NEEDED" caption) / Programme published /
  Already happened; deadline-soonest within groups, past events newest-first.
- Three page states, each at 900 and 390: full hub / between cycles (archive leads) /
  fresh deploy (the only empty state; sign-in only).
- Styling from the public CSS family (`public.css.ts`), NOT `TOOLS_CSS` — revises
  DEC-382 for `/` only.

## SEED COHERENCE (work item the README deliberately left to us)

The README proves the seed's dates can't support the mocks' numbers (CFP "6 days left"
vs tasks overdue in April — impossible under close_date 2027-03-01 with any single
"today"). We OWN the seed, so resolve it there: pick a canonical demo "today" and move
the seeded CFP `close_date` to ~2–3 weeks after it (keeping task due dates behind it),
so that ALL of these hold at once for judges: CFP open with a near deadline (no-login
CFP rubric + the hub's marquee row), populated overdue-task worklist on Overview, and
coherent countdowns everywhere. Every countdown/status must derive from the same clock.

## What the root URL (`/`) is

The self-hoster's **event hub** — NOT a marketing page for the software. A deployed
Chautauqua instance belongs to one org running many events; visitors at the root are
speakers with a CFP link, attendees looking for a program, and organizers heading to
login. Rationale discussed and agreed 2026-08-12: a marketing page at an instance root
is the software talking about itself to people who came for a conference; the field's
marketing-page roots are a reflex we deliberately reject. Marketing lives in the README.

## Behavior

1. **Published events of the org, newest/upcoming first** — one card each: name, dates,
   venue, links to public program (`/e/:slug/sessions`), speakers, and — when its CFP
   form is open — a prominent "Submit a talk" (`/submit/:slug`). Events with published
   content sort above empty ones (also fixes the forward-summit-2028 landing bug in
   NEXT-STEPS §5).
2. **Identity line** (header or footer, small): "Powered by Chautauqua — open-source
   speaker & event management" linking to the GitHub repo. Instance-appropriate; a
   self-hoster may remove it.
3. **RESOLVED (user decision 2026-08-12): NO demo buttons on the hub** — the homepage
   stays exactly as designed (org-owned, quiet "Sign in" link only). The demo
   affordance moves to **`/login`** instead: when the seeded demo identities exist in
   the database, the login card shows three small links — "Use demo organizer /
   reviewer / speaker" — that PREFILL the email + password fields (never auto-submit;
   the real auth flow stays visible, consonant with the login design's "One door,
   three roles" framing). Renders nothing when the demo accounts are absent. No new
   endpoint, no auto-login — prefill only.
4. Organizer "Sign in" link to `/login` stays discoverable but quiet.

## Constraints

- Server-rendered (Hono JSX, like other public surfaces); design tokens from the
  handoff (paper/olive/ink, Familjen/Figtree); no new dependencies.
- Multi-event is the point — this page is living proof of CFP-17/18.
- Gates as usual; render-sweep must cover `/`.
