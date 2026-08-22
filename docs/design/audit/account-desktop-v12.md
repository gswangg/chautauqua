# Account v12 DESKTOP (1600) per-frame render verdicts (w24-f, DEC-613/DEC-651 wave-24 amendments)

Per-frame render VERDICTS for the eight desktop frames on `Chautauqua
Account.dc.html`, entered through the app's real routes and asserted
against the returned HTML STRING's structure/order/text only (an SSR
response carries no computed layout). Receipts live in
`test/account-desktop-frame-verdicts.test.ts`.

STRICTLY MEASUREMENT ONLY: this document and its test file render,
verdict, and file divergences in prose -- they move no desktop byte and
edit no route module or `.css.ts`, even where a divergence is found below.

Every harness is COPIED, never re-authored (DEC-613's wave-24 amendment):
the Sign-in card and its rejected-credentials state reuse
`test/home-account-docs-390-frame-verdicts.test.ts`'s queue-based
`homeFakeDb`/`homeBuildQueue`/`loginFakeDb`/`accountSigninBuildApp` shape;
the Change-password card reuses that same file's real-drizzle-`eq()` fake
db (`makePasswordFakeDb`/`seedUser`/`passwordBuildApp`/
`loginForPasswordPage`); the four password-reset states and the two STATE
frames reuse `test/password-reset-flow.test.ts`'s in-memory `node:sqlite`
+ drizzle sqlite-proxy harness. The two STATE frames -- "Sign in ·
rejected" and "Not found · /admin/*" -- are each entered by operating the
real route that produces them (a POST with bad credentials; an unmatched
GET) rather than a direct error-view component mount, per DEC-651's
wave-24 amendment.

## Frame :28 "Sign in · a card, not a stretched phone"

**MATCHES.** Entered via `GET /login` (authRoutes).

- The frame's own caption is the verdict's subject: a CARD, not a
  full-bleed stretch. An SSR HTML string carries no computed layout (jsdom
  is not involved at all here), so this is verdicted against
  `src/routes/auth.css.ts`'s own stylesheet TEXT, the same idiom
  `docs/design/audit/speakers-desktop-v12.md`'s grid-weight-inversion
  finding uses for an inherently-CSS fact: `.chq-auth-card` declares
  `max-width: 460px` and `align-self: center`, matching the frame's own
  inner card at :30 (`max-width:460px`).
- The rendered markup carries `<main class="chq-auth-card">`, the
  wordmark (`chautauqua`), and the event-scoped subtitle ("Sign in to
  DevFlow Conf 2027"), matching :30-38's anatomy.

## Frame :69 "Change password · /account/password"

**MATCHES.** Entered via an authenticated `GET /account/password`
(authRoutes login, then accountRoutes).

- The `‹ Back` link, the `Change your password` title, all three field
  labels (Current password / New password / New password again), and the
  Change it / stay-signed-in hint row all render, matching :71-88's
  anatomy verbatim by class and text.

## Frame :101 "Not found · /admin/*"

**MATCHES** (STATE frame, DEC-651). Entered via an authenticated `GET
/admin/no-such-route` against the shared `app.notFound()` catch-all
(`src/server/not-found.tsx`'s `registerNotFoundHandler`), never a direct
`NotFoundDocument()` mount.

- "That page isn't here", the "link may be old..." body copy, and the two
  organizer footer links (`/admin/overview` "Overview", `/admin/submissions`
  "Submissions") all render, matching :107-111's anatomy.
- The frame's own eyebrow reads the illustrative "DevFlow Conf 2027"; the
  tree's eyebrow is dynamically resolved (`resolveNotFoundEyebrow`) and
  falls back to the literal string `"Not found"` when no org exists in the
  deployment. This test seeds no org (to keep the reset-flow harness's DDL,
  which has no `submission`/`submission_track`/`submission_answer` tables,
  from ever being asked to satisfy `listHubEvents`'s grouped queries), so
  the rendered eyebrow reads "Not found" rather than an event name -- the
  SAME illustrative-value treatment
  `test/home-account-docs-390-frame-verdicts.test.ts`'s Docs verdict
  already gives the frame's illustrative H1 text ("Triaging submissions"
  vs. the real article title). Not a structural divergence: the eyebrow's
  STRUCTURE (an eyebrow span above the H1) matches; only its dynamically-
  resolved VALUE differs by test fixture, exactly as the frame's own
  mockup value is illustrative everywhere else in this pack.

## Frame :182 "Reset · ask for a link"

**MATCHES.** Entered via `GET /forgot` (authRoutes).

- "Reset your password", the "We will email you a link..." subtitle, the
  Email field, and the ‹ Back to sign in / Email me a link row all render,
  matching :188-199's anatomy.

## Frame :209 "Reset · link sent"

**MATCHES.** Entered via `POST /forgot` with a known email (authRoutes),
per DEC-004's byte-identical-regardless-of-match ruling.

- "Check your email", the "Nothing arrived? Check spam..." hint, and the
  Use a different address / Back to sign in row all render, matching
  :215-223's anatomy.

## Frame :235 "Reset · choose a new one"

**MATCHES.** Entered via `GET /reset/:token` on a freshly minted,
unconsumed token (authRoutes).

- "Choose a new password", the "Signing in as {email}." identity line
  (rendered with the seeded fixture's real address, in the same structural
  slot the frame's own illustrative `sbek-speaker@example.com` occupies),
  and the Save and sign in button all render, matching :241-250's anatomy.

## Frame :266 "Reset · link no longer valid"

**MATCHES.** Entered via a SECOND `POST /reset/:token` against an
already-consumed token (authRoutes), which 410s.

- "That link has expired", the "This link has already been used, or it
  has been replaced by a newer one." body copy, and the ‹ Back to sign in
  / Send a fresh link row all render, matching :272-277's anatomy.

## Frame :290 "Sign in · rejected"

**MATCHES** (STATE frame, DEC-651). Entered via `POST /login` with a
wrong password against a real seeded user (authRoutes), never a direct
`LoginPage({error: LOGIN_REJECTED})` mount.

- The response is a real `401`, and the refusal band renders "That email
  and password do not match" / "Check both, or reset your password." --
  `src/routes/auth-helpers.ts`'s `LOGIN_REJECTED` constant's own comment
  cites this exact frame line, and the rendered `<h2>` text matches
  verbatim.
- The "Forgot your password?" link still renders on the rejected state,
  matching :317's anatomy (the same link the "Sign in · a card" frame
  draws at :50, unconditional on error state).

## Summary

| Frame | Verdict |
| --- | --- |
| :28 Sign in · a card, not a stretched phone | MATCHES |
| :69 Change password · /account/password | MATCHES |
| :101 Not found · /admin/* | MATCHES |
| :182 Reset · ask for a link | MATCHES |
| :209 Reset · link sent | MATCHES |
| :235 Reset · choose a new one | MATCHES |
| :266 Reset · link no longer valid | MATCHES |
| :290 Sign in · rejected | MATCHES |

8 of 8 frames MATCH as rendered. No desktop byte was moved to produce this
verdict.
