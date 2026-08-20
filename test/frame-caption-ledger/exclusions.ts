// Frame caption/consequence ledger -- EXCLUSIONS module (DEC-976 wave-133;
// split from test/frame-caption-ledger.scan.test.ts by the
// contention-custodian decomposition, no behaviour change).
//
// Every entry cited here is asserted (in the test suite) to still resolve
// to its file:line:text in the current pack -- a stale exclusion fails
// loudly, exactly like every prior ledger's exclusion-citation guard. This
// module is deliberately isolated from population.ts/match.ts/ceiling.ts:
// it is the file every worker adding a new disposed caption touches, and
// keeping it apart from the extraction grammar and match machinery is the
// whole point of the split (fewer touched files sharing this one's own
// merge surface, not zero).
import { DEC_032 } from '../../src/decisions';
import type { Caption } from './population';
import { ALL_CAPTIONS } from './population';

void DEC_032; // task w17-g: the Settings retention block's non-build (UNBACKED_EXCLUSIONS below) is a DEC-032 disposition, recorded in DEVIATIONS.md §1

export interface Exclusion {
  fileName: string;
  line: number;
  text: string;
  reason: string;
}

/** (a) EXPLAINER -- the pack's own annotation panels, commentary about the
 * design system rather than product copy a real screen draws. Each entry
 * asserted below to still resolve to its cited file:line:text in the
 * current pack. */
export const EXPLAINER_EXCLUSIONS: Exclusion[] = [
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 245,
    text: 'Nine blocks. An article is a sequence of these and nothing else — a new kind of block is a change to this page first, not a one-off inside one article.',
    reason:
      "the Docs frame's own 'element library' annotation panel names the nine block types an article may use -- design-system vocabulary, not a Docs article the app renders.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 252,
    text: 'Paragraphs are short. If one runs past six lines at this measure it is two paragraphs, or it is a list.',
    reason: "the same 'element library' panel's prose-block rule, not product copy.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 286,
    text: 'Something true that the screen does not say. Olive edge, one line of label, two sentences at most.',
    reason: "the same 'element library' panel's aside-block rule, not product copy.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 290,
    text: 'Ink edge, reserved for irreversible acts and data loss. If everything is a warning, nothing is — expect at most one per article.',
    reason: "the same 'element library' panel's aside-block rule, not product copy.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 292,
    text: 'Two weights, no others. No tip / note / info / caution ladder — a reader cannot rank five colours, and translation breaks the words.',
    reason: "the same 'element library' panel's aside-block rule (block-vocabulary notes), not product copy.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 323,
    text: 'A block is for something the reader will copy. Never for prose, never for a UI label.',
    reason: "the same 'element library' panel's code-block rule, not product copy.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 336,
    text: 'Closes every article. Names the screen, not the doc — a reader finishing here is about to go and do the thing.',
    reason: "the same 'element library' panel's where-next-block rule, not product copy.",
  },
  {
    fileName: 'Chautauqua Home.dc.html',
    line: 364,
    text: 'A published programme stays published after the event ends, so a finished event would sit at the top of a flat list forever. Grouping fixes that and matches what a visitor arrived to find out: can I submit, or what\'s on?',
    reason:
      "the Home frame's own 'Rules you can't see on the page' hub-ordering annotation panel (already recorded as an explainer panel in test/desktop-frame-ledger.scan.test.ts), not product copy.",
  },
  {
    fileName: 'Chautauqua Home.dc.html',
    line: 399,
    text: 'Chautauqua is named once, in the footer, as an attribution link to the repository. That is the only place the product appears on a customer-facing surface.',
    reason:
      "the same 'Rules you can't see on the page' hub-ordering annotation panel, not product copy.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 407,
    text: "The agenda grid, and only the agenda grid. Its column count is the event's room count, which an organiser can add to — so width genuinely buys columns and capping it would force scrolling on a monitor that had the room. The speaker matrix and pipeline board look like canvases but are not: their columns are bounded by the task list and the five fixed stages, so both sit at the table measure and scroll below their own minimum.",
    reason:
      "the Overview frame's own widths annotation panel (already recorded as an explainer panel in test/desktop-frame-ledger.scan.test.ts), not product copy.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 568,
    text: 'A status cell takes a ring, never a fill — it already carries a fill that encodes its state.',
    reason: "the Overview frame's own interaction-states annotation panel, not product copy.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 626,
    text: 'The button is the progress indicator and the only thing disabled — no spinner, no overlay, no fake percentage. The button never says "Sent!"; the result panel reports.',
    reason: "the Overview frame's own interaction-states annotation panel, not product copy.",
  },
  {
    fileName: 'Chautauqua Home.dc.html',
    line: 365,
    text: 'Within a group: soonest deadline first, then soonest event. Past events run newest first.',
    reason:
      "the same 'Rules you can't see on the page' hub-ordering annotation panel as the already-listed :364/:399 rows, not product copy.",
  },
  {
    fileName: 'Chautauqua Home.dc.html',
    line: 379,
    text: "Each of these describes how well an event is going, not what a visitor can do about it. A thin CFP or a stalled review wave is the organiser's business.",
    reason:
      "the same 'Rules you can't see on the page' hub-ordering annotation panel as the already-listed :364/:399 rows, not product copy.",
  },
  {
    fileName: 'Chautauqua Home.dc.html',
    line: 398,
    text: 'The org\'s, not the product\'s — matching the public event pages, which lead with the event name. One org per deployment, so the hub is simply "our events" and needs no org switcher.',
    reason:
      "the same 'Rules you can't see on the page' hub-ordering annotation panel as the already-listed :364/:399 rows, not product copy.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 423,
    text: 'Four rooms today. Add a fifth and the grid takes the width rather than compressing the four it has.',
    reason:
      "the Overview frame's own widths annotation panel, the same panel as the already-listed :407 row, not product copy.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 524,
    text: "A disabled button has no hover at all · a button inside a hovering row keeps its own hover, the row tint sits behind it",
    reason:
      "the Overview frame's own interaction-states annotation panel, the same panel as the already-listed :568/:626 rows, not product copy.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 551,
    text: "Expanded — the band repeats the table's own tracks, so each score lands under Score",
    reason:
      "the Overview frame's own interaction-states annotation panel, the same panel as the already-listed :568/:626 rows, not product copy.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 654,
    text: 'No rotation, no scale, no shadow — the user is reading the card to decide where it goes. Every drag has a keyboard equivalent; an occupied target still accepts the drop and flags the clash.',
    reason:
      "the Overview frame's own interaction-states annotation panel, the same panel as the already-listed :568/:626 rows, not product copy.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 679,
    text: 'An optimistic write must be instant in both directions — fading the change and the rollback alike makes them indistinguishable.',
    reason:
      "the Overview frame's own interaction-states annotation panel, the same panel as the already-listed :568/:626 rows, not product copy.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 703,
    text: 'The chrome a page can draw without data — header, title, toolbar — is drawn immediately. Only the rows wait, and they wait as blocks at the row height they will become, so nothing jumps when the data lands.',
    reason:
      "the Overview frame's own interaction-states annotation panel, the same panel as the already-listed :568/:626 rows, not product copy.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 726,
    text: 'Six rows, always — a skeleton that guesses the real count lies twice: once while loading, once when the number differs.',
    reason:
      "the Overview frame's own interaction-states annotation panel, the same panel as the already-listed :568/:626 rows, not product copy.",
  },
];

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
];

/** (c) EXEMPLAR ARTICLE -- the Docs frame's own sample article, 'Triaging
 * submissions', a demonstration of the nine-block vocabulary the Docs frame
 * defines (DEC-099: a principle, not a branch or a schedule -- this is what
 * these five lines ARE). src/routes/docs-content ships nine real articles
 * under DOCS_ARTICLES and none carries this slug or IA, so no screen owes
 * these words. Each entry asserted below to still resolve to its cited
 * file:line:text in the current pack. */
export const EXEMPLAR_ARTICLE_EXCLUSIONS: Exclusion[] = [
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 61,
    text: 'Deciding which talks make the programme. Accepting or declining never emails anyone — that is a separate, deliberate act in Comms.',
    reason:
      "the pack's sample article 'Triaging submissions', a demonstration of the nine-block vocabulary the Docs frame defines -- src/routes/docs-content's DOCS_ARTICLES ships nine real articles, none with this slug or IA, so no screen owes these words.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 69,
    text: 'A status change is silent. Speakers learn their outcome when you send from Comms, which is why the two are separate screens.',
    reason:
      "the pack's sample article 'Triaging submissions', a demonstration of the nine-block vocabulary the Docs frame defines -- src/routes/docs-content's DOCS_ARTICLES ships nine real articles, none with this slug or IA, so no screen owes these words.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 82,
    text: 'Open a submission to read the abstract, the form answers and every review it has collected. Accept and Decline sit in the right rail beside them, so the decision is next to the evidence.',
    reason:
      "the pack's sample article 'Triaging submissions', a demonstration of the nine-block vocabulary the Docs frame defines -- src/routes/docs-content's DOCS_ARTICLES ships nine real articles, none with this slug or IA, so no screen owes these words.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 92,
    text: 'screenshot · /admin/submissions/:id · decision rail in frame',
    reason:
      "the same sample article's screenshot-placeholder line -- a demonstration of the nine-block vocabulary, not a real screen's copy.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 176,
    text: 'Deciding which talks make the programme. Accepting never emails anyone — that is a separate act in Comms.',
    reason:
      "the pack's sample article 'Triaging submissions', a demonstration of the nine-block vocabulary the Docs frame defines -- src/routes/docs-content's DOCS_ARTICLES ships nine real articles, none with this slug or IA, so no screen owes these words.",
  },
];

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
      "app/src/pages/Settings.tsx composes the fixed 'Settings' word with the live section label as `&lsaquo; {editingSection ? editingSection.label : 'Settings'}`; editingSection.label is 'Call for papers' for the cfp section (SECTIONS[1].label, Settings.tsx).",
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
];

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
];

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
    line: 1175,
    text: 'After that the abstract and reviews are deleted; the contact stays',
    reason:
      "DEVIATIONS.md §1 rules the frame's 'Keeping and deleting' block (docs/design/Chautauqua Settings.dc.html:1161-1180) a deliberate non-build, quoting verbatim: \"no retention column, no endpoint, and no deletion job backs any of the three controls — building them alone would declare a setting nothing reads.\" app/src/pages/settings/ExportsPanel.tsx already records the same non-build in its own header comment: `Deliberately does NOT build the frame's 'Keeping and deleting' retention block (docs/design/Chautauqua Settings.dc.html: 1161-1180) -- no column, no endpoint, no rubric backs it; recorded as a deliberate non-build on DEC-032.`",
  },
];

export function isExcluded(c: Caption, table: Exclusion[]): boolean {
  return table.some((e) => e.fileName === c.fileName && e.line === c.line && e.text === c.text);
}

export const CAPTIONS_AFTER_EXCLUSION: Caption[] = ALL_CAPTIONS.filter(
  (c) =>
    !isExcluded(c, EXPLAINER_EXCLUSIONS) &&
    !isExcluded(c, FIXTURE_EXCLUSIONS) &&
    !isExcluded(c, EXEMPLAR_ARTICLE_EXCLUSIONS) &&
    !isExcluded(c, COMPOSED_EXCLUSIONS) &&
    !isExcluded(c, SUPERSEDED_EXCLUSIONS) &&
    !isExcluded(c, UNBACKED_EXCLUSIONS)
);

