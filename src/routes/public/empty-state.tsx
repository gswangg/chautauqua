// DEC-919 (wave 47 amendment): ONE zero-state renderer for every public
// (server-rendered) list surface. Before this file existed each surface
// picked its own bare sentence with no fresh/filtered split, no named facet,
// no escape, and the filter bar left standing over a search that matched
// nothing (sessions.tsx:340-342, speakers.tsx:225-226/287-288).
//
// DESIGN-RULINGS §B7 rule 3 settles the part that differs from the admin
// EmptyState (app/src/components/EmptyState.tsx, DEC-678): where the
// visitor genuinely cannot act -- an attendee waiting on a programme that
// isn't published yet -- there is NO button at all, never a disabled one.
// This component therefore has NO action prop AT ALL (not even an optional
// one that callers could pass by mistake) -- no public surface can grow a
// primary button through this component by construction. The 'filtered'
// escape is a plain <a href>, never a <button onClick>: SSR has no
// client-side handler to attach, so the only correct escape is a real link
// to the surface's bare (unfiltered) path.
//
// 'fresh' (the collection has never held anything -- no schedule published,
// no speakers announced yet) renders `what` + optional `reason` and NOTHING
// else; the CALLER is responsible for not rendering the filter bar above it
// (there is nothing to filter). 'filtered' (the collection is empty only
// because of a facet the visitor applied) renders `what` + `reason` naming
// the facet(s) in flight + an escape link back to the bare surface path --
// the filter bar stays mounted above it in the caller's markup.
export function PublicEmptyState(props: {
  variant: "fresh" | "filtered";
  what: string;
  reason?: string;
  escapeHref?: string;
  escapeLabel?: string;
}) {
  const { variant, what, reason, escapeHref, escapeLabel } = props;
  // Fail loudly rather than silently dropping a prop the variant forbids --
  // a caller passing an escape on 'fresh' (there is no filter to clear) or
  // omitting one on 'filtered' has misread the split, and quietly ignoring
  // the mistake would let it ship unnoticed (mirrors app/src/components/
  // EmptyState.tsx's DEC-678 throw).
  if (variant === "fresh" && (escapeHref || escapeLabel)) {
    throw new Error("PublicEmptyState: variant 'fresh' must never render an escape (there is no filter to clear).");
  }
  if (variant === "filtered" && (!escapeHref || !escapeLabel)) {
    throw new Error("PublicEmptyState: variant 'filtered' requires both escapeHref and escapeLabel.");
  }
  return (
    <div class={variant === "fresh" ? "chq-pub-empty-block chq-pub-empty-block-fresh" : "chq-pub-empty-block chq-pub-empty-block-filtered"}>
      <p class="chq-pub-empty-what">{what}</p>
      {reason ? <p class="chq-pub-empty-reason">{reason}</p> : null}
      {variant === "filtered" ? (
        <a class="chq-pub-accent-link chq-pub-empty-escape" href={escapeHref}>
          {escapeLabel}
        </a>
      ) : null}
    </div>
  );
}
