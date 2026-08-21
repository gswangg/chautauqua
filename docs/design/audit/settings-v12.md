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
