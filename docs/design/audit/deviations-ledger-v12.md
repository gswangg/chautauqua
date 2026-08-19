# DEVIATIONS.md ledger audit (DEC-967 wave-100 amendment)

Instrument: `test/deviations-ledger.scan.test.ts`.

`docs/design/DEVIATIONS.md` is the third authority the v12 mobile campaign
names (frames, `docs/design/DESIGN-RULINGS.md`, DEVIATIONS.md) and the only
one that had no derived guard before this wave. Fidelity audits are told to
cite it instead of re-flagging its entries, which means a stale entry
silently suppresses a real finding — already demonstrated once: two prior
waves read "## 5. Pending adjudication" as open work when "## 6. Deferred
post-deadline"'s "Adjudications recorded" sub-section had already answered
it (per-row dirty-reveal BLESSED, G13 srv1 adjudication).

## Scope

The ledger derives its population from four sections only:

- `## 1. Ruled omissions` (2 entries)
- `## 2. State-layer additions (frames draw no row/selection states)` (6 entries)
- `## 3. Interpretations where the frames underspecify` (5 entries)
- `## 6. Deferred post-deadline (USER RULING 2026-08-16, G13 sweep)` (14 entries)

27 entries total, asserted as an exact per-section count (vacuous-population
tripwire) so a broken heading match can never silently zero a section out.

**Deliberately excluded**, per this task's own file-ownership boundary and
DEC-967's amendment text:

- `## v12 frame errata` — an in-flight lane (v12m-w14-b) is deleting this
  section; transcribing it here would make the ledger red for a reason
  unrelated to whether ITS claims are honored.
- `## 5. Pending adjudication` — stale prose. Its one entry
  ("Tracks-and-rooms save model") is answered verbatim by section 6's
  differently-worded adjudication bullet of the same name; the test suite
  proves the derived `tracks-and-rooms-save-model` key traces to section 6,
  never to the excluded section 5.

Both exclusions are asserted as code, not just prose: `INCLUDED_HEADINGS`
never contains either excluded heading, and both excluded headings are
independently confirmed present in the live document (so a rename wouldn't
silently defeat the exclusion by making it vacuously true).

## Verdicts

- **honored** (two sub-kinds): `present` — a cited file exists, contains the
  cited literal verbatim, and a cited test file exists; `absent` — a cited
  term (a deliberately-not-built control) genuinely does not appear
  anywhere under `src/**` or `app/src/**`.
- **superseded** — a LATER section of DEVIATIONS.md itself records the
  adjudication; the cited literal is checked against the document's own
  bytes. One real case this wave: section 1's Speakers write-failed pill
  entry is superseded by section 6's "Speakers status vocabulary under
  write-failure (DEC-730, wave-90 amendment)" adjudication.
- **gap** — recorded openly, never faked with a citation. Section 6's
  "Unbuilt features" and "Reworks larger than the freeze window"
  sub-sections contribute most of these (7 + 2 = 9 gap rows); the
  auth-input-fill entry ("needs a README palette ruling before any change")
  is the tenth.

## Result at this wave

27/27 derived bullets carry exactly one ledger row. 1 superseded, 10 gap,
16 honored (15 present-citation, 1 absent-citation). Every honored and
superseded citation resolves against the live tree at test time — nothing
transcribed by hand without a scan checking it.
