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

  /* Colour comes from .chq-pub-accent-link (DEC-838, accent-bound) applied
     alongside this class on the same <a> -- this rule only sets spacing, no
     new colour token. */
  .chq-pub-empty-escape {
    font-size: 13px;
    display: inline-block;
  }
`;
