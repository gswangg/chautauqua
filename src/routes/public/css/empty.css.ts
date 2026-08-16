// Part of PUBLIC_CSS (DEC-373/DEC-374, see public.css.ts) -- split out by
// the structure custodian (contention decomposition) into its own fragment
// rather than appended to an existing one, mirroring the wave-68 file split.
// This fragment: the DEC-919 (wave 47 amendment) PublicEmptyState markup
// (src/routes/public/empty-state.tsx) -- the admin .chq-empty-block anatomy
// (app/src/styles.css, DEC-678) mirrored at the public type scale rather
// than re-invented.
//
// EMPTY_CSS is a fixed, value-free module constant, exactly like the
// PUBLIC_CSS it composes into (DEC-374) -- never interpolated with
// request/user data.
export const EMPTY_CSS = `
  /* DEC-919 (wave 47 amendment): public zero-state. 'fresh' (nothing has
     ever been published) gets 44px of top room and never an escape link.
     'filtered' (a facet excluded every row) sits tighter at 30px since the
     filter bar is still mounted directly above it, and carries the escape
     link back to the surface's bare path. Neither variant ever renders a
     button -- B7 rule 3: an attendee waiting on a programme cannot act. */
  .chq-pub-empty-block {
    text-align: left;
  }

  .chq-pub-empty-block-fresh {
    padding-top: 44px;
  }

  .chq-pub-empty-block-filtered {
    padding-top: 30px;
  }

  .chq-pub-empty-what {
    font-size: 15px;
    color: var(--chq-ink);
    margin: 0 0 4px;
  }

  .chq-pub-empty-reason {
    font-size: 13px;
    color: var(--chq-muted);
    margin: 0 0 12px;
  }

  /* G13 (frame 10--20, MAJOR): the FRESH zero-state is the page's whole
     content, and the frame sets its headline at the page-title register
     (~36px, the same size as every other public H1) with a ~16px reason --
     not a 15px body line that vanishes on a 1600 canvas. The filtered
     variant (a list surface with its filter bar still mounted above) keeps
     the quiet 15/13 pair above; inline fresh blocks on the portal are
     re-pinned by that surface's own sheet. */
  .chq-pub-empty-block-fresh .chq-pub-empty-what {
    font-family: var(--chq-font-display);
    font-size: var(--chq-type-page-title-size);
    font-weight: var(--chq-type-page-title-weight);
    letter-spacing: var(--chq-type-page-title-tracking);
    line-height: 1.15;
    margin: 0 0 10px;
  }
  .chq-pub-empty-block-fresh .chq-pub-empty-reason {
    font-size: 16px;
    line-height: 1.6;
  }

  /* Colour comes from .chq-pub-accent-link (DEC-838, accent-bound) applied
     alongside this class on the same <a> -- this rule only sets spacing, no
     new colour token. */
  .chq-pub-empty-escape {
    font-size: 13px;
    display: inline-block;
  }
`;
