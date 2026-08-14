import './page-skeleton.css';

// DEC-678 (wave-3 amendment): the ONE loading-structure primitive for a
// page's MAIN region. DelayedLoading (DelayedLoading.tsx) is correct for an
// inline sub-region wait inside an already-structured page -- it withholds
// its indicator for 250ms so a fast response never flickers. It is WRONG
// for a whole page: withholding structure for 250ms still means the first
// N frames render nav + a bare <h1> over an empty <main>, which two
// independent SBEK run-4 captures (/admin/review, per-plan Results/
// Speakers) read as broken. PageSkeleton renders on the FIRST frame -- no
// timer -- because a placeholder shaped like the page arriving is never a
// flicker risk the way a real "Loading…" string is; the risk DEC-678 opened
// with was about *label* flicker, not *structure* flicker.

export type PageSkeletonVariant = 'table' | 'list' | 'detail';

interface PageSkeletonProps {
  /** Number of placeholder rows/entries to render. */
  rows?: number;
  /** Shape of the placeholder content, matching what the page renders once loaded. */
  variant?: PageSkeletonVariant;
  /** Screen-reader-only label announced via the visually-hidden text and aria-busy region. */
  label?: string;
}

function TableRows({ rows }: { rows: number }) {
  return (
    <div className="chq-skeleton-frame">
      {Array.from({ length: rows }, (_, i) => (
        <div className="chq-skeleton-row chq-skeleton-row-table" key={i}>
          <span className="chq-skeleton-bar chq-skeleton-bar-wide" />
          <span className="chq-skeleton-bar chq-skeleton-bar-narrow" />
          <span className="chq-skeleton-bar chq-skeleton-bar-narrow" />
        </div>
      ))}
    </div>
  );
}

function ListRows({ rows }: { rows: number }) {
  return (
    <div className="chq-skeleton-frame">
      {Array.from({ length: rows }, (_, i) => (
        <div className="chq-skeleton-row chq-skeleton-row-list" key={i}>
          <span className="chq-skeleton-bar chq-skeleton-bar-ref" />
          <span className="chq-skeleton-bar chq-skeleton-bar-title" />
          <span className="chq-skeleton-bar chq-skeleton-bar-meta" />
        </div>
      ))}
    </div>
  );
}

function DetailRows({ rows }: { rows: number }) {
  const perColumn = Math.max(1, Math.ceil(rows / 2));
  return (
    <div className="chq-skeleton-detail">
      <span className="chq-skeleton-bar chq-skeleton-bar-title-lg" />
      <div className="chq-skeleton-detail-columns">
        <div className="chq-skeleton-detail-col">
          {Array.from({ length: perColumn }, (_, i) => (
            <span className="chq-skeleton-bar chq-skeleton-bar-wide" key={i} />
          ))}
        </div>
        <div className="chq-skeleton-detail-col">
          {Array.from({ length: rows - perColumn }, (_, i) => (
            <span className="chq-skeleton-bar chq-skeleton-bar-wide" key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders, on the first frame (no timer, no delay), a placeholder shaped
 * like the page's coming content: `variant="table"` gives full-width bars
 * in a bordered frame, `"list"` gives ref/title/meta stacks, `"detail"`
 * gives a title bar plus two columns. Carries `role="status"` +
 * `aria-busy="true"` and a visually-hidden label so a screen reader
 * announces the wait instead of silence.
 */
export function PageSkeleton({ rows = 6, variant = 'table', label = 'Loading…' }: PageSkeletonProps) {
  // No `chq-skeleton-${variant}` modifier on the container: the variant
  // already selects which subtree renders below, and each subtree carries
  // its own shape classes, so a container modifier would be a class with no
  // rule (and `chq-skeleton-detail` would collide with the inner wrapper of
  // the same name).
  return (
    <div className="chq-skeleton" role="status" aria-busy="true">
      <span className="chq-skeleton-sr-label">{label}</span>
      {variant === 'table' && <TableRows rows={rows} />}
      {variant === 'list' && <ListRows rows={rows} />}
      {variant === 'detail' && <DetailRows rows={rows} />}
    </div>
  );
}
