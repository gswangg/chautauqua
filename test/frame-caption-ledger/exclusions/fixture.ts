import type { Exclusion } from './types';

/** (b) FIXTURE -- invented sample identities and sample body text used as
 * mock data inside a frame, not a caption a real screen draws. Each entry
 * asserted below to still resolve to its cited file:line:text in the
 * current pack. */
export const FIXTURE_EXCLUSIONS: Exclusion[] = [
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 464,
    text: 'Priya Raman · Latticework Systems',
    reason: 'invented sample speaker identity used as mock card content, not a real UI caption. (fixture token: \'Priya Raman\')',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1081,
    text: 'Priya Raman · Latticework Systems',
    reason: 'invented sample speaker identity used as mock card content, not a real UI caption. (fixture token: \'Priya Raman\')',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 996,
    text: 'Priya Raman leads the build-tooling platform team at Latticework Systems. She maintained the open-source task runner gantry.',
    reason: 'invented sample speaker bio used as mock body text, not a real UI caption. (fixture token: \'Priya Raman\')',
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 346,
    text: 'Priya Raman leads the build-tooling platform team at Latticework Systems. She maintained the open-source task runner gantry and speaks on build systems and CI reliability.',
    reason: 'invented sample speaker bio used as mock body text, not a real UI caption. (fixture token: \'Priya Raman\')',
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 256,
    text: 'Strong practical content and a clear narrative arc; abstract could name the specific tooling used. Recommend accept for the AI track.',
    reason: 'invented sample reviewer comment used as mock body text, not a real UI caption. (fixture token: \'Strong practical content and a clear narrative arc\')',
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 333,
    text: 'Strong practical content and a clear narrative arc; abstract could name the specific tooling used. Recommend accept for the AI track.',
    reason: 'invented sample reviewer comment used as mock body text, not a real UI caption. (fixture token: \'Strong practical content and a clear narrative arc\')',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 236,
    text: 'Latticework Systems · Principal Engineer',
    reason: 'invented sample contact affiliation/title used as mock card content, not a real UI caption. (fixture token: \'Latticework Systems\')',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 411,
    text: 'Latticework Systems · Principal Engineer',
    reason: 'invented sample contact affiliation/title used as mock card content, not a real UI caption. (fixture token: \'Latticework Systems\')',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 553,
    text: 'Priya Raman, Marcus Okafor',
    reason: 'invented sample recipient-name list used as mock card content, not a real UI caption. (fixture token: \'Priya Raman\')',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 560,
    text: 'A quick question about your session',
    reason: 'invented sample message subject line used as mock body text, not a real UI caption. (fixture token: \'A quick question about your session\')',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 625,
    text: 'Aisha Karim · Vector Foundry',
    reason: 'invented sample contact identity used as mock card content, not a real UI caption. (fixture token: \'Aisha Karim\')',
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 657,
    text: 'Suggested by Priya — runs the build team at Vector',
    reason: 'invented sample suggestion/rationale used as mock body text, not a real UI caption. (fixture token: \'Priya\')',
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 295,
    text: 'Northwind Data · no portal account',
    reason: 'invented sample speaker affiliation/account-status used as mock card content, not a real UI caption. (fixture token: \'Northwind Data\')',
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 337,
    text: 'Latticework Systems · Principal Engineer · has an account',
    reason: 'invented sample speaker affiliation/title/account-status used as mock card content, not a real UI caption. (fixture token: \'Latticework Systems\')',
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 431,
    text: 'Prefers a morning slot. Happy to share a hotel with other speakers.',
    reason: 'invented sample speaker logistics note used as mock body text, not a real UI caption. (fixture token: \'Prefers a morning slot\')',
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 584,
    text: 'Cloudreach Labs · has account',
    reason: 'invented sample speaker affiliation/account-status used as mock card content, not a real UI caption. (fixture token: \'Cloudreach Labs\')',
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 479,
    text: 'Marcus Okafor is on the roster, but nothing of his is overdue. Clearing “Overdue only” finds him.',
    reason:
      "invented sample speaker identity 'Marcus Okafor' named in a two-facet (search + Overdue only) empty-state sentence. app/src/pages/speakers/narrowing.ts's own header comment already rules this shape out: `The frame's person-name clause (Chautauqua Speakers.dc.html:442) comes from the SEARCH term the organiser typed, never a name synthesised from the roster -- so a reason with a name in it renders only for the 'q' facet, and echoes the typed string verbatim.` app/src/pages/speakers/narrowing.ts's activeFacet() itself, `if (activeKeys.length !== 1) return null;`, returns null whenever two or more facets are active, so OnboardingGrid.tsx falls back to the generic multi-facet sentence and 'Clear filters' escape -- no facet composes a specific roster member's name the way this caption's real prose ('is on the roster, but nothing of his is overdue. Clearing “Overdue only” finds him.') would need. This is a genuine, previously-identified feature gap (a per-person multi-facet empty state), not yet built; the fixture name is what makes the row unmatched today. (fixture token: 'Marcus Okafor')",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 531,
    text: '— Jordan Alvarez, DevFlow Conf',
    reason:
      "invented sample organiser signature name 'Jordan Alvarez' inside the 'What {name} will read' reminder-email preview. src/server/repo/tasks/reminders.ts's own doc comment (buildReminderMessage) already names this exact gap: `the frame's signature names a person (\"— Jordan Alvarez, DevFlow Conf\"), but the tree has no organiser-identity field on an event to source a real name from -- signing \"— The {event} team\" is the narrowest data-honest reading`, implemented as `const signature = renderTemplate(\"— The {event_name} team\", { event_name: eventName });`. The invented person name is fixture data the app cannot honestly reproduce without a field that does not exist; the app's own signature line is real, built product copy, just not this one. (fixture token: 'Jordan Alvarez')",
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 326,
    text: 'Fieldnote Docs · Documentation Lead',
    reason: 'invented sample submitter affiliation/title used as mock card content, not a real UI caption. (fixture token: \'Fieldnote Docs\')',
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 363,
    text: 'Dana Whitmore · Fieldnote Docs',
    reason: 'invented sample submitter identity used as mock card content, not a real UI caption. (fixture token: \'Dana Whitmore\')',
  },
  // v12m-w18-c (wave-143): submission abstract fixture body text, the same
  // "invented sample X used as mock body text" shape as this table's other
  // rows -- app/src/pages/submissions/SubmissionDetailPage.tsx renders the
  // live `detail.description` field verbatim (no truncation logic anywhere
  // in this cluster's sources), but the frame's own sample abstract text is
  // invented, not a literal string the app carries.
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 228,
    text: "A 10-minute tour of turning a static docs site into one that answers questions with citations, stays honest when it doesn't know, and costs under $50 a month to run. Live demo, real failure cases, and a checklist you can apply to your own docs this week.",
    reason:
      "invented sample submission abstract used as mock body text for the desktop detail page's Abstract section (real field: `detail.description`, app/src/pages/submissions/SubmissionDetailPage.tsx), not a real UI caption. (fixture token: 'costs under $50 a month to run')",
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 367,
    text: "A 10-minute tour of turning a static docs site into one that answers questions with citations, stays honest when it doesn't know, and costs under $50 a month to run.",
    reason:
      "the same invented sample abstract as this table's :228 row, here as the shorter 390-phone modal preview sample -- both render the same live `detail.description` field (app/src/pages/submissions/SubmissionDetailPage.tsx); no truncation logic exists anywhere in this cluster's sources, so the shorter frame sample is the pack's own illustrative choice, not a second real behaviour. (fixture token: 'costs under $50 a month to run')",
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 316,
    text: "Hi {speaker_name}, congratulations. Your session '{talk_title}' has been accepted. Please confirm your participation by {task_due_date}.",
    reason:
      "a template author's sample body rendered as mock content for the accepted-template preview -- it uses SINGLE braces, so the population's `{{` filter never reached it, but it is still fixture data (a sample instantiation of a template), never product copy. (fixture token: \'{speaker_name}\')",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 518,
    text: 'Thanks for speaking at DevFlow. Everything we need from you is on this page, in order.',
    reason:
      "a sample value of the portal settings' welcomeMessage field (app/src/pages/settings/PortalSettingsPanel.tsx), rendered as mock preview content -- fixture DATA, not absent product copy. (fixture token: \'DevFlow\')",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 905,
    text: 'Thanks for speaking at DevFlow. Everything we need from you is on this page, in order.',
    reason:
      "a sample value of the portal settings' welcomeMessage field (app/src/pages/settings/PortalSettingsPanel.tsx), rendered as mock preview content -- fixture DATA, not absent product copy. (fixture token: \'DevFlow\')",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1495,
    text: 'Thanks for speaking at DevFlow. Everything we need from you is on this page, in order.',
    reason:
      "a sample value of the portal settings' welcomeMessage field (app/src/pages/settings/PortalSettingsPanel.tsx), rendered as mock preview content -- fixture DATA, not absent product copy. (fixture token: \'DevFlow\')",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1049,
    text: 'On · in use on devflowconf.com',
    reason:
      "'devflowconf.com' is a fixture host name for the saved-embed row's second grid cell (Settings.dc.html:155's `{{ e.used }}` field) -- app/src/pages/settings/SavedEmbedsPanel.tsx's own DEC-785 amendment (wave 63) header comment records `a fact no endpoint stores (grep src/server/repo/embeds.ts and the schema turns up no referrer/host tracking) and Copy rule 3 forbids asserting what no endpoint stores`, so the column is deliberately left out rather than invented; DEVIATIONS.md's 'Unbuilt features' list names the same gap as 'saved-embed \"in use on\" host column -- no backing data' (09--09). (fixture token: 'devflowconf.com')",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1400,
    text: 'It is embedded on notion.so',
    reason:
      "'notion.so' is the same fixture host name as Settings.dc.html:1049's saved-embed row cell, here drawn as the turn-off confirm modal's subtitle -- the identical host-tracking gap DEC-785 amendment (wave 63) and DEVIATIONS.md's '09--09' entry already record as unbuilt (no endpoint stores where an embed is pasted). app/src/pages/settings/SavedEmbedsPanel.tsx builds the modal's title and body verbatim but carries no subtitle, for the same reason: `body=\"The embed will render nothing wherever it is pasted, until you turn it back on. Nothing is deleted.\"`. (fixture token: 'notion.so')",
  },
  // v12m-w18-c (wave-143): the review scorecard's abstract, the same
  // fixture shape as the two Submissions rows above -- app/src/pages/review/
  // Scorecard.tsx renders the live `submission.description` field verbatim
  // at both the desktop and 390-phone widths (one component, DEC-385), but
  // the frame's own sample abstract text is invented, not a literal string
  // the app carries.
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 211,
    text: 'Code generation is easy; trusting it is hard. This session covers verification patterns for AI-generated code — property tests, mutation coverage, snapshot judges, and CI gates — with data from 18 months of running them on a 200-engineer codebase.',
    reason:
      "invented sample submission abstract used as mock body text for the scorecard's Abstract section (real field: `submission.description`, app/src/pages/review/Scorecard.tsx), not a real UI caption. (fixture token: 'Code generation is easy')",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 294,
    text: 'Code generation is easy; trusting it is hard. This session covers verification patterns for AI-generated code — property tests, mutation coverage, snapshot judges, and CI gates — with data from 18 months of running them on a 200-engineer codebase.',
    reason:
      "the same invented sample abstract as this table's Review.dc.html :211 row, here as the 390-phone rendering of the same `submission.description` field (app/src/pages/review/Scorecard.tsx) -- one component, DEC-385. (fixture token: 'Code generation is easy')",
  },
  // v12m-w18-c (wave-143): the Content upload-rejected modal's why-these-
  // formats hint and 'what was kept' band -- app/src/pages/content/
  // UploadZone.tsx computes a real `survives` sentence ('The current file is
  // unchanged. Nothing was replaced.' / 'Nothing was uploaded.') and passes
  // the domain's real `uploadHintText(kind)` ('Allowed types: ...') into
  // UploadRejectedModal, but neither matches the frame's own invented
  // narrative wording -- the frame names a specific invented file version
  // ('Slides v3') and an invented rationale sentence about zip archives that
  // exists nowhere in src/domain/files.ts's real allowlist/hint copy.
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 449,
    text: 'We take PDF, Keynote, PowerPoint and MP4 so reviewers and the AV team can open it without unpacking anything. A zip could hold anything.',
    reason:
      "invented sample rationale sentence for the upload-rejected modal's why-these-formats band (real hint text: `uploadHintText(kind)`, src/domain/files.ts, which composes a mechanical 'Allowed types: ...' allowlist sentence, not this narrative), not a real UI caption. (fixture token: 'A zip could hold anything')",
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 453,
    text: 'Slides v3 is still the current file. Nothing was replaced.',
    reason:
      "invented sample file version name ('Slides v3') used as mock body text for the upload-rejected modal's 'What was kept' band (real `survives` text: 'The current file is unchanged. Nothing was replaced.', app/src/pages/content/UploadZone.tsx), not a real UI caption. (fixture token: 'Slides v3')",
  },
  // v12m-w18-a (wave-143, DEC-976): Public and Portal cluster's own sample
  // submission abstract text, rendered verbatim wherever a real submission's
  // stored description is displayed -- fixture DATA (this pack's own
  // invented sample talk), never absent product copy. Two distinct wordings
  // exist in the pack: the longer one (with the "-- including the two
  // migrations that failed first" tail) and a shorter one without it.
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 576,
    text: 'Our monorepo CI took 40 minutes on a good day. This talk walks through how we cut it to 6 minutes with content-addressed caching, remote execution, and a test-selection model — including the two migrations that failed first.',
    reason:
      "invented sample submission abstract, rendered by src/routes/portal/index.tsx's SubmissionDetailPage as `{detail.description}` on the portal's own \"Your session\" read view -- real stored content, but this exact sentence is the pack's own fixture talk, not a literal the app carries. (fixture token: 'monorepo CI')",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 927,
    text: 'Our monorepo CI took 40 minutes on a good day. This talk walks through how we cut it to 6 minutes with content-addressed caching, remote execution, and a test-selection model — including the two migrations that failed first.',
    reason:
      "the same invented sample submission abstract as line 576's entry above, here drawn as the CFP submit form's own abstract textarea value (src/views/form-render.tsx, `value={answers[field.id]}`). (fixture token: 'monorepo CI')",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 616,
    text: 'Our monorepo CI took 40 minutes on a good day. This talk walks through how we cut it to 6 minutes with content-addressed caching, remote execution, and a test-selection model.',
    reason:
      "the same invented sample submission abstract as Chautauqua Public and Portal.dc.html:576, without its trailing '-- including the two migrations that failed first' clause -- drawn as the portal Edit your session form's own abstract textarea value (src/views/form-render.tsx, `value={answers[field.id]}`, mounted by src/routes/portal/edit.tsx). (fixture token: 'monorepo CI')",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1039,
    text: 'Our monorepo CI took 40 minutes on a good day. This talk walks through how we cut it to 6 minutes with content-addressed caching, remote execution, and a test-selection model.',
    reason:
      "the same shorter fixture abstract as line 616's entry above, here drawn as the CFP submit form's own abstract textarea value (src/views/form-render.tsx, `value={answers[field.id]}`). (fixture token: 'monorepo CI')",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1401,
    text: 'Our monorepo CI took 40 minutes on a good day. This talk walks through how we cut it to 6 minutes with content-addressed caching, remote execution, and a test-selection model.',
    reason:
      "the same shorter fixture abstract as line 616's entry above, here the desktop rendering of the identical portal Edit your session textarea (src/views/form-render.tsx, `value={answers[field.id]}`). (fixture token: 'monorepo CI')",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1248,
    text: "A 10-minute tour of turning a static docs site into one that answers questions with citations, stays honest when it doesn't know, and costs under $50 a month to run. Live demo, real failure cases, and a checklist you can apply to your own docs this week. …",
    reason:
      "a second invented sample submission abstract (a different fixture talk from the monorepo-CI one above), drawn as the CFP submit form's own abstract textarea value (src/views/form-render.tsx, `value={answers[field.id]}`). (fixture token: 'docs site')",
  },
  // v12m-w18-b (wave-143): Contacts + Comms caption residue (DEC-976).
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 713,
    text: '12–14 May 2027 · Moscone West, San Francisco',
    reason:
      "the mail-preview exhibit's sample event dates/venue -- the same invented 'DevFlow Conf 2027' fixture organisation the pack reuses throughout (already the fixture identity behind the FIXTURE rows above at Settings.dc.html:518/905, Public and Portal.dc.html:1495 and Contacts.dc.html:597 below). app/src/pages/comms/PreviewPane.tsx renders only subject/greeting/body from the live template -- no event name/dates/venue header card -- and the event schema has no venue-formatting call site anywhere in app/src/pages/comms/**, so this exact card is not drawn at all, not drawn with different data. (fixture token: 'Moscone West')",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 374,
    text: 'Marcus O. · added 2 Aug',
    reason:
      "invented sample discard-side identity for the merge comparison's 'Discarding' column, abbreviating the last name to an initial purely for the mock illustration (paired with the 'Keeping' column's full 'Marcus Okafor · added 14 Mar' two lines above) -- app/src/pages/contacts/MergePage.tsx's own 'added <date>' composing expression, `Discarding · ${soleDiscard.firstName} ${soleDiscard.lastName}${discardDisambiguator ? ...`, always prints the FULL last name (DEC-992), never abbreviates it to an initial, so the app can never honestly produce this exact abbreviated string. (fixture token: 'Marcus O.')",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 597,
    text: 'DevFlow Conf 2028 · planning',
    reason:
      "invented sample second-event identity/status in the Add-to-event picker, used as mock card content (the frame's other option beside the selected 'DevFlow Conf 2027'), not a real UI caption. (fixture token: 'DevFlow Conf 2028')",
  },
  // v12m-w21-c (wave-146, DEC-380/DEC-989 residue docket).
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 194,
    text: 'DFC-033 · lightning talk, 10 min',
    reason:
      "the Agenda frame's own mock submission code, used as sample task-card content, not a real UI caption -- aligning this ledger's disposition with test/phone-dock-ledger.scan.test.ts's own FIXTURE exclusion for the identical file:line:text (DEC-967: two ledgers disagreeing about one row). (fixture token: 'DFC-033')",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 235,
    text: 'Priya Raman · sent 2 Apr',
    reason:
      "the 'Task response' modal exhibit's sample recipient identity/send-date, used as mock modal-header content -- the same invented 'Priya Raman' fixture identity the pack reuses throughout (already the fixture token behind several rows above). (fixture token: 'Priya Raman')",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 521,
    text: '12–14 May 2027 · Moscone West, San Francisco',
    reason:
      "the 'Review these reminders' modal's own 'What Marcus will read' email-preview exhibit, the same invented 'DevFlow Conf 2027' event dates/venue fixture already excluded at the identical text on Chautauqua Comms.dc.html:713 above (a second render of the same mail-preview mock). (fixture token: 'Moscone West')",
  },
];
