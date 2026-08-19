// w1-f (DEC-576, wave-98 amendment): the shell suppresses the phone tab bar
// for ANY page that mounts a docked phone footer, via two idioms in
// styles.css -- `.chq-shell:has(.chq-phone-dock) .chq-tabbar` (shared class)
// and `.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar` (attribute
// contract, for page-local dock classes that can't share `.chq-phone-dock`'s
// geometry, e.g. Scorecard.tsx's 46px buttons vs the shared 48px). A docked
// footer band that declares neither leaves the tab bar mounted underneath
// it -- review-v12.md finding 1.
//
// DEC-808: the population of "docked footer classes" is derived from
// geometry, not hand-listed -- any class selector inside a
// `@media (max-width: 700px)` block whose declaration body sets
// `position: sticky` (or `fixed`) with `bottom: 0` AND a `border-top` is a
// docked band, by construction, regardless of what it's named. For each
// such class this scan finds its renderer(s) under app/src/**/*.tsx (non-
// test) and asserts the renderer applies `chq-phone-dock` alongside the
// class, or sets `data-chq-phone-dock` somewhere in the same file.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE;

function walk(dir: string, suffix: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, suffix));
    else if (entry.endsWith(suffix)) out.push(p);
  }
  return out;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Extracts the body text of every @media block whose condition mentions
 * the phone-width breakpoint (700px), mirroring phone-block-visibility.
 * test.ts's extractPhoneMediaBodies -- one level of nested braces inside
 * @media, which is all this codebase's stylesheets use. */
function extractPhoneMediaBodies(css: string): string {
  const re = /@media([^{]*)\{((?:[^{}]*\{[^{}]*\}[^{}]*)*)\}/g;
  let out = '';
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const condition = m[1];
    const body = m[2];
    if (condition !== undefined && body !== undefined && /max-width:\s*700px/.test(condition)) {
      out += `${body}\n`;
    }
  }
  return out;
}

export interface DockCandidate {
  className: string;
  body: string;
}

/** Every bare class selector inside a max-width:700px media body whose
 * declaration body is a docked footer band by GEOMETRY: sticky/fixed +
 * bottom:0 + a border-top. Compound selectors (e.g. `.foo .chq-btn`) are
 * not candidates -- they style children of a dock, not the dock itself. */
export function extractDockedClasses(cssText: string): DockCandidate[] {
  const phoneCss = extractPhoneMediaBodies(stripComments(cssText));
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  const out: DockCandidate[] = [];
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(phoneCss))) {
    const selectorList = m[1];
    const body = m[2];
    if (selectorList === undefined || body === undefined) continue;
    const isSticky = /position\s*:\s*(sticky|fixed)\b/.test(body);
    const isBottomZero = /bottom\s*:\s*0(px)?\b/.test(body);
    const hasBorderTop = /border-top\s*:/.test(body);
    if (!(isSticky && isBottomZero && hasBorderTop)) continue;
    for (const rawSelector of selectorList.split(',')) {
      const selector = rawSelector.trim();
      const bareClassMatch = /^\.([A-Za-z0-9_-]+)$/.exec(selector);
      const className = bareClassMatch?.[1];
      if (className !== undefined) {
        out.push({ className, body });
      }
    }
  }
  return out;
}

/** True when `fileText` (a .tsx renderer's source) declares the shared
 * phone-dock contract -- either the `chq-phone-dock` class literal, or the
 * `data-chq-phone-dock` attribute -- anywhere in the file. Same-file scope
 * mirrors the task's own guidance for the attribute case; for the shared
 * class this is the same literal-token check the rest of this scan family
 * uses (phone-block-visibility.test.ts's hasRuleFor / PHONE_SELECTOR_RE). */
export function declaresPhoneDock(fileText: string): boolean {
  return /data-chq-phone-dock/.test(fileText) || /\bchq-phone-dock\b/.test(fileText);
}

/** True when `fileText` mentions the literal class name (as a token, so
 * `chq-review-scorecard-dock` doesn't also match
 * `chq-review-scorecard-dock-extra`). */
export function rendererMentionsClass(fileText: string, className: string): boolean {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(fileText);
}

interface CssSource {
  file: string;
  css: string;
}

function loadCssSources(): CssSource[] {
  return walk(APP_SRC, '.css').map((file) => ({ file, css: readFileSync(file, 'utf8') }));
}

function loadRendererSources(): CssSource[] {
  return walk(APP_SRC, '.tsx')
    .filter((file) => !file.includes('.test.'))
    .map((file) => ({ file, css: readFileSync(file, 'utf8') }));
}

/** Docked classes that genuinely fail this scan's assertion for a reason no
 * page-local attribute can fix -- named and reasoned, not a silent skip
 * (mirrors NOT_PHONE_ONLY / NO_PHONE_RULE_OK in phone-block-visibility.
 * test.ts). Each entry is a to-do recorded in
 * docs/design/audit/phone-dock-declaration-v12.md, not a licence: removing
 * a row here should always be because the underlying gap was fixed, never
 * because the scan got noisy. */
export const KNOWN_UNFIXABLE_BY_ATTRIBUTE: Array<[className: string, reason: string]> = [
  [
    'chq-contacts-import-phone-dock',
    'ImportWizard.tsx renders through ModalFrame, which createPortals its ' +
      'whole tree to document.body (ModalFrame.tsx:161-177) -- entirely ' +
      'outside .chq-shell/.chq-main, so neither shell :has() selector can ' +
      'ever match a data-chq-phone-dock set anywhere inside the modal. ' +
      'See docs/design/audit/phone-dock-declaration-v12.md.',
  ],
];
const KNOWN_UNFIXABLE_SET = new Set(KNOWN_UNFIXABLE_BY_ATTRIBUTE.map(([c]) => c));

interface Offender {
  className: string;
  sheet: string;
  renderers: string[];
  reason: string;
}

function findOffenders(cssSources: CssSource[], rendererSources: CssSource[]): Offender[] {
  const offenders: Offender[] = [];
  for (const { file: sheet, css } of cssSources) {
    for (const { className } of extractDockedClasses(css)) {
      if (KNOWN_UNFIXABLE_SET.has(className)) continue;
      const renderers = rendererSources
        .filter(({ css: rendererText }) => rendererMentionsClass(rendererText, className))
        .map(({ file }) => file);
      if (renderers.length === 0) {
        offenders.push({
          className,
          sheet,
          renderers: [],
          reason: 'no renderer under app/src/**/*.tsx mentions this class at all',
        });
        continue;
      }
      const declaring = renderers.filter((file) =>
        declaresPhoneDock(rendererSources.find((r) => r.file === file)!.css),
      );
      if (declaring.length === 0) {
        offenders.push({
          className,
          sheet,
          renderers,
          reason:
            'none of the renderer file(s) apply chq-phone-dock or set data-chq-phone-dock',
        });
      }
    }
  }
  return offenders;
}

describe('every page-local phone dock declares itself to the shell (DEC-576, wave-98)', () => {
  const cssSources = loadCssSources();
  const rendererSources = loadRendererSources();

  it('vacuous-population tripwire: the derived docked-class set is non-empty and names the Scorecard dock', () => {
    const allClasses = cssSources.flatMap(({ css }) => extractDockedClasses(css).map((c) => c.className));
    expect(allClasses.length).toBeGreaterThan(0);
    expect(allClasses).toContain('chq-review-scorecard-dock');
  });

  it('positive control: a docked footer with no shell declaration is caught', () => {
    const fixtureCss = `
      @media (max-width: 700px) {
        .chq-fixture-missing-dock {
          position: sticky;
          bottom: 0;
          border-top: 1px solid #000;
        }
      }
    `;
    const fixtureRenderer = `
      export function Fixture() {
        return <div className="chq-page chq-fixture-missing-dock">no declaration here</div>;
      }
    `;
    const candidates = extractDockedClasses(fixtureCss);
    expect(candidates.map((c) => c.className)).toEqual(['chq-fixture-missing-dock']);
    expect(rendererMentionsClass(fixtureRenderer, 'chq-fixture-missing-dock')).toBe(true);
    expect(declaresPhoneDock(fixtureRenderer)).toBe(false);
  });

  it('negative control: a docked footer whose renderer sets data-chq-phone-dock passes', () => {
    const fixtureCss = `
      @media (max-width: 700px) {
        .chq-fixture-ok-dock {
          position: fixed;
          bottom: 0;
          border-top: 1px solid #000;
        }
      }
    `;
    const fixtureRenderer = `
      export function Fixture({ isPhone }: { isPhone: boolean }) {
        return (
          <div className="chq-page" {...(isPhone ? { 'data-chq-phone-dock': true } : {})}>
            {isPhone && <div className="chq-fixture-ok-dock">docked</div>}
          </div>
        );
      }
    `;
    const candidates = extractDockedClasses(fixtureCss);
    expect(candidates.map((c) => c.className)).toEqual(['chq-fixture-ok-dock']);
    expect(rendererMentionsClass(fixtureRenderer, 'chq-fixture-ok-dock')).toBe(true);
    expect(declaresPhoneDock(fixtureRenderer)).toBe(true);
  });

  it('every named exemption still corresponds to a real, currently-failing docked class (no phantom exemptions)', () => {
    const allClasses = new Set(
      cssSources.flatMap(({ css }) => extractDockedClasses(css).map((c) => c.className)),
    );
    for (const [className] of KNOWN_UNFIXABLE_BY_ATTRIBUTE) {
      expect(allClasses.has(className)).toBe(true);
    }
  });

  it('every real docked footer class declares itself to the shell', () => {
    const offenders = findOffenders(cssSources, rendererSources);
    if (offenders.length > 0) {
      const lines = offenders.map(
        (o) =>
          `  ${o.className} (sheet: ${o.sheet})\n` +
          `    renderer(s): ${o.renderers.length > 0 ? o.renderers.join(', ') : '(none found)'}\n` +
          `    missing: ${o.reason}`,
      );
      throw new Error(
        `${offenders.length} docked footer class(es) don't declare data-chq-phone-dock / chq-phone-dock to the shell:\n${lines.join('\n')}`,
      );
    }
    expect(offenders).toEqual([]);
  });
});
