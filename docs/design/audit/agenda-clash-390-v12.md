# Agenda · 390 clash card (task w32-f)

`docs/design/Chautauqua Agenda.dc.html:155-172` draws the phone clash card
(`sc-if value="{{ slot.clash }}"`) with three elements: a spelled flag
(:161), the two overlapping session cards, and a one-tap resolution
(:171).

## PART 1/2 — FIXED: the flag now spells its count (DEC-380 wave-32)

`docs/design/Chautauqua Agenda.dc.html:161`:

```
<span style="font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase">Two sessions in this slot</span>
```

SPELLED. `PhoneAgenda.tsx`'s `slot.kind === 'clash'` branch previously
rendered `${countOf(slot.sessions.length, 'session')} in this slot` — a
numeral at every N — which `v12m-w29-g` correctly recorded as a DIVERGES
row without inventing a ruling. FIXED by the very next paragraph's ruling
(DEC-380 wave-32, below): this occurrence narrates the pre-fix state, not
a currently-open row.

**Ruling (DEC-380 wave-32, mine):** this one flag spells its count.
`countOf`/`src/domain/count-copy.ts` are UNCHANGED and stay read-only —
`countOf` remains the numeral helper for this pack's data-dense registers
(e.g. the head-band's "6 unplaced · 2 clash" counter, which stays numeral).
The clash flag instead composes `capitalizeFirst(spellCount(n))` +
`plural(n, 'session')`, this pack's own spelled-count grammar, already
shipping in:

- `app/src/pages/overview/AgendaWorkSection.tsx` ("Remind all three")
- `app/src/pages/overview/rows.ts:54` ("Place the other six ›" / headline
  count)
- `src/domain/scorecardLogic.ts` (`${capitalizeFirst(spellCount(n))} …`)

All three re-exported from `app/src/lib/plural.ts:5`. No new vocabulary
owner, no new module added.

Product change: `app/src/pages/agenda/PhoneAgenda.tsx` (clash flag span,
now composed via `capitalizeFirst`/`spellCount`/`plural` imported from
`../../lib/plural`), comment names DEC-380 wave-32 and the frame
coordinate `Chautauqua Agenda.dc.html:161`.

### Pins converted in this same commit (DEC-976)

- `app/src/pages/agenda/PhoneAgenda.w49.render.test.tsx` — the two
  assertions at the (former) `:71-86` window (`'2 sessions in this slot'`
  / `'3 sessions in this slot'` + the `.not.toBeInTheDocument()` negative
  checks) converted to `'Two sessions in this slot'` /
  `'Three sessions in this slot'`. Its header comment (items iii/iv,
  DEC-358 wave-49) updated to describe the spelled form and cite this
  ruling instead of the stale numeral description.
- New file `app/src/pages/agenda/PhoneAgenda.clash390.render.test.tsx`
  (PART 4 below) is the frame-anchored receipt.

### Flagged for the merge train — since CONVERTED at megabatch integration

The three files below pinned the numeral shape and were out of this
task's owned-file scope, so this lane flagged them rather than reaching
into them. All three have since been converted, and the spelled form is
now the only shape asserted anywhere:

- `app/src/pages/agenda/PhoneAgenda.frame390.render.test.tsx` — was
  `v12m-w29-g`'s then-unmerged branch file. Its shape assertion now reads
  `toMatch(/^[A-Z][a-z]+ sessions? in this slot$/)` and its exact-string
  assertion `toBe('Two sessions in this slot')`.
- `app/src/pages/agenda/Agenda.render.test.tsx` — both assertions
  converted, inside the `describe('AgendaPage phone tap-to-place
  (DEC-380)')` block (stubs `stubPhoneMatchMedia()`), a **phone** verdict
  and so never a STOP trigger for PART 2's grep instruction.

  One deliberate deviation from the conversion sketched here: the
  three-session case keeps
  `expect(screen.queryByText('Two sessions in this slot')).toBeNull();`
  rather than inverting to the numeral `'3 sessions in this slot'`. With
  the spelled grammar the numeral string can never render for any N, so
  asserting its absence would be vacuous; asserting that the WRONG
  SPELLED count is absent is what actually falsifies a hardcoded "Two".
- `app/src/pages/agenda/PhoneAgenda.falsifiability.render.test.tsx` —
  the four `getByText`/`queryByText` assertions converted to the spelled
  forms, the same way as `PhoneAgenda.w49.render.test.tsx` above, keeping
  the two-way/three-way pair that proves the count is derived.

**Pre-commit grep confirmed no DESKTOP frame verdict pins the numeral
form** — `grep -rn "in this slot" app/ test/ docs/design/` turned up only
the two `Agenda.render.test.tsx` phone-mode describe block (above), the
unowned `PhoneAgenda.falsifiability.render.test.tsx` (also phone-only),
this task's own converted/new files, `content.css:2068` (unrelated CSS
comment), and `agenda-phone-frame.test.ts:236`, which only *quotes* the
frame's "Two sessions in this slot" text inside a CSS-color assertion
title (frame evidence per DEC-374, not a text-content shape pin — no
change needed there). No STOP triggered.

## PART 3 — SIZED, NOT BUILT: the one-tap resolution (DIVERGES)

`docs/design/Chautauqua Agenda.dc.html:171` draws a third element inside
the clash card:

```
<span style="background:#F4F1E8; color:#1B1D17; border-radius:5px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700">Move DFC-047 to 11:30</span>
```

`v12m-w29-g` grepped `app/src/pages/agenda/` and found no `moveTo` /
`suggestedMove` / `resolveClash` identifier — the control does not exist
in the phone agenda. Confirmed again this task: still absent.

**(a) Frame line:** `docs/design/Chautauqua Agenda.dc.html:171` (inside
the `slot.clash` `sc-if` block, `:155-172`).

**(b) Existing producer + consumer elsewhere in the codebase, with
coordinates:**

- *Producer:* src/server/repo/overview/scheduling.ts`buildConflictResolutionFor`,
  which composes the label via src/domain/schedule-copy.ts`Move ${ref} to ${clockHMM(startMin)}` —
  i.e. exactly this frame's copy shape ("Move DFC-047 to 11:30"). Wired
  into the Overview payload at src/server/repo/overview.ts`resolution: buildConflictResolutionFor(`
  (`agendaWork.conflicts[i].resolution`), per DEC-652
  (src/decisions-data/part4.ts`export const DEC_652`, referenced via `src/decisions.ts`'s
  `DEC_652` constant — Overview §04 "carries the CONCRETE next action the
  server computed … and clicking it places; a suggestion the server
  cannot compute is absent, never invented").
- *Consumer:* app/src/pages/overview/AgendaWorkSection.tsx`{conflict.resolution.label}`
  renders it as a button
  (`.chq-overview-link-btn`) whose `onClick` calls `placeSlot` (defined
  at app/src/pages/overview/AgendaWorkSection.tsx`async function placeSlot(`), which does
  `apiPut('/submissions/${submissionId}/slot', { day, startMin, endMin,
  roomId })` — i.e. `PUT /api/v1/submissions/:id/slot`, the same write
  endpoint `PhoneAgenda.tsx`'s own tap-to-place (`placeArmedAt`) already
  drives, just reached from a different screen.

**(c) What the agenda payload would have to carry for the same control
to mount here:** the phone agenda's own `GET .../agenda` response
(`app/src/pages/agenda/types.ts`'s `AgendaConflict`) carries only
`{ kind, submissionIds, day, roomId, detail }` — no room-name lookup, no
resolution slot, no label. To mount a "Move DFC-047 to 11:30" control on
`PhoneAgenda`'s clash card, the `AgendaConflict` wire shape (or the
`PhoneSlot`/clash-cluster the phone view derives locally in
`phoneSlots.ts`) would need a server-computed
`resolution: { submissionId, ref, day, startMin, roomId, roomName, label }
| null` field — i.e. the same `buildConflictResolutionFor` computation
Overview already runs, threaded through the agenda endpoint (or
recomputed client-side against the full `placed` list phone-agenda
already receives, which is a materially different scope decision than
this sizing task). Building that computation, wiring it into the wire
shape, and mounting the control are all out of scope for this task —
PART 3 is sizing only, nothing built across that boundary.

## PART 4 — Test coverage

New file `app/src/pages/agenda/PhoneAgenda.clash390.render.test.tsx`:
mounts `PhoneAgenda` with a 2-session clash slot and a 3-session clash
slot; asserts the flag reads `Two sessions in this slot` /
`Three sessions in this slot`. Each `it` opens with
`verbatimLine(161, '<exact source line>')` re-read from the `.dc.html` at
assert time.
