// EventSwitchBanner (w4-s, DEC-728 amendment / USER RULING D19): a URL
// eventId that silently overwrote a DIFFERENT stored event context now
// announces itself -- "Switched to <B> · Back to <A>" -- with a one-click
// restore. Mounted by EventSwitcher (../components/EventSwitcher.tsx), so
// it shares that component's one nav mount point across every page.
// Renders nothing until useCurrentEvent() has resolved the event name(s)
// in play from loadEventsOnce() (never an id in place of a name), and
// nothing at all when the URL eventId matched what was already stored --
// see useCurrentEvent.ts's `switchInfo`.
//
// DEC-728 wave-117: `switchInfo` is a discriminated union covering the
// two additional D19 clauses -- 'switched-no-restore' (URL id resolved,
// prior stored id no longer does: announce, no Back link) and 'kept' (URL
// id did NOT resolve, a different prior stored id did: the hook already
// restored it, this just says so; no Back link, nothing to go back to).
import { useCurrentEvent } from '../lib/useCurrentEvent';
import './event-switcher.css';

export function EventSwitchBanner() {
  const { switchInfo } = useCurrentEvent();
  if (!switchInfo) return null;

  if (switchInfo.kind === 'kept') {
    return (
      <div className="chq-event-switch-banner" role="status">
        <span className="chq-event-switch-banner-text">Kept {switchInfo.keptEvent.name}</span>
      </div>
    );
  }

  if (switchInfo.kind === 'switched-no-restore') {
    return (
      <div className="chq-event-switch-banner" role="status">
        <span className="chq-event-switch-banner-text">Switched to {switchInfo.toEvent.name}</span>
      </div>
    );
  }

  const { fromEvent, toEvent, restore } = switchInfo;
  return (
    <div className="chq-event-switch-banner" role="status">
      <span className="chq-event-switch-banner-text">Switched to {toEvent.name}</span>
      <span className="chq-event-switch-banner-sep" aria-hidden="true">
        ·
      </span>
      <button type="button" className="chq-event-switch-banner-restore" onClick={restore}>
        Back to {fromEvent.name}
      </button>
    </div>
  );
}
