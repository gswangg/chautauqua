// Contention decomposition (custodian, wave 44) + DEC-393 wave-44 clause (a)
// (task w44-e): the ANCHORLESS-CONTAINER tier, extracted verbatim from
// test/tap-floor-exempt-premise.scan.test.ts alongside its sibling tiers,
// no behavior change. It is the one tier that walks RENDERED MARKUP rather
// than CSS selectors, so it carries its own markup scanner and corpus.
import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { enumerateSourceFiles, stripComments } from "../frame-source-corpus";
import { REPO_ROOT, ROOTS } from "./population";
import type { Receipt, RosterRow } from "./receipts";

// ANCHORLESS-CONTAINER tier (DEC-393 wave-44, task w44-e): a reason naming
// a component file (or a directly-quoted markup fragment) and asserting
// that the receipted class's rendered children contain no bare anchor --
// "no anchor", "never a bare <a>/<Link>", "renders only <button ...>" --
// states a premise about the RENDERED MARKUP, not about a companion CSS
// rule, so none of the tiers above (which all search CSS selectors) have
// anything to say about it. This tier instead walks the real JSX/TSX
// markup corpus (test/frame-source-corpus.ts's enumerator + comment
// stripper -- DEC-613, never a second copy): locate every element bearing
// the receipted class as a literal className/class word, walk it to its
// own BALANCED matching close tag, and inspect every `<a`/`<Link`/
// `<NavLink` strictly inside.
//
// The balanced-close walk is a hand-rolled brace/quote-aware tag scanner,
// not a `[^>]*>` regex: a JSX attribute expression like `onClick={() =>
// onSelect(item.id)}` embeds a literal `>` (the arrow) that a naive
// tag-end regex would misread as the tag's own close, truncating the walk
// before it ever reaches the real children. The scanner instead tracks
// brace depth and quote state character-by-character, so `>` inside a
// `{...}` expression or a quoted string is invisible to it, exactly as it
// is to a real JSX parser.
//
// VERIFIED when no anchor is found inside, or every one found carries
// `.chq-btn` or `.chq-link-button` -- this codebase's two floored
// button-styled-anchor classes (see review.css:1574's PlanList worked
// example: "Export results CSV" `<a className="chq-btn chq-btn-
// secondary">` and "New plan" `<Link className="chq-btn chq-btn-
// primary">`, both chq-btn-styled). FALSE-PREMISE the moment a bare
// anchor carrying neither class is found inside -- a real 44px-floor gap,
// the whole point of building this tier rather than softening every
// unresolved "other" receipt into the same UNVERIFIABLE bucket.
// UNVERIFIABLE-PREMISE only when the receipted class token appears
// nowhere in the markup corpus at all, or every occurrence found could not
// be walked to a balanced close (never a silent VERIFIED-by-omission).
interface TagToken {
  start: number;
  end: number;
  name: string;
  closing: boolean;
  selfClosing: boolean;
  attrsText: string;
}

/** Scans the single tag starting at `text[ltIndex] === '<'`, tracking
 * brace depth (for `{...}` JSX expression attributes, which may nest
 * object literals) and quote state (`'`/`"`/`` ` ``, backslash-escape
 * aware) so an embedded `>` -- an arrow function's `=>`, a `>` inside a
 * string -- can never be misread as the tag's own close. Returns null when
 * `ltIndex` is not a real tag start (a bare `<`/`Array<string>` generic/
 * comparison) or the tag never closes before EOF. */
function scanTagAt(text: string, ltIndex: number): TagToken | null {
  const n = text.length;
  let i = ltIndex + 1;
  if (i >= n) return null;
  let closing = false;
  if (text[i] === "/") {
    closing = true;
    i++;
  }
  const nameStart = i;
  while (i < n && /[A-Za-z0-9_.]/.test(text[i]!)) i++;
  const name = text.slice(nameStart, i);
  if (name === "" && text[i] !== ">") return null; // not a fragment, not a real tag
  const attrsStart = i;
  let depth = 0;
  let quote: string | null = null;
  let selfClosing = false;
  let closed = false;
  while (i < n) {
    const c = text[i]!;
    if (quote) {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      i++;
      continue;
    }
    if (c === "{") {
      depth++;
      i++;
      continue;
    }
    if (c === "}") {
      depth--;
      i++;
      continue;
    }
    if (depth <= 0 && c === "/" && text[i + 1] === ">") {
      selfClosing = true;
      i += 2;
      closed = true;
      break;
    }
    if (depth <= 0 && c === ">") {
      i += 1;
      closed = true;
      break;
    }
    i++;
  }
  if (!closed) return null;
  return { start: ltIndex, end: i, name, closing, selfClosing, attrsText: text.slice(attrsStart, i) };
}

/** The next real tag at or after `fromIndex` -- skips any `<` that
 * `scanTagAt` refuses (a stray comparison/generic), never a raw index
 * scan alone. */
function nextTag(text: string, fromIndex: number): TagToken | null {
  let idx = text.indexOf("<", fromIndex);
  while (idx !== -1) {
    const tok = scanTagAt(text, idx);
    if (tok) return tok;
    idx = text.indexOf("<", idx + 1);
  }
  return null;
}

/** The `class`/`className` attribute's value, split into words -- only a
 * literal quoted string is read (this codebase's every receipted
 * container in this tier's population uses a plain `className="..."`
 * literal, never a dynamic expression), so a dynamic `className={...}`
 * simply yields no words, same as no class attribute at all. */
function classWords(attrsText: string): string[] {
  const m = attrsText.match(/class(?:Name)?\s*=\s*(["'`])((?:(?!\1)[\s\S])*)\1/);
  if (!m || m[2] === undefined) return [];
  return m[2].split(/\s+/).filter(Boolean);
}

/** Walks forward from `containerEnd` (the index right after the
 * container's own opening `>`) counting every subsequent tag: an opening,
 * non-self-closing tag increments depth; a closing tag decrements it; a
 * self-closing tag never changes it. The tag at which depth returns to 0
 * is the container's own BALANCED matching close tag; everything between
 * is returned as its content. Null when the walk runs off the end of the
 * text without ever finding that close (an unbalanced/unparseable region
 * -- never silently treated as empty content). */
function walkBalancedContent(text: string, containerEnd: number): string | null {
  let depth = 1;
  let pos = containerEnd;
  while (depth > 0) {
    const tok = nextTag(text, pos);
    if (!tok) return null;
    if (tok.closing) depth--;
    else if (!tok.selfClosing) depth++;
    if (depth === 0) return text.slice(containerEnd, tok.start);
    pos = tok.end;
  }
  return null;
}

export interface MarkupFile {
  path: string;
  text: string;
}

interface ContainerOccurrence {
  file: string;
  tagName: string;
  content: string | null;
}

interface FoundTag {
  tok: TagToken;
  /** The text `tok.start`/`tok.end` are offsets into -- the file's own
   * text at the top level, or an ANCESTOR tag's `attrsText` when `tok` was
   * only reachable by recursing into a render-prop (see below). */
  contextText: string;
}

/** Walks `text` for every opening tag satisfying `predicate`, the same
 * `nextTag`-driven, tok.end-advancing sweep every tier above uses -- BUT
 * also recurses into every visited tag's OWN `attrsText`. This codebase's
 * `<ModalFrame actions={<>...<div className="...">...</div>...</>} ...>`
 * render-prop idiom (FieldModal.tsx among others) puts real, rendered JSX
 * inside a `{...}` ATTRIBUTE VALUE -- `scanTagAt` correctly treats that
 * whole brace-balanced expression as one opaque span of ModalFrame's own
 * tag (so ModalFrame's own `>` is found correctly), but a sweep that only
 * ever jumps forward by `tok.end` would then skip straight past it, never
 * seeing the div (or any anchor) rendered inside. Recursing into
 * `tok.attrsText` whenever it contains a `<` finds it at any nesting
 * depth, however many render-props deep, while leaving `walkBalancedContent`
 * untouched -- everything nested inside one tag's attributes is already
 * internally balanced JSX, so it never perturbs an ANCESTOR's own depth
 * count. */
function collectTagsRecursive(text: string, predicate: (tok: TagToken) => boolean, out: FoundTag[]): void {
  let idx = 0;
  for (;;) {
    const tok = nextTag(text, idx);
    if (!tok) break;
    idx = tok.end;
    if (tok.closing) continue;
    if (predicate(tok)) out.push({ tok, contextText: text });
    if (tok.attrsText.includes("<")) collectTagsRecursive(tok.attrsText, predicate, out);
  }
}

/** Every element in `files` bearing `token` as a literal className/class
 * word, walked to its own balanced close via `walkBalancedContent`. A
 * self-closing container (`<button className="token" />`) has no
 * children by construction, so its content is the empty string, never a
 * walk. */
function findContainerOccurrences(token: string, files: MarkupFile[]): ContainerOccurrence[] {
  const out: ContainerOccurrence[] = [];
  for (const f of files) {
    const found: FoundTag[] = [];
    collectTagsRecursive(f.text, (tok) => classWords(tok.attrsText).includes(token), found);
    for (const { tok, contextText } of found) {
      const content = tok.selfClosing ? "" : walkBalancedContent(contextText, tok.end);
      out.push({ file: f.path, tagName: tok.name, content });
    }
  }
  return out;
}

const ANCHOR_TAG_NAMES = new Set(["a", "Link", "NavLink"]);
const FLOORED_ANCHOR_CLASSES = new Set(["chq-btn", "chq-link-button"]);

/** Every `<a`/`<Link`/`<NavLink` opening (or self-closing) tag inside
 * `content`, at any render-prop nesting depth (`collectTagsRecursive`). */
function anchorsIn(content: string): TagToken[] {
  const found: FoundTag[] = [];
  collectTagsRecursive(content, (tok) => ANCHOR_TAG_NAMES.has(tok.name), found);
  return found.map((f) => f.tok);
}

function isFlooredAnchor(tok: TagToken): boolean {
  return classWords(tok.attrsText).some((w) => FLOORED_ANCHOR_CLASSES.has(w));
}

/** Every `.tsx` file in the shared markup corpus (`enumerateSourceFiles`
 * -- DEC-613, the same enumerator + `stripComments` every frame-label
 * ledger already shares), read once at module load the same way
 * FILES/ALL_TEXT/ALL_CHUNKS above are. */
const REAL_MARKUP_FILES: MarkupFile[] = ROOTS.flatMap((r) => enumerateSourceFiles(join(REPO_ROOT, r)))
  .filter((full) => full.endsWith(".tsx"))
  .map((full) => ({ path: relative(REPO_ROOT, full).split(sep).join("/"), text: stripComments(readFileSync(full, "utf8")) }));

/** A reason states this tier's shape when it asserts anchor-absence (or
 * button-only children) in the receipted container -- "no anchor", "never
 * a bare <a>/<Link>", "renders only <button ...>" -- and is NOT one of the
 * several other shapes this population's `other`-family reasons use that
 * merely mention the same vocabulary: the receipted token itself rendering
 * AS an anchor elsewhere (theme.ts's `.chq-wordmark`, overview.css's
 * deadline-cell `<Link>`, portal.css.ts's `.chq-wordmark` `<span>` twin),
 * a native-control label/htmlFor association ("the label is the click/tap
 * anchor"), an ancestor-visibility claim (a `<thead>` set to
 * `display:none`), or a purely decorative-sizing claim (a checkbox/radio
 * glyph, a swatch, a `.chq-pill`) that says nothing about anchors at all. */
export function isContainerAnchorAbsenceCandidate(reason: string): boolean {
  const normalized = reason.replace(/\s+/g, " ");
  const include =
    /(\bno anchor\b|\bno bare anchor\b|never an? (bare )?anchor\b|never an? bare <a|never a bare anchor\b|<a[\s/>]|<link\b|<navlink\b|chq-link-button|renders only <button|\bnothing tappable\b)/i;
  const exclude =
    /(renders as an anchor|as a plain <span>|unlike its <a>|no selector-specific phone rule is needed|grows the anchor|IS the row-action-anchor shape|bare-anchor-token population member|<thead> parent is display:none|htmlfor|check-hit|visually-hidden|\bswatch\b|radio glyph|18px box|hint line|\bpill\b|click\/tap anchor)/i;
  return include.test(normalized) && !exclude.test(normalized);
}

export function judgeContainerAnchorAbsence(receipt: Receipt, files: MarkupFile[] = REAL_MARKUP_FILES): RosterRow {
  const token = receipt.receiptedClasses[receipt.receiptedClasses.length - 1];
  if (!token) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: "container-anchor tier: receipt names no receipted class token to locate in the markup corpus" };
  }
  const occurrences = findContainerOccurrences(token, files);
  if (occurrences.length === 0) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: `container-anchor tier: .${token} does not appear as a className word anywhere in the markup corpus` };
  }
  const resolved = occurrences.filter((o) => o.content !== null);
  if (resolved.length === 0) {
    return { ...receipt, verdict: "UNVERIFIABLE-PREMISE", detail: `container-anchor tier: .${token} was found ${occurrences.length} time(s) but none could be walked to a balanced close tag` };
  }
  for (const occ of resolved) {
    const bare = anchorsIn(occ.content as string).filter((a) => !isFlooredAnchor(a));
    if (bare.length > 0) {
      return {
        ...receipt,
        verdict: "FALSE-PREMISE",
        detail: `container-anchor tier: ${occ.file}'s .${token} container holds a bare <${bare[0]!.name}> with no chq-btn/chq-link-button class -- a real 44px hit-box gap`,
      };
    }
  }
  return {
    ...receipt,
    verdict: "VERIFIED",
    detail: `container-anchor tier: every .${token} container in the markup corpus (${resolved.length} of ${occurrences.length} occurrence(s) resolved) holds no anchor, or only chq-btn/chq-link-button-classed anchor(s)`,
  };
}

