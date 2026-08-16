# Blessed deviations from the design frames

The frames (design-frames-v12, 158 frames) are the authority. This file lists
every place the implementation deliberately departs from them, with the reason
and the ruling that blessed it. Fidelity audits cite this file instead of
re-flagging these; the design agent should read it as input to any next
iteration — several entries exist only because static frames cannot draw
states, and would dissolve if the frames adopted them.

## 1. Ruled omissions

- **"Archive this event" (frame 09--11, destructive footer)** — NOT built.
  USER RULING 2026-08-16: deferred until a real customer requests it; no
  reference may appear in implementation or docs. The control implies an
  undesigned subsystem (archived-state visibility, un-archive path, public
  lifecycle). Mandate commit 90dcbf73.

## 2. State-layer additions (frames draw no row/selection states)

The frames render tables and rows stateless; the app has hover fills, active
bands, selections, and dirty states. These rules exist so the drawn geometry
survives contact with state:

- **Shared `.chq-table` first/last-cell 16px insets** — content never touches
  a row fill's edge. Narrow first columns absorb the inset by widening
  (worklist checkbox 42px, submissions select 44px, contacts select 46px,
  results rank 56px). User-filed; frames show no fills, so no insets were
  drawn.
- **Review plan-row 16px right inset** (mirrors the drawn left inset) — the
  actions cluster sat flush against the active band's edge.
- **Bulk-action bars are ALWAYS mounted** (submissions, contacts, content
  worklist): idle is a visible quiet state — one muted `.chq-bulkbar-hint`
  line naming what selection unlocks (on content, plus the "N re-uploads are
  waiting for re-review — Select them" quick-select), no fill, no
  aria-hidden — with geometry identical to the armed bar, so first selection
  never shifts the table (USER RULING 2026-08-16; supersedes the earlier
  invisible + aria-hidden reserved band). Frames draw only the selected
  state in flow; the user ruled the no-shift behavior for all multi-select
  surfaces.
- **Tracks/rooms edit rows use a fixed 200px actions track** (frames draw no
  dirty state) — the dirty-only Save/Cancel pair appears without moving the
  row. Same rule as the people-and-roles rows.
- **Speakers grid task cells top-align on one shared pill line** (fixed 22px
  offset) — a cell that grows a second line (deliverable filename) no longer
  floats its pill off the siblings' line. Frames draw single-line cells only.
- **Disabled tertiary/link-shaped controls keep NO surface and no hover**
  — B8's disabled register (label on --chq-disabled-bg) is read as applying
  to FILLED tiers only; a disabled link-style control renders muted text with
  no box, no underline, no hover response. The frames never draw a disabled
  tertiary.

## 3. Interpretations where the frames underspecify

- **Track colour picking is a cycle control** — frame 09--12 draws only the
  swatch beside the name; the ruling says "beside the name rather than in a
  separate picker". Selecting the swatch cycles the five system-token
  colours in place. The mechanism (cycle vs popover) is our interpretation.
- **Contact drawer footer** — the frame's footer is buttons-only in the order
  Cancel · Save · Email · Add to event with no helper text. The app keeps
  the recorded A20 ruling (Delete far left as destructive tertiary,
  Cancel/Save as the right-flushed terminal pair) and keeps the save-scope
  sentence on its own line above the bar (added for a judge-verified
  ambiguity; the drawer's section structure alone did not carry it).
- **Wordmark vertical position** — −2.5px optical nudge (glyph-tight line
  box, ink-measured x-height centering + user-tuned 0.75px). The frames
  center the raw line boxes, which reads visually low; the miss exists in
  the design files too.

## 4. Voice

- **Docs prose follows the STE-derived house rules, not the design's "house
  voice" note** — USER DIRECTIVE arc: full ASD-STE100 (writing rules +
  Issue-9 dictionary) applied 2026-08-16, then deliberately relaxed to
  writing-rules-plus-natural-rhythm (dictionary conformance retired; the
  declared technical-names glossary kept at
  src/routes/docs-content/technical-names.ts). Bans that stand: should/might
  ambiguity, metaphors, synonym wobble on domain terms.

## 5. Pending adjudication (not yet blessed — sweep should verdict)

- **Tracks-and-rooms save model** — the frame (09--12) shows ONE page-level
  Cancel / Save-changes footer; the app saves per-row with dirty-reveal
  Save/Cancel. A save-model change was judged too risky mid-freeze; the
  final sweep should record a verdict (bless the per-row model or file the
  page-footer rework as post-deadline).
