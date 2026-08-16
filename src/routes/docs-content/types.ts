// Docs site content types (v12 intake section B). JSX-free data modules —
// this directory is prose, not markup. Shape fixed by DEC-518's
// derived-manifest discipline so parallel article-writing branches cannot
// fork the registry: each article file exports one named DocsArticle
// const, and index.ts's DOCS_ARTICLES is derived by import, never
// hand-listed (see index.ts and test/docs-content-manifest.test.ts).

export const DOCS_GROUPS = [
  "getting-started",
  "running-an-event",
  "your-contacts",
  "for-reviewers",
  "for-speakers",
  "running-the-software",
] as const;

export type DocsGroupId = (typeof DOCS_GROUPS)[number];

export type DocsBlock =
  | { kind: "heading"; text: string }
  | { kind: "prose"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "figure"; shotId: string; caption: string };

export interface DocsArticle {
  slug: string;
  group: DocsGroupId;
  title: string;
  standfirst: string;
  blocks: DocsBlock[];
}
