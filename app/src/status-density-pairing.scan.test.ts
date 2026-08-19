// Status tokens pair by density, made executable (DEC-730 wave-87 amendment,
// docs/design/DESIGN-RULINGS.md B8).
//
// B8's text: "The dense variant (no padding, ~20px) is for a matrix cell
// that must fit a 178px column twelve times over; the roomy variant
// (min-height:44px, horizontal padding) is for anywhere a row can carry a
// real target -- phone cards, the speaker detail, the task views. Colour
// and weight are identical in both; only geometry differs ... Both must be
// edited together: changing one alone is what put a bordered Pending box
// back on three phone frames after the desktop one had gone bare."
//
// POPULATION (DEC-808 idiom: enumerated, never hand-listed): every
// app/src/**/*.css file is parsed into its rule blocks (comments stripped
// first, @media context tracked via a brace-depth walk). A rule counts as a
// STATUS/STATE TOKEN member if its selector is a single bare class
// (`.chq-...`, no combinator/pseudo/compound) whose name contains a
// `-status-` or `-state-` segment -- found by splitting the class name on
// `-` and locating that segment, never by a hand-listed suffix table. The
// text before that segment (inclusive) is the family's STEM; the text after
// is the MEMBER name.
//
// Not every class carrying "status"/"state" in its name is a rendered
// token, though -- .chq-comms-status-filter, -pills, -search etc. are plain
// flex/search-box scaffolding that happens to share a stem with a real
// state chip. A member only enters a family if it is either (a) named
// exactly `dense` or `roomy` -- DEC-730's own density vocabulary, a fixed
// two-word global recognition rule, not a per-family list -- or (b)
// declares at least one visual-identity property (color / background(-color)
// / border* / border-radius) in its own base (non-@media) declaration
// block. Pure layout wrappers (display/gap/flex-wrap only, no colour or
// border) never render a status, so they are correctly excluded rather than
// diluting the family with structural noise.
//
// CLASSIFICATION: a member is ROOMY if its base declarations include
// `min-height >= 44px` AND a non-zero horizontal padding component; DENSE
// otherwise. Classification looks only at the member's OWN rule (never a
// shared ancestor like .chq-pill combined via markup), per the task's own
// instruction.
//
// CHECKS PER FAMILY:
//   1. Density axis (dense vs roomy, DEC-730's literal two-word pair): if a
//      family declares BOTH, colour/weight must be identical between them
//      (in practice: neither declares colour/weight at all -- the axis
//      carries geometry only) and only min-height/padding/border/
//      border-radius may differ.
//   2. No dense-classified member's selector may be re-targeted from inside
//      an `@media (max-width: <=700px)` block UNLESS that block's only
//      effect is `display: none` (an invisible element is not "a real
//      target" the 44px floor governs) -- this is the exact "bordered
//      Pending box came back on three phone frames" shape, made
//      mechanical. Any deliberate exception is named in
//      PHONE_DENSE_EXEMPTIONS below and independently re-verified every run
//      (stale-exemption direction) -- empty today, since the one hit found
//      (submissions-status-label) is the generic display:none carve-out,
//      not an exemption.
//
// VACUOUS-POPULATION TRIPWIRE: the population must be non-empty and must
// contain the speakers grid's own DONE/PEND/LATE family
// (chq-speakers-status, with complete/pending/overdue meaning members and a
// dense/roomy density pair) -- if the stem regex ever stops matching that
// family, this scan must fail loudly rather than pass over an empty set.
//
// TWO-SIDED RATCHET: DIVERGENCE_CEILING may only be LOWERED as real
// divergences are fixed in files this scan's owning lane can touch
// (app/src/components/*.css); it must never be raised to silently swallow
// a new one landing elsewhere -- the test pins it to the exact measured
// count today (0), so any drift in either direction fails until the
// constant is examined and updated deliberately. No status/state token
// lives in app/src/components/*.css today, so this branch fixes nothing in
// place; docs/design/audit/density-pairing-v12.md records every family this
// scan enumerated for the owning lanes.

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');

/** Every *.css file under app/src, enumerated (DEC-808), never hand-listed. */
function allAppCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

type Decl = Record<string, string>;

interface RawRule {
  selectors: string[]; // comma-split, trimmed
  decl: Decl;
  media: string | null; // raw @media prelude, e.g. "@media (max-width: 700px)"
}

/** Strip /* *\/ comments so no prose match ever masquerades as a rule. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Parse "prop: value; prop2: value2" into a lower-cased-key map. */
function parseDecl(body: string): Decl {
  const out: Decl = {};
  for (const stmt of body.split(';')) {
    const idx = stmt.indexOf(':');
    if (idx === -1) continue;
    const prop = stmt.slice(0, idx).trim().toLowerCase();
    const value = stmt.slice(idx + 1).trim();
    if (!prop || !value) continue;
    out[prop] = value;
  }
  return out;
}

/**
 * Walk a stripped CSS file's brace structure. Every at-rule (media or
 * otherwise) pushes a context frame; every plain selector block is recorded
 * against the current @media frame (or null at top level). Handles exactly
 * the nesting depth this codebase's stylesheets use (one level of @media).
 */
function parseRules(css: string): RawRule[] {
  const rules: RawRule[] = [];
  const mediaStack: (string | null)[] = [];
  let buf = '';
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '{') {
      const header = buf.trim();
      buf = '';
      if (header.startsWith('@')) {
        mediaStack.push(header.startsWith('@media') ? header : null);
        i++;
        continue;
      }
      let depth = 1;
      let j = i + 1;
      while (depth > 0 && j < css.length) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
        j++;
      }
      const body = css.slice(i + 1, j - 1);
      const media = mediaStack.length > 0 ? mediaStack[mediaStack.length - 1] ?? null : null;
      if (header) {
        rules.push({
          selectors: header.split(',').map((s) => s.trim()).filter(Boolean),
          decl: parseDecl(body),
          media,
        });
      }
      i = j;
      continue;
    }
    if (ch === '}') {
      if (mediaStack.length > 0) mediaStack.pop();
      buf = '';
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  return rules;
}

const SIMPLE_CLASS = /^\.([a-zA-Z0-9-]+)$/;
const STATUS_STEM_WORDS = new Set(['status', 'state']);
const DENSITY_WORDS = new Set(['dense', 'roomy']);
const IDENTITY_PROPS = [
  'color',
  'background',
  'background-color',
  'border',
  'border-color',
  'border-top',
  'border-bottom',
  'border-left',
  'border-right',
  'border-radius',
];
const GEOMETRY_ONLY_PROPS = new Set([
  'min-height',
  'padding',
  'padding-left',
  'padding-right',
  'padding-top',
  'padding-bottom',
  'border',
  'border-color',
  'border-top',
  'border-bottom',
  'border-left',
  'border-right',
  'border-radius',
]);

/** Split a chq class into {stem, member} at the LAST -status-/-state- segment. */
function splitStem(className: string): { stem: string; member: string } | null {
  if (!className.startsWith('chq-')) return null;
  const segments = className.split('-');
  let cut = -1;
  for (let idx = segments.length - 1; idx >= 0; idx--) {
    const seg = segments[idx];
    if (seg !== undefined && STATUS_STEM_WORDS.has(seg)) {
      cut = idx;
      break;
    }
  }
  if (cut === -1 || cut === segments.length - 1) return null; // no member after the stem word
  return {
    stem: segments.slice(0, cut + 1).join('-'),
    member: segments.slice(cut + 1).join('-'),
  };
}

function hasHorizontalPadding(decl: Decl): boolean {
  const l = decl['padding-left'];
  const r = decl['padding-right'];
  if ((l && l !== '0' && l !== '0px') || (r && r !== '0' && r !== '0px')) return true;
  const shorthand = decl['padding'];
  if (!shorthand) return false;
  const parts = shorthand.trim().split(/\s+/);
  const horiz = parts.length === 1 ? parts[0] : parts[1]; // 2/3/4-value forms carry horizontal 2nd
  return horiz !== '0' && horiz !== '0px';
}

function minHeightPx(decl: Decl): number | null {
  const v = decl['min-height'];
  if (!v) return null;
  const m = /^([\d.]+)px$/.exec(v.trim());
  return m ? parseFloat(m[1]!) : null;
}

type Density = 'dense' | 'roomy';

function classify(decl: Decl): Density {
  const mh = minHeightPx(decl);
  if (mh !== null && mh >= 44 && hasHorizontalPadding(decl)) return 'roomy';
  return 'dense';
}

interface Member {
  stem: string;
  name: string;
  file: string;
  decl: Decl; // merged base (non-media) declarations
  density: Density;
  phoneHits: { media: string; decl: Decl }[]; // matches inside max-width<=700 blocks
}

/** Resolve `var(--chq-x)` references against the :root token table. */
function collectTokens(rules: RawRule[], into: Map<string, string>): void {
  for (const rule of rules) {
    if (rule.media !== null) continue;
    if (!rule.selectors.includes(':root')) continue;
    for (const [prop, value] of Object.entries(rule.decl)) {
      if (prop.startsWith('--')) into.set(prop, value);
    }
  }
}

function resolveValue(value: string, tokens: Map<string, string>): string {
  const m = /^var\((--[a-zA-Z0-9-]+)\)$/.exec(value.trim());
  if (!m) return value.trim();
  return tokens.get(m[1]!) ?? value.trim();
}

function maxWidthPx(media: string): number | null {
  const m = /max-width\s*:\s*([\d.]+)px/.exec(media);
  return m ? parseFloat(m[1]!) : null;
}

// ---------------------------------------------------------------------
// Build the population.
// ---------------------------------------------------------------------

const cssFiles = allAppCssFiles(HERE);
const tokens = new Map<string, string>();
for (const file of cssFiles) {
  collectTokens(parseRules(stripComments(readFileSync(file, 'utf8'))), tokens);
}

const families = new Map<string, Map<string, Member>>();

for (const file of cssFiles) {
  const rel = relative(REPO_ROOT, file);
  const rules = parseRules(stripComments(readFileSync(file, 'utf8')));
  for (const rule of rules) {
    for (const sel of rule.selectors) {
      const m = SIMPLE_CLASS.exec(sel);
      if (!m) continue;
      const className = m[1]!;
      const split = splitStem(className);
      if (!split) continue;
      const { stem, member } = split;
      const isDensityWord = DENSITY_WORDS.has(member);
      const hasIdentity = IDENTITY_PROPS.some((p) => p in rule.decl);
      if (!isDensityWord && !hasIdentity && rule.media === null) continue;

      let famMap = families.get(stem);
      if (!famMap) {
        famMap = new Map();
        families.set(stem, famMap);
      }
      let member_ = famMap.get(member);
      if (rule.media === null) {
        if (!member_) {
          member_ = { stem, name: member, file: rel, decl: {}, density: 'dense', phoneHits: [] };
          famMap.set(member, member_);
        }
        member_.decl = { ...member_.decl, ...rule.decl };
      } else {
        const mw = maxWidthPx(rule.media);
        if (mw === null || mw > 700) continue; // only phone-band overrides matter here
        if (!member_) continue; // no base rule -> not a real member, ignore
        member_.phoneHits.push({ media: rule.media, decl: rule.decl });
      }
    }
  }
}

// Finalise density classification now that base declarations are merged.
for (const famMap of families.values()) {
  for (const member of famMap.values()) {
    member.density = classify(member.decl);
  }
}

// ---------------------------------------------------------------------
// Divergence detection.
// ---------------------------------------------------------------------

interface Divergence {
  stem: string;
  detail: string;
}

// A dense member re-targeted from a phone block with a NON-hiding rule (the
// display:none case is handled generically below and needs no entry here).
// Empty today.
const PHONE_DENSE_EXEMPTIONS: { stem: string; member: string; reason: string }[] = [];

function isDisplayNoneOnly(decl: Decl): boolean {
  const keys = Object.keys(decl);
  return keys.length === 1 && keys[0] === 'display' && decl['display'] === 'none';
}

const divergences: Divergence[] = [];
const exemptionsUsed = new Set<string>();

for (const [stem, famMap] of families) {
  const members = [...famMap.values()];

  // Check 1: the density axis (dense vs roomy) carries geometry only.
  const denseAxis = famMap.get('dense');
  const roomyAxis = famMap.get('roomy');
  if (denseAxis && roomyAxis) {
    for (const prop of ['color', 'font-weight', 'background', 'background-color']) {
      const dv = denseAxis.decl[prop];
      const rv = roomyAxis.decl[prop];
      if (dv || rv) {
        divergences.push({
          stem,
          detail: `density axis leaks meaning: .${stem}-dense/.${stem}-roomy declare '${prop}' (dense=${dv ?? '(none)'}, roomy=${rv ?? '(none)'})`,
        });
      }
    }
    const allProps = new Set([...Object.keys(denseAxis.decl), ...Object.keys(roomyAxis.decl)]);
    for (const prop of allProps) {
      if (GEOMETRY_ONLY_PROPS.has(prop)) continue;
      if (prop === 'color' || prop === 'font-weight' || prop === 'background' || prop === 'background-color') continue;
      const dv = denseAxis.decl[prop];
      const rv = roomyAxis.decl[prop];
      if (dv !== rv) {
        divergences.push({
          stem,
          detail: `density axis differs on a non-geometry property '${prop}' (dense=${dv ?? '(none)'}, roomy=${rv ?? '(none)'})`,
        });
      }
    }
  }

  // Check 2: no dense member re-targeted from a phone block except to hide it.
  for (const member of members) {
    if (member.density !== 'dense') continue;
    for (const hit of member.phoneHits) {
      if (isDisplayNoneOnly(hit.decl)) continue; // hidden entirely -- not a target
      const exemption = PHONE_DENSE_EXEMPTIONS.find(
        (e) => e.stem === stem && e.member === member.name,
      );
      if (exemption) {
        exemptionsUsed.add(`${stem}::${member.name}`);
        continue;
      }
      divergences.push({
        stem,
        detail: `dense member '${member.name}' (${member.file}) is re-targeted from ${hit.media} with non-hiding rules -- a phone row is always a real target`,
      });
    }
  }
}

// Stale-exemption direction: an exemption that no longer matches a real
// (non-hiding) dense-in-phone-block hit is dead weight -- delete it.
for (const exemption of PHONE_DENSE_EXEMPTIONS) {
  const famMap = families.get(exemption.stem);
  const member = famMap?.get(exemption.member);
  const stillNeeded =
    !!member &&
    member.density === 'dense' &&
    member.phoneHits.some((hit) => !isDisplayNoneOnly(hit.decl));
  if (!stillNeeded) {
    throw new Error(
      `PHONE_DENSE_EXEMPTIONS entry for ${exemption.stem}::${exemption.member} no longer ` +
        `matches a real dense-in-phone-block hit -- delete this line.`,
    );
  }
}

// This lane owns only app/src/components/*.css; no status/state family
// lives there today, so there is nothing this scan can fix in place. Every
// divergence found above must be lowered by whichever lane owns the file it
// lives in, never by raising this ceiling to swallow a new one silently.
const DIVERGENCE_CEILING = 0;

describe('status tokens pair by density (DEC-730, B8)', () => {
  it('finds a non-empty population of status/state families', () => {
    expect(families.size).toBeGreaterThan(0);
  });

  it('finds the speakers grid DONE/PEND/LATE family (vacuous-population tripwire)', () => {
    const speakersFamily = families.get('chq-speakers-status');
    expect(speakersFamily, 'chq-speakers-status family must exist').toBeDefined();
    const names = [...(speakersFamily?.keys() ?? [])];
    expect(names).toEqual(expect.arrayContaining(['complete', 'pending', 'overdue']));
    expect(names).toEqual(expect.arrayContaining(['dense', 'roomy']));
  });

  it('classifies the speakers density axis correctly (dense ~20px, roomy >=44px)', () => {
    const speakersFamily = families.get('chq-speakers-status')!;
    expect(speakersFamily.get('dense')!.density).toBe('dense');
    expect(speakersFamily.get('roomy')!.density).toBe('roomy');
  });

  it('resolves DONE/PEND/LATE colours through the token table and finds them distinct', () => {
    const speakersFamily = families.get('chq-speakers-status')!;
    const complete = resolveValue(speakersFamily.get('complete')!.decl['color']!, tokens);
    const pending = resolveValue(speakersFamily.get('pending')!.decl['color']!, tokens);
    const overdue = resolveValue(speakersFamily.get('overdue')!.decl['color']!, tokens);
    expect(new Set([complete, pending, overdue]).size).toBe(3);
  });

  it('stays within the divergence ceiling, and the ceiling may only be lowered to match', () => {
    if (divergences.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        'status-density-pairing divergences:\n' +
          divergences.map((d) => `  [${d.stem}] ${d.detail}`).join('\n'),
      );
    }
    expect(divergences.length).toBeLessThanOrEqual(DIVERGENCE_CEILING);
    // Tight pin: if fixes land and the true count drops below the ceiling,
    // this fails too, forcing DIVERGENCE_CEILING down rather than letting it
    // sit as a stale, licensing-not-ratcheting number (field guide: "a
    // ceiling above the truth doesn't ratchet, it licenses").
    expect(DIVERGENCE_CEILING).toBe(divergences.length);
  });

  it('every phone-dense exemption still matches a real hit (stale-exemption direction)', () => {
    for (const exemption of PHONE_DENSE_EXEMPTIONS) {
      expect(
        exemptionsUsed.has(`${exemption.stem}::${exemption.member}`),
        `exemption for ${exemption.stem}::${exemption.member} was never consulted -- delete this line`,
      ).toBe(true);
    }
  });
});
