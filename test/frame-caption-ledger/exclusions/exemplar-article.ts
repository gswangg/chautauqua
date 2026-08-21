import type { Exclusion } from './types';

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
  // v12m-w18-d (wave-143): the same sample article's desktop lead screenshot
  // placeholder and its 390-phone twin's own screenshot placeholder.
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 75,
    text: 'screenshot · /admin/submissions · 1600×900 · light',
    reason:
      "the pack's sample article 'Triaging submissions', the same desktop screenshot placeholder as the already-listed :92 row -- src/routes/docs-content's DOCS_ARTICLES ships nine real articles, none with this slug or IA, so no screen owes these words.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 185,
    text: 'screenshot · 390 · tap to zoom',
    reason:
      "the pack's sample article 'Triaging submissions', the 390-phone twin of the same article (the already-listed :176 row draws its lede at this width) -- src/routes/docs-content's DOCS_ARTICLES ships nine real articles, none with this slug or IA, so no screen owes these words.",
  },
];
