# Review v12 fidelity audit — 390 (task w3-g)

Numbered findings the task window could not resolve within scope.

## 1. Neither reviewer-scorecard 390 frame draws a tab bar

`docs/design/Chautauqua Review.dc.html:280-350` ("Reviewer scorecard ·
/review/plans/:id/submissions/:id") and `:934-1138` ("Scorecard · a
criterion unscored") both draw the phone device box edge-to-edge — a
sticky head band, a scrolling body, and a sticky action dock — with no tab
bar row anywhere in either frame's markup. Every other 390 cluster frame
audited so far in this campaign keeps the shell's tab bar mounted beneath
the page content (App.tsx:290, per the field guide's wave-1 finding); this
task's file scope (`Scorecard.tsx`, `scorecard.css`, `scorecardLogic.ts`)
does not include the shell, so whether the reviewer scorecard's phone
route should suppress the tab bar (a genuinely different, more app-like
surface reviewers work through repeatedly) or whether the frame simply
omitted it for space the way the same frames omit the abstract/form-answer
sections is a shell-level decision, not a page-level one. Recorded here
rather than edited into App.tsx, which task w3-g does not own.
