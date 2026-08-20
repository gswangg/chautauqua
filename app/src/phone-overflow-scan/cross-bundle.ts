// Decomposed out of phone-horizontal-overflow.scan.test.ts (contention
// hotspot decomposition, no behavior change): cross-bundle receipt
// tripwire (DEC-976).
//
// An `overflow-exempt:`/`tap-floor-exempt:` receipt inside a `src/**` sheet
// (an SSR surface) may not cite a path beginning `app/src/` (the SPA admin
// bundle) -- the SSR surface never loads that bundle, so such a citation
// names a rule the page in front of the user never runs. The SSR carrier
// every `src/**` container exemption should name instead is
// src/views/theme.ts:347-366 (the base .chq-btn/input rule) plus :625-627
// (the phone 44px floor) -- all three legs of DESIGN-RULINGS.md:189.

export function findCrossBundleReceiptCitations(cssText: string): string[] {
  const out: string[] = [];
  const re = /(?:overflow-exempt|tap-floor-exempt):\s*([^*]*?)\*\//g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cssText)) !== null) {
    const citation = (m[1] ?? '').trim();
    if (/app\/src\//.test(citation)) out.push(citation);
  }
  return out;
}

export interface CrossBundleOffender {
  file: string;
  citation: string;
}
