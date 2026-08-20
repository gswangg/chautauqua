// Self-grading tripwire for test/frame-source-corpus.ts's shared ENTITY_MAP
// (task w11-ff, DEC-808). The three control-label/caption ledgers
// (frame-control-label.scan.test.ts, desktop-control-label.scan.test.ts,
// frame-caption-ledger.scan.test.ts) all normalize their source corpus
// through normalizeSource(), which decodes only what ENTITY_MAP knows. A
// decode hole can only ever INVENT a false offender -- it can never hide a
// real one -- which is exactly why holes like this survived review for many
// waves (field guide, wave 136 header). Rather than trust a hand-written
// snapshot of "the population as of wave N" (the shape that already rotted
// twice: wave-128's thirteen entries, wave-135's private caption-ledger
// patch), this scan DERIVES the population from the real corpus at test
// time, using the exact same enumerateSourceFiles() population every ledger
// above reads, and fails -- naming each offending entity -- the moment the
// corpus writes an entity ENTITY_MAP cannot decode.
//
// Reads ENTITY_MAP itself (exported by frame-source-corpus.ts) rather than
// holding a second copy of the decode table, so this scan can never rot
// independently of the table it grades (DEC-613).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEC_808 } from '../src/decisions';
import { ENTITY_MAP, enumerateSourceFiles } from './frame-source-corpus';

// This scan's own shape is DEC_808's ruling applied to itself: the
// population it grades is derived from the corpus, never hand-listed.
void DEC_808;

const ROOTS = ['app/src', 'src'];
const ENTITY_RE = /&[a-zA-Z]{2,10};|&#\d{2,5};/g;

function measuredEntityPopulation(): Set<string> {
  const found = new Set<string>();
  for (const root of ROOTS) {
    const absRoot = join(process.cwd(), root);
    for (const file of enumerateSourceFiles(absRoot)) {
      const raw = readFileSync(file, 'utf8');
      const matches = raw.match(ENTITY_RE);
      if (!matches) continue;
      for (const m of matches) found.add(m);
    }
  }
  return found;
}

describe('entity-decode-coverage: ENTITY_MAP covers every entity the corpus writes', () => {
  it('decodes every &entity; / &#NNN; token found in app/src/** + src/**', () => {
    const population = measuredEntityPopulation();
    // Non-vacuity: the population itself must be non-empty, or this scan
    // would pass by finding nothing to grade (DEC-967 sighting #14's own
    // warning applied to this scan's own tripwire).
    expect(population.size).toBeGreaterThan(0);

    const undecoded = [...population].filter((entity) => !(entity in ENTITY_MAP)).sort();
    expect(undecoded, `ENTITY_MAP cannot decode: ${undecoded.join(', ')}`).toEqual([]);
  });
});
