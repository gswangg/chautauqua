// Docs search (DEC-382, wave-9 amendment): a pure, JSX-free, no-I/O search
// over the docs content manifest. The route layer (docs-site.tsx) is the
// only caller -- this module never imports hono/anything, mirroring the
// rest of docs-content/*.ts (DEC-002: pure core, no node:/cf).
//
// Case-insensitive substring match over an article's title, standfirst,
// and every DocsBlock variant's text. The block walk is DERIVED from the
// DocsBlock union declared in ./types (a switch with no default arm, so
// TypeScript fails the build if a tenth block kind is ever added and this
// file isn't updated) -- never a hand-listed subset of kinds (the
// DEC-180/DEC-941 "hand-listed enumeration" trap).

import type { DocsArticle, DocsBlock, DocsGroupId } from "./types";

export interface DocsSearchHit {
  slug: string;
  title: string;
  group: DocsGroupId;
  snippet: string;
}

const DEFAULT_LIMIT = 20;
const SNIPPET_WINDOW = 160;

/** Every searchable string carried by one block, in reading order. Every
 * DocsBlock kind is handled explicitly (see file header). */
function blockTexts(block: DocsBlock): string[] {
  switch (block.kind) {
    case "heading":
      return [block.text];
    case "prose":
      return [block.text];
    case "list":
      return block.items;
    case "figure":
      return [block.caption];
    case "aside":
      return [block.label, block.text];
    case "deflist":
      return block.rows.flatMap((row) => [row.term, row.definition]);
    case "code":
      return block.lines;
  }
}

interface SearchField {
  text: string;
  isTitle: boolean;
}

function articleFields(article: DocsArticle): SearchField[] {
  const fields: SearchField[] = [
    { text: article.title, isTitle: true },
    { text: article.standfirst, isTitle: true },
  ];
  for (const block of article.blocks) {
    for (const text of blockTexts(block)) {
      fields.push({ text, isTitle: false });
    }
  }
  return fields;
}

/** A ~160-char window around the first match, never mid-word-severed at
 * text bounds. Truncated edges get an ellipsis; an edge that already sits
 * at the string boundary does not. */
function snippetAround(text: string, matchStart: number, matchLength: number): string {
  if (text.length <= SNIPPET_WINDOW) return text;
  const half = Math.floor((SNIPPET_WINDOW - matchLength) / 2);
  let start = Math.max(0, matchStart - half);
  let end = Math.min(text.length, start + SNIPPET_WINDOW);
  start = Math.max(0, end - SNIPPET_WINDOW);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

/**
 * Case-insensitive substring search across an article's title, standfirst
 * and every block's text. Title/standfirst hits rank above body hits;
 * within a rank, articles keep `articles`' own order (DOCS_ARTICLES order).
 * Blank/whitespace `q` returns []. `limit` defaults to 20.
 */
export function searchDocs(articles: readonly DocsArticle[], q: string, limit: number = DEFAULT_LIMIT): DocsSearchHit[] {
  const needle = q.trim().toLowerCase();
  if (needle.length === 0) return [];

  const hits: { hit: DocsSearchHit; rank: 0 | 1; order: number }[] = [];

  articles.forEach((article, order) => {
    const fields = articleFields(article);
    for (const field of fields) {
      const idx = field.text.toLowerCase().indexOf(needle);
      if (idx === -1) continue;
      hits.push({
        hit: {
          slug: article.slug,
          title: article.title,
          group: article.group,
          snippet: snippetAround(field.text, idx, needle.length),
        },
        rank: field.isTitle ? 0 : 1,
        order,
      });
      break; // first match only, per article
    }
  });

  hits.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return hits.slice(0, limit).map((entry) => entry.hit);
}
