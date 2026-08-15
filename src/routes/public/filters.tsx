// DEC-919: the ONE filter idiom for every public list surface. Before this
// file existed, /sessions rendered a GET search form plus pill navs, /agenda
// and /schedule rendered a GET form whose track/format axes were <select>
// dropdowns (narrowing needed a submit), and /speakers/gallery rendered a
// third, differently-labelled search form with no filter axes at all. Every
// surface now renders PublicSearchBox for its keyword search and
// PublicFilterBar for each pill-narrowable axis; neither writes its own copy.

// DEC-433 amendment (wave 69): PublicSearchBox is the ONE `?q=` search
// control (also reused, via ItinerarySearchForm, on the agenda/schedule
// surfaces) — parseNameQuery/trimOrNullBounded (src/routes/public/query.ts)
// silently degrade any value over MAX_PUBLIC_QUERY_VALUE_LENGTH to null, so
// the box itself must declare that same cap via `maxlength` or an over-cap
// search submits, silently un-filters the list, and looks like a bug in the
// list rather than a rejected search. Sourced from the same bounds.ts the
// parser reads (never a copied number).
import { MAX_PUBLIC_QUERY_VALUE_LENGTH } from "../../server/repo/public/bounds";

/** The one keyword-search markup (DEC-919 amendment, wave 40): one compact
 * input at the head of the surface's single .chq-pub-filter-row, with no
 * visible label and no visible submit button — the row reads as one
 * narrowing gesture, not a labelled form stacked above pill navs. The label
 * and submit button are still emitted (visually hidden via
 * .chq-visually-hidden) so the form still works without JS and still
 * announces itself to assistive tech: a search form with no submit control
 * at all is a keyboard trap for anyone who cannot press Enter. `hidden`
 * carries whatever the caller's other active params are (trackId/format/
 * roomId/day/limit, ...) as already-built `<input type="hidden">` elements —
 * PublicSearchBox does not know each surface's knob table, it only renders
 * what it's handed. */
export function PublicSearchBox(props: { action: string; q: string | null; hidden?: unknown }) {
  const { action, q, hidden } = props;
  return (
    <form class="chq-pub-searchform" method="get" action={action} role="search">
      <label class="chq-visually-hidden" for="chq-pub-search-q">
        Search
      </label>
      <input
        class="chq-pub-search"
        id="chq-pub-search-q"
        type="search"
        name="q"
        value={q ?? ""}
        placeholder="Search"
        maxlength={MAX_PUBLIC_QUERY_VALUE_LENGTH}
      />
      {hidden as any}
      <button class="chq-visually-hidden" type="submit">
        Search
      </button>
    </form>
  );
}

// DEC-433 (wave 69 audit note): PublicFilterSelectForm has no free-text
// input to bound — `options` is a server-built closed set (track/format/room
// ids the repo layer already knows about), so there is no client-suppliable
// string here for a parser to silently degrade against. No maxlength needed.

/** v7 filter bar (design-pack v7, "Public filter bar — one idiom, four
 * surfaces"): a compact narrowing SELECT, one per facet, sitting beside the
 * search box on the surface's single .chq-pub-filter-row. Each select is its
 * own GET form (same idiom as agenda-controls.tsx's track-highlight control:
 * onchange auto-submits, a visually-hidden submit keeps the no-JS path and
 * assistive tech working) carrying the surface's OTHER active params as
 * hidden inputs so every facet composes with the rest. The pill-bar idiom is
 * dead on public surfaces — "four selects read as one control group; one
 * pill row plus two selects reads as five things." */
export function PublicFilterSelectForm(props: {
  action: string;
  name: string;
  allLabel: string;
  options: { value: string; label: string }[];
  activeValue: string | null;
  hidden?: unknown;
}) {
  const { action, name, allLabel, options, activeValue, hidden } = props;
  const id = `chq-pub-filter-${name}`;
  return (
    <form class="chq-pub-select-form" method="get" action={action}>
      <label class="chq-visually-hidden" for={id}>
        {allLabel}
      </label>
      <select class="chq-pub-select" id={id} name={name} onchange="this.form.submit()">
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option value={o.value} selected={o.value === activeValue ? true : undefined}>
            {o.label}
          </option>
        ))}
      </select>
      {hidden as any}
      <button class="chq-visually-hidden" type="submit">
        Apply
      </button>
    </form>
  );
}

/** v7 active-filter line: renders ONLY when at least one filter is set —
 * "9 of 18 sessions", one removable chip per active filter, and Clear.
 * Zero height at rest ("nothing is spent on that line at rest, and the
 * count answers the question filtering raises"). The caller owns chip
 * labels and clearing hrefs; this component owns the markup. */
export function PublicActiveFilters(props: {
  total: number;
  grandTotal: number;
  noun: string;
  chips: { label: string; clearHref: string }[];
  clearAllHref: string;
}) {
  const { total, grandTotal, noun, chips, clearAllHref } = props;
  if (chips.length === 0) return null;
  return (
    <div class="chq-pub-activefilters">
      <span class="chq-pub-activefilters-count">
        {total} of {grandTotal} {noun}
      </span>
      {chips.map((c) => (
        <a class="chq-pub-activefilters-chip" href={c.clearHref} aria-label={`Remove filter: ${c.label}`}>
          {c.label} <span aria-hidden="true">×</span>
        </a>
      ))}
      <a class="chq-pub-activefilters-clear" href={clearAllHref}>
        Clear
      </a>
    </div>
  );
}

