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
import { reviewingStartToFinish } from "./reviewing-start-to-finish";
import { yourSpeakerPortal } from "./your-speaker-portal";
import type { DocsArticle } from "./types";

export const DOCS_ARTICLES: readonly DocsArticle[] = [
  startHere,
  callForPapersAndSubmissions,
  reviewingStartToFinish,
  yourSpeakerPortal,
];

export { DOCS_GROUPS } from "./types";
export type { DocsGroupId, DocsBlock, DocsArticle } from "./types";
