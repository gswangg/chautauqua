import type { Exclusion } from './types';

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
  // v12m-w18-d (wave-143): the Docs '02 · Headings'/'05 · Figure' element-
  // library panel rows and the Overview 'widths' annotation panel rows this
  // lane's own residue population turned up.
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 262,
    text: 'Three levels. An article needing H4 is two articles.',
    reason: "the same 'element library' panel's heading-vocabulary rule ('02 · Headings'), not product copy.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 300,
    text: 'screenshot · /admin/route · 1600×900',
    reason: "the same 'element library' panel's figure-block screenshot placeholder ('05 · Figure'), not product copy.",
  },
  {
    fileName: 'Chautauqua Home.dc.html',
    line: 388,
    text: 'Each state is drawn at 900 and at 390, so there is no guessing which layout is being specified. Desktop lays an event out as a three-column row — dates, name and state, action. Phone stacks the same fields into a card with a full-width button.',
    reason:
      "the Home frame's own 'Three states, both widths' annotation panel, not product copy.",
  },
  {
    fileName: 'Chautauqua Home.dc.html',
    line: 408,
    text: 'The seed holds one event. The autumn-workshops and 2026 rows exist to show what the shape does with several — they are not seeded data.',
    reason:
      "the Home frame's own 'Two things this mock fudges' annotation panel, not product copy.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 367,
    text: 'Overview, session detail, forms, settings panels, every public page. Prose and single decisions. The gutters are the design, not waste — a 60-character measure does not improve at 1800px.',
    reason:
      "the Overview frame's own widths annotation panel ('Reading measure · 820px'), the same panel as the already-listed :407/:423 rows, not product copy.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 380,
    text: 'Submissions, Contacts directory, Content worklist, Review results, Comms, Settings. Tables want width — but past about 1440 the eye loses the row between the title and the action at the far end, and the fix is a wider gap, not a wider table.',
    reason:
      "the Overview frame's own widths annotation panel ('Table measure · capped at 1440px'), the same panel as the already-listed :407/:423 rows, not product copy.",
  },
];
