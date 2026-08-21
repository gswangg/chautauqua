// Frame caption/consequence ledger -- RATCHET module (DEC-976 wave-133;
// split from test/frame-caption-ledger.scan.test.ts by the
// contention-custodian decomposition, no behaviour change).
//
// FRAME_CAPTION_UNMATCHED_CEILING is scripts/exit-predicate.ts's own
// campaign constant (CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES): that
// script scans `git ls-files -- test app/src scripts` for a literal
// `export const FRAME_CAPTION_UNMATCHED_CEILING = <int>;` line, so this
// declaration must remain the ONLY file in that tree carrying that exact
// literal form (a re-export elsewhere is a different syntax shape and does
// not match its regex). Isolated into its own file because every worker
// re-measuring the ratchet touches only this constant and its history
// comment, not the population/exclusion/match machinery above it.

// -- Ratchet -------------------------------------------------------------
// Three lanes measured this ratchet independently against the same
// 233-caption / 13-frame-file population (>= 20 chars, no digit, no `@`, not
// text-transform:uppercase) as it stood before v12m-w17-f (wave-142); see
// that task's own history entry below for the digit-discriminator retirement
// that widened the population to 378. Each of the three lanes below excluded
// a DIFFERENT slice of the pre-widening population:
//   - v12m-w10-dd: +17 FIXTURE rows                          -> 54 unmatched
//   - v12m-w10-cc: +&apos;/&rsquo;/&lsquo; in ENTITY_MAP (retiring the
//     BreaksPanel/EmbedsPanel `day&apos;s`/`embed&apos;s` false offenders),
//     +10 EXPLAINER, +5 EXEMPLAR ARTICLE                     -> 53 unmatched
//   - v12m-w10-ee: +11 COMPOSED (a fourth named class)       -> 59 unmatched
// All four exclusion tables and the widened ENTITY_MAP are live here and
// CAPTIONS_AFTER_EXCLUSION subtracts every one of them, so the megabatch
// figure is the UNION's -- at or below the lowest single-lane measurement.
// Re-measured against this tree. May only be RAISED as a merge-train act if a
// future predicate widening surfaces more real divergences, and should be
// LOWERED as sibling lanes close real caption/consequence gaps.
// Merge-train act (thunderdome megabatch): measured at 24 against the
// integrated tree -- the union of all four exclusion tables plus the widened
// ENTITY_MAP subtracts far more than any single lane could see from its own
// base (54/53/59). A LOWERING from main's 70, as the ratchet requires.
// Merge-train act (thunderdome medic, post-megabatch): the 24 above was
// still 2 above what the integrated tree actually measures -- 22. The
// two-sided ratchet caught the gap, as designed; lowered to the measured
// figure so the ceiling cannot license stagnation.
//   - v12m-w10-gg: +12 COMPOSED (reader-facing clusters: Contacts, Public
//     and Portal, Review) and one BUILD (Contacts.dc.html:834's DEC-597
//     exclusion instead of an unmatched row is folded into the same
//     COMPOSED count; the frame's genuinely-absent per-pair reason at
//     Contacts.dc.html:159 and the "check spam" line at Public and
//     Portal.dc.html:1084 -- ruled buildable by DEC-380 rather than
//     BLESSED/DEFERRED, see this commit's body -- both exit the residue by
//     being built, not by an exclusion-table entry) -> 10 unmatched.
// Thunderdome megabatch reconciliation: main's medic had measured 22 against
// a tree WITHOUT v12m-w10-gg's 12 COMPOSED exclusions and 2 built captions;
// w10-gg measured 10 against a tree without the medic's other lanes. The
// integrated figure is re-measured below by this file's own two-sided
// ratchet, which prints the exact count on either breach.
//   - v12m-w13-gg (DEC-967 sighting #16): the corpus predicate itself was
//     wrong -- enumerateSourceFiles admitted src/decisions-data/**, so a
//     DEC_NNN ruling QUOTING a caption counted as the app rendering it. That
//     repair (isDecisionRegistryFile, live above) un-launders ~11 rows and
//     RAISES the count; w13-gg measured 32 from its own base. A raise here is
//     legitimate under the ratchet's own terms: it is a predicate WIDENING
//     surfacing real divergences that were previously hidden, not a
//     regression in coverage.
// v12m-w14-bb (task w14-bb): the 22 above was a CORPUS-BLIND figure -- this
// ledger's private enumerateSourceFiles skipped `.test.` paths but never
// excluded the decision registry (src/decisions-data/**, src/decisions.ts),
// so eleven captions read BUILT only because a DEC_NNN string constant or a
// DEC-NNN.md amendment quotes them verbatim (DEC-967/DEC-613 wave-138).
// Repaired by importing test/frame-source-corpus.ts's isDecisionRegistryFile
// predicate into this ledger's own enumerator (sharing the PREDICATE, not
// the enumerator -- this ledger's corpus still reaches .md, which that
// module's own isSourceFile does not). Forcing the ceiling to -1 against the
// repaired corpus measured 33 unmatched; two rows were then disposed of by
// this same task -- "If it hasn't arrived, check spam." (DEC-380 wave-137)
// built verbatim in src/routes/public/submit-views.tsx on the
// emailDelivered branch, and the co-presenter caption
// (Chautauqua Submissions.dc.html:298) moved into the new SUPERSEDED
// exclusion class (DEC-380 wave-139, correcting wave-137's own contrary
// ruling on that one row). Re-measured against the repaired corpus with both
// dispositions applied: 31. A RAISE from 22 -- corpus repairs move unmatched
// in the fix-me direction ONLY, never hide a real offender (DEC-976
// wave-138: a corpus repair re-seeds in the repairing commit and that is a
// repair, not a raise).
// v12m-w15-bb (wave-140): forcing the ceiling to -1 on that branch measured
// 15, down from its base's 31. The drop is entirely
// Chautauqua Review.dc.html:524/771 ("Two to six · results show how the
// picks fell, never an average"), DEC-380's ineligible row now built as one
// verbatim literal string in PlanEditor.tsx (see CRITERION_OPTIONS_CAPTION)
// instead of a composed/interpolated form, so the ledger's plain-substring
// match finds it.
// RATCHET: FRAME_CAPTION_UNMATCHED_CEILING re-seeded by the merge train.
// Thunderdome megabatch (wave-138/139/140 backlog of 14): no single lane's
// figure is the truth here -- w10-gg's 12 COMPOSED exclusions, w12-ff's
// builds, w14-bb's decision-registry corpus repair and w15-bb/cc/dd/ee/ff's
// dispositions all coexist for the first time on the integrated tree. The
// constant below is the integrated measurement (ceiling forced to -1, the
// two-sided ratchet's own printed offender count read back), never a
// guess and never a lane's pre-merge figure. Measured: 2 -- a LOWERING
// from every lane's own figure (31 / 17 / 16 / 15 / 14 / 13 / 12),
// because each lane's dispositions were measured without the others'
// and they are additive once integrated.
// RATCHET: FRAME_CAPTION_UNMATCHED_CEILING=31
// Thunderdome megabatch: 31 is w14-bb's figure, measured WITHOUT w10-gg's 12
// COMPOSED exclusions, which are also in this batch and push the count down
// again. The integrated figure is whatever the two-sided ratchet below prints
// on breach; it is re-seeded to that measurement, never guessed.
// v12m-w15-aa (wave-140, task w15-aa): on base main da3f1441, the decision
// registry exclusion (isDecisionRegistryFile) was ALREADY LIVE and imported
// (DEC-989 wave-140 disclosure). Forced to -1 and measured 17 unmatched
// before this task's changes; three were Chautauqua Public and Portal.dc.html
// rows owned by this task -- :963/:968 (built as placeholder= on the
// notes-for-reviewers/accessibility-needs controls, src/routes/public/
// submit-views.tsx, pinned by test/submit-cfp-frame-copy.test.ts) and :1541
// (COMPOSED shape (iii) BLESSED/DEFERRED exclusion citing DEC-986's own
// wave-130 amendment, which already declined to fabricate the tracks/formats
// half). Re-measured after: 14, zero of them from Chautauqua Public and
// Portal.dc.html. RATCHET: FRAME_CAPTION_UNMATCHED_CEILING=14
// RATCHET: FRAME_CAPTION_UNMATCHED_CEILING=13
// v12m-w15-cc (wave-140): 31 (this branch's base, w14-bb's integrated
// figure) forced to -1 and hand-measured: 17 offenders, four of them in
// Chautauqua Speakers.dc.html (:419, :479, :524, :531) -- this lane's own
// scope. Disposed :419 and :524 as COMPOSED (both already built --
// speaker-detail.ts:538's `Spoke · ${r.submissionTitle}` and
// reminders.ts:401-406's nudge-sentence composer) and :479 and :531 as
// FIXTURE (both name an invented identity a real gap or a real,
// differently-worded build already covers -- see each entry's reason).
// 13 remain, none in the Speakers file. Lowered from 31 to 13.
// v12m-w15-dd (task w15-dd, DEC-976/DEC-380/DEC-989 wave-140): base
// (main da3f1441) already carried the isDecisionRegistryFile predicate and
// several sibling lanes' exclusions -- forcing -1 against this branch's
// unmodified tree measured 17, well below the stale 31 (DEC-989: a stale
// ceiling above the live measurement licenses stagnation regardless of which
// lane last touched it). Scoped to the Settings/Home rows only: :1305 (the
// invite dialog's role-pill hint) was a sentence-case mismatch, not an
// absence -- PeopleRolesPanel.tsx:633 read 'a reviewer...' where the frame
// and DEC-650's own citation read 'A reviewer...', fixed to match verbatim
// (BUILD, one word's case). :1049 and :1400 share one host-tracking gap
// DEC-785's wave-63 amendment and DEVIATIONS.md's '09--09' entry already
// name as unbuilt (no endpoint stores where an embed is pasted) -- filed
// FIXTURE. Home :41/:125 are the hub's full-state hero sentence, already
// composed live from real counts by root.tsx's heroSummary() -- filed
// COMPOSED, one row per frame line per its own composing expression.
// Settings :1175 (the retention block's 'After that the abstract and
// reviews are deleted...' hint) stays UNMATCHED, not excluded: it is the
// SAME 'Keeping and deleting' block DEVIATIONS.md's 'Unbuilt features' list
// already names (Chautauqua Settings.dc.html:1111, 'Settings · editing your
// data') and ExportsPanel.tsx:15-18 already declines to build for the same
// reason DEC-032 gives ('no column, no endpoint, no rubric backs it') --
// this task's own instructions assumed a live retention row exists to carry
// the hint verbatim, but no such row is built anywhere in
// app/src/pages/settings/**, and fabricating a non-functional dropdown to
// carry static prose would misrepresent a real setting the app cannot
// enforce. Left in the residue for a future lane with the backing data
// model, per DEC-380 ("a frame's drawing does not create a data model").
// 17 - 5 closed (1 build + 2 fixture + 2 composed) = 12, forced -1 and
// read directly off this branch's own offender list, never guessed.
// v12m-w15-ee (task w15-ee, DEC-976/DEC-380 wave-140): re-derived on a base
// that already carries the wave-11 merge train's Contacts.dc.html:568/:570
// COMPOSED exclusions (commit 2be29050) and this file's own pre-existing
// :834 (DEC-597) and :758 COMPOSED rows -- forcing the ceiling to -1
// measured 17 unmatched, of which exactly two are this lane's own
// (Chautauqua Contacts.dc.html/Chautauqua Comms.dc.html). Contacts.dc.html:159
// ("Same email domain, one has no company") is ALREADY BUILT and COMPOSED --
// app/src/pages/contacts/duplicatePairReason.ts, mounted by DuplicateRow.tsx
// -- entered above as a new COMPOSED row (DEC-380 wave-135's clause (a)
// forbids excluding a ruled-buildable caption as absent; this is the
// already-built-composed disposition, not an evasion). Chautauqua
// Comms.dc.html:769 ("Your body uses {session_time} ... three of these
// speakers have no slot yet") was grepped against
// app/src/pages/comms/ComposeWizard.tsx and src/mail/render.ts's
// MERGE_FIELDS whitelist: no `session_time` merge field and no matching
// warning sentence exist anywhere in app/src or src today (confirmed by
// `grep -rn session_time app/src src`, zero hits outside the .dc.html pack
// itself) -- this is a genuine gap needing a new merge-field/session-data
// wire-up, out of a caption-residue task's scope and out of the files this
// lane owns, so it stays UNMATCHED per this file's own note above (the
// "could not be verified" list, wave-135). 17 - 1 (the :159 build) = 16,
// re-measured below.
// v12m-w17-f (wave-142, DEC-976): the digit discriminator in
// ./population.ts's captionsInText is RETIRED this task -- a caption with a
// digit no longer leaves the population, and ./match.ts's captionIsMatched
// gained a digit-skeleton SECOND pass (run only after its existing verbatim
// pass finds nothing) so a composed count/range still matches its frame.
// This is an INSTRUMENT widening, not a classification pass: the 233-caption
// population widens to whatever the pack's real digit-bearing count is, the
// ceiling is re-seeded to what the widened, still-unclassified population
// measures, and classifying each newly surfaced row (COMPOSED/FIXTURE/
// EXPLAINER/genuinely unbuilt) is explicitly out of this task's scope, left
// for a future lane. Forced to -1 and read back: 131 unmatched. A widening
// re-seeds where it widens in the repairing commit -- that is a repair, not
// a raise (DEC-976 wave-138's own clause, restated wave-142).
//
// v12m-w18-d (wave-143): disposed the 37 rows owned by this lane's seven
// clusters (Speakers/Settings/Overview/Account/Docs/Home/Agenda) -- 29 into
// EXPLAINER/EXEMPLAR_ARTICLE/COMPOSED, 8 left in the graded population for
// lack of a citable ruling/backing (Agenda:194 no format field on the
// agenda payload; Overview:164 "all need 120 minutes" tail with no
// composing site; Settings:1422/1427 resource download-count/404 tracking
// that does not exist; Settings:1515 the Sessionboard wizard's own
// differently-worded step indicator; Speakers:235/499/521 word-divergent
// or data-model-absent residues -- each flagged, none excluded). Forced to
// -1 and read back: 101 unmatched.
// RATCHET: FRAME_CAPTION_UNMATCHED_CEILING=131
// v12m-w18-c (wave-143, DEC-976): Review + Submissions + Content caption
// residue, the sibling lane's own three fileNames only. Forced to -1 on
// this branch's base (130) and read back: 130. Disposed 28 of this lane's
// 30 owned rows (16 Review, 9 Submissions, 5 Content) -- 21 COMPOSED
// (composing-expression citations resolving verbatim in the non-test
// source corpus, several loose/PARTIAL where the frame's own words are a
// narrative gloss over a real live-count vocabulary, e.g. ProgressPanel.tsx's
// sent/skipped reminder result and PlanEditor.tsx's criteria-cap notice) and
// 7 FIXTURE (invented sample abstract/file-version/rationale text over a
// real, differently-worded render site). Chautauqua Review.dc.html:598
// ("AI Engineering · closes 30 Aug · 2 reviews per talk", the phone Plan
// editor header subtitle) stays UNMATCHED, not excluded: no composing site
// anywhere in app/src/pages/review/PlanEditor.tsx joins a track name, an
// absolute close date and the reviews-per-talk count into one subtitle --
// Opens/Closes/Reviews-per-talk are three separate editable form fields,
// not a summary line -- and building one is a real feature addition out of
// a caption-residue task's narrow scope, so it is left in the residue for a
// future lane per this file's own "could not be verified" precedent
// (wave-135/w15-ee). Re-measured after all other dispositions: 101.
// RATCHET: FRAME_CAPTION_UNMATCHED_CEILING=101
// v12m-w18-a (wave-143, task w18-a): Public and Portal cluster's own 33-row
// docket (DEC-976). Two rows BUILT (Chautauqua Public and Portal.dc.html:119
// "Closes Sun 16 Aug · no account needed" -- sessions.tsx's CFP rail
// caption gained the trailing clause; :511 "5 questions · used to book your
// room" -- TaskFormPage gained a field-count/description subtitle;
// :699/:749 "23 across three tracks" -- speakers.tsx gained a live
// roster-count subline), 23 rows disposed into COMPOSED/FIXTURE (17
// COMPOSED, 6 FIXTURE -- see exclusions.ts's own w18-a-tagged entries), and
// 8 rows left UNMATCHED as genuine, out-of-scope gaps: :444/:445 (the
// portal home's SessionCard omits the format/duration clause and the
// deliverable/slides row that the "Your session" DETAIL page's own
// SubmissionDetailPage does render -- a second, poorer composing site, not
// this task's to unify); :620/:1405 ("Talk, 30 min · set by the
// organisers" -- no Session length read-only row exists anywhere in
// src/routes/portal/edit.tsx, a genuine unbuilt field); :847 (the /schedule
// overlaps detail panel draws a richer two-line sentence than
// agenda-itinerary-script.tsx's simpler per-pair "X overlaps Y." line);
// :1080/:1130/:1153 (the CFP confirmation card's `meta` composes
// track-then-format, order-pinned by
// test/cfp-confirmation-email-honesty.test.ts's own assertion
// '<span class="chq-cfp-confirm-card-meta">Main Track · Talk (45 min)</span>',
// while the frame draws format-then-track plus a third audience-level
// clause -- reordering or extending risks breaking that pin, out of this
// task's scope). Forced to -1 and read back on this branch: 105.
// RATCHET: FRAME_CAPTION_UNMATCHED_CEILING=105
// v12m-w18-b (wave-143, DEC-976): Contacts + Comms caption residue, owning
// exactly the rows whose fileName is 'Chautauqua Contacts.dc.html' (16 at
// main 76fdc56a) or 'Chautauqua Comms.dc.html' (14). Forced to -1 against
// this branch's base (main 08d617d8, ceiling already re-seeded to 130 by a
// sibling lane) and measured 130 unmatched before this task's changes; of
// the 30 owned rows, 4 were already-built COMPOSED matches this ledger's own
// plain-substring pass had missed (Contacts.dc.html:57/526/535/681/286,
// Comms.dc.html:93/184/191/339/416/440/576/617 -- 12 COMPOSED total, one
// PARTIAL), 5 were FIXTURE (invented sample identities/venue: Comms.dc.html
// :713, Contacts.dc.html:374/597), and 11 were SUPERSEDED (a live slot the
// app fills with a different, deliberate and pinned/documented sentence
// instead of the frame's own words: Comms.dc.html:57/376/469,
// Contacts.dc.html:116/303/388/491/507/703/747/778/797 -- see each entry's
// reason). Two rows stay UNMATCHED, per this file's own established
// precedent for the identical row at Comms.dc.html:769 (v12m-w15-ee's note
// above: no `session_time` merge field or matching warning sentence exists
// anywhere in app/src or src, a genuine gap needing a design ruling this
// worker has no authority to invent) -- Comms.dc.html:757 ("Comms · Compose
// · step 3") is the SAME unbuilt 'Compose · send blocked' 1600px exhibit's
// own header breadcrumb, sharing the identical gap. 130 - 28 disposed = 102,
// forced -1 and read directly off this branch's own offender list.
// RATCHET: FRAME_CAPTION_UNMATCHED_CEILING=102
// v12m-w21-c (wave-146, task w21-c, DEC-380/DEC-989): main measured RED at
// this ceiling's stale 101 against a tree measuring 20 -- the twenty rows
// the planner listed were v12m-w18-b's own pre-integration figure, additive
// and all landed. Disposed all twenty: 1 COMPOSED (Contacts.dc.html:321,
// the pipeline head band -- v12m-w19-a's desktop/phone conditional split
// the frame's one literal string across two JSX expressions, invisible to
// a plain-substring or digit-skeleton pass), 3 FIXTURE (Agenda.dc.html:194
// -- aligned with test/phone-dock-ledger.scan.test.ts's own identical
// file:line:text exclusion, previously two ledgers disagreeing about one
// row; Speakers.dc.html:235 and :521, both the pack's recurring invented
// 'Priya Raman'/'Moscone West' mock identities, :521 the same fixture text
// already excluded once at Chautauqua Comms.dc.html:713), and 1 SUPERSEDED
// (Settings.dc.html:1427 -- app/src/pages/settings/ResourcesPanel.tsx's
// delete-confirm dialog already fills this exact slot with a different,
// deliberate consequence sentence naming what a speaker experiences,
// never the HTTP status code the frame's words describe). The remaining
// fifteen are genuine gaps, each with a named blocker recorded in
// docs/design/audit/frame-caption-residue-v12.md (one row per row: no
// composing site, no schema column, or a pinned test forbidding the
// frame's exact wording) -- none excluded, all left in the graded
// population per this file's own established "could not be verified"
// precedent (v12m-w15-ee, v12m-w18-a/b/c/d). One correction to the
// planner's own citation along the way: Comms.dc.html:769's blocker is NOT
// "no session_time merge field exists" as briefed -- DEC-660's wave-142
// amendment already landed session_time in MERGE_FIELDS/MERGE_FIELD_SAMPLES/
// COMPOSE_MERGE_FIELDS and src/routes/comms/compose-core.ts already
// resolves it per-recipient; the still-missing piece is the compose-time
// warning BANNER naming {session_time} usage for an unscheduled recipient,
// which DEC-660's own text calls "a follow-on once the field exists" and
// which grepping ComposeWizard.tsx confirms has no render site (the
// sibling {feedback}-needs-a-plan banner is the nearest analogue, not a
// match). Forced to -1 and read back on this branch: 15.
// RATCHET: FRAME_CAPTION_UNMATCHED_CEILING=15
// v12m-w4-aj (wave-148, task w4-aj, DEC-660/DEC-939): owned exactly the two
// rows this task's own frame citations name. Chautauqua Comms.dc.html:757
// ("Comms · Compose · step 3") is now BUILT -- ComposeWizard.tsx's
// `wizardBreadcrumb` portals "Comms · Compose · step {currentIndex + 1}"
// into #chq-header-slot, digit-skeleton-matching the frame's line. :769
// moves to SUPERSEDED (see exclusions.ts's new v12m-w4-aj entry): the
// frame's own consequence sentence is false for this app (renderTemplate
// throws, preview.ts refuses the whole batch), so the app states the
// refusal instead, on purpose, never that sentence. One implementation
// note for the next lane composing a header-portal caption inside a
// `{cond && (...)}` JSX conditional: this ledger's sourceDigitSkeleton
// collapses `\{[^}]*\}` GREEDILY to the FIRST '}' after an opening '{' --
// nesting the target text inside an outer `{!isPhone && ... && (<p>text
// {expr}</p>)}` wrapper lets that outer brace's scan swallow everything up
// to the INNER expr's own closing '}', erasing the text. Computing the
// portal element as its own `const` (a plain JS statement, not itself
// inside a JSX `{}`) and referencing it via a bare `{wizardBreadcrumb}`
// avoids the trap -- the fix lives in ComposeWizard.tsx, not this ledger.
// Forced to -1 and read back: 13, down from 15.
// RATCHET: FRAME_CAPTION_UNMATCHED_CEILING=13
export const FRAME_CAPTION_UNMATCHED_CEILING = 13;
