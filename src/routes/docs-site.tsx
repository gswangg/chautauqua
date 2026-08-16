// DEC-382 (wave-3 amendment): the /docs site is a NEW designed public
// route — DESIGN-RULINGS.md:298-316 states "src/routes/docs.tsx serves
// only /docs/api; a user-facing /docs does not exist, so the whole site is
// new work, not a re-skin." This module is that whole site: an index
// grouped by DOCS_GROUP_META (DEC-613, "the docs role-group vocabulary has
// exactly one owner") and one article page per DOCS_ARTICLES entry
// (DEC-518, the manifest those articles are derived into, never
// hand-mirrored). Route files export a named Hono sub-app; only
// src/index.ts mounts it (DEC-012), AFTER the existing
// app.route("/", docsRoutes) so GET /docs/api keeps resolving to the
// TOOLS_CSS reference — the ruling explicitly declines to revise DEC-382
// for /docs/api, so the API reference stays a labelled LEAVING LINK
// (muted "↗" + DOCS_API_LEAVING_LINK.label) rather than another article.
//
// Styling: DocsSiteStyles() (./docs-site.css.ts), in the
// src/routes/public/home.css.ts idiom, rendered after ThemeStyles() —
// never TOOLS_CSS, never the admin SPA sheet.

import { Hono } from "hono";
import type { AppEnv } from "../server/env";
import { DEC_012, DEC_382, DEC_518, DEC_613 } from "../decisions";
import { ThemeStyles } from "../views/theme";
import { DocsSiteStyles } from "./docs-site.css";
import {
  DOCS_GROUPS,
  DOCS_GROUP_META,
  DOCS_API_LEAVING_LINK,
  DOCS_ARTICLES,
  type DocsArticle,
  type DocsBlock,
  type DocsGroupId,
} from "./docs-content";
import { publicNotFound } from "./public/not-found";
import { PublicEmptyState } from "./public/empty-state";
import { DOCS_SHOTS_AVAILABLE } from "./docs-content/shots-available";

export const docsSiteRoutes = new Hono<AppEnv>();

void DEC_012;
void DEC_382;
void DEC_518;
void DEC_613;

function DocsHeader() {
  return (
    <header class="chq-docs-header">
      <span class="chq-docs-brandrow">
        <a class="chq-docs-wordmark" href="/docs">
          chautauqua
        </a>
        <span class="chq-docs-suffix">Docs</span>
      </span>
      <a class="chq-docs-leaving" href={DOCS_API_LEAVING_LINK.href}>
        <span aria-hidden="true" class="chq-docs-leaving-mark">
          &#8599;
        </span>
        {DOCS_API_LEAVING_LINK.label}
      </a>
    </header>
  );
}

// A group with zero articles renders the codebase's existing named empty
// state (PublicEmptyState, DEC-919) rather than a bare empty grid — never
// invented as a second empty-state component for one surface.
function DocsBlockView(props: { block: DocsBlock }) {
  const { block } = props;
  if (block.kind === "heading") {
    return <h2 class="chq-docs-h2">{block.text}</h2>;
  }
  if (block.kind === "prose") {
    return <p class="chq-docs-prose">{block.text}</p>;
  }
  if (block.kind === "list") {
    return (
      <ul class="chq-docs-list">
        {block.items.map((item) => (
          <li>{item}</li>
        ))}
      </ul>
    );
  }
  // figure: a NAMED PLACEHOLDER frame carrying its shotId as text plus its
  // caption -- never an <img> pointing at a file that does not exist yet
  // (screenshot rule 1: a doc showing a screen that isn't there is worse
  // than no screenshot). Once scripts/docs-shots.ts has actually captured
  // this id (DOCS_SHOTS_AVAILABLE, generated -- never hand-extended), the
  // frame renders the real image instead. alt is deliberately empty: the
  // figcaption carries the point (DESIGN-RULINGS.md:313), so the image is
  // decorative to a screen reader.
  if (DOCS_SHOTS_AVAILABLE.includes(block.shotId)) {
    return (
      <figure class="chq-docs-figure">
        <div class="chq-docs-figure-frame">
          <img
            class="chq-docs-figure-img"
            src={`/docs/shots/${block.shotId}.png`}
            width="900"
            height="563"
            loading="lazy"
            alt=""
          />
        </div>
        <figcaption class="chq-docs-figure-caption">{block.caption}</figcaption>
      </figure>
    );
  }
  return (
    <figure class="chq-docs-figure">
      <div class="chq-docs-figure-frame">
        <span class="chq-docs-figure-placeholder">screenshot &middot; {block.shotId}</span>
      </div>
      <figcaption class="chq-docs-figure-caption">{block.caption}</figcaption>
    </figure>
  );
}

function DocsIndexPage() {
  const byGroup = new Map<DocsGroupId, DocsArticle[]>();
  for (const article of DOCS_ARTICLES) {
    const list = byGroup.get(article.group) ?? [];
    list.push(article);
    byGroup.set(article.group, list);
  }

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Chautauqua docs</title>
        <ThemeStyles />
        <DocsSiteStyles />
      </head>
      <body>
        <div class="chq-docs-shell">
          <DocsHeader />
          <main class="chq-docs-body">
            <div class="chq-docs-intro">
              <h1>Chautauqua docs</h1>
              <p>Everything the software does, in the order you meet it. Start where you sit.</p>
            </div>

            {DOCS_GROUPS.map((groupId) => {
              const meta = DOCS_GROUP_META[groupId];
              const articles = byGroup.get(groupId) ?? [];
              return (
                <section>
                  <div class="chq-docs-group-head">
                    <span class="chq-docs-group-label">{meta.label}</span>
                    <span class="chq-docs-group-blurb">{meta.blurb}</span>
                  </div>
                  {articles.length === 0 ? (
                    <div class="chq-docs-empty">
                      <PublicEmptyState variant="fresh" what="Nothing here yet." reason="This section is still being written." />
                    </div>
                  ) : (
                    <div class="chq-docs-article-grid">
                      {articles.map((article) => (
                        <div class="chq-docs-article-row">
                          <a class="chq-docs-article-title" href={`/docs/${article.slug}`}>
                            {article.title}
                          </a>
                          <span class="chq-docs-article-blurb">{article.standfirst}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </main>
        </div>
      </body>
    </html>
  );
}

function DocsArticlePage(props: { article: DocsArticle }) {
  const { article } = props;
  const meta = DOCS_GROUP_META[article.group];
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{article.title} - Chautauqua docs</title>
        <ThemeStyles />
        <DocsSiteStyles />
      </head>
      <body>
        <div class="chq-docs-shell">
          <DocsHeader />
          <main class="chq-docs-article-body">
            <div class="chq-docs-article-head">
              <span class="chq-docs-article-eyebrow">{meta.label}</span>
              <h1>{article.title}</h1>
              <p>{article.standfirst}</p>
            </div>
            {article.blocks.map((block) => (
              <DocsBlockView block={block} />
            ))}
          </main>
        </div>
      </body>
    </html>
  );
}

docsSiteRoutes.get("/docs", async (c) => {
  return c.html(<DocsIndexPage />);
});

docsSiteRoutes.get("/docs/:slug", async (c) => {
  const slug = c.req.param("slug");
  const article = DOCS_ARTICLES.find((a) => a.slug === slug);
  if (!article) {
    return publicNotFound(c, "This docs page does not exist.");
  }
  return c.html(<DocsArticlePage article={article} />);
});
