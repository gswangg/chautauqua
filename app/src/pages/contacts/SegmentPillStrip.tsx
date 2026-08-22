// src/decisions-data/DEC-919.md (Amendment wave 16): the Contacts 390 landing narrows with the
// frame's two chip strips, not with the desktop rule builder and rail --
// this is the SECOND strip (docs/design/Chautauqua Contacts.dc.html:194-198,
// "All" / "Speakers · 41" / "Reviewers"), re-lining the existing
// `.chq-contacts-tab-filters` saved-segment <select> as pills rather than
// minting a second filter surface. Counts are NOT recomputed here --
// Segment.count already arrives from GET /segments computed with the SAME
// where clause the directory list uses (DEC-710).
import { DEC_919, DEC_930 } from '../../../../src/decisions';
import type { Segment } from './types';

void DEC_919;
void DEC_930;

interface Props {
  segments: Segment[];
  segmentsLoaded: boolean;
  segmentId: string;
  onApplySegment: (segmentId: string) => void;
}

export function SegmentPillStrip({ segments, segmentsLoaded, segmentId, onApplySegment }: Props) {
  // src/decisions-data/DEC-678.md (Amendment wave-16 r4): a settled-empty
  // single-option filter strip stands down rather than rendering a lone
  // inert control -- a chooser with exactly one option (the already-
  // pressed `All` pill) asserts a choice the data cannot offer. Gated on
  // BOTH `segmentsLoaded` and `segments.length === 0`, never length alone,
  // so a momentarily-empty array during a load never blanks the head band.
  if (segmentsLoaded && segments.length === 0) {
    return null;
  }
  return (
    // src/decisions-data/DEC-930.md (amendment): this narrowing strip draws
    // no caption of its own, so the group takes an aria-label naming what
    // it narrows by.
    <div className="chq-chipstrip chq-contacts-segment-pills" role="group" aria-label="Filter by saved segment">
      <button
        type="button"
        className={segmentId === '' ? 'chq-pill is-active' : 'chq-pill'}
        aria-pressed={segmentId === ''}
        onClick={() => onApplySegment('')}
      >
        All
      </button>
      {/* DEC-678: an absence is only asserted from a settled load -- before
          `segmentsLoaded`, only the always-present All pill renders, never
          a momentarily-empty strip that reads as "no segments exist". */}
      {segmentsLoaded &&
        segments.map((s) => (
          <button
            key={s.id}
            type="button"
            className={segmentId === s.id ? 'chq-pill is-active' : 'chq-pill'}
            aria-pressed={segmentId === s.id}
            onClick={() => onApplySegment(s.id)}
          >
            {s.name} · {s.count}
          </button>
        ))}
    </div>
  );
}
