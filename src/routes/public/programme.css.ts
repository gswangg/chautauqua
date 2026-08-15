// DEC-683 amendment (wave 65): the printable programme is a print-first
// surface, not another /agenda skin — its own stylesheet, not another block
// grown inside public.css.ts, because print has its own rules (no
// background fills, black ink, no page break inside a day). PROGRAMME_CSS is
// a fixed, value-free module constant (DEC-374's convention) -- never
// interpolated with request/user data -- inlined by ProgrammeContent via
// `<style dangerouslySetInnerHTML={{ __html: PROGRAMME_CSS }} />`, exactly
// like shell.tsx's BaseStyles inlines PUBLIC_CSS.

import { EMPTY_CSS } from "./css/empty.css";

export const PROGRAMME_CSS = `
  .chq-prog-main {
    max-width: 760px;
    margin: 0 auto;
    padding: 24px 16px 64px;
  }
  /* task-w49-h (DEC-990 amendment): font-size moved to the shared
     .chq-pub-surface-title register below -- this selector keeps only its
     own layout. */
  .chq-prog-title {
    margin: 0 0 4px;
  }
  /* task-w49-h (DEC-990 amendment): the shared public page-title register
     -- docs/design/README.md's typography table states exactly two
     customer-facing h1 registers (page title 36px/700/-0.04em desktop;
     overview headline 44px, untouched -- see home.css.ts). Applied here
     (rather than inherited from src/routes/public/css/rail.css.ts, which
     this print-first stylesheet does not compose) since PROGRAMME_CSS is
     its own module. */
  .chq-pub-surface-title {
    font-family: var(--chq-font-display);
    font-size: 36px;
    font-weight: 700;
    letter-spacing: -0.04em;
  }
  .chq-prog-meta {
    margin: 0 0 32px;
    color: var(--chq-muted);
  }
  .chq-prog-note {
    margin: 0 0 32px;
    color: var(--chq-muted);
    font-size: 0.85rem;
  }
  .chq-prog-day {
    margin: 0 0 32px;
  }
  .chq-prog-day-heading {
    margin: 0 0 8px;
    padding-bottom: 4px;
    border-bottom: 2px solid var(--chq-ink);
    font-size: 1.1rem;
  }
  .chq-prog-row {
    display: flex;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--chq-hairline);
  }
  .chq-prog-row-time {
    flex: 0 0 130px;
    font-variant-numeric: tabular-nums;
  }
  .chq-prog-row-body {
    flex: 1 1 auto;
  }
  .chq-prog-row-title {
    font-weight: 600;
  }
  .chq-prog-row-sub {
    color: var(--chq-muted);
    font-size: 0.9rem;
  }
  .chq-prog-break {
    font-variant: small-caps;
    letter-spacing: 0.02em;
    color: var(--chq-muted);
  }
  /* DEC-383 (merge-train fix): print's "white page, black ink" is spelled
     with the palette's own tokens (--chq-paper / --chq-ink) rather than
     #fff/#000 -- the palette closure guard admits NO hex literal in a
     surface sheet, and these two tokens ARE the palette's paper and its
     darkest ink. */
  @media print {
    body {
      background: var(--chq-paper) !important;
      color: var(--chq-ink) !important;
    }
    .chq-prog-main {
      max-width: none;
      padding: 0;
    }
    .chq-prog-row-sub,
    .chq-prog-meta,
    .chq-prog-break {
      color: var(--chq-ink) !important;
    }
    .chq-prog-day {
      page-break-inside: avoid;
    }
    .chq-prog-note {
      display: none;
    }
  }
${EMPTY_CSS}
`;
