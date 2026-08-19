// EventSwitchBanner (w4-s, DEC-728 amendment / USER RULING D19): a URL
// eventId that silently overwrote a DIFFERENT stored event context now
// announces itself -- "Switched to <B> · Back to <A>" -- with a one-click
// restore. Mounted by EventSwitcher (../components/EventSwitcher.tsx), so
// it shares that component's one nav mount point across every page.
// Renders nothing until useCurrentEvent() has resolved BOTH event names
// from loadEventsOnce() (never an id in place of a name), and nothing at
// all when the URL eventId matched what was already stored -- see
// useCurrentEvent.ts's `switchInfo`.
import { useCurrentEvent } from '../lib/useCurrentEvent';
import './event-switcher.css';

export function EventSwitchBanner() {
  const { switchInfo } = useCurrentEvent();
  if (!switchInfo) return null;
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
