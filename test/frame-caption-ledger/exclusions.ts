// Frame caption/consequence ledger -- EXCLUSIONS barrel (DEC-976 wave-133;
// split from test/frame-caption-ledger.scan.test.ts by the
// contention-custodian decomposition, no behaviour change).
//
// This file itself was decomposed further (wave-8, structure-custodian
// contention decomposition): it had become a 4-conflict merge hotspot
// because every worker adding a new disposed caption touched the same
// ~1700-line file regardless of which exclusion class their row belonged
// to. Each exclusion class now lives in its own module under ./exclusions/
// -- workers touch only the class file their row belongs to, and this
// barrel re-exports every public name unchanged so every existing import
// path (`from '.../exclusions'`) keeps working with no behaviour change.
//
// Every entry cited across these modules is asserted (in the test suite) to
// still resolve to its file:line:text in the current pack -- a stale
// exclusion fails loudly, exactly like every prior ledger's
// exclusion-citation guard.
export type { Exclusion } from './exclusions/types';
export { EXPLAINER_EXCLUSIONS } from './exclusions/explainer';
export { FIXTURE_EXCLUSIONS } from './exclusions/fixture';
export { EXEMPLAR_ARTICLE_EXCLUSIONS } from './exclusions/exemplar-article';
export { COMPOSED_EXCLUSIONS } from './exclusions/composed';
export { SUPERSEDED_EXCLUSIONS } from './exclusions/superseded';
export { UNBACKED_EXCLUSIONS } from './exclusions/unbacked';

import type { Exclusion } from './exclusions/types';
import { EXPLAINER_EXCLUSIONS } from './exclusions/explainer';
import { FIXTURE_EXCLUSIONS } from './exclusions/fixture';
import { EXEMPLAR_ARTICLE_EXCLUSIONS } from './exclusions/exemplar-article';
import { COMPOSED_EXCLUSIONS } from './exclusions/composed';
import { SUPERSEDED_EXCLUSIONS } from './exclusions/superseded';
import { UNBACKED_EXCLUSIONS } from './exclusions/unbacked';
import type { Caption } from './population';
import { ALL_CAPTIONS } from './population';

export function isExcluded(c: Caption, table: Exclusion[]): boolean {
  return table.some((e) => e.fileName === c.fileName && e.line === c.line && e.text === c.text);
}

export const CAPTIONS_AFTER_EXCLUSION: Caption[] = ALL_CAPTIONS.filter(
  (c) =>
    !isExcluded(c, EXPLAINER_EXCLUSIONS) &&
    !isExcluded(c, FIXTURE_EXCLUSIONS) &&
    !isExcluded(c, EXEMPLAR_ARTICLE_EXCLUSIONS) &&
    !isExcluded(c, COMPOSED_EXCLUSIONS) &&
    !isExcluded(c, SUPERSEDED_EXCLUSIONS) &&
    !isExcluded(c, UNBACKED_EXCLUSIONS)
);
