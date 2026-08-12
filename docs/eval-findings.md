# MANDATE — implement the design redesign (2026-08-11)

The functional findings are closed (see `docs/design/` history below for the prior round's
record). **This round is a visual redesign.** A complete design handoff now lives in
`docs/design/` — read `docs/design/README.md` FIRST; it is authoritative over everything
here and over the images.

## What this is

A high-fidelity redesign of **every route in `app/src/routeManifest.ts`** plus the modals,
at desktop (1240px) and phone (390px) — 72 frames across 11 `.dc.html` files, with
full-canvas screenshots in `docs/design/screens/`.

It is a **re-skin plus exactly two structural changes**, NOT a rewrite:

1. **Overview becomes the work itself**, not a directory of counts: named speakers with
   Remind on the row, named submissions with Accept/Decline, sessions with Approve. The
   sidebar/nav carries destinations only, with a badge solely when something is wrong.
2. **The agenda works on a phone** via one-room-in-view + tap-to-place (not a shrunken
   grid). This maps onto the existing `PUT /submissions/:id/slot` body
   `{day, startMin, endMin, roomId}` — dragging was only ever the desktop's way of naming
   those four values.

## Hard rules

- **Do NOT port `support.js` or copy inline styles out of the `.dc.html` files.** Those are
  design references built on a streaming component runtime. (`support.js` has been removed
  from the bundle on purpose.) Recreate the designs in our existing environment: React 18 +
  React Router v6 + Vite for the admin SPA (`app/src/`), Hono JSX SSR for portal and public
  (`src/routes/`). The design needs **no CSS framework**.
- **Styling goes in `app/src/styles.css`** (already uses the `--chq-*` convention): replace
  the token values with the handoff's, add the new component classes. Portal/public SSR
  pages get their own styling pass against the same tokens.
- **Preserve behavior exactly.** Optimistic updates with loud rollback; bulk selection
  spanning pages sent in batches of 100 (`chunkSelection`, DEC-193 refetch-don't-restore);
  conflicts surfaced never blocked; reminders bulk-per-event with the
  `MANUAL_DEDUPE_WINDOW_MS` caption next to the send button; **deciding never emails**;
  reviewers confined to `/review`; task status `pending|complete` only; itinerary in
  `localStorage` → `schedule.ics?ids=`; drafts in KV. The handoff's "Interactions &
  behaviour" section restates these — it changes none of them.
- **Copy rules are binding** (handoff §Copy rules): no explanatory clauses in chrome, never
  promise time, never assert what no endpoint stores, state the constraint you need before
  acting, plain section names from the app's own vocabulary.
- **Fonts are already vendored** at `public/fonts/FamiljenGrotesk-var.woff2` and
  `Figtree-var.woff2` — 44 KB total, both **variable**, so `@font-face` must declare weight
  *ranges* (`400 700` / `400 800`) with `format('woff2-variations')`. See
  `public/fonts/README.md`. Do not add a Google Fonts network request.
- **No new colours.** There is no red and no third accent; lateness/clashes/not-reviewed are
  set in type (weight 800, uppercase, tracked), in Ink. Do not reintroduce a semantic red.
- **Accessibility is part of done**: WCAG AA on every text/background pair, 10px type floor,
  44px tap targets on phone, meaning never carried by colour alone.

## Order (follow it — it degrades gracefully)

The handoff's suggested order is deliberate: each step must land **green and deployable**,
because we may ship at any point before the deadline.

1. Tokens + the shell (header, nav, section pattern) in `styles.css`
2. **Overview** — biggest behavioural change, proves the row pattern
3. Submissions (table + detail + form builder) — highest-traffic admin screen
4. Speakers, Content, Comms, Contacts, Review, Settings
5. Agenda desktop, then phone tap-to-place
6. Public surfaces + portal (server-rendered — separate styling pass)
7. Login, password, not-found

## Gates (unchanged, all must stay green)

`npm run build` · `npm test` · `npm run gate:render-sweep` (desktop **and** mobile routes) ·
`npm run walkthrough` · `npm run perf:smoke`. A restyle that breaks a walkthrough step or a
render-sweep route is a failed task, not a tradeoff. **Add** to the render-sweep (or a new
sibling gate) two cheap design invariants that this round makes checkable:

- no computed `font-size` below 10px anywhere in the rendered admin/portal/public routes;
- every interactive element at 390px width has a ≥44px tap target.

## Scope discipline

Nothing outside the redesign. No new features, no new dependencies, no CSS framework, no
refactors of working data-fetching or role gating. If a design frame implies an endpoint we
do not have, render what the existing endpoints actually return and note the gap in the wave
summary rather than inventing an API.
