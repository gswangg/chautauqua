// Join: CSS rule -> chq- tokens -> TSX text findings -> frame extents. The
// core grading logic of the DEC-725 phone hidden-drawn-text ledger.
// Extracted (contention decomposition, no behavior change) from
// app/src/phone-hidden-drawn-text.scan.test.ts, which re-exports these
// symbols verbatim.
import { clusterKeyForPath } from './cluster-scope';
import type { FrameBlob } from './frame-blobs';
import { matchingFrame } from './frame-blobs';
import type { TextFinding } from './text-findings';
import { tokensOf } from './text-findings';

// ---------------------------------------------------------------------------
// Wave-39 amendment (DEC-725): a shared control verb from an UNRELATED
// component can no longer condemn a sheet. Two tightenings:
//
//   (1) TSX-SIDE CLUSTER SCOPING -- `findingsScopedForSheet`
//   (cluster-scope.ts), the TSX mirror of `scopeBlobsForSheet`: a finding
//   from ANY component anywhere in the tree used to be able to supply the
//   literal that grades ANY sheet's rule. The worked example that motivated
//   it: `.chq-agenda-head-actions .chq-btn-secondary` (agenda.css, cluster
//   "agenda") was graded PREMISE-FALSE on the word "Cancel" sourced from
//   `app/src/components/EventSwitcher.tsx` -- a shared component outside any
//   page cluster -- matched only by coincidence against the Agenda frame.
//
//   (2) GENERIC-VERB CORROBORATION -- even within one cluster, a single
//   short, generic control word ("Edit", "Save", "Open", "Approve") drawn
//   by ONE component and hidden by an unrelated rule in the SAME cluster is
//   still coincidental agreement, not a same-screen contradiction. A
//   candidate whose ENTIRE text is a single GENERIC verb -- derived from the
//   corpus, never a hand list (DEC-180): a word that appears as the
//   complete, static, own-text of some control in
//   `GENERIC_VERB_MIN_COMPONENTS` or more DISTINCT files -- may not, alone,
//   produce PREMISE-FALSE. It needs corroboration from another finding among
//   the SAME rule's own matches that also resolves against a frame extent:
//   either a longer, multi-word run, or the identical token repeating the
//   same text elsewhere.
// ---------------------------------------------------------------------------

// Any static (non-composed), single-word (no internal whitespace) text
// finding is a GENERIC-VERB CANDIDATE; it is promoted to the actual
// generic-verb set only once the SAME word recurs as the complete own-text
// of controls in this many or more distinct files -- one bare-word
// coincidence names nothing, but a word repeating across unrelated
// components is exactly the shared-vocabulary shape this amendment guards
// against (DEC-180: derived from the corpus, never hand-listed).
export const GENERIC_VERB_MIN_COMPONENTS = 3;

/** Every single-word static text that recurs as the complete own-text of a
 * control in `GENERIC_VERB_MIN_COMPONENTS` or more distinct files across
 * `findings` -- pure over its input so the non-vacuity section can drive it
 * over synthetic fixtures. */
export function genericVerbsIn(
  findings: readonly TextFinding[],
  minComponents: number = GENERIC_VERB_MIN_COMPONENTS
): ReadonlySet<string> {
  const filesByWord = new Map<string, Set<string>>();
  for (const f of findings) {
    if (f.composed || /\s/.test(f.text)) continue; // multi-word runs are never "generic verbs"
    if (!filesByWord.has(f.text)) filesByWord.set(f.text, new Set());
    filesByWord.get(f.text)!.add(f.file);
  }
  const out = new Set<string>();
  for (const [word, files] of filesByWord) {
    if (files.size >= minComponents) out.add(word);
  }
  return out;
}

/** Whether `finding`'s own text is a generic-verb candidate requiring
 * corroboration: static, single-word, and a member of `genericVerbs`. */
function isUncorroboratedCandidate(finding: TextFinding, genericVerbs: ReadonlySet<string>): boolean {
  return !finding.composed && !/\s/.test(finding.text) && genericVerbs.has(finding.text);
}

/** Whether some OTHER finding among this rule's own `matches` corroborates
 * `f`'s frame match: a longer multi-word run that also resolves against a
 * frame extent, or the SAME token repeating the identical text (the rule's
 * own literal recurring, not a stranger's). Pure over its inputs so the
 * non-vacuity section can drive it over synthetic fixtures. */
export function hasCorroboration(
  f: TextFinding,
  matches: readonly TextFinding[],
  blobs: readonly FrameBlob[],
  genericVerbs: ReadonlySet<string> = new Set()
): boolean {
  return matches.some((g) => {
    if (g === f || g.composed) return false;
    if (!matchingFrame(g.text, blobs)) return false;
    if (isUncorroboratedCandidate(g, genericVerbs)) {
      // another equally-generic candidate corroborates only by sharing f's
      // OWN token (the rule's own literal recurring, not a second stranger).
      return g.token === f.token;
    }
    return true; // a multi-word (or non-generic) independent match corroborates on its own
  });
}

export type Grade = 'PREMISE-FALSE' | 'UNVERIFIABLE' | 'PREMISE-OK' | 'TWIN-RESOLVED';

export interface GradedRule {
  sheet: string;
  selector: string;
  grade: Grade;
  reason: string;
}

/** The wave-35 twin-detection clause (`phone-capability-removal.scan.
 * test.ts`'s own "desktop twin" receipt precedent, reused rather than
 * re-derived, DEC-613): some OTHER `chq-` token, never itself phone-hidden
 * anywhere in the tree, carrying the IDENTICAL static text on the SAME
 * cluster surface as `finding`. Pure over its inputs so the non-vacuity
 * section can drive it over synthetic fixtures. */
export function findTwin(
  finding: TextFinding,
  findings: readonly TextFinding[],
  hiddenTokens: ReadonlySet<string> = new Set(),
  surfaceKeyOf: (file: string) => string | undefined = clusterKeyForPath
): TextFinding | undefined {
  const surface = surfaceKeyOf(finding.file);
  if (surface === undefined) return undefined; // no surface to key a twin match on -- never treat two unrelated "undefined" surfaces as the same one
  return findings.find((t) => {
    if (t === finding || t.composed || t.text !== finding.text) return false;
    if (hiddenTokens.has(t.token)) return false;
    if (surfaceKeyOf(t.file) !== surface) return false;
    // A twin must be a SPECIFIC element, not a bulk container: the
    // balanced-close-tag walk (text-findings.ts) deliberately attributes
    // NESTED text up to an outer token (so a token hidden BEHIND further
    // markup is still found), which means a coarse outer wrapper token
    // (e.g. a page-root `chq-page`) absorbs every distinct string nested
    // anywhere inside it. A genuine twin label -- `.chq-detail-back-short`
    // for a hidden `.chq-detail-back-full`, this scan's own worked
    // precedent -- names exactly ONE static text in the whole findings
    // population; requiring that here (rather than hand-listing wrapper
    // token names, DEC-808) disqualifies the container case by what it
    // measurably does, not by what it is called.
    const distinctTextsForToken = new Set(
      findings.filter((o) => o.token === t.token && !o.composed).map((o) => o.text)
    );
    return distinctTextsForToken.size === 1;
  });
}

/** Grades one CSS rule's selector against a set of already-gathered text
 * findings and frame blobs -- pure, so the non-vacuity section can drive it
 * over fabricated inputs. Returns `undefined` if the selector's tokens
 * carry no text-bearing finding at all (outside this population). */
export function gradeRule(
  selector: string,
  findings: readonly TextFinding[],
  blobs: readonly FrameBlob[],
  hiddenTokens: ReadonlySet<string> = new Set(),
  surfaceKeyOf: (file: string) => string | undefined = clusterKeyForPath,
  genericVerbs: ReadonlySet<string> = new Set()
): GradedRule | undefined {
  const tokens = tokensOf(selector);
  const matches = findings.filter((f) => tokens.includes(f.token));
  if (matches.length === 0) return undefined;

  for (const f of matches) {
    if (f.composed) continue;
    const frame = matchingFrame(f.text, blobs);
    if (frame) {
      // Wave-39 amendment (DEC-725): a candidate whose entire text is a
      // single GENERIC control verb cannot, alone, condemn this rule --
      // it needs corroboration from another of THIS rule's own matches
      // (a multi-word run, or the same token's literal recurring).
      if (isUncorroboratedCandidate(f, genericVerbs) && !hasCorroboration(f, matches, blobs, genericVerbs)) {
        continue;
      }
      const twin = findTwin(f, findings, hiddenTokens, surfaceKeyOf);
      if (twin) {
        return {
          sheet: '',
          selector,
          grade: 'TWIN-RESOLVED',
          reason:
            `"${f.text}" (${f.file}) is drawn verbatim at ${frame.fileName}:${frame.line} "${frame.title}", ` +
            `but an identical, still-visible text child exists on the same phone surface: "${twin.text}" ` +
            `(${twin.file} :: ${twin.token}) -- the frame's requirement is met by that twin, not by the hidden element`,
        };
      }
      return {
        sheet: '',
        selector,
        grade: 'PREMISE-FALSE',
        reason: `"${f.text}" (${f.file}) is drawn verbatim at ${frame.fileName}:${frame.line} "${frame.title}"`,
      };
    }
  }

  const composedFinding = matches.find((f) => f.composed);
  if (composedFinding) {
    return {
      sheet: '',
      selector,
      grade: 'UNVERIFIABLE',
      reason: `${composedFinding.file} :: ${composedFinding.token} renders a composed (non-static) text child: "${composedFinding.text}" -- a static substring join can never verify a value assembled at render time`,
    };
  }

  return {
    sheet: '',
    selector,
    grade: 'PREMISE-OK',
    reason: `every static text child of [${tokens.join(', ')}] was checked against every width:390 frame extent and none matched`,
  };
}
