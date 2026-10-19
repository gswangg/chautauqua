// Frame-verdict ASYNC-QUERY determinism scan (DEC-976 wave-43, task
// w43-b). `npx vitest run frame-verdicts.render frame390.render` measured
// ONE load-order-dependent pin at main `3ae9bd5bf`:
// `Comms.frame-verdicts.render.test.tsx` :286 awaited `waitFor` on the
// UNCONDITIONALLY-mounted 'New template' button (which can resolve on the
// very first render) and then issued a SYNCHRONOUS
// `screen.getByRole('textbox', { name: 'Subject' })` against DOM that only
// exists after `TemplatesTab`'s `apiList` fetch settles AND its DEC-890
// amendment-4 auto-select effect has committed -- green standalone (393ms,
// nothing else contends for the event loop), red under load (43-file
// concurrent run). That file is repaired in this same commit (every query
// after the `it`'s first `await` now uses `findBy*` or is wrapped in its
// own `waitFor`). This file is the tripwire that keeps the shape from
// recurring, unowned, in a sibling frame-verdict file.
//
// POPULATION (DEC-808: never hand-listed): every
// `*frame-verdicts.render.test.tsx` and `*frame390.render.test.tsx` file
// under app/src/** and test/**, found by a recursive readdirSync walk --
// 43 files today, matching the task brief's own measured count and the
// file set `npx vitest run frame-verdicts.render frame390.render` selects.
// This deliberately includes the `*.desktop-frame-verdicts.render.test.tsx`
// siblings (a `*frame-verdicts.render.test.tsx` suffix match): the shape
// this file grades -- a query racing an unrelated async gate -- is a
// jsdom/testing-library hazard with nothing 390-specific about it, and the
// desktop twins already dominate the roster below.
//
// OFFENDER PREDICATE (task's own words, implemented literally): inside an
// `it(...)` body that contains at least one `await`, any DOM query issued
// AFTER the first `await` that is a bare `screen.getBy*` / `screen.queryBy*`
// / `within(...).getBy*` / `within(...).queryBy*` rather than a `findBy*`
// call or a query written inside a `waitFor(...)` callback. This is a
// STRUCTURAL/textual predicate, not a semantic one: it does not attempt to
// judge whether a particular bare query is actually racing something --
// once an `it` body has proven it needs to await ANY condition, every
// later bare `getBy*`/`queryBy*` in that same body is graded the same way
// the :286 pin's own failure was (DEC-976 wave-43's own instruction: "any
// DOM query issued after the first await ... rather than findBy* or a
// query inside a waitFor callback", no narrower reading offered).
//
// SEEDING (DEC-808: never guess, never seed at 0): forced to -1 first and
// the printed roster read back. The real, measured count over the current
// tree is 730 offenders across 40 of the 43 files (three files --
// `Comms.frame-verdicts.render.test.tsx` after this task's own repair,
// plus any file whose `it` bodies contain no `await` at all -- have zero).
// This ceiling is registered PRINCIPLE-only in
// scripts/exit-predicate/campaign-scope.ts's OUT_OF_CAMPAIGN_SCOPE (a
// receipt-determinism fact about the test corpus's own reliability, not a
// v12 geometry or frame-conformance fact) -- see that entry for why it is
// not itself an exit-gate row.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const WALK_ROOTS = [join(REPO_ROOT, 'app', 'src'), join(REPO_ROOT, 'test')];

const NAME_RE = /(frame-verdicts\.render\.test\.tsx|frame390\.render\.test\.tsx)$/;

/** Recursive readdirSync walk (DEC-808: "a directory is not a population"
 * -- you must actually read the directory, every level of it). */
function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && NAME_RE.test(entry.name)) {
      out.push(full);
    }
  }
}

function findPopulation(): string[] {
  const out: string[] = [];
  for (const root of WALK_ROOTS) walk(root, out);
  return out.sort();
}

/** Population floor -- a vacuous-population tripwire (DEC-808/DEC-180): if
 * a rename or a moved directory ever made this walk see fewer than the
 * files it saw at wave-43, every "0 offenders" result below would silently
 * start being trivially true over a shrunken set. Never a hard equality --
 * new frame-verdict files are expected to land as the campaign continues. */
export const FRAME_VERDICT_ASYNC_QUERY_POPULATION_FLOOR = 43;

interface ItBody {
  title: string;
  body: string;
  /** Absolute character offset of `body[0]` within the source file, used
   * to translate an offender's in-body offset back to a real line number. */
  absOffset: number;
}

/** Extract every `it(...)`/`it.only(...)`/`it.skip(...)` async-arrow body
 * as raw text via balanced-brace parsing (no AST dependency -- the same
 * regex-plus-brace-counting idiom `campaign-ratchet-registration.scan
 * .test.ts` and the frame-citation scans already use in this tree). */
function extractItBodies(src: string): ItBody[] {
  const out: ItBody[] = [];
  const itRe = /\bit\.?(?:only|skip)?\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
  let m: RegExpExecArray | null;
  while ((m = itRe.exec(src))) {
    const title = m[2] ?? '';
    const afterTitleIdx = itRe.lastIndex;
    const arrowIdx = src.indexOf('=> {', afterTitleIdx);
    // An `it(...)` whose body isn't a `=> {` arrow within a short window of
    // its title (an it.each row, a named function reference, etc.) is not
    // this file's shape -- skip rather than mis-parse it.
    if (arrowIdx === -1 || arrowIdx - afterTitleIdx > 400) continue;
    const braceStart = arrowIdx + 3; // index of the '{'
    let depth = 0;
    let i = braceStart;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const bodyEnd = i; // index of the matching '}'
    out.push({ title, body: src.slice(braceStart + 1, bodyEnd), absOffset: braceStart + 1 });
  }
  return out;
}

/** Balanced-paren spans of every top-level `waitFor(...)` call inside a
 * body -- a query written inside one of these spans is the sanctioned
 * escape hatch the predicate names explicitly. */
function waitForSpans(body: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  const re = /\bwaitFor\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    let depth = 0;
    let i = m.index + 'waitFor('.length - 1;
    for (; i < body.length; i++) {
      if (body[i] === '(') depth++;
      else if (body[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    spans.push([m.index, i]);
  }
  return spans;
}

export interface Offender {
  file: string;
  line: number;
  title: string;
  snippet: string;
}

const QUERY_RE = /\b(?:screen|within\([^()]*\))\.(getBy\w*|queryBy\w*)\(/g;

function offendersInFile(file: string): Offender[] {
  const src = readFileSync(file, 'utf-8');
  const rel = relative(REPO_ROOT, file);
  const offenders: Offender[] = [];
  for (const { title, body, absOffset } of extractItBodies(src)) {
    const firstAwait = body.search(/\bawait\b/);
    if (firstAwait === -1) continue; // predicate only applies to async bodies
    const spans = waitForSpans(body);
    QUERY_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = QUERY_RE.exec(body))) {
      if (m.index < firstAwait) continue; // before the first await: not the shape
      const insideWaitFor = spans.some(([s, e]) => m!.index >= s && m!.index <= e);
      if (insideWaitFor) continue; // sanctioned per the predicate's own words
      const upTo = src.slice(0, absOffset + m.index);
      const line = upTo.split('\n').length;
      offenders.push({ file: rel, line, title, snippet: body.slice(m.index, m.index + 50).replace(/\s+/g, ' ') });
    }
  }
  return offenders;
}

export function findOffenders(files: string[]): Offender[] {
  return files.flatMap(offendersInFile);
}

// Measured over the real tree at this task's own commit (never guessed,
// never seeded at 0 -- forced to -1 first and this roster read back).
// DEC-069 wave-50 amendment: re-measured at 731 (was 730 at wave-43; one
// new post-await bare query landed in the tree since then) -- raised, not
// lowered, because the measured count sits ABOVE the stale constant, not
// below it.
// 731 -> 730 (multi-portal): one fewer offender, re-measured on the integrated tree.
// 730 -> 709 (multi-portal decision 74): the Settings Speaker portal edit
// view, resource dialog and general portal preview verdicts are
// superseded, and their render cases went with them.
export const FRAME_VERDICT_ASYNC_QUERY_CEILING = 709;

describe('frame-verdict async-query determinism (DEC-976 wave-43, w43-b)', () => {
  const population = findPopulation();

  it('vacuous-population tripwire: the walk sees at least the wave-43 measured file set', () => {
    expect(population.length).toBeGreaterThanOrEqual(FRAME_VERDICT_ASYNC_QUERY_POPULATION_FLOOR);
  });

  it('the repaired :286 pin file carries zero offenders', () => {
    const target = population.find((f) => f.endsWith('app/src/pages/Comms.frame-verdicts.render.test.tsx'));
    expect(target, 'Comms.frame-verdicts.render.test.tsx must be in the walked population').toBeTruthy();
    const offenders = offendersInFile(target!);
    expect(offenders, JSON.stringify(offenders, null, 2)).toHaveLength(0);
  });

  it('offender ceiling: no more than the wave-43 measured count of bare post-await queries', () => {
    const offenders = findOffenders(population);
    const roster = offenders.map((o) => `${o.file}:${o.line} [${o.title}] ${o.snippet}`).join('\n');
    expect(offenders.length, `roster:\n${roster}`).toBeLessThanOrEqual(FRAME_VERDICT_ASYNC_QUERY_CEILING);
  });

  // NON-VACUITY (DEC-967: never validate a detector by reading the same
  // array it grades as its own evidence): a synthetic `it` body with the
  // exact shape the predicate targets is asserted to be caught, and its
  // `findBy*`/`waitFor`-wrapped twin is asserted clean.
  it('detector self-check: catches the load-order shape, clears its findBy/waitFor fix', () => {
    const bad = `
      it('bad', async () => {
        await waitFor(() => expect(screen.getByRole('button', { name: 'New template' })).toBeInTheDocument());
        expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveValue('x');
      });
    `;
    const bodies = extractItBodies(bad);
    expect(bodies).toHaveLength(1);
    const badBody = bodies[0]!.body;
    const firstAwait = badBody.search(/\bawait\b/);
    const spans = waitForSpans(badBody);
    QUERY_RE.lastIndex = 0;
    const matches: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = QUERY_RE.exec(badBody))) matches.push(m);
    const caught = matches.filter(
      (mm) => mm.index >= firstAwait && !spans.some(([s, e]) => mm.index >= s && mm.index <= e),
    );
    expect(caught).toHaveLength(1); // only the bare Subject getByRole, not the waitFor-wrapped one

    const good = `
      it('good', async () => {
        await waitFor(() => expect(screen.getByRole('button', { name: 'New template' })).toBeInTheDocument());
        expect(await screen.findByRole('textbox', { name: 'Subject' })).toHaveValue('x');
      });
    `;
    const goodBodies = extractItBodies(good);
    const goodBody = goodBodies[0]!.body;
    const goodFirstAwait = goodBody.search(/\bawait\b/);
    const goodSpans = waitForSpans(goodBody);
    QUERY_RE.lastIndex = 0;
    const goodMatches: RegExpExecArray[] = [];
    while ((m = QUERY_RE.exec(goodBody))) goodMatches.push(m);
    const goodCaught = goodMatches.filter(
      (mm) => mm.index >= goodFirstAwait && !goodSpans.some(([s, e]) => mm.index >= s && mm.index <= e),
    );
    expect(goodCaught).toHaveLength(0);
  });

  // BELOW-direction companion (DEC-808 wave-85 amendment, enforced by
  // test/campaign-ratchet-two-sided.scan.test.ts): the offender ceiling `it`
  // above may only ever be LOWERED. This companion fails if the measured
  // offender count has fallen below FRAME_VERDICT_ASYNC_QUERY_CEILING
  // without the constant itself having been lowered to match, so a repair
  // that shrinks the offender roster can never sit stale behind an
  // over-generous ceiling.
  it('the ceiling is not stale: the measured offender count does not sit below FRAME_VERDICT_ASYNC_QUERY_CEILING without the constant having been lowered to match', () => {
    const offenders = findOffenders(population);
    if (offenders.length < FRAME_VERDICT_ASYNC_QUERY_CEILING) {
      throw new Error(
        `measured ${offenders.length} offenders, below FRAME_VERDICT_ASYNC_QUERY_CEILING = ` +
          `${FRAME_VERDICT_ASYNC_QUERY_CEILING} -- lower the constant: ` +
          `export const FRAME_VERDICT_ASYNC_QUERY_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(FRAME_VERDICT_ASYNC_QUERY_CEILING);
  });

  // ABOVE-direction companion for the population FLOOR (DEC-808 wave-85
  // amendment): the floor `it` above only ever fails when the population
  // shrinks. This companion fails if the walk finds MORE files than the
  // floor without the floor having been raised to match -- a stale floor
  // licenses stagnation just as much as a stale ceiling does (same idiom
  // as test/open-divergence-ledger.scan.test.ts's AUDIT_FILE_FLOOR pair).
  it(`FRAME_VERDICT_ASYNC_QUERY_POPULATION_FLOOR (${FRAME_VERDICT_ASYNC_QUERY_POPULATION_FLOOR}) is not stale below the walked file count (a stale floor licenses stagnation)`, () => {
    if (population.length > FRAME_VERDICT_ASYNC_QUERY_POPULATION_FLOOR) {
      throw new Error(
        `The walk reaches ${population.length} files, above the floor of ` +
          `${FRAME_VERDICT_ASYNC_QUERY_POPULATION_FLOOR}. This is the guard working: the corpus grew. ` +
          `Raise the floor in the same commit by replacing the line:\n` +
          `  export const FRAME_VERDICT_ASYNC_QUERY_POPULATION_FLOOR = ${population.length};`,
      );
    }
    expect(population.length).toBeLessThanOrEqual(FRAME_VERDICT_ASYNC_QUERY_POPULATION_FLOOR);
  });
});
