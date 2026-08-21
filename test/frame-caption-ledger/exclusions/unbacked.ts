import { DEC_032 } from '../../../src/decisions';
import type { Exclusion } from './types';

void DEC_032; // task w17-g: the Settings retention block's non-build (UNBACKED_EXCLUSIONS below) is a DEC-032 disposition, recorded in DEVIATIONS.md §1

/** (f) UNBACKED -- DEC-976 wave-142's fifth exclusion class (task w17-g). A
 * caption here draws a control DEVIATIONS.md §1 has already ruled a
 * deliberate non-build: no column, no endpoint, and no job backs it, so
 * building the control just to carry the caption would declare a setting
 * nothing reads. This class is deliberately SELF-GRADING (DEC-967 wave-140's
 * "a ledger a comment can satisfy is not a ledger" applies here too): every
 * row's `reason` must quote a line occurring verbatim in DEVIATIONS.md
 * (test/frame-caption-exclusion-grammar.test.ts's clause 5 checks this
 * mechanically, never by eye) and cite its backing source file as a BARE
 * path plus a verbatim backtick quote of that file's own non-build comment
 * -- never a `path:NNN` coordinate (clause 2 grades this table too). */
export const UNBACKED_EXCLUSIONS: Exclusion[] = [
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1139,
    text: 'Retention applies to every event in this org',
    reason:
      "DEVIATIONS.md §6 rules this the head consequence line of the same 'Keeping and deleting' retention block as the :1175 row below, quoting verbatim: \"is part of the same deferral and returns verbatim the moment the block is built.\" app/src/pages/settings/YourDataPanel.tsx already records the same non-build in its own comment: `Deliberately does NOT build the frame's head consequence line (docs/design/Chautauqua Settings.dc.html, \"Retention applies to every event in this org\") ... Recorded as a deliberate non-build on DEC-032.`",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1175,
    text: 'After that the abstract and reviews are deleted; the contact stays',
    reason:
      "DEVIATIONS.md §1 rules the frame's 'Keeping and deleting' block (docs/design/Chautauqua Settings.dc.html:1161-1180) a deliberate non-build, quoting verbatim: \"no retention column, no endpoint, and no deletion job backs any of the three controls — building them alone would declare a setting nothing reads.\" app/src/pages/settings/ExportsPanel.tsx already records the same non-build in its own header comment: `Deliberately does NOT build the frame's 'Keeping and deleting' retention block (docs/design/Chautauqua Settings.dc.html: 1161-1180) -- no column, no endpoint, no rubric backs it; recorded as a deliberate non-build on DEC-032.`",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1422,
    text: 'Downloaded 18 times by 12 speakers',
    reason:
      "DEVIATIONS.md §6's 'Unbuilt features' bullet extends the Public-pages/saved-embed non-build to this same line, quoting verbatim: \"carries no download-count column and no read-tracking endpoint exists anywhere in the repo, so the count is absent by design\" (DEC-032, task w4-aq). app/src/pages/settings/ResourcesPanel.tsx already records the same non-build in its own comment: `Deliberately does NOT build the frame's delete-modal download-count line (docs/design/Chautauqua Settings.dc.html:1422, \"Downloaded 18 times by 12 speakers\") -- the resource table (src/db/schema/content.ts) has no download-count column and no read-tracking endpoint exists anywhere in the repo; recorded as a deliberate non-build on DEC-032 (task w4-aq).`",
  },
];
