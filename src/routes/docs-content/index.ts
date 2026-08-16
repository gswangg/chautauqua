// Docs content registry (v12 intake section B). Each article module below
// exports exactly one named DocsArticle const; this file imports every one
// of them and lists it in DOCS_ARTICLES. test/docs-content-manifest.test.ts
// derives the directory's article modules independently (by reading the
// directory and importing each file) and asserts that derived set equals
// this array's slugs exactly — so an article file added here without a
// matching entry, or an entry here with no backing file, both fail loudly
// (DEC-518: a cross-file manifest is derived in a test, never trusted).

import { startHere } from "./start-here";
import { callForPapersAndSubmissions } from "./call-for-papers-and-submissions";
import { speakersTasksAndContent } from "./speakers-tasks-and-content";
import { agendaAndPublishing } from "./agenda-and-publishing";
import { embedsAndPublicPages } from "./embeds-and-public-pages";
import { contactsPipelineAndComms } from "./contacts-pipeline-and-comms";
import { reviewingStartToFinish } from "./reviewing-start-to-finish";
import { yourSpeakerPortal } from "./your-speaker-portal";
import { runningTheSoftware } from "./running-the-software";
import type { DocsArticle } from "./types";

// Listed in DOCS_GROUPS order (getting-started, running-an-event,
// your-contacts, for-reviewers, for-speakers, running-the-software) so the
// registry reads in the same order the docs index renders. The manifest test
// compares slug SETS, so this order is a readability convention, not a
// contract -- nothing may depend on the array's index positions.
export const DOCS_ARTICLES: readonly DocsArticle[] = [
  startHere,
  callForPapersAndSubmissions,
  speakersTasksAndContent,
  agendaAndPublishing,
  embedsAndPublicPages,
  contactsPipelineAndComms,
  reviewingStartToFinish,
  yourSpeakerPortal,
  runningTheSoftware,
];

export { DOCS_GROUPS } from "./types";
export type { DocsGroupId, DocsBlock, DocsArticle } from "./types";
export { DOCS_GROUP_META, DOCS_API_LEAVING_LINK } from "./groups";
export type { DocsGroupMeta } from "./groups";
