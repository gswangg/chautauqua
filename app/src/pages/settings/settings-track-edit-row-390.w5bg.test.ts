// DEC-919 (task v12m-w5-bg): .chq-settings-track-edit-row (settings.css:1174)
// declares `grid-template-columns: minmax(0, 1fr) 150px 200px` and inherits
// `display: grid; gap: 16px` from .chq-settings-edit-row (settings.css:1154).
// At 390 that is 350px of fixed tracks plus 32px of gaps (16px x 2) against
// a 358px content budget, leaving the track NAME input eight pixels wide on
// /admin/settings tracks-and-rooms in EDIT mode (TrackEditRow.tsx:46 mounts
// `chq-settings-edit-row chq-settings-track-edit-row`).
//
// jsdom performs no layout, so the fix is pinned as a source scan of the
// terminal @media (max-width: 700px) block, mirroring this cluster's own
// settings-overflow-390.w5p.test.ts idiom. New file (not an edit to that
// one) so a sibling lane's edits to it never collide with this task's.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_919 } from '../../../../src/decisions';

void DEC_919; // a re-line that starves its yielding track has not re-lined

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'settings.css');
const css = readFileSync(CSS_PATH, 'utf-8');

/** Strips one level of @media { ... } blocks out of a stylesheet's text. */
function withoutMediaBlocks(source: string): string {
  return source.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
}

/** Extracts the body text of the (single) terminal 700px media block. */
function mediaBlockBody(source: string): string {
  const match = source.match(/@media \(max-width: 700px\) \{([\s\S]*)\n\}\n/);
  const body = match?.[1];
  if (body === undefined) throw new Error('no 700px media block found');
  return body;
}

describe('settings.css only declares ONE terminal @media (max-width: 700px) block', () => {
  it('the 700px media block appears exactly once', () => {
    const matches = css.match(/@media \(max-width: 700px\)/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});

describe('DEC-919: track-edit-row collapses to a single stacked column at 390', () => {
  const mediaBody = mediaBlockBody(css);
  const outside = withoutMediaBlocks(css);

  it('.chq-settings-track-edit-row is redefined to a single track inside the phone block', () => {
    const rule = mediaBody.match(/\.chq-settings-track-edit-row\s*\{([^}]*)\}/);
    expect(rule, '.chq-settings-track-edit-row rule not found inside the phone block').not.toBeNull();
    expect(rule![1]).toMatch(/grid-template-columns:\s*1fr\s*;/);
  });

  it('the desktop .chq-settings-track-edit-row rule (outside media) still declares its original three fixed/flex tracks', () => {
    const rule = outside.match(/\.chq-settings-track-edit-row\s*\{([^}]*)\}/);
    expect(rule, '.chq-settings-track-edit-row desktop rule not found outside the phone block').not.toBeNull();
    expect(rule![1]).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*150px\s*200px\s*;/);
  });

  it('the room-edit-row twin (settings.css:2314) is untouched by this task and still re-lines to 1fr inside the phone block', () => {
    const rule = mediaBody.match(/\.chq-settings-room-edit-row\s*\{([^}]*)\}/);
    expect(rule, '.chq-settings-room-edit-row rule not found inside the phone block').not.toBeNull();
    expect(rule![1]).toMatch(/grid-template-columns:\s*1fr\s*;/);
  });
});

describe('leaves the top-level (outside-media) rule set unchanged from before this task', () => {
  it('.chq-settings-track-edit-row still resolves outside the phone block, exactly once', () => {
    const outside = withoutMediaBlocks(css);
    const matches = outside.match(/\.chq-settings-track-edit-row\s*\{[^}]*minmax\(0,\s*1fr\)\s*150px\s*200px/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('.chq-settings-edit-row (the shared grid/gap parent) is not touched by this task', () => {
    const outside = withoutMediaBlocks(css);
    const rule = outside.match(/\.chq-settings-edit-row\s*\{([^}]*)\}/);
    expect(rule, '.chq-settings-edit-row desktop rule not found outside the phone block').not.toBeNull();
    expect(rule![1]).toMatch(/display:\s*grid\s*;/);
    expect(rule![1]).toMatch(/gap:\s*16px\s*;/);
  });
});
