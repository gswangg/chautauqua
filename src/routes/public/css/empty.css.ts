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

/* DEC-385 wave-143: this module is COMPOSED into other sheets, so a
   max-width:700px block sitting inside its own body lands MID-sheet in
   every host and is silently outranked by whatever desktop rule the next
   composed module contributes after it (equal specificity resolves by
   source order). The block below -- with its own documentation comment --
   is this module's phone half, split out VERBATIM (nothing reordered,
   nothing reworded), so each host can concatenate it into its ONE
   contiguous trailing phone region in ascending source order. EMPTY_CSS
   keeps every non-phone rule, so desktop output is byte-identical. This
   is the same split w16-bb already applied to ERROR_STATES_CSS. */
export const EMPTY_PHONE_CSS = `
  /* v12m-w14-dd (DEC-393 wave-139 REAL FLOOR, DEC-385 single-direction):
     this sheet had no ≤700px block at all before this task -- created here
     as the LAST top-level construct in this module, per DEC-385. The
     'filtered' zero-state's escape link (empty-state.tsx) is paired with
     .chq-pub-accent-link on the same <a> (see accent-link's own REAL FLOOR
     rule, rail.css.ts), but that sibling was not already floored before
     this task, so this token is floored on its own selector too rather
     than claimed composition-exempt. */

`;

// DEC-385 wave-143 amendment (task w18-f): the phone media block that used
// to live inside EMPTY_CSS above (and made this fragment's composed
// position inside PUBLIC_CSS/PORTAL_CSS non-terminal, per
// docs/design/audit/terminal-phone-block-v12.md) is split into its own
// export, mirroring src/views/error-states.css.ts's ERROR_STATES_CSS/
// ERROR_STATES_PHONE_CSS split (task w16-bb). EMPTY_PHONE_CSS carries ONLY the
// rule below, verbatim, unreordered, unreworded -- each composing sheet
// concatenates it into its own trailing phone region instead.
export const EMPTY_PHONE_CSS = `
  @media (max-width: 700px) {
    .chq-pub-empty-escape {
      min-height: 44px;
      display: flex;
      align-items: center;
      padding: 0 4px;
    }
  }
`;
