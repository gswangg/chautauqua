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
//
// DEC-382 (Amendment, wave 9, sha 3323a7b7): docs search is a QUERY on
// GET /docs, never a new route (src/index.ts's mounted-route list and the
// README evaluator table stay unchanged). ?q= renders the same shell with
// a results section swapped in for the group grid, via the pure
// ./docs-content/search.ts core. The ruling's other half -- the API
// reference as the "Running the software" group's last row, per
// Chautauqua Docs.dc.html:436 -- reads off the one existing
// DOCS_API_LEAVING_LINK constant (DocsApiLeavingRow below).

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
import { docsNavGroups, docsArticleNeighbours } from "./docs-content/nav";
import { WHERE_NEXT_BY_SLUG } from "./docs-content/where-next";
import { searchDocs, type DocsSearchHit } from "./docs-content/search";
import { boundedQueryString, MAX_SEARCH_QUERY_LENGTH } from "../lib/query-bounds";

export const docsSiteRoutes = new Hono<AppEnv>();

void DEC_012;
void DEC_382;
void DEC_518;
void DEC_613;

// DEC-650 amendment (USER RULING 2026-08-16, two-tier docs vocabulary):
// article prose carries exactly two inline spans -- `code` for
// machine-literal text (commands, URLs, file names, column names) and
// **bold** for an on-screen control or label named as a thing to find.
// This parser is deliberately minimal and escape-safe: an unpaired
// backtick or ** renders as-is, spans never nest, and an empty span
// (``/****) is not a span. Applied to prose text, list items,
// standfirsts, figure captions and search snippets -- never to headings,
// titles, or code blocks (already monospace whole).
export type DocsInlineSegment = { kind: "text" | "code" | "strong"; text: string };

const DOCS_INLINE_SPAN_RE = /`([^`]+)`|\*\*([^*]+)\*\*/g;

export function docsInlineSegments(text: string): DocsInlineSegment[] {
  const segments: DocsInlineSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(DOCS_INLINE_SPAN_RE)) {
    const idx = m.index!;
    if (idx > last) segments.push({ kind: "text", text: text.slice(last, idx) });
    if (m[1] !== undefined) {
      segments.push({ kind: "code", text: m[1] });
    } else {
      segments.push({ kind: "strong", text: m[2]! });
    }
    last = idx + m[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
  return segments;
}

function DocsInline(props: { text: string }) {
  return (
    <>
      {docsInlineSegments(props.text).map((seg) =>
        seg.kind === "code" ? <code>{seg.text}</code> : seg.kind === "strong" ? <strong>{seg.text}</strong> : seg.text,
      )}
    </>
  );
}

// Real GET form (no-JS-correct: this IS how ?q= reaches the server), a
// named `q` input, and a submit control with a real >=44px touch target --
// the DEC-919 "off-screen/1px submit" defect does not repeat here. `size`
// picks between the two drawn placements (Chautauqua Docs.dc.html:136 vs
// :39/:237): both are the SAME form/route, only geometry differs.
function DocsSearchForm(props: { q: string | undefined; size: "large" | "compact" }) {
  const { q, size } = props;
  return (
    <form
      method="get"
      action="/docs"
      class={size === "large" ? "chq-docs-search chq-docs-search-large" : "chq-docs-search chq-docs-search-compact"}
      role="search"
    >
      <input
        type="search"
        name="q"
        value={q ?? ""}
        placeholder="Search the docs…"
        aria-label="Search the docs"
        class="chq-docs-search-input"
      />
      <button type="submit" class="chq-docs-search-submit">
        Search
      </button>
    </form>
  );
}

// DEC-382 (wave-9 amendment): a compact search field sits in the header's
// right cluster, BEFORE the API-reference leaving link, on article and
// results pages (:39/:237) -- never on the plain index (which carries the
// large intro-block placement instead, :136).
function DocsHeader(props: { search?: { q: string | undefined } }) {
  return (
    <header class="chq-docs-header">
      <span class="chq-docs-brandrow">
        <a class="chq-docs-wordmark" href="/docs">
          chautauqua
        </a>
        <span class="chq-docs-suffix">Docs</span>
      </span>
      {props.search ? <DocsSearchForm q={props.search.q} size="compact" /> : null}
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
    // level stops at 3 -- DEC-650's "an article needing H4 is two articles"
    // is enforced at the type level (DocsBlock's level union has no 4), so
    // this render side only ever picks between the two shapes that exist.
    if (block.level === 3) {
      return <h3 class="chq-docs-h3">{block.text}</h3>;
    }
    return <h2 class="chq-docs-h2">{block.text}</h2>;
  }
  if (block.kind === "prose") {
    return (
      <p class="chq-docs-prose">
        <DocsInline text={block.text} />
      </p>
    );
  }
  if (block.kind === "list") {
    if (block.ordered) {
      return (
        <ol class="chq-docs-list">
          {block.items.map((item) => (
            <li>
              <DocsInline text={item} />
            </li>
          ))}
        </ol>
      );
    }
    return (
      <ul class="chq-docs-list">
        {block.items.map((item) => (
          <li>
            <DocsInline text={item} />
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === "aside") {
    // Weight picks a whole literal class string (never assembled with a
    // template literal) -- test/ssr-css-contract.scan.test.ts's
    // whole-source-text scan only sees plain quoted literals.
    const asideClass =
      block.weight === "cannot-be-undone" ? "chq-docs-aside chq-docs-aside-cannot-be-undone" : "chq-docs-aside chq-docs-aside-worth-knowing";
    return (
      <div class={asideClass}>
        <span class="chq-docs-aside-label">{block.label}</span>
        <p class="chq-docs-aside-text">{block.text}</p>
      </div>
    );
  }
  if (block.kind === "deflist") {
    return (
      <dl class="chq-docs-deflist">
        {block.rows.map((row) => (
          <div class="chq-docs-deflist-row">
            <dt class="chq-docs-deflist-term">{row.term}</dt>
            <dd class="chq-docs-deflist-definition">{row.definition}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if (block.kind === "code") {
    return (
      <pre class="chq-docs-code">
        <code>{block.lines.join("\n")}</code>
      </pre>
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
        <figcaption class="chq-docs-figure-caption">
          <DocsInline text={block.caption} />
        </figcaption>
      </figure>
    );
  }
  return (
    <figure class="chq-docs-figure">
      <div class="chq-docs-figure-frame">
        <span class="chq-docs-figure-placeholder">screenshot &middot; {block.shotId}</span>
      </div>
      <figcaption class="chq-docs-figure-caption">
        <DocsInline text={block.caption} />
      </figcaption>
    </figure>
  );
}

// Sticky grouped side nav (Chautauqua Docs.dc.html:46-55). Current article
// marked with the olive inset rule (:354-355 of the same file); every other
// link in its group renders unselected. On phone the whole column is
// hidden by CSS in favour of the '‹ Docs' back link rendered separately
// below, per the frame's third (390px) panel.
function DocsNav(props: { activeSlug: string }) {
  const groups = docsNavGroups();
  return (
    <nav class="chq-docs-nav" aria-label="Docs sections">
      {groups.map((group) => (
        <div class="chq-docs-nav-group">
          <span class="chq-docs-nav-group-label">{group.label}</span>
          {group.articles.map((article) => (
            <a
              class={
                article.slug === props.activeSlug
                  ? "chq-docs-nav-link chq-docs-nav-link-active"
                  : "chq-docs-nav-link"
              }
              href={`/docs/${article.slug}`}
              aria-current={article.slug === props.activeSlug ? "page" : undefined}
            >
              {article.title}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}

// "Closes every article. Names the screen, not the doc." (:336) -- the
// 150px/1fr grid drawn at :328-337 and again in the article frame at
// :97-105.
function DocsWhereNext(props: { slug: string }) {
  const rows = WHERE_NEXT_BY_SLUG[props.slug] ?? [];
  if (rows.length === 0) return null;
  return (
    <div class="chq-docs-where-next">
      <h2 class="chq-docs-h2">Where next</h2>
      {rows.map((row) => (
        <div class="chq-docs-where-next-row">
          <a class="chq-docs-where-next-where" href={row.href}>
            {row.where}
          </a>
          <span class="chq-docs-where-next-what">{row.what}</span>
        </div>
      ))}
    </div>
  );
}

// Top-rule pager: prev on the left, next pushed right (:341-345). Either
// side is omitted at the ends of the flattened nav order.
function DocsPager(props: { slug: string }) {
  const { prev, next } = docsArticleNeighbours(props.slug);
  if (!prev && !next) return null;
  return (
    <div class="chq-docs-pager">
      {prev ? (
        <a class="chq-docs-pager-prev" href={`/docs/${prev.slug}`}>
          &lsaquo; {prev.title}
        </a>
      ) : null}
      {next ? (
        <a class="chq-docs-pager-next" href={`/docs/${next.slug}`}>
          {next.title} &rsaquo;
        </a>
      ) : null}
    </div>
  );
}

// The running-the-software group's final row: the API reference, drawn as
// a leaving link rather than an article (Chautauqua Docs.dc.html:436,
// DESIGN-RULINGS.md:306). Both label and href come from the one existing
// DOCS_API_LEAVING_LINK constant -- never re-typed (DEC-613's
// two-vocabularies trap).
function DocsApiLeavingRow() {
  return (
    <div class="chq-docs-article-row chq-docs-article-row-leaving">
      <a class="chq-docs-article-title chq-docs-leaving-row-link" href={DOCS_API_LEAVING_LINK.href}>
        <span aria-hidden="true" class="chq-docs-leaving-mark">
          &#8599;
        </span>
        {DOCS_API_LEAVING_LINK.label}
      </a>
      <span class="chq-docs-article-blurb">Leaves the docs — an operator surface, generated from the routes</span>
    </div>
  );
}

function DocsSearchResults(props: { q: string; hits: DocsSearchHit[] }) {
  const { q, hits } = props;
  if (hits.length === 0) {
    return (
      <div class="chq-docs-empty">
        <PublicEmptyState variant="fresh" what={`No results for "${q}".`} reason="Try a different word, or browse the sections below." />
      </div>
    );
  }
  return (
    <div class="chq-docs-article-grid">
      {hits.map((hit) => (
        <div class="chq-docs-article-row">
          <a class="chq-docs-article-title" href={`/docs/${hit.slug}`}>
            {hit.title}
          </a>
          <span class="chq-docs-article-blurb">{DOCS_GROUP_META[hit.group].label}</span>
          <span class="chq-docs-article-blurb">
            <DocsInline text={hit.snippet} />
          </span>
        </div>
      ))}
    </div>
  );
}

function DocsIndexPage(props: { q?: string; hits?: DocsSearchHit[] }) {
  const { q, hits } = props;
  const isSearch = q !== undefined;
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
          <DocsHeader search={isSearch ? { q } : undefined} />
          <main class="chq-docs-body">
            <div class="chq-docs-intro">
              <h1>Chautauqua docs</h1>
              <p>Everything the software does, in the order you meet it. Start where you sit.</p>
              <DocsSearchForm q={q} size="large" />
            </div>

            {isSearch ? (
              <section>
                <div class="chq-docs-group-head">
                  <span class="chq-docs-group-label">Search results</span>
                  <span class="chq-docs-group-blurb">{`${hits!.length} match${hits!.length === 1 ? "" : "es"} for "${q}"`}</span>
                </div>
                <DocsSearchResults q={q!} hits={hits!} />
              </section>
            ) : (
              DOCS_GROUPS.map((groupId) => {
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
                            <span class="chq-docs-article-blurb">
                              <DocsInline text={article.standfirst} />
                            </span>
                          </div>
                        ))}
                        {groupId === "running-the-software" ? <DocsApiLeavingRow /> : null}
                      </div>
                    )}
                  </section>
                );
              })
            )}
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
          <DocsHeader search={{ q: undefined }} />
          <div class="chq-docs-article-frame">
            <DocsNav activeSlug={article.slug} />
            <main class="chq-docs-article-body">
              <a class="chq-docs-phone-back" href="/docs">
                &lsaquo; Docs
              </a>
              <div class="chq-docs-article-head">
                <span class="chq-docs-article-eyebrow">{meta.label}</span>
                <h1>{article.title}</h1>
                <p>
                  <DocsInline text={article.standfirst} />
                </p>
              </div>
              {article.blocks.map((block) => (
                <DocsBlockView block={block} />
              ))}
              <DocsWhereNext slug={article.slug} />
              <DocsPager slug={article.slug} />
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}

// Query bound: an over-long ?q= renders the no-results state rather than
// throwing (this is a public surface, DEC-023's "the message must reach
// the operator" is about a fail-loud SITE, not a fail-loud 500 in front of
// an anonymous visitor). boundedQueryString still throws for a genuinely
// too-long value; caught here and folded into "no matches" so the search
// box round-trips the raw value without ever 500ing.
docsSiteRoutes.get("/docs", async (c) => {
  const raw = c.req.query("q");
  let q: string | null;
  try {
    q = boundedQueryString(raw, "q", MAX_SEARCH_QUERY_LENGTH);
  } catch {
    q = null;
    if (raw !== undefined && raw.trim().length > 0) {
      // Over-long: keep the raw value on-screen (so the box round-trips
      // what was typed) but never feed it to the pure search core.
      return c.html(<DocsIndexPage q={raw} hits={[]} />);
    }
  }
  if (q === null) {
    return c.html(<DocsIndexPage />);
  }
  const hits = searchDocs(DOCS_ARTICLES, q);
  return c.html(<DocsIndexPage q={q} hits={hits} />);
});

docsSiteRoutes.get("/docs/:slug", async (c) => {
  const slug = c.req.param("slug");
  const article = DOCS_ARTICLES.find((a) => a.slug === slug);
  if (!article) {
    return publicNotFound(c, "This docs page does not exist.");
  }
  return c.html(<DocsArticlePage article={article} />);
});
