// DEC-856 amendment (wave 71): a settings panel's page-level error banner
// (a lone `useState<string | undefined>`/`useState<string | null>` set from
// an API read's `.catch` and rendered under `role="alert"`) is a SCANNED
// class, not a per-panel rediscovery. Wave 69 fixed TracksRoomsPanel.tsx one
// panel at a time -- the CLEAR lives in the code path that triggers a
// reload (either the reload function clears itself before its own reads,
// or every one of its callers clears `error` before invoking it) -- and the
// shape survived unfixed in PortalSettingsPanel/PublicPagesPanel/
// SavedEmbedsPanel because nothing scanned for it: a load path that never
// clears leaves one transient failure bannering the panel PERMANENTLY,
// beside every later successful load.
//
// This scan walks every .tsx under app/src/pages/settings/ (excluding
// *.test.tsx), finds each qualifying page-level error state (single string
// useState, rendered near a `role="alert"`), locates every "loader block"
// (function/useCallback/useEffect body) whose text contains an API read's
// `.catch` feeding that state's setter, and requires EITHER (a) the block
// clears the setter (`setter(undefined)`/`setter(null)`) before its own
// first `apiGet/apiList/apiPost/apiPatch/apiPut/apiDelete/apiUpload` call,
// OR (b) the block is a NAMED function/useCallback and every call site that
// invokes it elsewhere in the file clears the setter first (the
// TracksRoomsPanel/ResourcesPanel `reload(id)` shape) -- with one narrow
// exemption for a mount-only effect whose entire body is just an early
// eventId guard plus the one call (there is no prior render to have left a
// stale error in that shape, so no clear is required there).
//
// Deliberately a lightweight, comment-stripped text scan -- no new parser
// dependency (same precedent as test/serial-write-scan.test.ts and this
// directory's own nested-edit-drill.scan.test.ts). Two-directional, same
// shape as those: an unlisted, unexempt offender fails naming file/loader;
// an EXEMPTIONS entry matching no offender ALSO fails ("stale entry --
// delete this line"), so a later fix can't leave rot behind.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SETTINGS_DIR = join(__dirname);

/** Strips `//` and `/* *\/` comments, preserving newlines and string/
 * template literal contents -- same shape as test/serial-write-scan.test.ts's
 * stripComments, duplicated here rather than imported so this scan has no
 * cross-directory dependency. */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && c2 === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\' && i + 1 < n) {
          out += (src[i] ?? '') + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += src[i] ?? '';
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

interface Block {
  start: number; // index of the opening keyword (function/const/useEffect)
  name: string; // function/useCallback name, or "(effect)" for a bare useEffect
  bodyStart: number; // index just past the body's opening `{`
  bodyEnd: number; // index of the body's closing `}`
}

const BLOCK_OPENERS: { re: RegExp; name: (m: RegExpExecArray) => string }[] = [
  {
    re: /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/g,
    name: (m) => m[1]!,
  },
  {
    re: /const\s+([A-Za-z0-9_]+)\s*=\s*useCallback\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/g,
    name: (m) => m[1]!,
  },
  {
    re: /useEffect\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/g,
    name: () => '(effect)',
  },
];

function findBlocks(src: string): Block[] {
  const out: Block[] = [];
  for (const { re, name } of BLOCK_OPENERS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const bodyStart = re.lastIndex; // just past the opening `{`
      let depth = 1;
      let i = bodyStart;
      while (i < src.length && depth > 0) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') depth--;
        i++;
      }
      out.push({ start: m.index, name: name(m), bodyStart, bodyEnd: i - 1 });
    }
  }
  return out;
}

/** Smallest block whose body span contains `idx`, or null if none. */
function innermostBlock(blocks: Block[], idx: number): Block | null {
  let best: Block | null = null;
  for (const b of blocks) {
    if (idx < b.bodyStart || idx >= b.bodyEnd) continue;
    if (!best || b.bodyEnd - b.bodyStart < best.bodyEnd - best.bodyStart) best = b;
  }
  return best;
}

const API_CALL = /\bapi(?:Get|List|Post|Patch|Put|Delete|Upload)\s*\(/g;

function firstIndex(re: RegExp, src: string, from: number, to: number): number {
  re.lastIndex = from;
  const m = re.exec(src);
  if (!m || m.index >= to) return -1;
  return m.index;
}

function clearRegexFor(setter: string): RegExp {
  return new RegExp(`\\b${setter}\\(\\s*(?:undefined|null)\\s*\\)`, 'g');
}

/** True if `blockSrc`-span [start,end) clears `setter` before its own first
 * apiXxx( call (or clears it anywhere and has no apiXxx( call at all). */
function selfClears(src: string, setter: string, start: number, end: number): boolean {
  const apiIdx = firstIndex(API_CALL, src, start, end);
  const clearIdx = firstIndex(clearRegexFor(setter), src, start, end);
  if (clearIdx === -1) return false;
  if (apiIdx === -1) return true;
  return clearIdx < apiIdx;
}

/** True if a call site's enclosing block is a trivial mount-only effect: an
 * anonymous effect whose ENTIRE body (after stripping blank lines) is just
 * an early-return eventId guard plus the one call to `loaderName`. There is
 * no prior render in this shape that could have left a stale error, so no
 * clear is required here. */
function isTrivialMountCallSite(src: string, block: Block, loaderName: string, callIdx: number): boolean {
  if (block.name !== '(effect)') return false;
  const body = src
    .slice(block.bodyStart, block.bodyEnd)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const guardRe = /^if\s*\([^)]*\)\s*return[^;]*;$/;
  const callRe = new RegExp(`^${loaderName}\\([^)]*\\);?$`);
  const nonGuard = body.filter((l) => !guardRe.test(l));
  return nonGuard.length === 1 && callRe.test(nonGuard[0]!) && callIdx >= block.bodyStart && callIdx < block.bodyEnd;
}

interface Offender {
  file: string;
  loader: string;
  setter: string;
  detail: string;
}

/** Deliberate exceptions. Every entry must name why the loader/setter pair
 * for that file is exempt. An entry matching no real offender fails the
 * "no stale entries" test below. */
const EXEMPTIONS: { file: string; loader: string; setter: string; reason: string }[] = [];

function scanFile(file: string, rawSrc: string): Offender[] {
  const src = stripComments(rawSrc);
  const offenders: Offender[] = [];

  const statePairRe = /const\s+\[(\w+),\s*(set\w+)\]\s*=\s*useState<string\s*\|\s*(?:undefined|null)>\(\s*(?:undefined|null)\s*\)/g;
  let stateMatch: RegExpExecArray | null;
  const candidates: { getter: string; setter: string }[] = [];
  while ((stateMatch = statePairRe.exec(src))) {
    candidates.push({ getter: stateMatch[1]!, setter: stateMatch[2]! });
  }

  const blocks = findBlocks(src);

  for (const { getter, setter } of candidates) {
    // Only page-level banners: the getter must be referenced near a
    // role="alert" JSX render somewhere in this file (a field/row-scoped
    // error passed down as a prop, e.g. ResourcesPanel's fileError, never
    // shows up in this window and is correctly excluded).
    const alertRe = /role="alert"/g;
    let qualifies = false;
    let am: RegExpExecArray | null;
    while ((am = alertRe.exec(src))) {
      const windowStart = Math.max(0, am.index - 80);
      const windowEnd = Math.min(src.length, am.index + 250);
      const window = src.slice(windowStart, windowEnd);
      if (new RegExp(`\\b${getter}\\b`).test(window)) {
        qualifies = true;
        break;
      }
    }
    if (!qualifies) continue;

    // Every block whose body contains a `.catch(...=> setter(` is a loader
    // for this setter.
    const catchRe = new RegExp(`\\.catch\\(\\s*\\(?\\w*\\)?\\s*=>\\s*${setter}\\(`, 'g');
    for (const block of blocks) {
      catchRe.lastIndex = block.bodyStart;
      const m = catchRe.exec(src);
      if (!m || m.index >= block.bodyEnd) continue;

      if (selfClears(src, setter, block.bodyStart, block.bodyEnd)) continue;

      if (block.name === '(effect)') {
        offenders.push({
          file,
          loader: '(anonymous useEffect)',
          setter,
          detail: 'anonymous effect reads without clearing first, and cannot be called from elsewhere to be cleared by a caller',
        });
        continue;
      }

      // A loader passed BARE to useEffect (`useEffect(load, [deps])`, no
      // wrapping arrow) is invoked with no clearable surrounding block at
      // all -- that reference alone forces the loader to self-clear; no
      // caller can ever clear on its behalf.
      const bareEffectRefRe = new RegExp(`useEffect\\(\\s*${block.name}\\s*,`);
      if (bareEffectRefRe.test(src)) {
        offenders.push({
          file,
          loader: block.name,
          setter,
          detail: 'passed bare to useEffect(name, [deps]) with no wrapping block a caller could clear in -- must self-clear',
        });
        continue;
      }

      // Named block: every OTHER call site of block.name(...) in the file
      // must clear `setter` before invoking it (or be the trivial mount
      // shape).
      const callRe = new RegExp(`\\b${block.name}\\(`, 'g');
      callRe.lastIndex = 0;
      let anyCallSite = false;
      let allSitesClear = true;
      let cm: RegExpExecArray | null;
      while ((cm = callRe.exec(src))) {
        const callIdx = cm.index;
        if (callIdx >= block.start && callIdx < block.bodyEnd) continue; // the declaration itself
        anyCallSite = true;
        const enclosing = innermostBlock(blocks, callIdx);
        if (!enclosing) {
          allSitesClear = false;
          break;
        }
        if (isTrivialMountCallSite(src, enclosing, block.name, callIdx)) continue;
        const clearIdx = firstIndex(clearRegexFor(setter), src, enclosing.bodyStart, callIdx);
        if (clearIdx === -1) {
          allSitesClear = false;
          break;
        }
      }

      if (!anyCallSite || !allSitesClear) {
        offenders.push({
          file,
          loader: block.name,
          setter,
          detail: !anyCallSite
            ? 'loader never clears itself and is never called elsewhere either'
            : 'a caller invokes this loader without clearing the setter first',
        });
      }
    }
  }

  return offenders;
}

function listSettingsFiles(): string[] {
  return readdirSync(SETTINGS_DIR)
    .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
    .sort();
}

function scanAll(): Offender[] {
  const offenders: Offender[] = [];
  for (const f of listSettingsFiles()) {
    const raw = readFileSync(join(SETTINGS_DIR, f), 'utf8');
    offenders.push(...scanFile(f, raw));
  }
  return offenders;
}

describe('settings page-level error banners always clear on reload (DEC-856 amendment, wave 71)', () => {
  it('the scan is not vacuous: walks a non-trivial file set', () => {
    const files = listSettingsFiles();
    expect(files.length).toBeGreaterThan(10);
  });

  it('every page-level error state either self-clears before its own reads, or every one of its callers clears it first', () => {
    const offenders = scanAll().filter(
      (o) => !EXEMPTIONS.some((e) => e.file === o.file && e.loader === o.loader && e.setter === o.setter),
    );

    expect(
      offenders,
      offenders
        .map(
          (o) =>
            `${o.file} / ${o.loader} (setter ${o.setter}): ${o.detail}. Clear the setter at the start of the ` +
            `load/refetch (before the reads are issued), following TracksRoomsPanel's shape -- or add a ` +
            `{ file, loader, setter, reason } line to EXEMPTIONS in ` +
            `app/src/pages/settings/settings-error-clear.scan.test.ts naming why this one is exempt.`,
        )
        .join('\n'),
    ).toEqual([]);
  });

  it('every EXEMPTIONS entry still matches a real offender (no stale lines)', () => {
    const offenders = scanAll();
    const stale = EXEMPTIONS.filter(
      (e) => !offenders.some((o) => o.file === e.file && o.loader === e.loader && o.setter === e.setter),
    );

    expect(
      stale,
      stale
        .map(
          (e) =>
            `${e.file} / ${e.loader} (setter ${e.setter}): stale EXEMPTIONS entry -- delete this line ` +
            `(app/src/pages/settings/settings-error-clear.scan.test.ts) -- no matching offender was found.`,
        )
        .join('\n'),
    ).toEqual([]);
  });
});
