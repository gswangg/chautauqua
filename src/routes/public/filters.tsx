// DEC-919: the ONE filter idiom for every public list surface. Before this
// file existed, /sessions rendered a GET search form plus pill navs, /agenda
// and /schedule rendered a GET form whose track/format axes were <select>
// dropdowns (narrowing needed a submit), and /speakers/gallery rendered a
// third, differently-labelled search form with no filter axes at all. Every
// surface now renders PublicSearchBox for its keyword search and
// PublicFilterBar for each pill-narrowable axis; neither writes its own copy.

/** The one keyword-search markup: one label ('Search'), one placeholder, one
 * form shape. `hidden` carries whatever the caller's other active params are
 * (trackId/format/roomId/day/limit, ...) as already-built `<input
 * type="hidden">` elements — PublicSearchBox does not know each surface's
 * knob table, it only renders what it's handed. */
export function PublicSearchBox(props: { action: string; q: string | null; hidden?: unknown }) {
  const { action, q, hidden } = props;
  return (
    <form method="get" action={action} role="search">
      <label>
        Search
        <input type="search" name="q" value={q ?? ""} placeholder="Title or speaker name" />
      </label>
      {hidden as any}
      <button type="submit">Search</button>
    </form>
  );
}

/** The one pill-bar markup: an "All ..." pill plus one pill per option,
 * aria-current on whichever is active. `hrefFor(value)` builds the full href
 * for a given option value (or `null` for the "All ..." pill) — the caller
 * owns param composition (which other active filters/day/q carry forward),
 * this component only owns the markup and the active-state wiring. */
export function PublicFilterBar(props: {
  ariaLabel: string;
  allLabel: string;
  options: { value: string; label: string }[];
  activeValue: string | null;
  hrefFor: (value: string | null) => string;
}) {
  const { ariaLabel, allLabel, options, activeValue, hrefFor } = props;
  return (
    <nav aria-label={ariaLabel} class="chq-pub-filter-bar">
      <a class="chq-pub-pill" href={hrefFor(null)} aria-current={activeValue === null ? "true" : undefined}>
        {allLabel}
      </a>
      {options.map((o) => (
        <a class="chq-pub-pill" href={hrefFor(o.value)} aria-current={activeValue === o.value ? "true" : undefined}>
          {o.label}
        </a>
      ))}
    </nav>
  );
}
