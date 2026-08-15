// DEC-894 amendment (w62-c): one headshot upload contract, exported from
// pure core (src/domain/files.ts) and printed by both file pickers (portal
// profile, contacts drawer) — never a second hand-typed
// `.png,.jpg,.jpeg,.webp` string. This test asserts both directions of the
// extension contract, that the hint text names the real byte cap, and that
// the hand-typed accept string does not resurface anywhere else in the
// tree.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HEADSHOT_EXTENSIONS, HEADSHOT_MAX_BYTES, headshotHintText, validateHeadshotUpload } from '../src/domain/files';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');

const CANDIDATE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'svg', 'pdf', 'mp4'];

describe('HEADSHOT_EXTENSIONS <-> validateHeadshotUpload agree in both directions', () => {
  it('every extension in HEADSHOT_EXTENSIONS is accepted by validateHeadshotUpload', () => {
    for (const ext of HEADSHOT_EXTENSIONS) {
      const result = validateHeadshotUpload({ filename: `photo.${ext}`, sizeBytes: 1024 });
      expect(result.ok, `expected .${ext} to be accepted`).toBe(true);
    }
  });

  it('every extension validateHeadshotUpload accepts is in HEADSHOT_EXTENSIONS (re-derived, not hand-listed)', () => {
    const accepted = CANDIDATE_EXTENSIONS.filter(
      (ext) => validateHeadshotUpload({ filename: `photo.${ext}`, sizeBytes: 1024 }).ok,
    );
    expect(accepted.length).toBeGreaterThan(0);
    for (const ext of accepted) {
      expect(HEADSHOT_EXTENSIONS, `.${ext} was accepted but is missing from HEADSHOT_EXTENSIONS`).toContain(ext);
    }
  });
});

describe('headshotHintText', () => {
  it('names the real byte cap, interpolated from HEADSHOT_MAX_BYTES', () => {
    const text = headshotHintText();
    const expectedMb = HEADSHOT_MAX_BYTES / (1024 * 1024);
    expect(text).toContain(`Max ${expectedMb} MB`);
    for (const ext of HEADSHOT_EXTENSIONS) {
      expect(text).toContain(`.${ext}`);
    }
  });
});

/** Every .ts/.tsx source file under `root`, excluding test files. */
function allSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const HAND_TYPED_ACCEPT_RE = /\.png,\.jpg,\.jpeg,\.webp/;

describe('the hand-typed headshot accept literal appears nowhere outside src/domain/files.ts', () => {
  it('negative control: the fingerprint regex actually matches a synthetic hand-typed literal', () => {
    expect(HAND_TYPED_ACCEPT_RE.test('accept=".png,.jpg,.jpeg,.webp"')).toBe(true);
  });

  it('scans src/ and app/src/', () => {
    const files = [...allSourceFiles(join(REPO_ROOT, 'src')), ...allSourceFiles(join(REPO_ROOT, 'app', 'src'))];
    expect(files.length).toBeGreaterThan(1);

    const offenders: string[] = [];
    for (const file of files) {
      if (file === join(REPO_ROOT, 'src', 'domain', 'files.ts')) continue;
      const src = readFileSync(file, 'utf8');
      if (HAND_TYPED_ACCEPT_RE.test(src)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
