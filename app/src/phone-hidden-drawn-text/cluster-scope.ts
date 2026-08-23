// Cluster scoping (wave-35 amendment, DEC-725/DEC-808): a sheet's frame
// join is narrowed to the ONE frame file its cluster owns, with an
// explicit, asserted fallback to the full pack for shared roots and for
// clusters the pack draws no same-named frame for. The SAME normalisation
// (`clusterKeyForPath`) also keys twin-detection's "same phone surface"
// test in grade.ts, so the two amendments share one population key rather
// than growing two private notions of "surface" (DEC-613). Extracted
// (contention decomposition, no behavior change) from
// app/src/phone-hidden-drawn-text.scan.test.ts, which re-exports these
// symbols verbatim.
import { capitalizeFirst } from '../../../src/domain/count-copy';
import type { FrameBlob } from './frame-blobs';

const PAGES_PREFIX = 'app/src/pages/';

/** The cluster key a REPO_ROOT-relative path belongs to, or `undefined` if
 * the path names no cluster (a shared root, or a tree this ledger's
 * mapping does not cover). Derived purely from the path string -- never a
 * hand list (DEC-808). */
export function clusterKeyForPath(relPath: string): string | undefined {
  if (relPath.startsWith(PAGES_PREFIX)) {
    const rest = relPath.slice(PAGES_PREFIX.length);
    const firstSeg = rest.split('/')[0]!;
    // A root-level file directly under app/src/pages (no cluster
    // subdirectory, e.g. `Agenda.tsx` or `not-found.css`) still names its
    // own cluster by its own base name (`Agenda.tsx` -> `agenda`, matching
    // `app/src/pages/agenda/*`'s own key) -- this is what lets a TSX
    // finding in the top-level page component join the same surface as its
    // subcomponents' findings and its cluster's CSS sheet.
    const base = firstSeg.includes('.') ? firstSeg.split('.')[0]! : firstSeg;
    return base.toLowerCase();
  }
  if (relPath.startsWith('src/routes/public/') || relPath.startsWith('src/routes/portal/')) return 'public-portal';
  if (relPath.startsWith('src/routes/docs')) return 'docs';
  return undefined;
}

/** The `docs/design/*.dc.html` file name a cluster key's OWN frame would
 * carry, were one to exist -- existence against the pack's real file list
 * is checked by the caller (`scopeBlobsForSheet`), never assumed here. */
function frameFileNameForClusterKey(key: string): string {
  if (key === 'public-portal') return 'Chautauqua Public and Portal.dc.html';
  if (key === 'docs') return 'Chautauqua Docs.dc.html';
  return `Chautauqua ${capitalizeFirst(key)}.dc.html`;
}

// Sheets whose join EXPLICITLY stays full-pack -- never narrowed, because
// their rules are not owned by any one cluster's frame (asserted by name in
// the non-vacuity section below, so a future shared root can't silently
// inherit whichever behaviour this set's absence would produce).
const SHARED_ROOT_SHEETS = new Set(['app/src/styles.css', 'src/views/theme.ts']);

export interface SheetScope {
  blobs: FrameBlob[];
  kind: 'cluster' | 'shared-root' | 'no-frame-fallback';
  frameFile: string | undefined;
}

/** The frame-extent population a CSS rule from `sheet` is graded against.
 * Pure over its `allBlobs`/`knownFrameFiles` inputs so the non-vacuity
 * section can drive it over synthetic fixtures without touching the real
 * design pack. */
export function scopeBlobsForSheet(
  sheet: string,
  allBlobs: readonly FrameBlob[],
  knownFrameFiles: ReadonlySet<string>
): SheetScope {
  if (SHARED_ROOT_SHEETS.has(sheet)) {
    return { blobs: [...allBlobs], kind: 'shared-root', frameFile: undefined };
  }
  const key = clusterKeyForPath(sheet);
  const frameFile = key === undefined ? undefined : frameFileNameForClusterKey(key);
  if (frameFile === undefined || !knownFrameFiles.has(frameFile)) {
    return { blobs: [...allBlobs], kind: 'no-frame-fallback', frameFile: undefined };
  }
  return { blobs: allBlobs.filter((b) => b.fileName === frameFile), kind: 'cluster', frameFile };
}
