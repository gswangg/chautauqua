// CSS token + button-face contract (DEC-937). Two invariants the app's CSS
// vocabulary must never silently violate:
//
//   A) every BARE var(--chq-…) reference (no fallback argument) must
//      resolve to a real declaration — either in styles.css's :root token
//      block, or declared somewhere in the referencing file itself (a
//      locally-scoped custom property). A typo'd/renamed token (e.g.
//      --chq-sunk vs --chq-surface-sunk) otherwise resolves to
//      `transparent`/`initial` silently in the browser with no build-time
//      signal. A var(--chq-foo, <fallback>) call is exempt: the fallback
//      is a deliberate, visible default, not a silent failure.
//
//   B) every top-level (not inside @media) rule whose selector ends in
//      -btn/-button (no pseudo-class suffix) and declares `padding` is a
//      button face and must also declare its own font-family (or a `font`
//      shorthand) — otherwise it inherits the browser default (Arial) next
//      to the app's chosen UI typeface.
//
//   C) (DEC-976) every `chq-…` class token used in a *.tsx file's className
//      (a bare string, a template literal, or a conditional expression) has
//      a matching `.chq-…` rule SOMEWHERE in the app's CSS — including
//      inside an @media block, since a class defined only in a phone
//      override is still defined. A markup token with no matching rule is
//      a bug (typo/renamed class) or dead weight (a leftover className);
//      this invariant makes both build-time failures instead of a silent
//      no-op in the browser. A token that is a deliberate no-style hook
//      (used only as a scroll/query anchor, never meant to carry a rule)
//      must be named in NO_STYLE_HOOK_TOKENS below with its reason — never
//      an allowlist populated from the failure output.
//
//   D) (DEC-970 / DEC-976) the REVERSE direction of (C): every `chq-…`
//      class token appearing in a class selector anywhere in the union of
//      app/src CSS — including compound (.chq-a.chq-b), descendant
//      (.chq-a .chq-b), pseudo (.chq-a:hover, .chq-a::before) selectors,
//      and selectors nested inside an @media block — must appear in the
//      text of some app/src/**/*.ts or *.tsx file (EXCLUDING *.test.ts /
//      *.test.tsx — a class kept alive only by a test assertion is dead in
//      the product). A rule is reported dead only when EVERY chq-… token
//      in its selector is unused; the failure names the token and the file
//      that defines the dead rule. Tokens matching /^chq-phone-/ are out of
//      scope: the phone layer belongs to the deferred mobile round
//      (desktop-first standing rule) and has its own guard,
//      app/src/phone-block-visibility.test.ts.
//
//   E) (DEC-937 amendment, wave 39) every `font-family` declaration in any
//      app/src *.css file resolves through a `var(--chq-font-…)` reference
//      or is exactly `inherit` — a bare literal family name (or a fallback
//      chain ending in one) silently diverges from the app's two typefaces
//      the moment a token is renamed. Exempt: @font-face bodies (they
//      DECLARE a family, not consume one) and the single `monospace` code
//      face in styles.css. This invariant also asserts the global
//      `button, input, select, textarea, optgroup { font-family: inherit; }`
//      reset (added alongside this amendment) is present verbatim — without
//      it, form controls silently fall back to the platform UI font next to
//      Figtree-styled surrounding text.
//
//   F) (DEC-937 amendment, wave 39) WITHDRAWS (A)'s fallback exemption: a
//      `var(--chq-foo, <fallback>)` call whose `--chq-foo` is declared
//      neither in :root nor in the referencing file is an offender, exactly
//      like a bare undeclared token. The wave 39 audit found several
//      "phantom" tokens (--chq-display-font, --chq-font-body, plus stale
//      fallback chains on --chq-font-display/--chq-font-ui) that had
//      silently survived on their fallback value for multiple waves — the
//      fallback argument turned out to be hiding exactly the kind of typo
//      (A) exists to catch, not a deliberate default. A token set
//      dynamically from TSX via an inline `style` prop (never declared in
//      any CSS file) is a legitimate exception and must be named in
//      DYNAMIC_CSS_PROPS below with its setter file — never an allowlist
//      populated from the failure output.
//
//   G) (DEC-744, task-w40-b) the class of bug that shrink-wrapped the CFP
//      builder: `.chq-page` is a flex COLUMN (styles.css), and a
//      max-width: var(--chq-measure*) + auto left/right margins on a flex-
//      column CHILD cancels align-items:stretch -- the box sizes to its own
//      content instead of sharing the page root's clamp (forms.css's header
//      band rendered 275.5px inside an 820px column). Every rule in
//      app/src/**/*.css (enumerated, not hand-listed, per DEC-808) that
//      declares `max-width: var(--chq-measure*)` together with BOTH
//      `margin-left: auto` and `margin-right: auto` (the shrink-wrap shape)
//      must also declare `width: 100%` or `align-self: stretch` to defeat
//      the shrink -- unless it is one of the three foundational
//      .chq-measure / .chq-measure-wide / .chq-measure-table rules in
//      styles.css themselves (the token DEFINITIONS, always used on a block
//      or grid-item context, never a flex-column child). task-w40-g
//      deliberately lands one legal instance of this shape,
//      .chq-comms-editor, which pairs the clamp with `width: 100%`.
//
// All scans ENUMERATE every *.css / *.tsx file under app/src via
// readdirSync (mirroring page-measure.test.ts / DEC-808) rather than a
// hand-listed manifest, so a new page's markup and CSS are checked
// automatically.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES_PATH = join(HERE, 'styles.css');

/** Every *.css file under app/src, enumerated rather than named (DEC-808). */
function allCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Strips /* ... *\/ block comments so a decision note quoting CSS-shaped
 * text (a selector, a property) is never mistaken for a real rule. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Strips every @media block (top-level-only parsing, per house idiom). */
function stripMedia(css: string): string {
  return stripComments(css).replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
}

/** Every top-level `selector { body }` rule, with @media blocks stripped. */
function topLevelRules(css: string): Array<{ selector: string; body: string }> {
  const withoutMedia = stripMedia(css);
  const rules: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutMedia)) !== null) {
    rules.push({ selector: (m[1] ?? '').trim(), body: m[2] ?? '' });
  }
  return rules;
}

/** Extracts a top-level (not inside an @media block) rule's declaration body by selector. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = stripMedia(css);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

/**
 * Every distinct `--chq-…` custom-property name referenced via a BARE
 * var(--chq-foo) call (no fallback argument) in the given css text. A
 * var(--chq-foo, <fallback>) call is deliberately self-healing -- the
 * fallback stands in for an undefined token instead of silently resolving
 * to transparent/initial -- so it is out of scope for this contract.
 */
function referencedTokens(css: string): string[] {
  const out = new Set<string>();
  const re = /var\(\s*(--chq-[A-Za-z0-9-]+)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripComments(css))) !== null) {
    const name = m[1];
    if (name) out.add(name);
  }
  return [...out];
}

/**
 * Every distinct `--chq-…` custom-property name referenced via a
 * var(--chq-foo, <fallback>) call (WITH a fallback argument) in the given
 * css text -- the mirror of referencedTokens above, used by invariant (F)
 * which withdraws (A)'s fallback exemption.
 */
function referencedTokensWithFallback(css: string): string[] {
  const out = new Set<string>();
  const re = /var\(\s*(--chq-[A-Za-z0-9-]+)\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripComments(css))) !== null) {
    const name = m[1];
    if (name) out.add(name);
  }
  return [...out];
}

/**
 * Every `font-family: <value>;` declaration in the given css text, paired
 * with the enclosing top-level (or @media-nested) selector, so invariant
 * (E) can tell an @font-face body (which DECLARES a family) apart from a
 * rule that CONSUMES one.
 */
function fontFamilyDeclarations(css: string): Array<{ selector: string; value: string }> {
  const out: Array<{ selector: string; value: string }> = [];
  for (const { selector, body } of allRulesIncludingMedia(css)) {
    const re = /font-family\s*:\s*([^;]+);/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      const value = m[1];
      if (value) out.push({ selector, value: value.trim() });
    }
  }
  return out;
}

/** Whether `token` is declared (as `token:`) anywhere in the given css text. */
function isDeclaredIn(css: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*:`).test(css);
}

const CSS_FILES = allCssFiles(HERE);
const STYLES_CSS = readFileSync(STYLES_PATH, 'utf-8');
const ROOT_BODY = topLevelRuleBody(STYLES_CSS, ':root');

// Selector ends in -btn or -button, with no pseudo-class/attribute suffix
// (i.e. it literally ends in that string once trimmed).
const BUTTON_FACE_SELECTOR = /-(btn|button)$/;

function declaresFontFace(body: string): boolean {
  return /font-family\s*:/.test(body) || /font\s*:/.test(body);
}

/** Every *.tsx file under app/src, excluding test files (DEC-976/DEC-808). */
function allTsxFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Strips `//` line comments and `/* *\/` block comments from TSX source. */
function stripTsxComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Every `className={...}` / `className="..."` region's raw text, scanned
 * for brace-balance on the `{...}` form so a nested expression (a ternary,
 * a template literal, a function call) is captured in full.
 */
function classNameRegions(src: string): string[] {
  const regions: string[] = [];
  const re = /className\s*=\s*(\{|")/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const opener = m[1];
    const start = re.lastIndex;
    if (opener === '"') {
      const end = src.indexOf('"', start);
      if (end === -1) continue;
      regions.push(src.slice(start, end));
      re.lastIndex = end + 1;
    } else {
      let depth = 1;
      let i = start;
      while (i < src.length && depth > 0) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') depth--;
        i++;
      }
      regions.push(src.slice(start, i - 1));
      re.lastIndex = i;
    }
  }
  return regions;
}

/** Every distinct `chq-…` token found inside className regions of `src`. */
function classNameTokens(src: string): string[] {
  const out = new Set<string>();
  const re = /chq-[a-z0-9-]+/g;
  for (const region of classNameRegions(src)) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(region)) !== null) out.add(m[0]);
  }
  return [...out];
}

/**
 * Deliberate no-style hooks: a `chq-…` className used only as a scroll or
 * query anchor, never meant to carry a rule. One named entry per class,
 * with the reason written beside it — never an allowlist populated from
 * the failure output (DEC-976).
 */
const NO_STYLE_HOOK_TOKENS = new Set<string>([
  // Extractor artifact, not a real class: SettingsField.tsx builds
  // `chq-settings-field-${width}` as a template literal, and the bare
  // regex captures the fixed prefix up to the placeholder as its own
  // token. The five real, fully-interpolated tokens
  // (chq-settings-field-date/seats/name/slug/full) each have their own
  // CSS rule in settings.css.
  'chq-settings-field-',
]);

/** A token belonging to the deferred phone layer (its own guard lives in
 * app/src/phone-block-visibility.test.ts) — out of scope for the (D) dead-
 * rule scan per the desktop-first standing rule. */
const PHONE_TOKEN = /^chq-phone-/;

/** Every *.ts/*.tsx file under app/src, excluding *.test.ts(x) (DEC-976/DEC-808). */
function allTsAndTsxFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Every `selector { body }` rule in the given CSS text, INCLUDING rules
 * nested inside an @media block (unlike topLevelRules, which strips media
 * blocks entirely) — a rule that only exists inside a phone-width query is
 * still a rule that must be reachable from markup, per invariant (D). */
function allRulesIncludingMedia(css: string): Array<{ selector: string; body: string }> {
  const withoutComments = stripComments(css);
  const rules: Array<{ selector: string; body: string }> = [];
  const topLevel = withoutComments.replace(
    /@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g,
    (_full, inner: string) => {
      const re = /([^{}]+)\{([^{}]*)\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(inner)) !== null) {
        rules.push({ selector: (m[1] ?? '').trim(), body: m[2] ?? '' });
      }
      return '';
    },
  );
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(topLevel)) !== null) {
    rules.push({ selector: (m[1] ?? '').trim(), body: m[2] ?? '' });
  }
  return rules;
}

/** Every distinct `chq-…` class token appearing in a class selector — a
 * compound (.chq-a.chq-b), descendant (.chq-a .chq-b), or pseudo
 * (.chq-a:hover, .chq-a::before) selector all yield their `.chq-…`
 * segments via the same `\.(chq-…)` match (a pseudo starts with `:`, not
 * part of the token). */
function selectorClassTokens(selector: string): string[] {
  const out = new Set<string>();
  const re = /\.(chq-[A-Za-z0-9-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(selector)) !== null) {
    const token = m[1];
    if (token) out.add(token);
  }
  return [...out];
}

/**
 * Named exceptions to (D): a `chq-…` class token that IS live in the
 * product but is emitted in a way the plain-text token extractor cannot
 * see (e.g. built by string concatenation/template interpolation rather
 * than appearing as a literal `chq-…` substring). One named entry per
 * token, with the reason and its emitter file written beside it — never a
 * list populated from the failure output.
 */
const DYNAMIC_CLASS_TOKENS = new Set<string>([
  // Built as `chq-speakers-status-${modifier}` in
  // app/src/pages/speakers/TaskCell.tsx's statusCellClass (modifier in
  // 'complete' | 'overdue' | 'pending') and
  // app/src/pages/speakers/ParticipationMenu.tsx's participationStatusClass
  // (same three plus 'none') -- the token extractor only sees the fixed
  // `chq-speakers-status-` prefix up to the template placeholder.
  'chq-speakers-status-complete',
  'chq-speakers-status-pending',
  'chq-speakers-status-overdue',
  // v12: participation's Invited split off the task axis's Pending when the
  // task token went bare bold-ink and INV.Invited kept its 1px rule.
  'chq-speakers-status-invited',
  'chq-speakers-status-none',
  // v12 density half of the status token pair -- built as
  // `chq-speakers-status-${density}` in the same statusCellClass.
  'chq-speakers-status-dense',
  'chq-speakers-status-roomy',
  // Built as `chq-settings-field-${width}` in
  // app/src/pages/settings/SettingsEditForm.tsx's SettingsField (width in
  // 'date' | 'seats' | 'name' | 'slug' | 'full', DEC-896 amendment wave
  // 26) -- the token extractor only sees the fixed `chq-settings-field-`
  // prefix up to the template placeholder.
  'chq-settings-field-date',
  'chq-settings-field-seats',
  'chq-settings-field-name',
  'chq-settings-field-slug',
  'chq-settings-field-venue',
  'chq-settings-field-timezone',
  'chq-settings-field-full',
]);

/**
 * Named exceptions to (F): a `--chq-…` custom property that is legitimately
 * never declared in any CSS file because it is set dynamically from TSX via
 * an inline `style` prop (e.g. `style={{ '--chq-foo': value }}`). One named
 * entry per token, with its setter file written beside it -- never a list
 * populated from the failure output.
 */
const DYNAMIC_CSS_PROPS = new Set<string>([
  // Set inline in app/src/pages/review/Scorecard.tsx as
  // `style={{ '--chq-review-scale-steps': ratingScaleStepCount }}` so the
  // rating grid's column count tracks the event's configured scale; the
  // `, 5)` fallback in review.css covers the unmounted/pre-hydration case.
  '--chq-review-scale-steps',
]);

describe('CSS token + button-face contract (DEC-937)', () => {
  it('found more than one CSS file to scan', () => {
    // Guards the enumeration itself: if readdirSync ever returned nothing,
    // every assertion below would vacuously pass.
    expect(CSS_FILES.length).toBeGreaterThan(5);
  });

  it('every var(--chq-…) reference resolves to a declaration in :root or its own file', () => {
    const offenders: string[] = [];
    for (const path of CSS_FILES) {
      const css = readFileSync(path, 'utf-8');
      const label = relative(HERE, path);
      for (const token of referencedTokens(css)) {
        const declaredGlobally = isDeclaredIn(ROOT_BODY, token);
        const declaredLocally = isDeclaredIn(css, token);
        if (!declaredGlobally && !declaredLocally) {
          offenders.push(`${label}: ${token}`);
        }
      }
    }
    expect(offenders, `undeclared CSS custom properties:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('every button-face rule (selector ends -btn/-button, declares padding) also declares its own font', () => {
    const offenders: string[] = [];
    for (const path of CSS_FILES) {
      const css = readFileSync(path, 'utf-8');
      const label = relative(HERE, path);
      for (const { selector, body } of topLevelRules(css)) {
        // A comma-separated selector list can mix button-face and other
        // names; each individual part is checked.
        const parts = selector.split(',').map((s) => s.trim());
        const isButtonFace = parts.some((s) => BUTTON_FACE_SELECTOR.test(s));
        if (!isButtonFace) continue;
        if (!/padding\s*:/.test(body)) continue;
        if (!declaresFontFace(body)) {
          offenders.push(`${label}: "${selector}"`);
        }
      }
    }
    expect(offenders, `button-face rules with no font-family/font:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('every chq-… className token used in markup has a matching CSS rule (DEC-976)', () => {
    // Defined set: every `.chq-…` class selector appearing anywhere in the
    // union of the CSS files, including inside @media blocks (comments
    // stripped only, media NOT stripped — a phone-only class is defined).
    const defined = new Set<string>();
    for (const path of CSS_FILES) {
      const css = stripComments(readFileSync(path, 'utf-8'));
      const re = /\.(chq-[A-Za-z0-9-]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(css)) !== null) {
        const token = m[1];
        if (token) defined.add(token);
      }
    }

    const TSX_FILES = allTsxFiles(HERE);
    expect(TSX_FILES.length).toBeGreaterThan(5);

    const offenders: string[] = [];
    for (const path of TSX_FILES) {
      const src = stripTsxComments(readFileSync(path, 'utf-8'));
      const label = relative(HERE, path);
      for (const token of classNameTokens(src)) {
        if (defined.has(token) || NO_STYLE_HOOK_TOKENS.has(token)) continue;
        offenders.push(`${label}: ${token}`);
      }
    }
    expect(
      offenders,
      `className tokens with no matching CSS rule (add a rule or delete the className):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('every chq-… class token in a CSS selector is used somewhere in app/src markup/source (DEC-970)', () => {
    // Used set: every `chq-…` token found in the plain text of any *.ts/
    // *.tsx source file (excluding tests), not just className regions —
    // (D) is deliberately broader than (C)'s className-only scan since a
    // token can also be referenced via a helper (e.g. `classList.add`) or
    // built from a shared constant. Deliberately scanned on the RAW source
    // (not stripTsxComments' output): stripTsxComments' block-comment
    // regex treats any bare "/*" as a comment opener, which a route-path
    // string literal like '/review/*' also contains, so it can swallow
    // real code up to the next literal "*/" (seen live: it ate the
    // `className="chq-header"` markup in App.tsx). A token mentioned only
    // in a comment being counted as "used" is a safe false negative here
    // (worst case: a truly dead rule stays undetected); a token wrongly
    // erased from the used set risks deleting a live rule, which is worse.
    const used = new Set<string>();
    for (const path of allTsAndTsxFiles(HERE)) {
      const src = readFileSync(path, 'utf-8');
      const re = /chq-[a-z0-9-]+/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) used.add(m[0]);
    }

    const offenders: string[] = [];
    for (const path of CSS_FILES) {
      const label = relative(HERE, path);
      const css = readFileSync(path, 'utf-8');
      for (const { selector } of allRulesIncludingMedia(css)) {
        const tokens = selectorClassTokens(selector).filter((t) => !PHONE_TOKEN.test(t));
        if (tokens.length === 0) continue; // no in-scope chq-… token in this selector
        const allDead = tokens.every(
          (t) => !used.has(t) && !DYNAMIC_CLASS_TOKENS.has(t),
        );
        if (allDead) {
          for (const t of tokens) offenders.push(`${label}: ${t} ("${selector}")`);
        }
      }
    }
    expect(
      offenders,
      `dead CSS rules (chq-… token unused in app/src *.ts/*.tsx, excluding tests):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('every font-family declaration resolves through var(--chq-font-…) or is inherit (E)', () => {
    const offenders: string[] = [];
    for (const path of CSS_FILES) {
      const css = stripComments(readFileSync(path, 'utf-8'));
      const label = relative(HERE, path);
      for (const { selector, value } of fontFamilyDeclarations(css)) {
        if (selector.trim() === '@font-face') continue; // declares a family, doesn't consume one
        if (value === 'monospace') continue; // the single named code-face exemption
        if (value === 'inherit') continue;
        if (/^var\(--chq-font-[A-Za-z0-9-]+\)$/.test(value)) continue;
        offenders.push(`${label}: "${selector}" font-family: ${value}`);
      }
    }
    expect(
      offenders,
      `font-family declarations bypassing the --chq-font-… token contract:\n${offenders.join('\n')}`,
    ).toEqual([]);

    // The global element reset (added alongside this amendment) must exist
    // verbatim -- it is what makes <button>/<input>/etc. inherit the
    // surrounding Figtree/Familjen Grotesk face instead of the browser's
    // Arial default.
    const resetRe =
      /button,\s*\n\s*input,\s*\n\s*select,\s*\n\s*textarea,\s*\n\s*optgroup\s*\{\s*\n\s*font-family:\s*inherit;\s*\n\s*\}/;
    expect(resetRe.test(STYLES_CSS), 'global form-control font-family: inherit reset not found in styles.css').toBe(
      true,
    );
  });

  it('no rule clamps max-width: var(--chq-measure*) with auto left+right margins unless it also stretches (G, DEC-744)', () => {
    const MEASURE_CLAMP_RE = /max-width:\s*var\(--chq-measure(?:-wide|-table)?\)/;
    const MARGIN_LEFT_AUTO_RE = /margin-left:\s*auto/;
    const MARGIN_RIGHT_AUTO_RE = /margin-right:\s*auto/;
    const STRETCH_RE = /width:\s*100%|align-self:\s*stretch/;

    /** Whether a `body`'s margin declarations (longhand OR the `margin:`
     * shorthand, e.g. `margin: 0 auto;`) set BOTH left and right to auto --
     * the CSS box-model shorthand rule: 1 value -> all sides; 2 values ->
     * [vertical, horizontal]; 3 -> [top, horizontal, bottom]; 4 -> [top,
     * right, bottom, left]. */
    function hasAutoLeftAndRightMargins(body: string): boolean {
      if (MARGIN_LEFT_AUTO_RE.test(body) && MARGIN_RIGHT_AUTO_RE.test(body)) return true;
      const shorthand = body.match(/(?:^|[;{])\s*margin\s*:\s*([^;]+);/);
      if (!shorthand) return false;
      const parts = shorthand[1]!.trim().split(/\s+/);
      let left: string | undefined;
      let right: string | undefined;
      if (parts.length === 1) {
        left = right = parts[0];
      } else if (parts.length === 2) {
        right = left = parts[1];
      } else if (parts.length === 3) {
        right = left = parts[1];
      } else if (parts.length === 4) {
        right = parts[1];
        left = parts[3];
      }
      return left === 'auto' && right === 'auto';
    }

    const offenders: string[] = [];
    for (const path of CSS_FILES) {
      const label = relative(HERE, path);
      const css = readFileSync(path, 'utf-8');
      for (const { selector, body } of allRulesIncludingMedia(css)) {
        if (!MEASURE_CLAMP_RE.test(body)) continue;
        if (!hasAutoLeftAndRightMargins(body)) continue;
        if (STRETCH_RE.test(body)) continue;
        // The three foundational token-definition rules in styles.css are
        // the one legitimate place this shape is allowed to appear
        // unguarded -- they define .chq-measure* itself, always consumed on
        // a block/grid-item context, never a flex-column child.
        if (
          path === STYLES_PATH &&
          ['.chq-measure', '.chq-measure-wide', '.chq-measure-table'].includes(selector.trim())
        ) {
          continue;
        }
        offenders.push(`${label}: "${selector}"`);
      }
    }
    expect(
      offenders,
      `rules that clamp max-width: var(--chq-measure*) with auto left+right margins but no width:100%/align-self:stretch (shrink-wraps inside a flex-column parent):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('every var(--chq-foo, <fallback>) call also resolves to a real declaration (F)', () => {
    const offenders: string[] = [];
    for (const path of CSS_FILES) {
      const css = readFileSync(path, 'utf-8');
      const label = relative(HERE, path);
      for (const token of referencedTokensWithFallback(css)) {
        if (DYNAMIC_CSS_PROPS.has(token)) continue;
        const declaredGlobally = isDeclaredIn(ROOT_BODY, token);
        const declaredLocally = isDeclaredIn(css, token);
        if (!declaredGlobally && !declaredLocally) {
          offenders.push(`${label}: ${token}`);
        }
      }
    }
    expect(
      offenders,
      `var(--chq-foo, fallback) calls whose token is declared nowhere:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
