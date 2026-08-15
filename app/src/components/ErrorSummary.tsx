// DEC-124/DEC-958: the ONE top-of-form error summary -- one block, one
// anchor per problem, each anchor pointing at the offending field's own
// id. Renders the `.chq-error-summary` family declared in
// ./error-states.css, mirroring src/routes/public/cfp.css.ts's block so
// the public CFP builder and the admin SPA share one visual contract.

import { plural, spellCount } from '../lib/plural';

function capitalizeFirst(s: string): string {
  return s.length === 0 ? s : `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
}

/**
 * Spells 0-10 ('Zero' .. 'Ten'), falls back to digits above 10 (DEC-925: the
 * shared src/domain/count-copy.ts spellCount, capitalized for a sentence
 * head). Pairs the count with the correct singular/plural verb+noun -- 'One
 * thing needs fixing', 'Three things need fixing' -- and appends `tail`
 * (e.g. 'before this can be sent').
 */
export function countHeading(n: number, tail: string): string {
  const word = capitalizeFirst(spellCount(n));
  const noun = `${plural(n, 'thing')} ${plural(n, 'needs', 'need')}`;
  return `${word} ${noun} fixing ${tail}`;
}

export function ErrorSummary(props: {
  heading: string;
  kept?: string;
  problems: Array<{ anchorId: string; label: string }>;
}) {
  const { heading, kept, problems } = props;
  return (
    <div className="chq-error-summary" role="alert">
      <h2>{heading}</h2>
      {kept && <p>{kept}</p>}
      <ul>
        {problems.map((p) => (
          <li key={p.anchorId}>
            <a className="chq-error-summary-link" href={'#' + p.anchorId}>
              {p.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
