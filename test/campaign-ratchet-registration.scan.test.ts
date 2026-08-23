// Campaign ratchet REGISTRATION enforcer (DEC-808 wave-24 amendment,
// clause 3). test/campaign-ratchet-two-sided.scan.test.ts already grades
// two-sidedness, but its own POPULATION is derived from the union of
// scripts/exit-predicate.ts's CAMPAIGN_CONSTANT_NAMES / TIER2_CEILING_NAMES
// / OUT_OF_CAMPAIGN_SCOPE keys -- a ratchet constant nobody registered in
// any of those three lists is therefore invisible to that gate (and to the
// campaign exit predicate itself, since findCampaignCeilingCandidates() is
// only ever run over FIXTURES in test/exit-predicate-campaign.test.ts, never
// over the real tree). That is exactly the DEC-180 shape ("a population
// derived from the answers cannot find a missing answer") one level out:
// this file supplies the missing check by deriving its OWN population
// directly from the tree's `*_CEILING`/`*_FLOOR`/`*_TRIPWIRE` DECLARATIONS
// (readdirSync recursive over test/**, app/src/** and scripts/** -- no
// manifest, deliberately NOT filtered to *.test.ts(x): mirrors
// campaign-ratchet-two-sided.scan.test.ts's own walk, which does not filter
// either, because a plain .ts ceiling module -- e.g.
// app/src/phone-overflow-scan/starved-track-ceiling.ts -- would otherwise
// silently vanish from the population) and fails listing any name absent
// from all three exit-predicate lists.
//
// Measured on this worktree's branch point (main): 51 candidate ratchet
// constants exist in the tree; two are unregistered --
// AUDIT_GREP_NEGATIVE_STALE_CEILING (this task's own clause 2) and
// UNRESOLVED_COUNT_TRIPWIRE (test/frame-control-floor.scan.test.ts, value
// 111). Both are registered in scripts/exit-predicate.ts's
// OUT_OF_CAMPAIGN_SCOPE by this same commit, so this gate seeds at zero
// offenders.
//
// NON-VACUITY (DEC-967: never validate a detector by reading the same array
// it grades as its own evidence): a fabricated, unregistered `_CEILING`
// constant is written to a real tmpdir fixture and asserted to be REPORTED
// by the exact same finder function the population walk below uses; a
// second fixture registers its constant (via a synthetic exit-predicate
// list passed directly to the finder, never CAMPAIGN_CONSTANT_NAMES /
// TIER2_CEILING_NAMES / OUT_OF_CAMPAIGN_SCOPE themselves) and is asserted
// NOT reported.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CAMPAIGN_CONSTANT_NAMES,
  loadCampaignFiles,
  OUT_OF_CAMPAIGN_SCOPE,
  TIER2_CEILING_NAMES,
} from '../scripts/exit-predicate';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');

// ---------------------------------------------------------------------------
// File walk. DEC-069 wave-43 amendment (task w43-e, HOLE 2): this file used
// to run its OWN readdirSync-recursive walk over test/, app/src/ and
// scripts/ -- a second copy of exactly the corpus-enumeration
// scripts/exit-predicate/campaign.ts's `loadCampaignFiles` already owns
// (DEC-613: one walk, one owner -- a second copy of a vocabulary is a trap
// with a delay fuse). Consuming the exported walk means this gate and the
// real exit predicate now agree, by construction, on what the campaign
// corpus IS: a git-tracked `.ts` file under test/, app/src/ or scripts/.
// ---------------------------------------------------------------------------

interface SourceFile {
  readonly rel: string;
  readonly content: string;
}

function walkTsFiles(): SourceFile[] {
  return loadCampaignFiles(REPO_ROOT).map((f) => ({ rel: f.path, content: f.content }));
}

// ---------------------------------------------------------------------------
// Declaration finder -- `[export ]const <NAME>_(CEILING|FLOOR|TRIPWIRE) =
// <int>;` at top level, the same shape scripts/exit-predicate.ts's own
// CONST_DECL_RE matches, narrowed to the ratchet-name suffixes clause 3
// names.
// ---------------------------------------------------------------------------

const RATCHET_DECL_RE =
  /^[ \t]*(?:export\s+)?const\s+([A-Z][A-Z0-9_]*_(?:CEILING|FLOOR|TRIPWIRE))\s*=\s*(-?\d+)\s*;[ \t]*$/gm;

interface Declaration {
  readonly name: string;
  readonly file: string;
  readonly value: number;
}

/** Every ratchet-shaped constant declared at top level across `files`. */
function findDeclarations(files: readonly SourceFile[]): Declaration[] {
  const out: Declaration[] = [];
  for (const f of files) {
    RATCHET_DECL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RATCHET_DECL_RE.exec(f.content)) !== null) {
      out.push({ name: m[1] as string, file: f.rel, value: Number.parseInt(m[2] as string, 10) });
    }
  }
  return out;
}

interface Offender {
  readonly name: string;
  readonly message: string;
}

/** Every declared ratchet name absent from ALL THREE of `registered`. */
function findUnregistered(declarations: readonly Declaration[], registered: ReadonlySet<string>): Offender[] {
  const seen = new Set<string>();
  const offenders: Offender[] = [];
  for (const d of declarations) {
    if (registered.has(d.name)) continue;
    if (seen.has(d.name)) continue;
    seen.add(d.name);
    offenders.push({
      name: d.name,
      message: `${d.name} declared at ${d.file} -- absent from CAMPAIGN_CONSTANT_NAMES, TIER2_CEILING_NAMES and OUT_OF_CAMPAIGN_SCOPE`,
    });
  }
  return offenders;
}

// ---------------------------------------------------------------------------
// Gate.
// ---------------------------------------------------------------------------

describe('every campaign ratchet constant is registered somewhere (DEC-808 wave-24 amendment, clause 3)', () => {
  let files: SourceFile[];
  let declarations: Declaration[];
  let offenders: Offender[];

  beforeAll(() => {
    files = walkTsFiles();
    declarations = findDeclarations(files);
    const registered = new Set<string>([
      ...CAMPAIGN_CONSTANT_NAMES,
      ...TIER2_CEILING_NAMES,
      ...Object.keys(OUT_OF_CAMPAIGN_SCOPE),
    ]);
    offenders = findUnregistered(declarations, registered);
  }, 30000);

  it('the file walk finds a non-trivial number of source files (guards against a bad root leaving zero files scanned)', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('the declared-constant population is non-empty (guards against a broken regex leaving this gate green over an empty set)', () => {
    expect(declarations.length).toBeGreaterThan(25);
  });

  it('every declared ratchet constant is registered in CAMPAIGN_CONSTANT_NAMES, TIER2_CEILING_NAMES or OUT_OF_CAMPAIGN_SCOPE (seeds at zero)', () => {
    if (offenders.length > 0) {
      throw new Error(
        `${offenders.length} campaign ratchet constant(s) are declared in the tree but registered ` +
          `nowhere in scripts/exit-predicate.ts -- invisible to the campaign exit predicate and to ` +
          `test/campaign-ratchet-two-sided.scan.test.ts's population walk (DEC-180: a population derived ` +
          `from the answers cannot find a missing answer). Register each in CAMPAIGN_CONSTANT_NAMES/` +
          `TIER2_CEILING_NAMES (if it is a v12 frame/390-geometry conformance fact) or OUT_OF_CAMPAIGN_SCOPE ` +
          `(with a real prose reason, if it is not):\n` +
          offenders.map((o) => `  ${o.message}`).join('\n'),
      );
    }
    expect(offenders.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// NON-VACUITY (DEC-967): synthetic fixtures written to a real tmpdir,
// exercised through the SAME findDeclarations/findUnregistered functions
// the population walk above uses -- never validated by reading
// CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES/OUT_OF_CAMPAIGN_SCOPE back as
// their own evidence.
// ---------------------------------------------------------------------------

describe('non-vacuity: the detector discriminates unregistered from registered fixtures', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'campaign-ratchet-registration-fixture-'));
  });

  it('a fabricated, unregistered ratchet constant IS reported', () => {
    const content = [
      'export const FIXTURE_UNREGISTERED_CEILING = 0;',
      '',
      "describe('fixture', () => {",
      "  it('never exceeds the ceiling', () => {",
      '    expect(measured.length).toBeLessThanOrEqual(FIXTURE_UNREGISTERED_CEILING);',
      '  });',
      '});',
      '',
    ].join('\n');
    const abs = join(dir, 'unregistered.fixture.test.ts');
    writeFileSync(abs, content, 'utf8');
    const fixtureFiles: SourceFile[] = [{ rel: 'unregistered.fixture.test.ts', content }];
    const declarations = findDeclarations(fixtureFiles);
    expect(declarations.some((d) => d.name === 'FIXTURE_UNREGISTERED_CEILING')).toBe(true);
    const offenders = findUnregistered(declarations, new Set<string>());
    expect(offenders.some((o) => o.name === 'FIXTURE_UNREGISTERED_CEILING')).toBe(true);
  });

  it('a fabricated, registered ratchet constant is NOT reported', () => {
    const content = [
      'export const FIXTURE_REGISTERED_FLOOR = 3;',
      '',
      "describe('fixture', () => {",
      "  it('never falls below the floor', () => {",
      '    expect(measured.length).toBeGreaterThanOrEqual(FIXTURE_REGISTERED_FLOOR);',
      '  });',
      '});',
      '',
    ].join('\n');
    const abs = join(dir, 'registered.fixture.test.ts');
    writeFileSync(abs, content, 'utf8');
    const fixtureFiles: SourceFile[] = [{ rel: 'registered.fixture.test.ts', content }];
    const declarations = findDeclarations(fixtureFiles);
    expect(declarations.some((d) => d.name === 'FIXTURE_REGISTERED_FLOOR')).toBe(true);
    const offenders = findUnregistered(declarations, new Set<string>(['FIXTURE_REGISTERED_FLOOR']));
    expect(offenders.some((o) => o.name === 'FIXTURE_REGISTERED_FLOOR')).toBe(false);
  });

  it('a plain .ts ceiling module (not a .test.ts file) is still seen by the declaration finder -- the walk is not extension-filtered beyond .ts/.tsx', () => {
    const content = 'export const FIXTURE_PLAIN_MODULE_TRIPWIRE = 7;\n';
    const abs = join(dir, 'fixture-plain-ceiling-module.ts');
    writeFileSync(abs, content, 'utf8');
    const fixtureFiles: SourceFile[] = [{ rel: 'fixture-plain-ceiling-module.ts', content }];
    const declarations = findDeclarations(fixtureFiles);
    expect(declarations).toHaveLength(1);
    expect(declarations[0]!.name).toBe('FIXTURE_PLAIN_MODULE_TRIPWIRE');
    expect(declarations[0]!.value).toBe(7);
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));
});
