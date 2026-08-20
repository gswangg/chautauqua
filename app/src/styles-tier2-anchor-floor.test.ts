// DEC-393/DEC-576/DEC-989 wave-123 (task w12-k): receipts for the ten
// row-action-anchor tap-floor offenders this lane owned in app/src/styles.css
// (phone-tap-target.scan.test.ts's ANCHOR_FLOOR_OFFENDERS_CEILING, DEC-393
// wave-87 amendment / anchor-floor.ts). Five containers are cleared with a
// `tap-floor-exempt` comment at their own top-level definitions (every
// child mounted through them is a plain <button>, never an anchor); the
// remaining five get a real phone-width floor. Population/predicate cited
// by drift-proof bare path + backtick quote (DEC-967 wave-115):
// docs/design/DESIGN-RULINGS.md`The 44px floor, and how it gets evaded` and
// docs/design/DEVIATIONS.md`Focus/hover ring GEOMETRY on bare-text
// controls: cancelled inline padding.`
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_393, DEC_576, DEC_989 } from '../../src/decisions';

void DEC_393; // the anchor-floor lens itself
void DEC_576; // element-qualified floor for the shared quiet-action group
void DEC_989; // two-sided ratchet: this lane's own drain, re-measured below

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const CSS_PATH = join(HERE, 'styles.css');
const css = readFileSync(CSS_PATH, 'utf-8');

/** Every rule body inside every `@media (max-width: <=700px)` block, joined
 * in source order -- mirrors speakers-css.test.ts's `phoneLayer` helper. */
function phoneLayer(source: string): string {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(source)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
      i += 1;
    }
    out.push(source.slice(start, i - 1));
  }
  if (out.length === 0) throw new Error('no max-width media block found in styles.css');
  return out.join('\n');
}

const phone = phoneLayer(css);

describe('v12m-w12-k: DEC-393/DEC-576 tap-floor receipts (app/src/styles.css)', () => {
  it('.chq-bulkbar-actions is exempted: every mount in the tree is a plain button, no anchor to reach', () => {
    expect(css).toMatch(/tap-floor-exempt:[^*]*\.chq-bulkbar-actions[^*]*\*\/\s*\.chq-bulkbar-actions\s*\{/);
  });

  it('.chq-contacts-col-actions is exempted: an empty <th> spacer with no children at all', () => {
    expect(css).toMatch(
      /tap-floor-exempt:[^*]*\.chq-contacts-col-actions[^*]*\*\/\s*\.chq-contacts-table \.chq-contacts-col-actions\s*\{/,
    );
  });

  it('.chq-contacts-drawer-actions is exempted: the drawer action row is five chq-btn buttons, no anchor', () => {
    expect(css).toMatch(/tap-floor-exempt:[^*]*chq-btn[^*]*\*\/\s*\.chq-contacts-drawer-actions\s*\{/);
  });

  it('.chq-embeds-output-actions is exempted: two Copy chq-btn buttons, no anchor', () => {
    expect(css).toMatch(/tap-floor-exempt:[^*]*\.chq-embeds-output-actions[^*]*\*\/\s*\.chq-embeds-output-actions\s*\{/);
  });

  it('.chq-modal-actions is exempted: every ModalFrame caller passes chq-btn buttons, no anchor', () => {
    expect(css).toMatch(/tap-floor-exempt:[^*]*\.chq-modal-actions[^*]*\*\/\s*\.chq-modal-actions\s*\{/);
  });

  it('.chq-empty-actions reaches its anchor branch (`a`) with all three floor properties', () => {
    expect(phone).toMatch(
      /\.chq-empty-actions a\s*\{[^}]*min-height:\s*44px[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*padding-inline:\s*16px/,
    );
  });

  it('.chq-link-button (bare-anchor population, no chq-btn) gets a self-sufficient phone floor', () => {
    expect(phone).toMatch(
      /\.chq-link-button\s*\{[^}]*min-height:\s*44px[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*padding:\s*0 6px/,
    );
  });

  it('.chq-section-action (independent bare-anchor population alongside .chq-link-button) gets its own floor', () => {
    expect(phone).toMatch(
      /\.chq-section-action\s*\{[^}]*min-height:\s*44px[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*padding:\s*0 6px[^}]*margin-inline:\s*-6px/,
    );
  });

  it('.chq-row-title (bare-anchor row name link) gets a self-sufficient phone floor', () => {
    expect(phone).toMatch(
      /\.chq-row-title\s*\{[^}]*min-height:\s*44px[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*padding:\s*0 8px[^}]*margin-inline:\s*-8px/,
    );
  });

  it('DEC-576: the pill/rail-link floor lands on the anchor-qualified selector, not the bare group', () => {
    expect(phone).toMatch(
      /a\.chq-pill\s*\{[^}]*min-height:\s*44px[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*padding-inline:\s*12px/,
    );
    expect(phone).toMatch(
      /a\.chq-rail-link\s*\{[^}]*min-height:\s*44px[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*padding-inline:\s*11px 0/,
    );
  });

  it('the bare shared group (.chq-pill, .chq-rail-link, .chq-checkbox-label, .chq-btn-tertiary) is untouched -- no min-height was added to it', () => {
    expect(phone).toMatch(
      /\.chq-pill,\s*\.chq-rail-link,\s*\.chq-checkbox-label,\s*\.chq-btn-tertiary\s*\{\s*display:\s*inline-flex;\s*align-items:\s*center;\s*justify-content:\s*center;\s*min-height:\s*44px;\s*\}/,
    );
  });
});
