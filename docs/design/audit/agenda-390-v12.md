# Agenda 390 v12 fidelity audit -- the pack's only Agenda phone frame

Frame: `docs/design/Chautauqua Agenda.dc.html:127` (extent 127 through
the last drawn label, `{{ slot.length }} free` at :178). Task w29-g. Every
citation below is a verbatim literal from that extent, per DEC-976.

New markup instrument: `app/src/pages/agenda/PhoneAgenda.frame390.render.test.tsx`
mounts `PhoneAgenda` directly (the same harness
`PhoneAgenda.dock-membership.render.test.tsx` already establishes) and
asserts, at request/render level (DEC-976 wave-28: an SSR/SPA phone-frame
verdict is a REQUEST, a CSS-text scan is its companion, never its
substitute):

- exactly one `<h1>` reading "Agenda" (:133)
- the "N unplaced · M clash(es)" counter shape (:131)
- the day strip: one control per event day, in order, "Ddd D" shape (:135-137)
- the room strip: one chip per room, a CLASH marker present only on a room
  that actually clashes -- never on an uninvolved room (:140-142)
- a placed slot's four fields: time, ref·length, title, speaker (:149-155)
- the empty-slot placement control ("Place here" + "N min free") once a
  session is armed (:177-178)
- the dock-membership ruling (DEVIATIONS §3 / DEC-380 wave-116, DEC-576
  wave-114) holds: exactly Unscheduled + Auto-schedule, no Publish
  schedule / Breaks control in `.chq-phone-footer-actions` -- recorded,
  not re-adjudicated, per this task's brief.

Of the 14 previously-unasserted drawn strings this task was scoped
against, 12 are now covered by the tests above. Two resolved to real
frame/code divergences that this lane's file ownership (this test file,
this doc, and `agenda.css`'s TERMINAL `@media (max-width: 700px)` block
only -- no markup/component file) cannot fix in-commit under DEC-385
wave-29's four-condition bar (condition 4: "touches only files the lane
OWNS"; both fixes below require editing `PhoneAgenda.tsx` and/or
`phoneSlots.ts`, neither owned here). Recorded as DIVERGES rows:

## DIVERGES 1 -- :161 "Two sessions in this slot" is spelled in the frame; the built disclosure is numeral-based and never spells the word, even at n=2

Frame:

`<span style="font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase">Two sessions in this slot</span>` (:161)

Built (`app/src/pages/agenda/PhoneAgenda.tsx`, the `slot.kind === 'clash'`
branch):

```
<span className="chq-flag">{countOf(slot.sessions.length, 'session')} in this slot</span>
```

`countOf` (DEC-925, `src/domain/count-copy.ts`) is the codebase's one
count-copy helper and always renders `"${n} ${plural(...)}"` -- a numeral,
never a spelled word, regardless of `n`. For the two-session clash the
frame itself draws, the built text reads **"2 sessions in this slot"**,
not "Two sessions in this slot". `spellCount` (0-10 spelled, `count-copy.ts`)
exists in the same module and is not used here.

Test receipt: `PhoneAgenda.frame390.render.test.tsx`, describe block
"Agenda 390 frame :161 -- two-in-a-slot disclosure", asserts the built
shape `/^\d+ sessions? in this slot$/` and pins the literal
`"2 sessions in this slot"` so this divergence cannot silently drift
further without failing that pin.

Disposition: a copy-only fix (swap `countOf` for a small
`n === 2 ? 'Two' : String(n)` or route through `spellCount`) that touches
`PhoneAgenda.tsx`, outside this lane's ownership. Recommend a follow-up
task scoped to that file; not attempted here per DEC-385 wave-29's
ownership condition.

## DIVERGES 2 -- :171 the frame draws an inline one-tap resolution action on the clash card ("Move DFC-047 to 11:30"); no equivalent control exists in the built component at any state

Frame:

`<span style="background:#F4F1E8; color:#1B1D17; border-radius:5px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700">Move DFC-047 to 11:30</span>` (:171)

The frame draws this as a THIRD element inside the ink-filled clash card
(:160), alongside the two listed sessions -- a single tap that resolves
the clash by moving the later-starting session to the room's next open
slot, computed and labelled inline ("to 11:30").

Built: grepped `app/src/pages/agenda/` and found no "Move ... to ..."
string, no `moveTo`/`suggestedMove`/`resolveClash` identifier, anywhere.
The only way off a clash in the built component is the existing
arm-then-place flow -- tap a clashing card to arm it
(`armFromPlaced`/`chq-phone-slot-clash-item`), then tap a free run
elsewhere, or the SAME clashing slot again via the conditionally-rendered
`chq-phone-slot-place-anyway` ("Place here anyway"). That is a different
interaction shape (two taps, an intermediate armed state, no computed
"next opening" label) than the frame's single always-visible resolution
action.

Test receipt: `PhoneAgenda.frame390.render.test.tsx`, describe block
"Agenda 390 frame :161 -- two-in-a-slot disclosure", second `it()` asserts
no control anywhere in the mounted tree matches
`/^Move \S+ to \d{1,2}:\d{2}$/` when a two-session clash is seeded (the
exact scenario the frame draws).

Disposition: an unbuilt feature (a computed "move to the next open slot"
resolution action), not a styling gap -- requires new component logic in
`PhoneAgenda.tsx`/`phoneSlots.ts` (deriving the suggested target time),
outside this lane's file ownership and outside a CSS-only fix's reach
under DEC-385 wave-29 condition (1) (terminal `@media` block or an
existing phone-only branch -- there is no existing branch to extend).
Recommend a follow-up task scoped to those two files; not attempted here.

No other change made to `agenda.css` -- neither divergence above is a CSS
defect, so this lane's terminal-`@media`-block fix allowance is unused.
