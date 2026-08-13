// DEC-969: one menu primitive, adopted by both popup menus. Exercises the
// hook in isolation with a minimal menu harness (a trigger + a panel with
// three menuitem buttons) rather than via either call site.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { useMenu } from './useMenu';

function Harness() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { containerRef, onPanelKeyDown } = useMenu(open, close);

  return (
    <div ref={containerRef}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Open menu
      </button>
      {open && (
        <div role="menu" aria-label="Test menu" onKeyDown={onPanelKeyDown}>
          <button type="button" role="menuitem" onClick={close}>
            First
          </button>
          <button type="button" role="menuitem" onClick={close}>
            Second
          </button>
          <button type="button" role="menuitem" onClick={close}>
            Third
          </button>
        </div>
      )}
    </div>
  );
}

afterEach(() => cleanup());

describe('useMenu (DEC-969)', () => {
  it('focuses the first menu item when the menu opens', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const first = await screen.findByRole('menuitem', { name: 'First' });
    expect(first).toHaveFocus();
  });

  it('ArrowDown/ArrowUp rove across items with wrap', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = await screen.findByRole('menu');
    const first = screen.getByRole('menuitem', { name: 'First' });
    const second = screen.getByRole('menuitem', { name: 'Second' });
    const third = screen.getByRole('menuitem', { name: 'Third' });

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(second).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(third).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(first).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(third).toHaveFocus();
  });

  it('Home/End jump to the first/last item', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = await screen.findByRole('menu');
    const first = screen.getByRole('menuitem', { name: 'First' });
    const third = screen.getByRole('menuitem', { name: 'Third' });

    fireEvent.keyDown(menu, { key: 'End' });
    expect(third).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(first).toHaveFocus();
  });

  it('a pointerdown outside the container closes the menu', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await screen.findByRole('menu');

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('a pointerdown inside the container does not close the menu', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = await screen.findByRole('menu');

    fireEvent.pointerDown(menu);

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('Escape closes the menu', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await screen.findByRole('menu');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('returns focus to the [aria-haspopup] trigger on close (Escape, outside press, or item selection)', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });

    fireEvent.click(trigger);
    await screen.findByRole('menu');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    await screen.findByRole('menu');
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    await screen.findByRole('menu');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Second' }));
    expect(trigger).toHaveFocus();
  });

  it('removes its document listeners when the menu closes', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await screen.findByRole('menu');
    expect(addSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(removeSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('removes its document listeners on unmount while open', async () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await screen.findByRole('menu');

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    removeSpy.mockRestore();
  });
});
