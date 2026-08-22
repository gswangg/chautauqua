# Shell header · 390 real-mount verdict (task w22-e, SHELL LANE, DEC-576/DEC-919/DEC-967/DEC-976/DEC-385)

`docs/design/Chautauqua Settings.dc.html:277-279` ("Settings" 390 landing)
draws the shell header band as a two-element row above every admin page's
own H1 -- the `chautauqua` wordmark, and a right-flushed identity span. Its
prior citer, `docs/design/audit/settings-hub-390-v12.md`, recorded both
elements as **NOT INSTRUMENTABLE HERE**: a page-scoped real mount of
`SettingsPage` alone mints neither `.chq-header` nor `.chq-wordmark`, and
named the correct owner as "a future shell-level frame-verdict lane
covering App.tsx's Header across every page it wraps" — no wave had opened
it. `src/decisions-data/DEC-576.md`'s own `## Amendment (wave 22)` records
the same gap and rules the band is verdicted ONCE, at the shell, by a real
mount of `App.tsx`'s `Header()`. This is that receipt.

**Every admin 390 frame draws the same literal band, byte-for-byte** —
confirmed by direct read, not assumed:

| Frame | Wordmark literal |
|---|---|
| Chautauqua Settings.dc.html:278 | `font-size:20px; ...; top:-2.5px` |
| Chautauqua Submissions.dc.html:140 | same |
| Chautauqua Content.dc.html:201, :250 | same |
| Chautauqua Contacts.dc.html:182 | same |

Because the wordmark and the identity slot are rendered by the ONE shared
`Header()` in `app/src/App.tsx`, mounted once by every admin route, a
single real mount of the real `App` (its own `BrowserRouter`, an organizer
fixture, the harness `app/src/App.render.test.tsx` already uses) verdicts
the band for every page that shares it — a page never renders its own copy
of `.chq-header`.

**Receipt**: `app/src/App.header390.render.test.tsx`. MEASUREMENT (plus one
narrow fix, below) — `App.tsx` itself is untouched; the one CSS change is
inside `app/src/styles.css`'s terminal `@media (max-width: 700px)` block,
scoped to `.chq-header .chq-wordmark`.

## Verdict table

| Frame region | Drawn literal | Verdict | Notes |
|---|---|---|---|
| Wordmark span | `font-family:'Familjen Grotesk'; font-size:20px; font-weight:700; letter-spacing:-0.03em; line-height:1; position:relative; top:-2.5px` | **DIVERGES-fixed** | Before this lane, `.chq-wordmark` carried no phone-width override at all — the desktop 22px/`top:-3px` pair rode through unscaled to 390. Fixed: `app/src/styles.css`'s terminal phone block gains `.chq-header .chq-wordmark { font-size: 20px; top: -2.5px; }`. This is not a new judgement — the wordmark's own DEC-991 comment (styles.css, beside the base `.chq-wordmark` rule) already states the matching optical-nudge value for 20px ("-3px at 22px, -2.5px at 20px, -2px at 17px"); this lane applies the existing scale. Desktop's rule is untouched (DEC-385 single-direction), pinned by the receipt's own top-level-vs-phone-rule pair of assertions. |
| Right-flushed identity slot | `margin-left:auto; font-size:12px; font-weight:600; color:#565A4B`, plain `<span>DevFlow 2027</span>` | **DIVERGES-blessed** | See adjudication below — the app renders `<EventSwitcher />`'s `.chq-eventswitcher-menu-btn`, a real accessible control, not an inert span. Blessed by DEC-576's own base ruling, which predates this wave and predates the mobile campaign entirely. |
| Band geometry (`border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0`) | — | **MATCHES** | `.chq-header`'s top-level rule already carries `border-bottom: 1px solid var(--chq-ink)` and `flex-shrink: 0` (`--chq-ink: #1b1d17`, byte-identical); the phone block already carried `padding: 14px 16px` before this lane (landed under the wave-22-era `.chq-header` amendment). No change needed. |
| `.chq-nav` (negative: does not render at 390) | Frame draws no primary nav in the phone band | **MATCHES** | `app/src/App.header390.render.test.tsx` asserts `.chq-nav`'s phone rule sets `display: none`, with no top-level counterpart (desktop keeps the full nav) — read from `styles.css` text (jsdom applies no `@media`, so this is a source-scan pin, not a computed-style assertion). |
| `.chq-header-identity .chq-user-identity` (negative: the desktop "JORDAN A. · Sign out" block does not render at 390) | Frame draws no user-identity text in the phone band | **MATCHES** | Same source-scan idiom: the phone rule sets `display: none`; `.chq-header-identity` itself and `.chq-eventswitcher` carry NO phone `display:none` anywhere — only the identity label stands down, never the event switcher (DEC-919: standing the switcher down would strand a real capability with no phone-reachable substitute, since no page renders a second copy). |

## The divergence: `.chq-eventswitcher-menu-btn` vs. the frame's plain `<span>`

DEC-576's own wave-22 amendment names this as the one sub-clause this lane
must adjudicate, not defer: "whether `.chq-eventswitcher-menu-btn`
satisfies the frame's plain right-flushed `<span>` or diverges from it...
a control where the frame draws text is a real DIVERGES row."

**It diverges, and the divergence is already blessed — not newly, by this
lane, but by `DEC-576`'s own base text**, which predates every amendment in
the file: *"DEC-576: desktop header shows the current event as plain text
(13px/600) beside a menu button, not the raw `<select>` this used to
render — switching/create behaviour is unchanged, only the control."* (This
sentence is the literal comment `EventSwitcher.tsx` carries beside its own
`<button className="chq-eventswitcher-menu-btn">`.) Confirmed directly:
`docs/design/Chautauqua Overview.dc.html:33` — the 1600 admin frame, not
just the 390 ones — draws the SAME plain `<span>` for the event name that
every 390 frame draws. The control-vs-span substitution is therefore not a
phone-specific fact this lane is inventing; it is the standing shape of
`.chq-header` at EVERY width, adjudicated once, years before the mobile
campaign, and inherited unchanged at 390.

Why the substitution is right rather than a defect, tested against DEC-919's
capability-removal carve-out ("a stand-down is legal only when every
capability survives on a full-screen path"): event-switching is a real,
load-bearing organizer capability (switch the active event; create a new
one) that a plain `<span>` cannot carry at any width. The frame's static
mockup draws the CURRENT event's name; it cannot draw an interaction the
mockup format has no vocabulary for (a hover/click affordance), the same
class of gap DEC-919's own wave-116 finding names for other controls ("a
frame's silence removes geometry, not capability"). Replacing the control
with inert text to match the frame's literal `<span>` tag would be the
capability-removal DEC-919 forbids, at both widths, not just 390 — so no
legal fix exists that satisfies the frame's tag literally without deleting
a capability every admin page depends on. Filed as DIVERGES-blessed, citing
DEC-576's own base ruling as the precedent (not a fresh blessing minted by
this audit).

**Residual, not a defect of this lane**: the control's rendered register
(`.chq-eventswitcher-name`: 13px, `color: var(--chq-ink)`) differs slightly
from the frame's literal (12px, `#565A4B`/muted) at every width the control
appears, not just 390 — a pre-existing, desktop-frozen fact this lane's
file scope cannot reach (`.chq-eventswitcher-name` sits outside
`.chq-header*`, the selector-prefix boundary this wave's merge-train note
sets, and `app/src/components/event-switcher.css` is not among this task's
owned files). Recorded here as a known register delta for a future
register-owning lane, per DEC-613 wave-104's rule that a lane wires the
shared class and cites the geometry gap rather than forking a shared
sheet for one frame's type register.

## `.chq-shell:has([data-chq-phone-head]) .chq-header` — a frame-driven
## exception, not a hole

DEC-576's own wave-22 amendment names this sub-clause too: the Review
scorecard 390 frames (`docs/design/Chautauqua Review.dc.html:281`, `:935`)
draw NO header band at all — no wordmark, no identity, no Sign out — just
the page's own head band as the phone shell's first child. `styles.css`'s
`.chq-shell:has([data-chq-phone-head]) .chq-header { display: none }`
(inside the terminal phone block; no top-level counterpart, so desktop
keeps its header unconditionally) is the mechanism, and it is opt-in per
page via one attribute. This is verdicted as legitimate BECAUSE it is
scoped to a page whose own frame draws no header band at all — a page that
draws its own head band is verdicted against ITS OWN frame (Review's), not
this one, exactly as DEC-576's amendment states.

`app/src/App.header390.render.test.tsx` asserts the negative this lane's
own instructions require: **`Scorecard.tsx` is the only live setter of
`data-chq-phone-head`** in `app/src`. A file-walk scan (excluding
`*.test.tsx`) collecting every real JSX-attribute or object-literal-key
setter of the string (filtering `//`-commented lines, since
`PhoneAgenda.tsx` mentions the attribute only in prose explaining why it
does NOT set it — DEC-919's wave-20 amendment reversed an earlier call that
would have) returns exactly `['pages/review/Scorecard.tsx']`. A second
setter appearing anywhere else in the tree fails this assertion loudly,
per this task's own instruction.

## Summary

Four of six drawn/negative regions **MATCH** outright. One (the wordmark)
**DIVERGES-fixed** by a narrow, frame-scaled CSS addition inside the
terminal phone block. One (the identity slot) **DIVERGES-blessed**,
carrying forward a substitution DEC-576 itself already ruled correct at
every width, years before this campaign — not a gap this lane leaves open,
a decision this lane records with its precedent. No row is deferred to a
future wave (DEC-576's own text: "adjudicated in this lane and not
deferred").

`docs/design/audit/settings-hub-390-v12.md`'s two former NOT-INSTRUMENTABLE
rows now cite this receipt instead of recording a scope hole.
