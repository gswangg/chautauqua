// DEC-124/DEC-958: the ONE top-of-form error summary -- one block, one
// anchor per problem, each anchor pointing at the offending field's own
// id. Renders the `.chq-error-summary` family declared in
// ./error-states.css, mirroring src/routes/public/cfp.css.ts's block so
// the public CFP builder and the admin SPA share one visual contract.

import { thingsNeedFixingHeading } from '../lib/plural';

/**
 * The top-of-form error summary heading -- 'One thing needs fixing before
 * this can be sent', 'Three things need fixing ...' (DEC-925/DEC-957: the
 * shared src/domain/count-copy.ts thingsNeedFixingHeading). `tail` is
 * appended after 'fixing ' (e.g. 'before this can be sent').
 */
export function countHeading(n: number, tail: string): string {
  return thingsNeedFixingHeading(n, tail);
}

export function ErrorSummary(props: {
  heading: string;
  kept?: string;
  problems: Array<{ anchorId: string; label: string }>;
  /** Optional additional class appended after `chq-error-summary` -- for a
   * caller whose heading/kept prose has its own v12 frame measure
   * (DEC-896 wave-52), never for altering the shared block's own chrome. */
  className?: string;
}) {
  const { heading, kept, problems, className } = props;
  return (
    <div className={className ? `chq-error-summary ${className}` : 'chq-error-summary'} role="alert">
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
