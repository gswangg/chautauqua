// DEC-651 (wave 7 amendment): the ModalFrame header band must stay paired
// to `.chq-drawer`'s own phone inset (styles.css:2283) so the header never
// overhangs the drawer's edges. THE OVERHANG defect was exactly this pair
// drifting apart -- this scan reads both magnitudes from the live source
// (never hardcodes them) so they cannot silently drift again.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODAL_FRAME_CSS = readFileSync(join(HERE, 'modal-frame.css'), 'utf-8');
const STYLES_CSS = readFileSync(join(HERE, '..', 'styles.css'), 'utf-8');

function px(n: string | undefined, label: string): number {
  if (n === undefined) throw new Error(`expected to find a px magnitude for ${label}`);
  return Number(n);
}

describe('modal-frame.css: drawer-scoped phone head pairing (DEC-651)', () => {
  it('re-pairs .chq-drawer .chq-modal-head to .chq-drawer\'s own phone padding, inside a max-width block', () => {
    // Isolate the @media (max-width: 700px) block that carries the
    // drawer-scoped override, and pull its margin/padding numbers out.
    const mediaBlocks = [...MODAL_FRAME_CSS.matchAll(/@media \(max-width: 700px\) \{([\s\S]*?)\n\}/g)];
    const drawerBlock = mediaBlocks
      .map((m) => m[1])
      .find((body): body is string => body !== undefined && body.includes('.chq-drawer .chq-modal-head'));
    if (!drawerBlock) throw new Error('expected a @media (max-width: 700px) block containing .chq-drawer .chq-modal-head');

    const marginMatch = drawerBlock.match(/\.chq-drawer \.chq-modal-head\s*\{[^}]*margin:\s*-(\d+)px -(\d+)px 0/);
    const paddingMatch = drawerBlock.match(/\.chq-drawer \.chq-modal-head\s*\{[^}]*padding:\s*0 (\d+)px (\d+)px/);
    if (!marginMatch || !paddingMatch) {
      throw new Error('could not parse .chq-drawer .chq-modal-head margin/padding out of the phone block');
    }

    const marginTop = px(marginMatch[1], 'margin left magnitude');
    const marginSide = px(marginMatch[2], 'margin right magnitude');
    const paddingSide = px(paddingMatch[1], 'header padding side magnitude');

    // The two negative-margin magnitudes must equal each other -- the
    // header must cancel .chq-drawer's inset symmetrically on both sides.
    expect(marginTop).toBe(marginSide);
    // The margin magnitude must equal the padding-side magnitude re-applied
    // by .chq-modal-head, or the header re-widens past what it just
    // cancelled.
    expect(marginSide).toBe(paddingSide);

    // Read .chq-drawer's OWN phone padding straight out of styles.css --
    // never hardcoded -- so this scan tracks the real pairing, not a
    // memorised copy of it.
    const drawerPhoneBlock = STYLES_CSS.match(/@media \(max-width: 700px\) \{([\s\S]*?)\n\}/g)?.find((b) =>
      /\.chq-drawer\s*\{/.test(b),
    );
    if (!drawerPhoneBlock) throw new Error('expected to find .chq-drawer\'s own phone padding block in styles.css');
    const drawerPaddingMatch = drawerPhoneBlock.match(/\.chq-drawer\s*\{\s*padding:\s*(\d+)px;/);
    if (!drawerPaddingMatch) throw new Error('could not parse .chq-drawer\'s phone padding out of styles.css');
    const drawerPadding = px(drawerPaddingMatch[1], "styles.css .chq-drawer phone padding");

    expect(paddingSide).toBe(drawerPadding);
    expect(marginSide).toBe(drawerPadding);
  });

  it('leaves .chq-modal (non-drawer) unscoped by the phone override -- it keeps its 26px pairing at every width', () => {
    const mediaBlocks = [...MODAL_FRAME_CSS.matchAll(/@media \(max-width: 700px\) \{([\s\S]*?)\n\}/g)];
    const drawerBlock = mediaBlocks
      .map((m) => m[1])
      .find((body): body is string => body !== undefined && body.includes('.chq-drawer .chq-modal-head'));
    expect(drawerBlock).toBeDefined();
    // The bare, unscoped `.chq-modal-head` selector must not appear inside
    // this phone block -- only the `.chq-drawer`-scoped one.
    expect(drawerBlock).not.toMatch(/(?<!\.chq-drawer )\.chq-modal-head\s*\{/);
  });
});
