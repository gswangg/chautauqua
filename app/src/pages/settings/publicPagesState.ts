// Shared 'live'/'muted' state-pill class for PublicPagesPanel and
// SavedEmbedsPanel (DEC-747: the tone is NAMED from the semantic state,
// never a copied color literal). Exposed as a lookup of LITERAL full class
// names rather than built by string concatenation at the call site, so the
// css-contract scan (DEC-976) can see the exact tokens the CSS defines
// (app/src/pages/settings/settings.css: .chq-settings-public-pages-state-live
// / -muted) instead of a template-literal fragment it can't resolve.
export type PublicPagesStateTone = 'live' | 'muted';

export const PUBLIC_PAGES_STATE_TONE_CLASS: Record<PublicPagesStateTone, string> = {
  live: 'chq-settings-public-pages-state-live',
  muted: 'chq-settings-public-pages-state-muted',
};
