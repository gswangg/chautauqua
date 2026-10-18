import type { Exclusion } from './types';

/** (e) SUPERSEDED -- a caption the app deliberately renders the OPPOSITE of,
 * because the pack's own words are stale about a side effect (DEC-380
 * wave-139, correcting that same decision's wave-137 amendment, which had
 * ruled this row a build without weighing the app's actual behaviour or the
 * pin below). This is not EXPLAINER (it is product copy about a real
 * control, not design-system commentary), not FIXTURE (it is not sample
 * data), and not COMPOSED (the app's sentence is not assembled from this
 * one, it CONTRADICTS it) -- a caption that asserts a side effect is graded
 * against the app's observed behaviour, not the live-referent test the
 * other four classes share. Each entry's `reason` names the superseding
 * ruling and the pin that would break if the frame's words were built. */
export const SUPERSEDED_EXCLUSIONS: Exclusion[] = [
  // Multi-portal (docs/design/multi-portal/DECISIONS.md #32): the v12
  // Speaker portal section is now Settings' Portals section, whose copy
  // describes portals rather than one fixed speaker portal.
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 542,
    text: 'Speakers claim their portal from a link in their acceptance email.',
    reason:
      "superseded by multi-portal: invited speakers and sponsor contacts claim a portal too, so the Portals section's Access row reads 'Participants claim their portal from a link in their acceptance or invitation email' (app/src/pages/settings/PortalSettingsPanel.tsx), pinned by PortalSettingsPanel.render.test.tsx and settings-drill-phone-frames.test.ts. The frame's sentence would be false for every participant who isn't a speaker.",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 919,
    text: 'Title and abstract stay organiser-only — a speaker editing them after acceptance would change what the committee accepted',
    reason:
      "superseded by multi-portal: whether participants may edit the session title and abstract is now each portal's own field permission (app/src/pages/portals/PermissionsSection.tsx), not a fixed rule, so the edit drill's consequence line names where it is set ('What participants may edit, and what they're asked for, is set per portal in Manage portals', PortalSettingsPanel.tsx). The frame's fixed claim would be false once a portal opens those fields.",
  },
  // Multi-portal decision 71: /portal/preview speaks for every portal, and
  // preview-as-participant exists, so both of the frame's speaker-only
  // sentences about the preview would be false.
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1488,
    text: 'This is the portal your speakers see. It has no speaker attached, so there are no submissions, tasks or files here — only what you have written for everyone.',
    reason:
      "superseded by multi-portal decision 71: the preview shows what every portal shares, for speakers, sponsors and anyone else a portal covers, so the banner reads 'This is how the portal looks to everyone who has one: speakers, sponsors and anyone else a portal covers. Nobody is signed in here, so there are no sessions, items or files' (src/routes/portal/preview.tsx), pinned by test/portal-preview.test.ts.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1523,
    text: "To see a real speaker's portal you would have to be them — this preview deliberately cannot.",
    reason:
      "superseded by multi-portal decision 71: preview-as-participant (src/routes/portal/preview-person.tsx, the Portals frame's flow 4) shows one person's portal, so the preview points to it: 'To see one person's portal, open their record and choose Preview, or open a portal and preview it as someone it matches' (src/routes/portal/preview.tsx), pinned by test/portal-preview.test.ts, which also pins the frame's sentence absent.",
  },
  // v12m-w4-aj (wave-148, DEC-660): the pre-emptive unresolvable-merge-field
  // band (task w4-aj), placed on the compose/TEMPLATE step from state the
  // wizard already holds (ComposeWizard.tsx's `usedSlotDependentFields`/
  // `selectedNoSlotCount`), fills this slot with a DELIBERATELY different
  // sentence -- the heading is built verbatim (digit-skeleton matches
  // Comms.dc.html:769's own heading line, one file up), but this second
  // sentence is not, on purpose.
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 769,
    text: 'Your body uses {session_time}, and three of these speakers have no slot yet. They would receive the literal text “{session_time}”.',
    reason:
      'the frame\'s own consequence clause is FALSE for this app: src/mail/render.ts:163\'s renderTemplate throws MergeFieldError on a missing var, and src/routes/comms/preview.ts:66 turns that into a whole-batch ApiError, so a recipient with no slot is REFUSED, never sent the literal text "{session_time}" (DEC-793 already renders one named line per rejected person in the error banner, and the wave-28 partial-send path is how to proceed). Building the frame\'s sentence verbatim would ship a lie about what sending does. ComposeWizard.tsx\'s chq-comms-merge-warning band states the refusal instead ("Sending will refuse those recipients entirely, not send them the literal placeholder text") and names the partial-send path, per DEC-660 wave-148\'s own ruling to build the heading verbatim and write the consequence clause from the code.',
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 298,
    text: 'A new co-presenter is emailed a portal link · the lead presenter is not changed',
    reason:
      "DEC-380 wave-139 (correcting that decision's own wave-137 amendment): app/src/pages/submissions/SubmissionDetailPage.tsx:1854 deliberately renders the opposite claim -- 'Adding a co-presenter here sends no email — sending a portal invite is a separate, explicit action. The lead presenter is not changed.' -- under DEC-604 wave-70, because src/routes/api/submissions.ts:6 states, and a source-scan test enforces, that the submissions routes never import a mailer. SubmissionDetailPage.render.test.tsx:1421-1427 pins the app's sentence verbatim and its own comment calls the frame's version 'the stale DEC-900 \"emails them\" claim' -- building the frame's sentence would ship a lie about the mailer and break that pin. Recorded in DEVIATIONS.md §3 under the pre-existing DEC-909 wave-134 bullet.",
  },
  // v12m-w18-b (wave-143): Contacts + Comms caption residue (DEC-976). Every
  // row below is a caption whose SLOT the app genuinely fills, but with a
  // different, deliberate and tested/documented sentence instead of the
  // frame's own words -- not a substring match with residue (COMPOSED
  // shape ii) and not sample data (FIXTURE), so graded here the same way
  // the co-presenter row above is: against the app's observed, pinned
  // behaviour.
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 57,
    text: '4 sent in 7 days · last Tue 4:12pm',
    reason:
      "the desktop head's chq-comms-head-subtitle slot renders app/src/pages/Comms.tsx:354's `<p className=\"chq-comms-head-subtitle\">{formatSendRhythm(rhythm)}</p>`, which composes the LONGER 'N sent in the last 7 days · M failed · last <date>' grammar (DEC-905), not the frame's shorter phone grammar quoted here. app/src/pages/comms/sendRhythm.ts's own comment states the divergence is deliberate: formatPhoneSendRhythm 'follows the frame's own shorter grammar... dropping desktop's \"the last\" wording and its failed-count clause' -- i.e. the SHORT sentence is reserved for the phone landing (Comms.dc.html:184, a real COMPOSED match above) and desktop keeps the long one on purpose. Comms.render.test.tsx pins the long-form desktop wording ('4 sent in the last 7 days', '2 sent in the last 7 days · 3 failed') at this exact DOM slot; building the frame's short sentence here would contradict those pins.",
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 376,
    text: '23 accepted speakers',
    reason:
      "the compose step-strip's 'Recipients' micro-label always renders app/src/pages/comms/ComposeWizard.tsx's stepMeta 'select' detail -- `selection.selectedIds.size === 0 ? 'None selected yet' : \\`${countOf(selection.selectedIds.size, 'submission')} selected\\`` -- a live SELECTION-PROGRESS sentence, never the frame's static accepted-speaker population label. ComposeWizard.idsParam.render.test.tsx and ComposeWizard.selection.render.test.tsx both pin the 'N submissions selected'/'None selected yet' wording at this slot; building the frame's population label would contradict those pins and would also have to choose between two different live counts (selection size vs. the accepted-status total) with no ruling on which one the frame's single line means.",
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 469,
    text: '23 accepted speakers',
    reason:
      "the same ComposeWizard.tsx stepMeta 'select' detail composing expression and the same pinned-test conflict as Chautauqua Comms.dc.html:376 above -- the identical step-strip micro-label rendered a second time in the pack.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 116,
    text: 'Showing 2 of 2 matching',
    reason:
      "app/src/pages/contacts/ContactsTable.tsx's own header comment (B7 rule 6, DEC-678) states the architecture this caption would break: 'ContactsTable is presentational, so ContactsApp computes which of the two voices applies... the table itself never inspects filter state.' The table's pager renders only `paginationSummary(page, perPage, total, items.length)` -- 'Showing {start}–{end} of {total}', never a trailing 'matching' word -- and has no rules/filter prop to condition one on without violating that stated boundary. app/src/lib/pagination-summary.ts is the product's ONE pagination-summary shape (DEC-906), shared by every paged table, so a one-off 'matching' suffix here would also fork that shared grammar for this table alone.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 303,
    text: '9 rows match existing contacts by email · they will be updated',
    reason:
      "RESOLVED (DEC-663 wave-108, ruling A, docs/design/audit/contacts-v12.md finding 2): this frame slot's literal wording 'can only come from the dry run's plan.updated, which does not exist at this step' (app/src/pages/contacts/ImportWizard.tsx's own comment on the dedupeCount block), so the wizard ships a TRUE, differently-worded statement it can actually compute at the match step instead -- `Same-file email repeat: {countOf(dedupeCount, 'row')} · the later row wins` -- an in-file collision count, not a query against existing contacts. The frame-accurate plan.updated sentence lands separately once the dry run has actually run (see the two SUPERSEDED rows below for :507, and the COMPOSED row above for :1127's near-neighbour wording).",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 388,
    text: '3 submissions and 1 task move to the kept record. The discarded record is deleted.',
    reason:
      "app/src/pages/contacts/MergePage.tsx's own w2-c/DEC-919 comment (contacts-v12.md finding 3) records that the frame's referent here is generic ('the kept record') 'because the head band at :526 already names the kept record', but the app's own desktop rendering makes the OPPOSITE choice at this exact consequence line: the sibling `chq-contacts-merge-impact-name` span -- `{keepContact.firstName} {keepContact.lastName}` -- is the one CSS shows on desktop, naming the record directly ('...move to Marcus Okafor.') instead of the frame's generic 'the kept record' phrase; only the phone-visible sibling span renders the frame's generic wording (the COMPOSED row above for Contacts.dc.html:535).",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 491,
    text: 'speakers.csv · 214 rows · 2 of 5',
    reason:
      "app/src/pages/contacts/ImportWizard.tsx's own w15-c comment records the deliberate choice this caption would reverse: '\"Import contacts from CSV\" moves down to the ModalFrame subtitle so it stays visible across every step instead of being the one static title' -- i.e. the modal's subtitle is now ONE static sentence across all four steps, not a per-step dynamic 'filename · row count · column N of M' eyebrow the way the frame's phone header draws it. The column-position fragment alone survives, at a different slot: `Column {phoneColumnIndex + 1} of {header.length}` inside the column body (a real COMPOSED match, not this head-band line).",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 507,
    text: '9 rows match an existing contact by email · those get updated',
    reason:
      "the same RESOLVED DEC-663 wave-108 ruling A as Chautauqua Contacts.dc.html:303 above (docs/design/audit/contacts-v12.md finding 2), for the phone rendering of the identical match-step slot: the wizard ships `Same-file email repeat: {countOf(dedupeCount, 'row')} · the later row wins` because plan.updated does not exist yet at this step, never the frame's plan-sourced 'match an existing contact... those get updated' wording.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 703,
    text: '5 more updates · all of them company or title only',
    reason:
      "app/src/pages/contacts/ImportWizard.tsx's own w49-f comment states the rule this caption would need a second layer to satisfy: 'update rows -- the only rows where something is lost -- come first' and the review table's `isLosingRow` predicate (`row.action === 'update' || (row.overwrites?.length ?? 0) > 0 || (row.possibleDuplicates?.length ?? 0) > 0`) shows every update row by default, with no further split between a 'significant' update and a trivial company/title-only one -- only the CREATE rows (plan.created) are the hidden-by-default population, via the 'Show all N rows' disclosure. The app's default view therefore already shows the frame's 'more updates' as ordinary visible rows rather than collapsing a subset of them behind this count.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 747,
    text: '18 people across five stages',
    reason:
      "app/src/pages/contacts/PipelineBoard.tsx's own w11-e/DEC-665 and w4-c/DEC-898 amendment comments record the deliberate substitute wording at this exact head-band slot: `{total} people · drag between columns` -- 'names the board's own affordance now that the card face carries no stage control of its own' -- never the frame's static 'N people across five stages' population count.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 778,
    text: 'speakers-final.csv · 214 rows read',
    reason:
      "this is the frame's standalone 'Nothing was imported' 560px MODAL exhibit for the file-level bad-rows refusal (docs/design/Chautauqua Contacts.dc.html: 'Modal' badge, 'File-level failure, before any mapping') -- the SAME feature app/src/pages/contacts/ImportWizard.tsx builds (DEC-575 wave-28 amendment, the showFileWarning block), but rendered inline above the wizard's own step content rather than as a second, standalone dialog with its own title/subtitle chrome naming the file and row count; the wizard has no 'Nothing was imported' modal-head slot for this exact sentence to fill.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 797,
    text: 'Fix them in the file and upload again, or import the 205 rows that are complete and leave these out.',
    reason:
      "the same standalone modal exhibit as Chautauqua Contacts.dc.html:778 above -- the app's real showFileWarning block offers the identical way out (Import the N good rows / Upload a different file / Download the N rows, DEC-745 wave-108 amendment) through its own DIFFERENT sentences (`{badRows.length} of {allDataRows.length} rows have no email address`, `Nothing was lost — the file is still loaded.`), inline rather than in a standalone modal, never this exact frame sentence.",
  },
  // v12m-w21-c (wave-146, DEC-380/DEC-989 residue docket): the Settings
  // resource-delete confirm dialog's body sentence.
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1427,
    text: 'This cannot be undone. Speakers linking to it will get a 404.',
    reason:
      "app/src/pages/settings/ResourcesPanel.tsx's delete-confirm dialog already renders a live consequence sentence at this exact slot -- `Speakers lose the download from their portal. \"${pendingDelete.title}\" cannot be recovered.` -- naming the human consequence a speaker actually experiences rather than the HTTP status code the frame's words describe, which no speaker ever sees. Building the frame's literal '404' sentence would ship a technically-accurate-but-user-hostile message over the app's own deliberately different, tested copy.",
  },
  // v12m-w4-am (wave-148, DEC-613/DEC-829): both rows below ARE built,
  // verbatim, off the same scalar the frame draws them from -- neither
  // survives this ledger's plain-substring or digit-skeleton pass because
  // the phase/noun word is chosen by a ternary/function call nested inside
  // a `${...}` template placeholder, which `collapseSourcePlaceholders`
  // collapses to one sentinel together with the literal text it contains.
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1515,
    text: 'Step 2 of 3 · what we found',
    reason:
      "app/src/pages/settings/SessionboardImportPanel.tsx composes `` `Step ${step} of 3 · ${step === 1 ? 'choose file' : step === 2 ? 'what we found' : 'done'}` `` off the SAME `step` scalar (`const step = finalReport ? 3 : header.length > 0 ? 2 : 1`) the panel's own `chq-steps` <ol> renders -- 'what we found' is the frame's own step-2 phase word verbatim, chosen by the ternary rather than typed as a second copy of the step count (DEC-613).",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 499,
    text: '3 speakers · nothing has been sent yet',
    reason:
      "app/src/pages/speakers/RemindPreviewModal.tsx's `subtitle` prop composes `` `${countOf(count, 'speaker')} · nothing has been sent yet` `` off the server's own `drafts.length` when `skipped === 0` -- the frame's exact clause, printed only when there is truly nothing to report as skipped (when `skipped > 0` the subtitle states the skip instead, via the shared `remindSkipVocabulary.ts` phrase, so the two clauses never contradict on one line, per DEC-829).",
  },
  // v12m-w36-a (wave-36, DEC-021 wave-36 amendment): the Agenda frame's
  // break-hint caption is stale about the fully-outside case since DEC-021
  // wave-34's break-clamp fix (commit 487b7fb98) and w34-b's matching rewrite
  // of BreaksPanel.tsx's own hint. Excluded here by citation, per DEC-021
  // wave-36's own instruction -- never by raising FRAME_CAPTION_UNMATCHED_CEILING.
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 244,
    text: "A break outside the day's window is kept but flagged — the grid shows it greyed rather than dropping it.",
    reason:
      'RULED (DEC-021 wave-34): "a break that intersects the window keeps today\'s flagged-and-clamped band; a break with no intersection gets no band at all — it is surfaced as flagged but never given a fabricated row, and the panel\'s copy must be true of both cases." app/src/pages/agenda/BreaksPanel.tsx:463-464 was rewritten (commit 487b7fb98, w34-b) to be true of both cases, so it no longer renders this frame sentence, which asserts every outside-window break is greyed and drawn -- false for the fully-outside case. Building the frame\'s sentence verbatim would ship a lie about breaks with no intersection at all. The pin that would break: BreaksPanel would have to re-claim a band is always drawn, contradicting DayGrid.tsx\'s gridMath.ts interval arithmetic that deliberately omits one for the no-intersection case.',
  },
];
