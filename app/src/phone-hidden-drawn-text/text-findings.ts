// TSX side of the DEC-725 phone hidden-drawn-text ledger: every chq- token
// on a text-bearing element, static-vs-composed. Extracted (contention
// decomposition, no behavior change) from
// app/src/phone-hidden-drawn-text.scan.test.ts, which re-exports these
// symbols verbatim.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enumerateSourceFiles, stripComments } from '../../../test/frame-source-corpus';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src/phone-hidden-drawn-text
const REPO_ROOT = join(HERE, '..', '..', '..');

export interface TextFinding {
  file: string; // relative to REPO_ROOT
  token: string;
  text: string; // trimmed raw text child
  composed: boolean; // a JSX expression (`{…}`) rather than literal prose
}

// Opening tag `<TAG attrs>` (self-closing tags carry no children and are
// skipped) whose class/className attribute carries a chq- token; DEC-613
// idiom shared with test/frame-control-label.scan.test.ts's own
// TAG_RE/SPAN_RE style. Unlike a single-level sibling regex, a token-bearing
// element's own text may sit BEHIND further nested markup (the worked
// example: `.chq-review-criteria-head-row`'s "Weight " column-head literal
// sits inside a nested `<span className="chq-review-criteria-head-cell">`,
// not as the head-row `<div>`'s own direct child) -- so once a token-bearing
// OPEN tag is found, its content is walked to the matching BALANCED close
// tag (depth-counted on that exact tag name, mirrors
// test/frame-control-label.scan.test.ts's `balancedDivEnd`, generalised to
// any tag) and every text/JSX-expression run inside that whole block is
// extracted as a candidate finding for the token(s) on the outer tag.
const OPEN_TAG_RE = /<([A-Za-z][\w.]*)\b([^>]*?)(\/?)>/g;
const CLASS_ATTR_RE = /(?:class|className)\s*=\s*(\{[^}]*\}|"[^"]*"|`[^`]*`)/;
const CHQ_TOKEN_RE = /chq-[a-z0-9-]+/g;
const TEXT_RUN_RE = />([^<>]+)</g;
// A candidate must carry at least 3 consecutive letters to count as real
// prose (mirrors the campaign's standing `isRealLabel`-shaped filter --
// test/frame-control-label.scan.test.ts's own `isRealLabel` -- generalised
// from "length >= 2" to "contains real letters" so bare punctuation/interp
// noise (`(`, `}`, `{  }`) coming out of the balanced-block text-run walk
// can never manufacture a match or an UNVERIFIABLE row).
const MEANINGFUL_TEXT_RE = /[A-Za-z]{3,}/;

/** Start offset (the `<` of `</tagName>`) of the balanced closing tag
 * matching the open tag `tagName` whose own `>` sits at `openTagEnd`.
 * Depth-counted so a nested occurrence of the same tag name can never
 * truncate the walk early. */
function balancedCloseStart(src: string, tagName: string, openTagEnd: number): number {
  const re = new RegExp(`<(/?)${tagName}\\b[^>]*?(/?)>`, 'g');
  re.lastIndex = openTagEnd;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const isClose = m[1] === '/';
    const selfClosing = !isClose && m[2] === '/';
    if (selfClosing) continue;
    if (isClose) {
      depth -= 1;
      if (depth === 0) return m.index;
    } else {
      depth += 1;
    }
  }
  throw new Error(`balancedCloseStart: <${tagName}> at offset ${openTagEnd} never closed`);
}

/** Every distinct `chq-…` text-bearing finding across `root`'s non-test
 * `.tsx` files, comments stripped with the ONE shared stripper
 * (test/frame-source-corpus.ts's `stripComments`, DEC-613). `file` fields
 * are relative to this repo's REPO_ROOT (derived from this module's own
 * location, not the caller's -- so this module carries no path assumptions
 * of the caller's). */
export function textBearingFindingsIn(root: string): TextFinding[] {
  const out: TextFinding[] = [];
  for (const abs of enumerateSourceFiles(root)) {
    if (!abs.endsWith('.tsx')) continue;
    const rel = abs.slice(REPO_ROOT.length + 1);
    const src = stripComments(readFileSync(abs, 'utf-8'));
    OPEN_TAG_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = OPEN_TAG_RE.exec(src)) !== null) {
      if (m[3] === '/') continue; // self-closing: no children
      const attrs = m[2] ?? '';
      const classMatch = attrs.match(CLASS_ATTR_RE);
      if (!classMatch) continue;
      const classText = classMatch[1] ?? '';
      const tokens = [...classText.matchAll(CHQ_TOKEN_RE)].map((t) => t[0]);
      if (tokens.length === 0) continue;
      const tagName = m[1]!;
      const openTagEnd = m.index + m[0].length;
      let closeStart: number;
      try {
        closeStart = balancedCloseStart(src, tagName, openTagEnd);
      } catch {
        continue; // malformed/unbalanced in this narrow slice -- skip, never invent a block
      }
      // `block` is the raw text strictly BETWEEN the open tag's `>` and the
      // close tag's `<` -- for a LEAF element (no nested markup at all,
      // e.g. `<span className="chq-x">Plain text</span>`) that means the
      // block carries no `>`/`<` delimiter of its own, so TEXT_RUN_RE's
      // `>(...)<` shape would find nothing even though the whole block IS
      // one text run. Wrapping it back in its own boundary characters
      // unifies the leaf case with the nested-container case (where the
      // block's OWN interior `>`/`<` pairs, from its nested children,
      // already delimit each run) under one regex pass.
      const block = src.slice(openTagEnd, closeStart);
      const wrapped = `>${block}<`;
      TEXT_RUN_RE.lastIndex = 0;
      let tm: RegExpExecArray | null;
      while ((tm = TEXT_RUN_RE.exec(wrapped)) !== null) {
        const text = (tm[1] ?? '').trim();
        if (!MEANINGFUL_TEXT_RE.test(text)) continue;
        const composed = text.includes('{');
        for (const token of tokens) out.push({ file: rel, token, text, composed });
      }
    }
  }
  return out;
}

// Wave-39 amendment (DEC-725): a CSS SELECTOR token must be a genuine CLASS
// selector -- `.chq-x` -- not merely a `chq-` substring anywhere in the
// selector text. Without the leading `.` anchor, `CHQ_TOKEN_RE` also matched
// `chq-cfp-step` INSIDE the ATTRIBUTE NAME of `[data-chq-cfp-step="1"]`
// (an attribute selector, never a class selector), pulling in every
// `.chq-cfp-step` finding -- including the unrelated "You" section label --
// as if it were a real match for `.chq-cfp-step-back`/`.chq-cfp-step-next`'s
// own rule. This is the SAME shape as the cross-component match that wave
// closes, one layer earlier in the pipeline: a token that was never actually
// named by the rule's own class selector supplying the literal that condemns
// it.
const CSS_CLASS_TOKEN_RE = /\.(chq-[a-z0-9-]+)/g;

/** `chq-` class-selector token extraction for the CSS side of this ledger
 * (the TSX-class side reads class attributes with `CHQ_TOKEN_RE` directly,
 * where no leading `.` is written). */
export function tokensOf(selector: string): string[] {
  return [...new Set([...selector.matchAll(CSS_CLASS_TOKEN_RE)].map((m) => m[1]!))];
}
