import type { Exclusion } from './types';

/** (c) COMPOSED -- DEC-976 wave-135's fourth exclusion class. A caption
 * here IS product copy the app draws (unlike EXPLAINER/FIXTURE above), but
 * it never appears in source as one static substring the way a plain label
 * does, so this ledger's plain-substring MATCH can never find it. Each
 * entry's `reason` names, in a full sentence, exactly one of three legal
 * shapes -- and (DEC-099) always names a MECHANISM, never a schedule or a
 * branch/wave name:
 *
 *   (i) COMPOSED-from-data -- the frame's exact words are assembled at
 *       render time from live record data (a name, a count, a label, a
 *       saved-view's own filter state, ...). The reason quotes the
 *       composing expression VERBATIM with its file:line coordinate, so the
 *       exclusion is itself a citation a future reader can re-grep.
 *   (ii) PARTIAL -- the app draws the reader-facing clause of the caption
 *        (a real substring match, findable by eye in the source), and the
 *        remaining residue is the PACK'S OWN NOTE about how the control
 *        that clause names actually behaves -- not copy the screen renders
 *        at all. The reason cites the file:line where that behaviour is
 *        implemented, so the "residue is just an annotation" claim is
 *        itself checkable.
 *   (iv) SPLIT (DEC-976 wave-21 amendment) -- the app draws EVERY word of
 *        the caption, in the frame's own order, but a ruled phone
 *        stand-down forced the sentence into sibling elements so half of it
 *        is separately addressable. Nothing is composed from data and
 *        nothing is deferred; the plain-substring matcher simply cannot see
 *        across an element boundary. A SPLIT reason must quote EACH span's
 *        source text verbatim -- which satisfies clause 4's
 *        resolve-in-source check by construction -- and name the ruling
 *        that forced the split, so the claim stays machine-checkable rather
 *        than asserted.
 *
 *   (iii) BLESSED/DEFERRED -- the caption draws a feature or rework the
 *         build does not carry, and DEVIATIONS.md §6 (or a DEC ruling) has
 *         already settled that as scope, not a defect. The reason quotes
 *         the deferring bullet's own words. DEVIATIONS.md is never edited
 *         by an entry here -- this table only cites it.
 *
 * Every entry below is shape (i) or (iii); each entry's composing
 * expression (or deferring bullet) was verified to exist on the branch that
 * wrote it -- the fifteen candidates named for this lane, four could not be
 * verified against source as it stands today and are not entered here:
 * Chautauqua Speakers.dc.html:479 (no facet composes a person's name from
 * the roster -- narrowing.ts's own header comment says so: "the frame's
 * person-name clause ... comes from the SEARCH term the organiser typed,
 * never a name synthesised from the roster"), Chautauqua Comms.dc.html:769
 * (no `session_time` merge field or matching warning sentence exists
 * anywhere in app/src or src today), and Chautauqua Settings.dc.html:1175
 * and :1400 (DEVIATIONS.md §6 carries no bullet deferring either row yet --
 * per this lane's own instructions, an in-flight sibling wave may add them
 * later). Each is left in the graded, unexcluded population until its own
 * citation exists to write down. */
export const COMPOSED_EXCLUSIONS: Exclusion[] = [
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 614,
    text: 'Settings · Call for papers',
    reason:
      "app/src/pages/Settings.tsx composes the fixed 'Settings' word with the live section label as `&lsaquo; {editingSection ? editingSection.label : viewingEmbeds ? 'Public pages' : 'Settings'}`; editingSection.label is 'Call for papers' for the cfp section (SECTIONS[1].label, Settings.tsx).",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 795,
    text: 'Settings · Tracks and rooms',
    reason:
      "the same Settings.tsx composing expression; editingSection.label is 'Tracks and rooms' for the tracks-rooms section (SECTIONS[2].label, Settings.tsx).",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 876,
    text: 'Settings · Speaker portal',
    reason:
      "the same Settings.tsx composing expression; editingSection.label is 'Speaker portal' for the portal section (SECTIONS[4].label, Settings.tsx).",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 957,
    text: 'Settings · People and roles',
    reason:
      "the same Settings.tsx composing expression; editingSection.label is 'People and roles' for the people section (SECTIONS[6].label, Settings.tsx).",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1028,
    text: 'Settings · Public pages · AI track sessions',
    reason:
      "the same Settings.tsx composing expression supplies 'Settings · Public pages' (editingSection.label 'Public pages', SECTIONS[3].label, Settings.tsx); the trailing embed name is the live `{embed.name}` at app/src/pages/settings/SavedEmbedsPanel.tsx.",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1118,
    text: 'Settings · Your data',
    reason:
      "the same Settings.tsx composing expression; editingSection.label is 'Your data' for the your-data section (SECTIONS[5].label, Settings.tsx).",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 669,
    text: 'Three tracks, five formats, no account needed. We email you a portal link, and you can edit until the form closes.',
    reason:
      "src/routes/public/submit-views.tsx composes the lede's opening clause from the event's own live track/format counts -- `const trackCount = tracks.length;` / `const formatCount = (formatField?.options ?? []).length;` feeding `ledeParts`, joined into `introLede` at :470 -- the DEC-986 organiser-authored form.description overrides the tail sentence, so only the counted opening clause is this mechanism's own words.",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 326,
    text: 'Speakers · Priya Raman',
    reason:
      "app/src/pages/speakers/SpeakerDetailPage.tsx draws the fixed '‹ Speakers' back link beside `<h1 className=\"chq-page-title\">{detail.contact.name}</h1>`, the live contact's name.",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 530,
    text: 'Or paste this into your browser: chautauqua.cc/portal/tasks',
    reason:
      'src/mail/shell.ts composes `Or paste this into your browser: ${escapeHtml(opts.cta.href)}` from the mail CTA’s live href.',
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 538,
    text: 'Pending · AI Engineering · newest first',
    reason:
      "app/src/pages/submissions/ViewTabs.tsx's summarizeFilters (DEC-750, :105-116) composes the save-view subtitle from the current status/search/track/sort filter state, joined with `parts.join(' · ')` at :116.",
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 267,
    text: 'Six available · dropped in at the cursor',
    reason:
      'app/src/pages/comms/InsertFieldMenu.tsx composes `{fields.length} available &middot; dropped in at the cursor` from the live merge-field count.',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 159,
    text: 'Same email domain, one has no company',
    reason:
      "app/src/pages/contacts/duplicatePairReason.ts composes `${base}, one has no company` (base is the per-rule clause, e.g. 'Same email domain') from the pair's own live company fields -- `const oneMissingCompany = hasCompany(a!) !== hasCompany(b!);`. DuplicateRow.tsx mounts `duplicatePairReason(group.reason, group.contacts)`. duplicatePairReason.test.ts pins the exact sentence by name (\"appends the company clause when exactly one side has no company (the frame's own words, DC.html:159)\").",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 568,
    text: 'Acceptance, Decline and Schedule live need a submission, so they are not available here — send those from Comms',
    reason:
      "app/src/pages/contacts/BulkEmailModal.tsx composes `{joined} {verb} a submission, so {pronoun} not available here — send those from Comms.` (the trailing period is the JSX text node's own, not the caption span's) from the event's own submission-scoped template names -- `const names = unavailable.map((t) => t.name)` above at :390.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 570,
    text: 'Sent one at a time · logged in Comms history · {first_name} and {company} resolve per contact',
    reason:
      "app/src/pages/contacts/BulkEmailModal.tsx composes 'Sent one at a time · logged in Comms history · merge fields: ' followed by BULK_EMAIL_MERGE_FIELDS.map((f) => `{${f}}`).join(', ') from the event's own BULK_EMAIL_MERGE_FIELDS list -- {first_name} and {company} are the two live merge-field names, not interpolated values.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 758,
    text: 'Five people are in Contacted. Cards land here when you move them, or you can add someone straight to this stage.',
    reason:
      "app/src/pages/contacts/PipelineBoard.tsx composes `${countPhrase} in ${PIPELINE_STAGE_LABELS[prevStage]}. Cards land here when you move them, or you can add someone straight to this stage.` from the previous stage's live entry count (countPhrase, :92) and its label.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 834,
    text: 'Must be unique — it is how contacts are matched and merged',
    reason:
      'DEC-597 (wave 8 amendment, decisions/DEC-597.md) already rules this exact caption: "The one clause NOT to adopt is the frame\'s email caption \\"Must be unique\\": contact_email_idx is a PLAIN index ... and duplicate contacts sharing an email are a SUPPORTED state ... The app\'s existing help text at NewContactModal.tsx already states the true reason (matching and merging) and stays. Geometry and verbs bind; a caption that would make the product lie does not." NewContactModal.render.test.tsx pins the divergence by name.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 909,
    text: 'Three tracks, five formats, no account needed. We email you a portal link, and you can edit until the form closes.',
    reason:
      "src/routes/public/submit-views.tsx composes the lede's opening clause from the event's own live track/format counts -- `const trackCount = tracks.length;` (:464) / `const formatCount = (formatField?.options ?? []).length;` (:465) feeding `ledeParts` (:467-468) -- the same mechanism already excluded for Chautauqua Settings.dc.html:669.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1314,
    text: 'Priya is already on this session. Everything you typed is still below.',
    reason:
      'src/routes/portal/edit.tsx composes `{duplicateMatch ? duplicateMatch.name : "This person"} is already on this session. Everything you typed is still below.` from the co-presenter\'s own live name (the chq-portal-copresenter-notice block, :334-336).',
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 162,
    text: 'One reviewer recused · their scores are excluded from the mean',
    reason:
      "app/src/pages/review/ResultsTable.tsx composes `{countOf(row.recusals, 'reviewer')} recused · their scores are excluded from the mean` from the row's own live recusal count.",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 943,
    text: 'The weighted total cannot be worked out until all three are scored.',
    reason:
      'app/src/pages/review/scorecardLogic.ts composes `The weighted total cannot be worked out until all ${spellCount(criteria.length)} are scored.` from the plan\'s own live criteria count.',
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 800,
    text: 'Across two open plans',
    reason:
      "app/src/pages/review/ReviewerQueue.tsx composes `Across ${spellCount(openCount)} open ${plural(openCount, 'plan')}` from the reviewer's own live open-plan count; this 390 frame and Chautauqua Review.dc.html:844's desktop frame render the same `chq-reviewer-plans-subline` element at different widths (DEC-385).",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 844,
    text: 'Across two open plans',
    reason:
      "the same ReviewerQueue.tsx composing expression as Chautauqua Review.dc.html:800 -- the desktop rendering of the same `chq-reviewer-plans-subline` element (DEC-385).",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 325,
    text: 'Weighted mean of the two scored criteria · Fit is recorded, not averaged',
    reason:
      "app/src/pages/review/Scorecard.tsx composes the overallDenominatorClause from `${ratingCriteria.length} scored criteria` (the plan's own live rating-criteria count) and the Choice-criterion labels joined via choiceCriteria.map((c) => c.label).join(', ') (DEC-939, wave-82 amendment).",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 103,
    text: 'Laggards is everyone with anything outstanding · not-started is the subset who have scored nothing. Where nobody is unstarted the second link is hidden, not disabled.',
    reason:
      'PARTIAL (shape ii): app/src/pages/review/ProgressPanel.tsx draws the reader-facing clause verbatim (`Laggards is everyone with anything outstanding · not-started is the subset who have scored nothing.`); the trailing sentence is the pack\'s own implementer note for DEC-760\'s hidden-when-zero rule, already honoured at ProgressPanel.tsx (`{notStarted.length > 0 && (<button>...</button>)}` -- the second link is conditionally NOT RENDERED, i.e. hidden, never `disabled`), and ProgressPanel.tsx\'s own comment names this exact citation.',
  },
  // v12m-w18-b (wave-143): Contacts + Comms caption residue (DEC-976).
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 93,
    text: '18 more · 23 is under the 100-recipient cap',
    reason:
      "app/src/pages/comms/ComposeWizard.tsx composes `{overflowCount} more &middot; ` immediately before `{preview.length} is {preview.length >= MAX_COMPOSE_RECIPIENTS ? 'at' : 'under'} the {MAX_COMPOSE_RECIPIENTS}-recipient` from the preview step's own live overflow/recipient/cap figures.",
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 184,
    text: '4 sent in 7 days · last Tue 4:12pm',
    reason:
      "app/src/pages/comms/sendRhythm.ts's formatPhoneSendRhythm composes `${sentLast7Days} sent in 7 days${lastSuffix}` from the phone landing's own live rhythm figures (the same sentLast7Days/lastSentAt Comms.tsx's head fetches once); its own header comment names this exact frame citation.",
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 191,
    text: '23 recipients · reviewer feedback merged',
    reason:
      "PARTIAL (shape ii): app/src/pages/comms/PhoneDraftCard.tsx draws the reader-facing clause verbatim -- `{draft.recipientCount} recipients` -- as its own comment states: `the provenance clause is dropped, not fabricated (see doc comment above)`. That doc comment records why: nothing in the app records WHY a draft includes reviewer feedback, and docs/design/audit/comms-v12.md finding 1 names this gap and its own rule forbids fabricating that provenance clause.",
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 339,
    text: '57 sends · 4 in the last 7 days',
    reason:
      "app/src/pages/comms/HistoryTab.tsx composes `${countOf(total, 'send')} · ${rhythm.sentLast7Days} in the last 7 days` (countLine) from the drill head's own live total/sentLast7Days figures; its own DEC-621 wave-98 amendment comment names this exact frame citation.",
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 416,
    text: 'Kept as you change filters · 23 is under the 100-recipient cap',
    reason:
      "app/src/pages/comms/ComposeWizard.tsx composes `Kept as you change filters &middot; {selection.selectedIds.size} is` followed by `{selection.selectedIds.size > MAX_COMPOSE_RECIPIENTS ? 'over' : 'under'} the {MAX_COMPOSE_RECIPIENTS}-recipient cap` from the step-1 selection bar's own live selection size and the compose recipient cap.",
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 440,
    text: '3 have no slot yet — they can still be emailed, but not sent a calendar invite',
    reason:
      "app/src/pages/comms/ComposeWizard.tsx composes `${selectedNoSlotCount} ${plural(selectedNoSlotCount, 'has', 'have')} no slot yet — they can still be emailed, but not sent a calendar invite` (the step-1 footer note) from the current selection's own live no-slot count.",
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 576,
    text: '23 submissions have a decision and nobody has been told. Every send is logged here afterwards.',
    reason:
      "app/src/pages/comms/RecentSends.tsx composes `${countOf(decidedUntoldCount, 'submission')} ${plural(decidedUntoldCount, 'has', 'have')} a decision and nobody has been told. Every send is logged here afterwards.` from the event's own live decided-but-untold submission count.",
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 617,
    text: '57 sends · 4 in the last 7 days',
    reason:
      "the same HistoryTab.tsx countLine composing expression as Chautauqua Comms.dc.html:339 above -- the same drill head rendered a second time in the pack.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 57,
    text: '318 people · 41 speakers · 6 possible duplicates',
    reason:
      "app/src/pages/contacts/ContactsApp.tsx's title-row summary composes `countOf(stats.total, 'person', 'people')` and `countOf(stats.speakerCount, 'speaker')` and `countOf(duplicateTotal, 'possible duplicate')`, joined with ' · ', from the directory's own live stats (DEC-432/DEC-809); its own comment states the shape as N people · M speakers · [R returning] · [across E events] · K possible duplicates.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 526,
    text: '1 of 6 pairs · Marcus Okafor',
    reason:
      "app/src/pages/contacts/MergePage.tsx composes `{pairPosition.index} of {countOf(pairPosition.total, 'pair')}` followed by ` &middot; {keepContact.firstName} {keepContact.lastName}` (the phone-only chq-contacts-merge-pair-count-name suffix, DEC-919 amendment wave-98) from the merge screen's own live pair position and kept-record name.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 535,
    text: 'Labels combine, notes are appended · 3 submissions and 1 task move to the record you keep',
    reason:
      "app/src/pages/contacts/MergePage.tsx composes `Labels combine, notes are appended` followed by `{countOf(impact.submissions, 'submission')} and {countOf(impact.tasks, 'task')} move to` and the phone-visible generic span `the record you keep` from the merge screen's own live submission/task impact counts (w2-c, DEC-919, contacts-v12.md finding 3).",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 681,
    text: 'speakers.csv · 214 rows · matched on email',
    reason:
      "app/src/pages/contacts/ImportWizard.tsx composes `{fileName ?? 'Pasted CSV'} · {countOf(plan.rows.length, 'row')} · matched on email` (the Review step's own summary line) from the import's own live file name and row count.",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 286,
    text: 'speakers.csv · 214 rows',
    reason:
      "app/src/pages/contacts/ImportWizard.tsx's match-step header composes `{fileName ?? 'Pasted CSV'}` beside `{countOf(dataRows.length, 'row')}` from the import's own live file name and parsed row count.",
  },
  // v12m-w12-gg (wave-136): two further COMPOSED captions whose divergence is
  // an interpolated half, carried in by the thunderdome megabatch.
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 569,
    text: 'The server rejected it — someone else may have edited this speaker while you were here. The cell has been put back to Overdue.',
    reason:
      'app/src/pages/speakers/OnboardingGrid.tsx composes `cellFailureBody(restoredStatus)` as "The server rejected it ... The cell has been put back to `${restoredStatus}`."; restoredStatus is the pre-flip status word (Complete / Overdue / Pending) read from the snapshot taken just before the optimistic flip.',
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 697,
    text: 'A reminder names only this task · skips anyone emailed in the last hour · the due date moves for everyone, from the header',
    reason:
      "app/src/pages/speakers/TaskView.tsx composes `A reminder names only this task · ${REMIND_SKIP_RULE} · the due date moves for everyone, from the header`, interpolating REMIND_SKIP_RULE. The frame's word 'emailed' is superseded by the shared vocabulary's word 'reminded' (REMIND_SKIP_RULE = 'skips anyone reminded in the last hour', app/src/pages/speakers/remindSkipVocabulary.ts), per the DEVIATIONS.md §3 ruling 'Reminder skip-window wording stays \"reminded\", not \"emailed\"' (docs/design/DEVIATIONS.md) — the app's word stands, the frame's word is superseded.",
  },
  // v12m-w15-aa (wave-140): shape (iii) BLESSED/DEFERRED -- DEC-986's own
  // wave-130 amendment already settled this exact half-sentence as scope,
  // not a defect.
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1541,
    text: 'Three tracks, five formats. You will not need an account.',
    reason:
      "DEC-986 (wave-130 amendment, src/decisions-data/DEC-986.md): \"The tracks/formats clause is NOT free — submit-get.tsx returns before fetching tracks for this window state — so only the account clause is adopted, because it is the half that is true of this product without a new query.\" src/routes/public/submit-views.tsx (NotYetOpenPage) renders 'You will not need an account.' verbatim and its own comment names the omission by the same reasoning; the account clause alone is a real substring match (shape (ii) territory), but the residue ('Three tracks, five formats.') is genuine visitor-facing copy the ruling deliberately declined to fabricate, not a pack annotation — so this is (iii), not (ii).",
  },
  // v12m-w15-cc (wave-140): two further COMPOSED captions, disposed per
  // DEC-976 wave-140's own instruction that real product prose around a
  // fixture-shaped caption is graded as COMPOSED, not excluded wholesale as
  // FIXTURE.
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 419,
    text: 'Spoke · Build Caches in Anger',
    reason:
      "src/server/repo/tasks/speaker-detail.ts composes `Spoke · ${r.submissionTitle}` for an other-event row whose submission was accepted, rendered at app/src/pages/speakers/SpeakerDetailPage.tsx (`<span className=\"chq-speaker-detail-other-event-participation\">{e.participation}</span>`); 'Build Caches in Anger' is the frame's own invented sample submission title, not a literal string the app carries anywhere.",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 524,
    text: 'A quick nudge — two of your speaker tasks are still open, and one is past its due date.',
    reason:
      'src/server/repo/tasks/reminders.ts composes `A quick nudge — ${openClause}${overdueClause}` from the live assignment counts (spellCount/plural, domain/count-copy.ts) -- the frame\'s exact words are this expression\'s output for a 2-open/1-overdue recipient (spellCount(2)="two", plural(2,"task")="tasks", plural(2,"is","are")="are", spellCount(1)="one"), rendered into the preview card at RemindPreviewModal.tsx (`<pre className="chq-speakers-remind-draft-text">{first.text}</pre>`).',
  },
  {
    fileName: 'Chautauqua Home.dc.html',
    line: 41,
    text: 'One call for papers is open. Two programmes are published.',
    reason:
      "src/routes/root.tsx's heroSummary(sections) composes the full-state hero sentence from the hub's own live counts -- pluralClause(sections.openCfp.length, 'call for papers', 'calls for papers', 'is open', 'are open') and pluralClause(sections.published.length, 'programme', 'programmes', 'is published', 'are published'), each capitalized and joined with a space -- rendered at `<p>{heroSummary(sections)}</p>` inside the state===\"full\" hero, the 900-desktop frame's own state.",
  },
  {
    fileName: 'Chautauqua Home.dc.html',
    line: 125,
    text: 'One call for papers is open. Two programmes are published.',
    reason:
      "the same root.tsx heroSummary(sections) composing expression and the same `<p>{heroSummary(sections)}</p>` render site as line 41's entry above -- this is the 390-phone frame drawing the identical full-state hero, not a second sentence.",
  },
  // v12m-w18-d (wave-143): seven further clusters' COMPOSED residue --
  // Account, Overview, Settings, Speakers.
  {
    fileName: 'Chautauqua Account.dc.html',
    line: 37,
    text: 'Sign in to DevFlow Conf 2027',
    reason:
      "src/routes/auth-views.tsx's LoginPage composes `Sign in to ${singleEvent.name}` (the ternary's true branch backing `subtitle`) from the single seeded event's own live name; the same subtitle renders at :125 and :299, three frame states of the one LoginPage component.",
  },
  {
    fileName: 'Chautauqua Account.dc.html',
    line: 125,
    text: 'Sign in to DevFlow Conf 2027',
    reason: "the same auth-views.tsx LoginPage subtitle expression as the already-listed :37 row.",
  },
  {
    fileName: 'Chautauqua Account.dc.html',
    line: 299,
    text: 'Sign in to DevFlow Conf 2027',
    reason: "the same auth-views.tsx LoginPage subtitle expression as the already-listed :37 row.",
  },
  {
    fileName: 'Chautauqua Account.dc.html',
    line: 84,
    text: 'At least 12 characters',
    reason:
      "src/routes/auth-views.tsx (and src/routes/account.tsx) composes `At least ${MIN_PASSWORD_LENGTH} characters` as the password field's placeholder, from the live MIN_PASSWORD_LENGTH constant (src/domain/auth-copy.ts, value 12); the same placeholder renders at :165 and :248.",
  },
  {
    fileName: 'Chautauqua Account.dc.html',
    line: 165,
    text: 'At least 12 characters',
    reason: "the same MIN_PASSWORD_LENGTH-composed placeholder expression as the already-listed :84 row.",
  },
  {
    fileName: 'Chautauqua Account.dc.html',
    line: 248,
    text: 'At least 12 characters',
    reason: "the same MIN_PASSWORD_LENGTH-composed placeholder expression as the already-listed :84 row.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 146,
    text: '— Priya Raman · DFC-014',
    reason:
      "app/src/pages/overview/AgendaWorkSection.tsx composes `— {joinSegments([entry.speakerName, entry.ref])}` for each conflict-row entry -- the leading '— ' is the JSX text node, joinSegments (app/src/pages/overview/rows.ts) joins the entry's own live speakerName/ref with ' · '.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 147,
    text: '— Ruth Adeyemi · DFC-047',
    reason: "the same AgendaWorkSection.tsx composing expression as the already-listed :146 row, a second conflict entry.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 151,
    text: 'Next free slot in Room 2A',
    reason:
      "app/src/pages/overview/AgendaWorkSection.tsx composes `<span className=\"chq-overview-caption\">Next free slot in {conflict.resolution.roomName}</span>` from the conflict's own live suggested room name.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 459,
    text: 'DevFlow Conf 2028 · nothing scheduled',
    reason:
      "app/src/pages/Overview.tsx composes `{eventName ?? 'This event'} · nothing scheduled` from the current event's own live name, in the no-work-yet empty state beside the H1.",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 635,
    text: '47 submissions received · changes do not affect them',
    reason:
      "app/src/pages/settings/CallForPapersPanel.tsx composes `${countOf(receivedTotal, 'submission')} received · changes do not affect them` as the CFP edit view's head consequence line, from the event's own live submissions count.",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 816,
    text: '47 submissions reference these tracks',
    reason:
      "DEC-781 (wave-132 amendment, src/decisions-data/DEC-781.md): \"The three that are data-backed -- Tracks and rooms ('47 submissions reference these tracks'), Speaker portal ('23 speakers can sign in today') and the saved-embed drill ('On · in use on devflowconf.com') -- are NOT built in the same breath: each needs a live referent that must be shown to exist first, and DEC-380's rule governs (a frame's drawing does not create a data model; record it, never mint it). They are named here so the next wave schedules them from a record.\" TracksRoomsPanel.tsx passes no consequence prop to SettingsEditForm, matching this deferral -- the panel already draws a different, section-scoped closing note (DEC-896 wave-133 amendment) in its place, not this head line.",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 897,
    text: '23 speakers can sign in today',
    reason:
      "the same DEC-781 (wave-132 amendment, src/decisions-data/DEC-781.md) deferral quoted in full at the already-listed :816 row -- the Speaker portal head consequence is one of the same three named data-backed, not-yet-built lines.",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1430,
    text: 'Speaker handbook 2027.pdf',
    reason:
      "app/src/components/ConfirmDialog.tsx composes `placeholder={confirmPhrase}` for the irreversible-weight type-to-confirm field; app/src/pages/settings/ResourcesPanel.tsx passes `confirmPhrase={pendingDelete.title}` -- the resource's own live title, verbatim, when the deleted resource is titled 'Speaker handbook 2027.pdf'.",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 194,
    text: 'Created for all 12 accepted speakers',
    reason:
      "app/src/pages/speakers/TaskModal.tsx composes `Created for all ${acceptedCount} accepted speakers` as the New-task modal's subtitle, from the event's own live accepted-speaker count.",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 264,
    text: '12 accepted · 2 not claimed',
    reason:
      "app/src/pages/speakers/RosterPanel.tsx composes `<strong>{acceptedCount}</strong> accepted &middot; <strong>{notClaimedCount}</strong> not claimed` from the roster's own live counts, in the 390-phone drill-in head.",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 354,
    text: 'Reminded 3× · last 4 Aug',
    reason:
      "app/src/pages/speakers/SpeakerDetailPage.tsx composes `Reminded {detail.counts.remindCount}&times; &middot; last {formatDateOnly(lastRemindedAcross(detail.tasks))}` from the speaker's own live remind count and most-recent-reminded date.",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 469,
    text: '12 accepted · 3 overdue',
    reason:
      "app/src/pages/speakers/OnboardingGrid.tsx composes `<strong>{counts?.speakers ?? 0}</strong> accepted &middot; <strong>{counts?.overdue ?? 0}</strong> overdue` from the event's own live speaker/overdue counts, beside the Speakers H1.",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 563,
    text: '12 accepted · 3 overdue',
    reason: "the same OnboardingGrid.tsx composing expression as the already-listed :469 row, a different frame state (search-found-nothing) of the same page.",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 614,
    text: 'Due 15 Aug · required · 6 answered of 9 who need it',
    reason:
      "app/src/pages/speakers/TaskView.tsx composes a subLine array (Due clause, conditional 'required', then `${counts.answered} answered of ${counts.assigned} who need it`, joined with ' · ') from the task's own live due date/required flag/answered-assigned counts -- the file's own comment cites this exact frame line, docs/design/Chautauqua Speakers.dc.html.",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 681,
    text: 'Due 15 Aug · required · 6 answered of 9 who need it',
    reason: "the same TaskView.tsx composing expression as the already-listed :614 row, the desktop rendering of the same subLine.",
  },
  // v12m-w18-c (wave-143): Review + Submissions + Content caption residue
  // (DEC-976), fourteen COMPOSED rows.
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 57,
    text: '3 plans · 1 with evaluations in',
    reason:
      "app/src/pages/review/PlanList.tsx composes the hub summary count clause `countOf(plans.length, 'plan')` and appends ` · ${withEvaluationsCount} with evaluations in` when progress has resolved, from the plan list's own live length and completed-progress count.",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 102,
    text: 'Sent to 5 reviewers · 1 skipped, reminded within the hour',
    reason:
      "PARTIAL/loose (same shape as TaskView.tsx's remindSkipVocabulary substitution above): app/src/pages/review/ProgressPanel.tsx's formatReminderResult composes `Sent: ${result.sent}.` and `Skipped: ${result.skipped}.` from the plan's own live remind-outcome counts (the CLOSED sent/skipped/remaining ReminderResult vocabulary, DEC-238); the frame's words are a narrative gloss over the same sent/skipped vocabulary (sent-to-N, N-skipped), not a second copy of it.",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 204,
    text: 'DFC-021 · talk, 30 min · advanced',
    reason:
      "app/src/pages/review/Scorecard.tsx composes the scorecard meta line from `submission.format != null ? sessionFormatLabel(submission.format) : null` and `submission.audienceLevel != null ? audienceLevelLabel(submission.audienceLevel) : null`, joined with submission.ref via `.join(' · ')`, from the submission's own live ref/format/audienceLevel fields.",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 249,
    text: 'Averaged by weight · not editable. A plain average of 5, 4, 4 would be 4.33.',
    reason:
      "app/src/pages/review/Scorecard.tsx composes the desktop overall caption from two sibling <p> elements the frame reads as one line (DEC-889 wave-159 split what was one paragraph into two): `.chq-review-overall-caption` composes `'Averaged by weight, not editable' + overallDenominatorClause` and `.chq-review-overall-reconciliation` composes `A plain average of ${ratingCriteria.map((c) => scores[c.id] as number).join(', ')} would be ${formatScore(plainAverage(ratingCriteria.map((c) => scores[c.id] as number)))}`, both from the plan's own live rating-criteria scores.",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 288,
    text: 'DFC-021 · talk, 30 min · advanced',
    reason:
      "the same Scorecard.tsx meta-line composing expression as Chautauqua Review.dc.html:204's entry above -- this is the 390-phone rendering of the same one-component header (DEC-385).",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 326,
    text: 'A plain average of 5, 4, 4 would be 4.33',
    reason:
      "the same Scorecard.tsx `.chq-review-overall-reconciliation` composing expression as Chautauqua Review.dc.html:249's entry above (`A plain average of ${ratingCriteria.map((c) => scores[c.id] as number).join(', ')} would be ${formatScore(plainAverage(ratingCriteria.map((c) => scores[c.id] as number)))}`) -- this is the 390-phone rendering of the same reconciliation paragraph, split across two <span> elements at this width instead of the desktop's two <p> elements (DEC-385).",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 372,
    text: 'AI Engineering deep pass · closes in 19 days',
    reason:
      "app/src/pages/review/ReviewerQueue.tsx composes the scoped-queue subtitle `[scope, roundName, closesLabel].filter((v): v is string => v !== null).join(' · ')` from the plan's own live scopeTrackName, round name (roundLabel), and closesInDaysLabel(envelope.closeDate, timezone).",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 421,
    text: 'AI Engineering deep pass · closes in 19 days',
    reason:
      "the same ReviewerQueue.tsx subtitle composing expression as Chautauqua Review.dc.html:372's entry above -- the same one-component scoped-queue head rendered at a different frame width (DEC-385).",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 549,
    text: '18 talks · 36 reviews needed at 2 each · 4 reviewers',
    reason:
      "app/src/pages/review/PlanEditor.tsx's distributeSummaryText composes `${countOf(talks, 'talk')} · ${countOf(reviewsNeeded, 'review')} needed at ${reviewsPerTalk} each · ${countOf(reviewers, 'reviewer')}` from the run's own live talk/review/reviewer counts (DEC-840/DEC-745).",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 567,
    text: '14 reviews stay unassigned — the cap is reached and nobody else covers AI Engineering',
    reason:
      "app/src/pages/review/PlanEditor.tsx's shortfallSummaries composes `${g.needed} ${noun} unassigned — ${constraint}.` where constraint is `the cap is reached and nobody else covers ${g.trackName}`, from the distribute run's own live shortfall groups (DEC-840).",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 640,
    text: '3 of about 7 · the two scored ones average by weight',
    reason:
      "PARTIAL: app/src/pages/review/PlanEditor.tsx draws the reader-facing count clause verbatim -- `{editingCriteria.length} of about {MAX_PLAN_CRITERIA}` -- from the draft's own live criteria length and MAX_PLAN_CRITERIA cap; the trailing clause the real control renders is 'more than that and reviewers rush the last ones' (the cap-notice's own rationale for the cap), not the frame's 'the two scored ones average by weight', which is the pack's own note about how Scorecard.tsx's overallDenominatorClause treats rating vs. Choice criteria (already excluded above, Chautauqua Review.dc.html:249/:326).",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 662,
    text: 'Would assign 22 of 36 · you confirm before anything saves',
    reason:
      "app/src/pages/review/PlanEditor.tsx's distribute-confirm panel draws the same live totalAssigned count the frame's 'Would assign 22' opens with -- `Assign these ${distributePreview.totalAssigned}` -- and its own confirm caption `Nothing is saved until you confirm.` (DEC-786/DEC-572) is the app's wording of the frame's trailing clause; distributeSummaryText's `${countOf(reviewsNeeded, 'review')} needed at ${reviewsPerTalk} each` (already excluded at Chautauqua Review.dc.html:549) is the same reviews-needed denominator the frame's 'of 36' names.",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 684,
    text: 'Open · 7 of 18 reviews in',
    reason:
      'app/src/pages/review/PlanEditor.tsx composes `Open · {reviewsCompleted} of {reviewsAssigned} reviews in` (DEC-882) from the plan progress aggregate\'s own live completed/assigned counts.',
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 57,
    text: '47 total · 12 awaiting triage',
    reason:
      "app/src/pages/submissions/SubmissionsTable.tsx composes the summary `{total} total` and appends ` · ${pendingTotal} awaiting triage` when a pending count is known, from the submission list's own live total/pending counts.",
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 328,
    text: '2 submissions this year · spoke in 2026',
    reason:
      "app/src/pages/submissions/SubmissionDetailPage.tsx's speakerHistoryLine composes `${countOf(speaker.submissionsThisYear, 'submission')} this year` and `spoke in ${speaker.lastSpokeYear}`, joined with ' · ', from the speaker participant payload's own live submissionsThisYear/lastSpokeYear fields (DEC-900).",
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 472,
    text: 'Closes 16 Aug · 47 received',
    reason:
      'app/src/pages/forms/FormsPage.tsx composes `Closes ${closesText} · ${receivedCountText} received` (phoneMetaText) from the CFP window\'s own live close date and received-submission total.',
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 592,
    text: 'The call for papers opens on 1 February. Anything submitted after that appears here for triage.',
    reason:
      'app/src/pages/submissions/SubmissionsTable.tsx composes `The call for papers opens on ${formatDateOnly(formOpenDate)}. Anything submitted after that appears here for triage.` from the event\'s own live CFP open date.',
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 632,
    text: '47 total · 0 awaiting triage',
    reason:
      "the same SubmissionsTable.tsx composing expression as Chautauqua Submissions.dc.html:57's entry above -- the triage-cleared state's own live total/pending counts (pendingTotal 0).",
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 643,
    text: 'All 47 submissions have a decision. Twelve are still waiting on content, if you want the next thing.',
    reason:
      "PARTIAL: app/src/pages/submissions/SubmissionsTable.tsx draws the reader-facing clause verbatim -- `All ${allTotal} submissions have a decision.` -- from the submission list's own live unfiltered total; the trailing sentence ('Twelve are still waiting on content, if you want the next thing.') is the pack's own note about where the adjacent secondary action leads, matching the real `secondary={{ label: 'Go to content ›', to: '/content' }}` link rendered beside it, not a second sentence the panel renders.",
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 663,
    text: '47 people have already answered this form',
    reason:
      "app/src/pages/forms/FormsPage.tsx composes `${answeredCount} people have already answered this form — their answers to this question are deleted too.` from the form's own live answered-submission count; the frame's row is this sentence's opening clause.",
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 119,
    text: 'Priya Raman · DFC-014 · Tue 10:00, Room 2A',
    reason:
      "app/src/pages/content/DeliverableDetail.tsx renders the live speaker link beside `{firstSpeaker.name}`, followed by the trailer clause ` · ${subtitleTrailer}`, where subtitleTrailer is formatDetailTrailer's own composition, appending the day/time/room clause with publicRoomLabel(detail.slot.roomName) only when detail.slot is present (DEC-901), from the submission's own live ref/slot/room fields -- this is the width:1600px desktop rendering of the same subscreen as Chautauqua Content.dc.html:377's entry below (DEC-385).",
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 377,
    text: 'Priya Raman · DFC-014',
    reason:
      "the same DeliverableDetail.tsx composing expression as Chautauqua Content.dc.html:119's entry above -- the 390-phone rendering of the same speaker-link-plus-trailer header for an unplaced session (formatDetailTrailer's `parts = [detail.ref]` with no slot clause appended, DEC-901).",
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 442,
    text: 'Taming 40-Minute CI · slides',
    reason:
      "app/src/pages/content/UploadRejectedModal.tsx composes `${sessionTitle} · ${DELIVERABLE_LABELS[kind].toLowerCase()}` (the modal's subtitle prop) from the caller's own live sessionTitle and DELIVERABLE_LABELS['presentation'] = 'Slides' (app/src/pages/content/types.ts).",
  },
  // v12m-w18-a (wave-143, DEC-976): Public and Portal cluster, task w18-a's
  // own 33-row docket. The itinerary rail's saved-count caption renders at
  // three call sites, all identical JSX text -- one caption, four frame
  // lines (agenda's rail, sessions' rail, and the schedule page's own rail
  // render twice across its two states).
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 96,
    text: '4 saved in this browser · no account needed',
    reason:
      'src/routes/public/agenda-rail.tsx and src/routes/public/sessions.tsx both compose `saved in this browser · no account needed` beside the live `<span id="chq-ics-count">0</span>` node that agenda-itinerary-script.tsx writes the real count into -- the count and the caption are two DOM nodes, so a plain-substring match can never bridge the tag between them.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 212,
    text: '4 saved in this browser · no account needed',
    reason:
      "the same agenda-rail.tsx/sessions.tsx `saved in this browser · no account needed` composing text as line 96's entry above -- the sessions surface's own render of the identical rail widget.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 330,
    text: '4 saved in this browser · no account needed',
    reason:
      "the same agenda-rail.tsx/sessions.tsx `saved in this browser · no account needed` composing text as line 96's entry above -- a third render site for the identical rail widget.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 836,
    text: '4 saved in this browser · no account needed',
    reason:
      "the same agenda-rail.tsx/sessions.tsx `saved in this browser · no account needed` composing text as line 96's entry above -- the schedule page's own 'Take it with you' rendering of the identical widget.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 119,
    text: 'Closes Sun 16 Aug · no account needed',
    reason:
      'src/routes/public/sessions.tsx composes `Closes ${formatEventDateTime(dayLabelEndInstant(cfpWindow.closeDate, event.timezone), event.timezone)} · no account needed` for the CFP rail caption (task w18-a added the trailing " · no account needed" clause this wave); the date expression collapses to one placeholder token so a plain-substring match cannot see through it to the frame\'s literal "Sun 16 Aug".',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 421,
    text: 'DevFlow Conf 2027 · you speak Tue 12 May, 10:00, Room 2A',
    reason:
      'src/routes/portal/index.tsx\'s scheduledSubline composes `${first.eventName} · you speak ${formatPlacement(first.day!, first.startMin!, first.roomName)}` from the speaker\'s own single placed session, rendered into the portal home\'s "Two things to do" header subtitle.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 511,
    text: '5 questions · used to book your room',
    reason:
      'src/routes/portal/tasks/views.tsx (TaskFormPage, task w18-a) composes `countOf(fields.length, "question")` joined with the task\'s own organiser-authored `assignment.description` for the Hotel stay form subtitle -- the field count is real and live, the trailing purpose clause is whatever description the organiser stored for this specific form-kind task, matching the frame\'s own sample value only when an organiser happens to type that exact sentence.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 571,
    text: 'DFC-014 · talk, 30 min · Platform &amp; Infra',
    reason:
      'src/routes/portal/index.tsx\'s SubmissionDetailPage composes `[detail.ref, detail.format, detail.trackName].filter(` into metaParts, joined " · ", for the "Your session" read view\'s ref/format/track subline -- detail.ref is the submission\'s own REF, detail.format and detail.trackName are the form\'s own live answer/track fields.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 572,
    text: 'Tue 12 May, 10:00 · Room 2A',
    reason:
      'the same SubmissionDetailPage composes `formatPlacement(detail.day!, detail.startMin!, detail.roomName)` immediately below the ref/format/track subline, rendered only when the session is placed -- the live schedule slot, not sample data.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 583,
    text: 'v3 · 14 MB · with the organisers',
    reason:
      'the same SubmissionDetailPage composes `v{deliverableVersion ?? 1} · {formatBytes(deliverable.sizeBytes)} · Shared with the organisers` for the Slides row\'s version/size caption -- the version and byte size are the live deliverable\'s own fields; the app\'s word "Shared" is additional to the frame\'s wording, not a divergent claim.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 604,
    text: 'You can change this until the form closes on 16 Aug',
    reason:
      'src/routes/portal/edit.tsx composes `You can change this until the form closes on` immediately followed by `formatEventDate(dayLabelEndInstant(data.form.closeDate, data.form.timezone), data.form.timezone)` for the Edit your session subtitle -- the close date is the form\'s own live closeDate field.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1308,
    text: 'You can change this until the form closes on 16 Aug',
    reason:
      "the same edit.tsx `You can change this until the form closes on` composing expression as line 604's entry above -- the co-presenter-rejected state's own render of the identical Edit your session header.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1388,
    text: 'You can change this until the form closes on 16 Aug',
    reason:
      "the same edit.tsx `You can change this until the form closes on` composing expression as line 604's entry above -- the desktop rendering of the identical Edit your session header.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 699,
    text: '23 across three tracks',
    reason:
      'src/routes/public/speakers.tsx (task w18-a) composes `{total} across {spellCount(tracks!.length)} {plural(tracks!.length, "track")}` beside the Speakers H1 -- the live speaker total and the live offered-track count, spelled out via the shared count-copy vocabulary (spellCount/plural, domain/count-copy.ts) rather than a bare digit.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 749,
    text: '23 across three tracks',
    reason:
      "the same speakers.tsx `{total} across {spellCount(tracks!.length)} {plural(tracks!.length, \"track\")}` composing expression as line 699's entry above -- the Gallery view's own twin render of the identical Speakers header (DEC-433/477).",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 868,
    text: '4 saved · 2 overlaps · no account needed',
    reason:
      'src/routes/public/agenda-itinerary-script.tsx composes `saved.length + \' saved · \' + overlap.pairCount + \' \' + overlapWord + \' · no account needed\'` (task w18-a added the trailing " · no account needed" clause this wave) for the /schedule page\'s client-revealed subtitle -- a string concatenation of live counts, never a template literal, so no placeholder-collapse pass can bridge it to the frame\'s literal digits.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 902,
    text: 'Call for papers · closes Sun 16 Aug, 23:59 Pacific',
    reason:
      'src/routes/public/submit-views.tsx composes `Call for papers · closes {formatEventDateTime(dayLabelEndInstant(form.closeDate, event.timezone), event.timezone)}` for the CFP page\'s own header subline -- the close date is the form\'s own live closeDate field.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1109,
    text: 'Submissions closed on 16 August 2026. Thanks for your interest in DevFlow Conf.',
    reason:
      'src/routes/public/submit-views.tsx\'s ClosedPage composes `Submissions closed on{" "}` followed by the live close-date expression and `. Thanks for your interest in ` followed by `{props.event.name}` -- the date and event name are the form\'s and event\'s own live fields, "DevFlow Conf" is this pack\'s own fixture event name.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1188,
    text: 'Sessions appear here once the committee has finished reviewing. The call for papers closed on 16 August.',
    reason:
      'PARTIAL (shape ii), a deliberate divergence recorded in src/routes/public/sessions.tsx\'s own comment: the frame\'s reason sentence names a CFP close DATE, but this app has no per-event CFP-close-date-as-headline copy path (a day label derived from a stored instant is a timezone bomb, DEC-522) and B7 rule 2 only earns a reason when it is actionable, which a bare close date is not -- so sessions.tsx renders `Sessions appear here once the schedule is published.` verbatim instead, "named here as a deliberate divergence rather than force-fit" per the file\'s own header comment above the PublicEmptyState call.',
  },
  // v12m-w21-c (wave-146, DEC-380/DEC-989 residue docket): Contacts pipeline
  // head band caption -- built, the plain-substring matcher cannot see it
  // because v12m-w19-a split the literal across a conditional.
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 321,
    text: '20 people · drag between columns',
    reason:
      "app/src/pages/contacts/PipelineBoard.tsx's own pipeline head band composes `{total} people{!isPhone && ' · drag between columns'}` -- v12m-w19-a's desktop-vs-phone conditional splits the frame's one literal string into two JSX expressions (the count and the trailing clause), which no substring or digit-skeleton pass can rejoin (DEC-967 drift-proof citation: cite the composing expression itself, not a coordinate that moves).",
  },
  // v12m-w4-ak (wave 148, DEC-895 amendment): Overview §04's unplaced
  // remainder duration clause -- built this task, but not visible to
  // match.ts's own digit-skeleton pass.
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 164,
    text: '3 more unplaced · all need 120 minutes',
    reason:
      "app/src/pages/overview/AgendaWorkSection.tsx's agendaOverflowLine composes `${extraUnplaced} more unplaced · all need ${remainderDurationMin} minutes` from the server's own unplacedRemainderDurationMin (src/server/repo/overview.ts, DEC-895 amendment wave-148/w4-ak) -- a real batched read over the unplaced set minus the capped detail rows, non-null only when every remainder row shares one parseable session_format duration (DEC-936). match.ts's sourceDigitSkeleton pass (collapseSourcePlaceholders) is not scoped to one template literal -- its plain `\\{[^}]*\\}` regex spans from the first unrelated `{` anywhere earlier in this ~200-line component file to the first `}` anywhere after it, swallowing this template's own text into the collapse before the digit-skeleton comparison ever sees it, so the otherwise-correct second pass never gets a chance to match. A ledger-machinery fix (scoping the placeholder collapse to balanced braces) is out of this caption-residue task's file ownership (test/frame-caption-ledger/match.ts is not among its owned files) -- filed as a COMPOSED exclusion per this task's own instructions, not as evidence the clause is unbuilt.",
  },
  // v12m-w4-ai (wave-148, DEC-777/DEC-908 amendment): the portal edit
  // page's read-only "Session length" row, built this task
  // (src/routes/portal/edit.tsx). No plain-substring or digit-skeleton
  // pass can rejoin it -- the whole "Talk, 30 min" clause is dynamic
  // (session-vocabulary.ts's sessionFormatLabel over the submission's own
  // session_format-role answer), not just its digits.
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 620,
    text: 'Talk, 30 min · set by the organisers',
    reason:
      "src/routes/portal/edit.tsx composes `{sessionFormatLabel(data.formatLabel)} · set by the organisers`, and sessionFormatLabel (src/lib/session-vocabulary.ts, DEC-908) renders the submission's own session_format-role answer (loadEditableSubmission's answerFieldRoleCondition('session_format') read, src/server/repo/portal-edit.ts) as `<name>, <N> min` -- 'Talk, 30 min' for this pack's own fixture data, but the format name and duration are both live fields, not literal text a substring pass can match.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1405,
    text: 'Talk, 30 min · set by the organisers',
    reason:
      "the SAME composing expression as :620 above -- edit.tsx renders one Session length row shared by both the 390 and desktop frames (DEC-385 single-direction responsive, no separate desktop markup).",
  },
  // v12m-w6-cd (wave 150, DEC-908 amendment): the portal home SessionCard's
  // meta clause and deliverable clause, both built this task
  // (src/routes/portal/index.tsx). Neither is a plain-substring or
  // digit-skeleton match -- both are assembled from a live session_format
  // answer and a live stored file version, per the same ruling that
  // exempted the edit.tsx Session-length row above.
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 444,
    text: 'Talk, 30 min · Platform &amp; Infra · accepted 14 Mar',
    reason:
      "src/routes/portal/index.tsx's SessionCard composes `metaParts = [formatLabel, s.trackName, accepted <date>].filter(...).join(' · ')`, where formatLabel is `sessionFormatLabel(s.format)` (src/lib/session-vocabulary.ts, DEC-908) over PortalSession.format -- a live session_format-role answer read via listFormatLabelsBySubmission (src/server/repo/review/submissions.ts, reused rather than re-implemented) -- and the track name and accepted date are likewise per-submission live fields. 'Talk, 30 min · Platform & Infra · accepted 14 Mar' matches this pack's own fixture data, but every clause is dynamic, not literal text a substring pass can match.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 445,
    text: 'Slides v3 · with the organisers',
    reason:
      "the SAME SessionCard composes `{deliverable.filename} v{deliverableVersionOrThrow(deliverable)} · with the organisers` from PortalDeliverable.versionNo -- the file table's own stored version_no column (src/db/schema/content.ts), now selected by listLatestDeliverables (src/server/repo/portal/sessions.ts) alongside the existing filename/size/uploadedAt fields, per DEC-908's ruling to reuse the submission-detail page's own v{n}-clause vocabulary rather than a second phrase. The filename and version are both live per-file data, not literal text.",
  },
  // v12m-w4-al (wave-148, DEC-709 amendment): the phone plan-editor head
  // subtitle, composed at PlanEditor.tsx's planHeadSubtitle from
  // draft.trackIds (resolved against the loaded tracks list), draft.closeAt
  // (via lib/dates.ts's formatDateOnly, the ONE calendar-date-only
  // formatter per DEC-153/DEC-907) and draft.maxEvaluationsPerSubmission
  // (via the file's own countOf). Cited by the composing expression, not a
  // coordinate, per DEC-967.
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 598,
    text: 'AI Engineering · closes 30 Aug · 2 reviews per talk',
    reason:
      "app/src/pages/review/PlanEditor.tsx's planHeadSubtitle composes `[trackNames, closesClause, reviewsClause].filter(...).join(' · ')` from `draft.trackIds.map((id) => tracks.find((t) => t.id === id)?.name ?? id).join(', ')`, `` `closes ${formatDateOnly(draft.closeAt)}` `` and `` `${countOf(draft.maxEvaluationsPerSubmission, 'review')} per talk` `` -- every input already lives in this component's own state, rendered phone-only (isPhone) as `.chq-review-editor-head-subtitle`, matching the frame's 'AI Engineering · closes 30 Aug · 2 reviews per talk' for a single-track plan closing 30 Aug with 2 reviews per talk. formatDateOnly renders the UTC calendar day with its year (DEC-153 bans toLocaleDateString/local-timezone reads for date-only fields), so the exact digits/year the ledger's digit-skeleton pass sees vary by plan, not the frame's fixture year -- the grammar and separators are the live match this exclusion records.",
  },
  // v12m-w4-an (wave-148, DEC-555): /schedule overlaps panel, one sentence
  // per covering session naming its live clock range and every title it
  // covers -- necessarily COMPOSED, since the range and titles come from
  // whichever sessions the reader actually saved.
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 847,
    text: 'Evaluating Agents runs 10:00–12:00, over both Taming 40-Minute CI and Your AI Pair Programmer.',
    reason:
      "src/routes/public/agenda-itinerary-script.tsx's applyScheduleView composes, per saved item with at least one clash, `item.title + ' runs ' + __chqClock(item.startMin) + '–' + __chqClock(item.endMin) + ', over ' + joined + '.'` where __chqClock is clockHMM (src/domain/clock.ts, embedded via .toString() exactly like the file's other pure helpers) and joined is src/lib/overlap-lanes.ts's joinOverlapTitles(overlap.clashesById[item.id]) -- the frame's exact session title, clock range and covered-title list are all live saved-item data read off the rendered .chq-pub-schedule-row's own data-start-min/-end-min attributes, so no static substring of this sentence exists anywhere in source for a plain-substring or digit-skeleton pass to find.",
  },
  // v12m-w4-ao (wave-148, DEC-908 amendment): the CFP confirmation card's
  // three meta lines -- built, in the frame's own clause order
  // (format, track, audience level), by src/routes/public/submit-post.tsx's
  // `metaParts` composing `[formatLabel, selectedTrackNames.join(' · '),
  // audienceLevelClause]`. The plain-substring matcher cannot see any of
  // these three lines because each interpolates this fixture pack's own
  // sample submission's live track name, format label and audience level --
  // "Platform & Infra", "Developer Experience" and "AI Engineering" are
  // this pack's own invented track data, not a string this app's source
  // ever contains verbatim.
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1080,
    text: 'Talk, 30 min · Platform &amp; Infra · intermediate',
    reason:
      "src/routes/public/submit-post.tsx composes `metaParts.join(' · ')` from `sessionFormatLabel(formatAnswer)`, `selectedTrackNames.join(' · ')` and `audienceLevelLabel(audienceLevelAnswer)` (src/lib/session-vocabulary.ts, DEC-908) -- the frame's 'Platform & Infra' track name and 'intermediate' level are this fixture's own sample data, composed at request time from the submitted answers, not a literal this app's source ever contains.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1130,
    text: 'Lightning talk, 10 min · Developer Experience',
    reason:
      "the same submit-post.tsx `metaParts` composing expression, this sample's track-only clause (no audience level answered) -- 'Developer Experience' is this fixture's own sample track name.",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1153,
    text: 'Panel, 45 min · AI Engineering',
    reason:
      "the same submit-post.tsx `metaParts` composing expression, this sample's track-only clause (no audience level answered) -- 'AI Engineering' is this fixture's own sample track name.",
  },
  // SHAPE (iv) SPLIT (DEC-976 wave-21 amendment, ruled on this exact row).
  // The desktop 1600 hub is FROZEN and genuinely draws both sentences in one
  // closing line, so neither sentence could be deleted; DEC-874's wave-19
  // amendment split the paragraph into two sibling spans so the
  // hidden-scores half alone can stand down at 390 with a `phone-hidden:`
  // receipt, since the phone dock already states that exact sentence at that
  // width. Every word is still drawn, in the frame's own reading order --
  // only the element boundary between them is new, and that boundary is what
  // this ledger's plain-substring matcher cannot see across.
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 866,
    text: 'With one open plan this page is skipped \u2014 you land straight in its queue. Scores stay hidden from other reviewers.',
    reason:
      'app/src/pages/review/ReviewerQueue.tsx draws the caption whole, as two sibling spans inside one paragraph: `<span>With one open plan this page is skipped \u2014 you land straight in its queue.</span>{\' \'}` immediately followed by `<span className="chq-reviewer-plans-footnote-repeat">Scores stay hidden from other reviewers.</span>`. DEC-874\'s wave-19 amendment forced that split (desktop reading order byte-identical, the frozen 1600 frame untouched) so review.css\'s one terminal phone block can stand the second span down at 390 with a `phone-hidden:` receipt naming the dock band that already carries the same sentence there -- one sentence, one place, per width. Nothing is composed from data and nothing is deferred: the words are literal in source, split across an element boundary the plain-substring pass cannot cross.',
  },
];
