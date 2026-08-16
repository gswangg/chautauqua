import { Link } from 'react-router-dom';
import { DEC_678 } from '../../../src/decisions';

// DEC-678 amendment (B7): `.chq-empty` is one muted 14px line reused
// everywhere and cannot express the fresh-vs-filtered distinction ruling B7
// makes load-bearing:
//
// - 'fresh' (the collection has never held anything) hides the filter
//   chrome, gets 44px of top room, and offers ONE real primary action --
//   never an escape link (there is no filter to clear).
// - 'filtered' (the collection is empty because of a facet the user
//   applied) keeps its chrome visible ABOVE the message, is tighter at
//   30px, names the excluding facet in `reason`, and offers an escape link
//   that clears exactly that facet -- never a primary action button (the
//   fix is "change the filter", not "do a new thing").
//
// Neither variant ever renders a disabled control, an illustration, or a
// centred hero -- this component enforces that by construction rather than
// trusting each call site to remember the rule.
void DEC_678;

export interface EmptyStateAction {
  label: string;
  to?: string;
  onClick?: () => void;
}

export interface EmptyStateEscape {
  label: string;
  onClick: () => void;
}

export interface EmptyStateSecondary {
  label: string;
  // G13 lane-D (02-submissions--08): same to/onClick duality as
  // EmptyStateAction — a secondary can open a dialog ('Add one by hand ›')
  // rather than navigate.
  to?: string;
  onClick?: () => void;
}

export interface EmptyStateProps {
  variant: 'fresh' | 'filtered';
  what: string;
  reason?: string;
  action?: EmptyStateAction | null;
  escape?: EmptyStateEscape | null;
  // DEC-370 amendment (wave 47): a second, lower-emphasis link beside the
  // primary action -- permitted ONLY on 'fresh' (a 'filtered' empty state
  // never gets a primary action either, so there is nothing for a
  // secondary link to sit beside).
  secondary?: EmptyStateSecondary | null;
}

export function EmptyState({ variant, what, reason, action, escape, secondary }: EmptyStateProps) {
  // Fail loudly rather than silently dropping a prop the variant forbids --
  // a caller that passes `action` on a 'filtered' empty state, or `escape`
  // on a 'fresh' one, has misread B7's split, and a component that quietly
  // ignored the wrong prop would let that mistake ship unnoticed.
  if (variant === 'filtered' && action) {
    throw new Error("EmptyState: variant 'filtered' must never render `action` (B7: no primary button over a filter).");
  }
  if (variant === 'fresh' && escape) {
    throw new Error("EmptyState: variant 'fresh' must never render `escape` (there is no filter to clear).");
  }
  if (variant === 'filtered' && secondary) {
    throw new Error("EmptyState: variant 'filtered' must never render `secondary` (B7: no primary button over a filter, so nothing for a secondary link to sit beside).");
  }

  return (
    // DEC-976/DEC-970: the class token is written out in full per variant
    // rather than interpolated. An interpolated `chq-empty-block-${variant}`
    // is invisible to the CSS-contract scan in both directions -- it reads as
    // a partial token `chq-empty-block-` with no rule, and it leaves the real
    // -fresh/-filtered rules looking dead.
    <div className={variant === 'fresh' ? 'chq-empty-block chq-empty-block-fresh' : 'chq-empty-block chq-empty-block-filtered'}>
      <p className="chq-empty-what">{what}</p>
      {reason && <p className="chq-empty-reason">{reason}</p>}
      {(action || secondary) && (
        <div className="chq-empty-actions">
          {action &&
            (action.to ? (
              <Link to={action.to} className="chq-btn chq-btn-primary">
                {action.label}
              </Link>
            ) : (
              <button type="button" className="chq-btn chq-btn-primary" onClick={action.onClick}>
                {action.label}
              </button>
            ))}
          {secondary &&
            (secondary.to ? (
              <Link to={secondary.to} className="chq-btn chq-btn-tertiary">
                {secondary.label}
              </Link>
            ) : (
              <button type="button" className="chq-btn chq-btn-tertiary" onClick={secondary.onClick}>
                {secondary.label}
              </button>
            ))}
        </div>
      )}
      {escape && (
        <button type="button" className="chq-link-button chq-empty-escape" onClick={escape.onClick}>
          {escape.label}
        </button>
      )}
    </div>
  );
}
