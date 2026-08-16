// Docs article furniture: the sticky grouped side nav and prev/next
// neighbours (DEC-613 amendment wave 4 / DEC-180 amendment wave 4).
// Pure, no JSX, no IO -- mirrors the discipline of the other
// docs-content/*.ts modules (DEC-518: derived, never hand-mirrored). The
// nav's group order and labels come from DOCS_GROUP_META (./groups) so
// there is exactly one owner of the six group labels; this module never
// re-spells them.

import { DOCS_GROUP_META } from "./groups";
import { DOCS_ARTICLES } from "./index";
import type { DocsGroupId } from "./types";

export interface DocsNavGroup {
  id: DocsGroupId;
  label: string;
  articles: { slug: string; title: string }[];
}

/** Groups DOCS_ARTICLES by group, in DOCS_GROUP_META's key order (which is
 * DOCS_GROUPS order), articles within a group in DOCS_ARTICLES order. A
 * group with zero articles is omitted -- the nav never renders an empty
 * heading (same rule the index page follows for its own empty state). */
export function docsNavGroups(): DocsNavGroup[] {
  const groups: DocsNavGroup[] = [];
  for (const id of Object.keys(DOCS_GROUP_META) as DocsGroupId[]) {
    const articles = DOCS_ARTICLES.filter((a) => a.group === id).map((a) => ({
      slug: a.slug,
      title: a.title,
    }));
    if (articles.length === 0) continue;
    groups.push({ id, label: DOCS_GROUP_META[id].label, articles });
  }
  return groups;
}

/** The flattened nav order (every group's articles, group order then
 * within-group order) is the order the prev/next pager walks. Null at
 * both ends -- the first article has no prev, the last has no next. */
export function docsArticleNeighbours(slug: string): {
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
} {
  const flat = docsNavGroups().flatMap((g) => g.articles);
  const index = flat.findIndex((a) => a.slug === slug);
  if (index === -1) {
    return { prev: null, next: null };
  }
  return {
    prev: index > 0 ? (flat[index - 1] ?? null) : null,
    next: index < flat.length - 1 ? (flat[index + 1] ?? null) : null,
  };
}
