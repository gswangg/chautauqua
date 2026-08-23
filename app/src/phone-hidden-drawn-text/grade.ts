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
  surfaceKeyOf: (file: string) => string | undefined = clusterKeyForPath
): GradedRule | undefined {
  const tokens = tokensOf(selector);
  const matches = findings.filter((f) => tokens.includes(f.token));
  if (matches.length === 0) return undefined;

  for (const f of matches) {
    if (f.composed) continue;
    const frame = matchingFrame(f.text, blobs);
    if (frame) {
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
