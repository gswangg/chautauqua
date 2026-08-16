// DEC-369 amendment (wave 22): fitted sub-pixel geometry values were CSS
// declarations tuned to close a gate-4/gate-5 RENDER measurement gap
// against a stale fleet measurement, rather than transcribing the vendored
// frame. The vendored design pack outranks a render measurement (SPEC.md
// docs precedence), so any fractional-px literal surviving in a geometry
// declaration is presumptively a fitted value, not a frame transcription.
// This scan enumerates every stylesheet under app/src/**/*.css (readdirSync,
// no hand-listed manifest) and every SSR *_CSS module under src/ (via
// ssrCssSources(), DEC-808's derived-population idiom -- wave 57 widened
// this from a src/routes/**/*.css.ts directory glob, which made
// src/views/theme.ts and its siblings invisible to the scan), strips /* */
// comments first (comment prose legitimately carries decimal measurements
// when explaining a past fit), and fails on any fractional-px literal
// appearing in a padding/margin/gap/width/height/grid-template-columns
// declaration.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ssrCssSources } from '../../test/helpers/ssr-css-sources';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE;
const REPO_ROOT = join(HERE, '..', '..');

/** Every .css file under `root`, found via recursive readdirSync. */
function allCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.css') && !entry.name.endsWith('.css.ts')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Strips /* ... *\/ block comments (which legitimately carry decimal prose). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

// A fractional-px literal (one or more digits, a decimal point, one or more
// digits, then `px`) inside a geometry-property declaration. Matches
// `padding: 4.2px 16px`, `gap: 11.5px`, `width: calc(100% - 3.5px)`,
// `grid-template-columns: 220.5px 1fr`, etc.
const GEOMETRY_PROP_RE = /(padding(?:-\w+)?|margin(?:-\w+)?|gap|width|height|grid-template-columns)\s*:\s*[^;]*?(-?\d+\.\d+px)[^;]*;/g;

function findFittedGeometry(css: string): Array<{ selectorHint: string; declaration: string }> {
  const withoutComments = stripComments(css);
  const results: Array<{ selectorHint: string; declaration: string }> = [];
  let match: RegExpExecArray | null;
  GEOMETRY_PROP_RE.lastIndex = 0;
  while ((match = GEOMETRY_PROP_RE.exec(withoutComments)) !== null) {
    const declaration = match[0];
    // Find the nearest enclosing selector by scanning backward for the last
    // `{` and taking the text since the previous `}` before it.
    const upTo = withoutComments.slice(0, match.index);
    const lastOpenBrace = upTo.lastIndexOf('{');
    const lastCloseBeforeThat = upTo.lastIndexOf('}', lastOpenBrace);
    const selectorHint = upTo.slice(lastCloseBeforeThat + 1, lastOpenBrace).trim().split(/\s+/).join(' ');
    results.push({ selectorHint, declaration: declaration.trim() });
  }
  return results;
}

describe('no fitted sub-pixel geometry survives in any stylesheet (DEC-369 amendment, wave 22)', () => {
  const appCssFiles = allCssFiles(APP_SRC);
  const ssrSources = ssrCssSources();

  it('found at least one stylesheet in each root (sanity check on the enumeration)', () => {
    expect(appCssFiles.length).toBeGreaterThan(0);
    expect(ssrSources.length).toBeGreaterThanOrEqual(14);
  });

  for (const file of appCssFiles) {
    const rel = relative(REPO_ROOT, file);
    it(`${rel} has no fractional-px geometry declaration`, () => {
      const src = readFileSync(file, 'utf-8');
      const offenders = findFittedGeometry(src);
      if (offenders.length > 0) {
        const detail = offenders
          .map((o) => `  selector "${o.selectorHint}": ${o.declaration}`)
          .join('\n');
        throw new Error(`${rel} has fitted sub-pixel geometry:\n${detail}`);
      }
      expect(offenders).toEqual([]);
    });
  }

  for (const { path: rel, text: src } of ssrSources) {
    it(`${rel} has no fractional-px geometry declaration`, () => {
      const offenders = findFittedGeometry(src);
      if (offenders.length > 0) {
        const detail = offenders
          .map((o) => `  selector "${o.selectorHint}": ${o.declaration}`)
          .join('\n');
        throw new Error(`${rel} has fitted sub-pixel geometry:\n${detail}`);
      }
      expect(offenders).toEqual([]);
    });
  }
});
