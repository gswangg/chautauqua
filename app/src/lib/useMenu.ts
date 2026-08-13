// DEC-969: one menu primitive, adopted by both popup menus (EventSwitcher's
// event menu and ParticipationMenu's status menu). Owns the behaviour every
// popup menu needs: outside-pointerdown dismissal, initial focus on open,
// roving arrow/Home/End navigation across [role^="menuitem"] items, Escape
// dismissal, and returning focus to the `[aria-haspopup]` trigger whenever
// the menu closes for any reason (Escape, outside press, or an item's own
// onClick calling `close`).
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';

export interface UseMenuResult {
  containerRef: RefObject<HTMLDivElement>;
  onPanelKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => void;
}

function menuItems(container: HTMLElement | null): HTMLElement[] {
  return Array.from(container?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
}

export function useMenu(open: boolean, close: () => void): UseMenuResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) {
        containerRef.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
      }
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;

    // Focus the panel's first menu item as soon as it mounts.
    menuItems(containerRef.current)[0]?.focus();

    function onPointerDown(e: PointerEvent) {
      const container = containerRef.current;
      if (container && e.target instanceof Node && !container.contains(e.target)) {
        close();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  function onPanelKeyDown(e: ReactKeyboardEvent<HTMLElement>) {
    const items = menuItems(containerRef.current);
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(currentIndex + 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  return { containerRef, onPanelKeyDown };
}
