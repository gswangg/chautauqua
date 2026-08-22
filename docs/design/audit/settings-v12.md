# Settings v12 phone conformance — audit findings (index)

<!-- Wave 15 contention decomposition (custodian-docs_design_audit_settings_v12_md):
     this file had 4 merge conflicts across concurrent lanes because every
     wave's Settings finding appended to the same monolithic file. No content
     was changed or removed — every finding below moved verbatim into its own
     submodule file under docs/design/audit/settings-v12/, split along the
     wave boundaries the file already used ("---" separators / amendment
     headers). This index is the file every other doc/comment in the repo
     cites by path (`docs/design/audit/settings-v12.md`); it stays the public
     entry point so those citations keep resolving, and future waves should
     append new findings to whichever submodule they extend, or add a new
     submodule file + index row, rather than growing one file again. -->

This file is now an index. The full findings live in per-wave submodule
files so that independent lanes touch independent files instead of
colliding on one growing document:

- [`settings-v12/w3-landing-drills.md`](settings-v12/w3-landing-drills.md) —
  w3-e: Settings landing + Tracks/rooms + Your-data 390 drills (shell tab
  bar note, per-row Edit/Download/Revoke gap and its wave-156 partial
  closure, settings.css media-block consolidation).
- [`settings-v12/w3f-cfp-public-portal.md`](settings-v12/w3f-cfp-public-portal.md) —
  w3-f: Call for papers, Public pages, Speaker portal 390 drills (shell
  note, CFP/Welcome-note/Public-pages content gaps, the w1-e
  `.chq-settings-summary-row` citation repair, the deferred Publish/
  Unpublish toggle).
- [`settings-v12/w10-frame-verdicts.md`](settings-v12/w10-frame-verdicts.md) —
  w10-ne: the per-frame verdict table for all nine Settings 390 READ
  frames, closing the phoneA "frame-count" open clause, with the wave-156
  amendment narrowing the divergence count to two of nine (`:316`, `:552`).

**Current state (see `w10-frame-verdicts.md` for the authoritative table):**
seven of nine 390 read frames match (landing, Tracks and rooms, Your data,
Call for papers, Public pages, Speaker portal, Saved embeds); two diverge
(`:316` Settings · Event, `:552` People and roles), both narrowed to the
same DEC-919/DEC-728 read/edit-split gap — a missing frame-drawn footer
primary in read mode, not a phone-CSS or markup-order defect. Wave 17 (task w17-d, DEC-919) narrowed `:316`
further — the drill head band now draws the frame's single title, and
Event's head "Change" action re-lines onto the frame's own footer
primary; see that submodule's wave-17 amendment.

## Wave 29 (task w29-d, DEC-976/DEC-967/DEC-385/DEC-651/DEC-874): FIRST markup-level verdicts for `:481` Public pages · 390 and `:578` Saved embeds · 390

The `w10-frame-verdicts.md` table has read `MATCHES` / `MATCHES (nested)`
for these two frames since wave 156, but until this wave neither frame's
11 drawn strings (name/state/path row template, `View`, `Embed code`,
`Get code`, the "N on · N off" count line, the laptop caption) were
asserted by any markup-producing test — the MATCHES rows were citations,
not receipts (FINDINGS: "a CITATION IS NOT AN ASSERTION", DEC-967). This
wave adds the first two:
`app/src/pages/settings/SettingsDrill.publicPages390.render.test.tsx` and
`app/src/pages/settings/SettingsDrill.savedEmbeds390.render.test.tsx`,
both mounting `SettingsPage` at the real drilled route (`?section=
public-pages` and `?section=public-pages&view=embeds` respectively, per
DEC-651's "verdict the screen, not the bare panel" rule) rather than
`PublicPagesPanel`/`SavedEmbedsPanel` directly, since the frames' `‹ back`
link and H1 are rendered one level up, by `Settings.tsx`.

**Public pages (`:481`) — CONFIRMED MATCHES.** The real render carries
exactly the frame's back link (`‹ Settings`), H1 (`Public pages`), and
every row's name / state pill / `View` / `Embed code` pair in the frame's
own DOM order. `{{ p.toggle }}` (`:495`) is confirmed absent, matching the
already-recorded DEVIATIONS §6 deferral (no backing data for a publish
toggle) — not a new finding. The 44px floor on `View`
(`.chq-settings-public-pages-view-action`) and `Embed code` (via the
shared `.chq-settings-panel .chq-link-button` phone rule) is confirmed by
reading `settings.css`'s one terminal `@media (max-width: 700px)` block
through `test/helpers/strip-css-comments`.

**Saved embeds (`:578`) — CONFIRMED MATCHES, with one already-recorded
divergence made explicit for the first time at markup level.** The real
render carries the frame's H1 (`Saved embeds`), the "N on · N off" count
line (asserted by shape, `/^\d+ on · \d+ off$/`, against real row data —
3 enabled/1 disabled — rather than the frame's literal sample `3 on · 1
off`), every row's name / state pill / `Get code`, and the list-closing
laptop caption (`:599`) rendering exactly once. The 44px floor on `Get
code` (`.chq-settings-saved-embed-actions .chq-link-button`) is likewise
confirmed inside the same terminal phone block.

**DIVERGES (back-link literal, `:580`):** the frame draws the identical
`‹ Settings` back-link text on both its Public pages and Saved embeds
screens, but the shipped router renders `‹ Public pages` for the
Saved-embeds nested drill instead — a deliberate wave-156 DEC-728 re-line
(`w10-frame-verdicts.md`'s `:578` row, citing DESIGN-RULINGS:247: "a drill
still always has a way out, it's just the one the frame draws instead of
a second one this component minted") reflecting that the nested drill's
real destination is the Public pages read-drill, not the section index.
This wave's new render test asserts the actual `‹ Public pages` text and
confirms `‹ Settings` does NOT render there, rather than asserting the
frame's literal against a router decision two waves settled. Not a new
finding — recorded here because this is the first test that can see it at
markup level at all.

No CSS or component change was needed for either frame: `settings.css`
and `settings-lists.css` already carried every 44px floor and DEC-385
terminal-block placement this task's citations name; this wave's scope
was proving it, not building it.
