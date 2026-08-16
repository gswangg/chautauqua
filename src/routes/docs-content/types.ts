// Docs site content types (v12 intake section B). JSX-free data modules —
// this directory is prose, not markup. Shape fixed by DEC-518's
// derived-manifest discipline so parallel article-writing branches cannot
// fork the registry: each article file exports one named DocsArticle
// const, and index.ts's DOCS_ARTICLES is derived by import, never
// hand-listed (see index.ts and test/docs-content-manifest.test.ts).
//
// DocsBlock's union is DEC-650's closed nine-block element library
// (wave-4 amendment) -- see the type below for the vocabulary itself.

import { DEC_650 } from "../../decisions";

void DEC_650;

export const DOCS_GROUPS = [
  "getting-started",
  "running-an-event",
  "your-contacts",
  "for-reviewers",
  "for-speakers",
  "running-the-software",
] as const;

export type DocsGroupId = (typeof DOCS_GROUPS)[number];

// DEC-650 (wave-4 amendment): the drawn element library
// (docs/design/Chautauqua Docs.dc.html:226-346) is a CLOSED set of nine
// block kinds -- "Nothing outside this set may appear in an article" -- so
// this union is the whole vocabulary an article file may use. heading and
// list grew additive, optional members (never a breaking change to an
// existing article); aside, deflist and code are new. A heading's level
// stops at 3: "an article needing H4 is two articles" -- there is no level
// 4 in this type, not just a runtime check against it.
export type DocsBlock =
  | { kind: "heading"; text: string; level?: 2 | 3 }
  | { kind: "prose"; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "figure"; shotId: string; caption: string }
  // Exactly two weights -- no tip/note/info/caution ladder (DEC-613's
  // second-vocabulary trap). "worth-knowing" is a soft aside;
  // "cannot-be-undone" flags an irreversible action described in prose.
  | { kind: "aside"; weight: "worth-knowing" | "cannot-be-undone"; label: string; text: string }
  | { kind: "deflist"; rows: { term: string; definition: string }[] }
  // A code block is for something the reader will copy verbatim -- never
  // rendered as prose or a bulleted list.
  | { kind: "code"; lines: string[] };

export interface DocsArticle {
  slug: string;
  group: DocsGroupId;
  title: string;
  standfirst: string;
  blocks: DocsBlock[];
}
