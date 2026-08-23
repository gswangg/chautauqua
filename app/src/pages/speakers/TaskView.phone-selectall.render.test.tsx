// DEC-989 wave-54 (task w54-c): the task view's phone select-all. The
// terminal @media(max-width:700px) block in task-view.css hides
// `.chq-taskview-head-row` (the ONLY host of the desktop select-all
// checkbox) on phone, so the always-mounted bulk bar grows an `All {n}`
// control -- the house's one existing select-all idiom (DEC-825,
// ContentApp.tsx :414's `All {items.length}`), calling the same
// `toggleAll` the head-row checkbox calls. Exactly one such control is
// ever mounted (React renders one branch of the idle/armed ternary at a
// time), reachable whether or not anything is already selected.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TaskView } from './TaskView';
import { mockApi } from '../../test-utils/mockApi';
import type { TaskViewResponse, TaskViewRow } from './taskRoster';

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK_ID = 'task-hotel';
const EVENT_ID = 'evt-1';
const DAY = 24 * 60 * 60 * 1000;

function row(overrides: Partial<TaskViewRow> & Pick<TaskViewRow, 'contactId' | 'name'>): TaskViewRow {
  return {
    company: 'Latticework Systems',
    assignmentId: `as-${overrides.contactId}`,
    status: 'pending',
    completedAt: null,
    assignedAt: Date.now() - 6 * DAY,
    lastRemindedAt: null,
    remindCount: 0,
    fileId: null,
    fileName: null,
    answerSummary: null,
    overdue: false,
    ...overrides,
  };
}

const ANSWERED: TaskViewRow[] = [
  row({ contactId: 'ct-priya', name: 'Priya Raman', status: 'complete', completedAt: Date.now() - 14 * DAY }),
  row({ contactId: 'ct-iris', name: 'Iris Bell', status: 'complete', completedAt: Date.now() - 10 * DAY }),
];

const WAITING: TaskViewRow[] = [
  row({ contactId: 'ct-ruth', name: 'Ruth Adeyemi' }),
  row({ contactId: 'ct-marcus', name: 'Marcus Okafor' }),
  row({ contactId: 'ct-tomas', name: 'Tomas Bell' }),
];

function payload(): TaskViewResponse {
  const rows = [...ANSWERED, ...WAITING];
  return {
    task: {
      id: TASK_ID,
      eventId: EVENT_ID,
      kind: 'form',
      title: 'Hotel stay form',
      dueDate: Date.UTC(2027, 7, 15),
      required: true,
      formId: 'form-1',
      instructions: null,
    },
    timezone: 'UTC',
    rows,
    counts: { assigned: rows.length, complete: 2, pending: rows.length - 2, answered: 2 },
  };
}

async function mountLoaded() {
  mockApi({ [`GET /api/v1/tasks/${TASK_ID}/roster`]: payload() });
  render(
    <MemoryRouter initialEntries={[`/speakers/tasks/${TASK_ID}`]}>
      <Routes>
        <Route path="/speakers/tasks/:taskId" element={<TaskView />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Hotel stay form' });
}

afterEach(() => {
  cleanup();
});

describe('DEC-989 wave-54: task view phone select-all (`.chq-taskview-bulk-selectall`)', () => {
  it('exactly one "All N" control is mounted, idle, matching the answered tab count', async () => {
    await mountLoaded();

    const controls = screen.getAllByRole('button', { name: `All ${ANSWERED.length}` });
    expect(controls).toHaveLength(1);
    expect(controls[0]).toHaveClass('chq-taskview-bulk-selectall');
  });

  it('clicking it selects every row on the active (answered) tab, and clicking again clears', async () => {
    await mountLoaded();

    fireEvent.click(screen.getByRole('button', { name: `All ${ANSWERED.length}` }));
    expect(screen.getByText(`${ANSWERED.length} selected`)).toBeInTheDocument();
    for (const r of ANSWERED) {
      expect(screen.getByRole('checkbox', { name: `Select ${r.name}` })).toBeChecked();
    }

    // Still reachable once armed -- same control, same handler.
    const armed = screen.getByRole('button', { name: `All ${ANSWERED.length}` });
    expect(armed).toHaveClass('chq-taskview-bulk-selectall');
    fireEvent.click(armed);
    expect(screen.queryByText(`${ANSWERED.length} selected`)).not.toBeInTheDocument();
    for (const r of ANSWERED) {
      expect(screen.getByRole('checkbox', { name: `Select ${r.name}` })).not.toBeChecked();
    }
  });

  it('switching to the waiting tab shows "All N" for that tab\'s own row count', async () => {
    await mountLoaded();

    fireEvent.click(screen.getByRole('button', { name: /Still waiting/ }));
    const controls = screen.getAllByRole('button', { name: `All ${WAITING.length}` });
    expect(controls).toHaveLength(1);

    fireEvent.click(controls[0]!);
    expect(screen.getByText(`${WAITING.length} selected`)).toBeInTheDocument();
  });
});

describe('DEC-385 single-direction: the top-level rule is display:none, floored only in the terminal phone block', () => {
  const css = readFileSync(join(HERE, 'task-view.css'), 'utf8');

  function firstTopLevelRuleBody(cssText: string, selector: string): string {
    // Only search the text BEFORE the terminal phone block, so this can
    // never accidentally match the phone-block copy of the same selector.
    const phoneIdx = cssText.indexOf('@media (max-width: 700px)');
    const topLevelText = phoneIdx === -1 ? cssText : cssText.slice(0, phoneIdx);
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
    const m = re.exec(topLevelText);
    if (!m || m[1] === undefined) throw new Error(`top-level rule not found: ${selector}`);
    return m[1];
  }

  function phoneBlockBody(cssText: string): string {
    const idx = cssText.indexOf('@media (max-width: 700px)');
    if (idx === -1) throw new Error('no terminal phone block found');
    const braceStart = cssText.indexOf('{', idx);
    let depth = 1;
    let i = braceStart + 1;
    for (; i < cssText.length && depth > 0; i++) {
      if (cssText[i] === '{') depth++;
      else if (cssText[i] === '}') depth--;
    }
    return cssText.slice(braceStart + 1, i - 1);
  }

  it('the top-level `.chq-taskview-bulk-selectall` rule is display:none', () => {
    const body = firstTopLevelRuleBody(css, '.chq-taskview-bulk-selectall');
    expect(body).toMatch(/display:\s*none/);
  });

  it('the 44px floor for `.chq-taskview-bulk-selectall` lives only inside the terminal phone block', () => {
    const phoneBody = phoneBlockBody(css);
    const floorRe = /\.chq-taskview-bulk-selectall\s*\{([^}]*)\}/;
    const m = floorRe.exec(phoneBody);
    expect(m).not.toBeNull();
    const decl = m![1] as string;
    expect(decl).toMatch(/min-height:\s*44px/);
    expect(decl).toMatch(/display:\s*flex/);
    expect(decl).toMatch(/align-items:\s*center/);
    expect(decl).toMatch(/padding-inline:\s*[1-9]/);

    // Outside the phone block, no OTHER rule re-declares min-height for
    // this selector (the file has exactly one terminal phone block per
    // test/phone-terminal-block.scan.test.ts, so this is really just a
    // sanity check that the floor rule text itself only appears once).
    const allMatches = [...css.matchAll(/\.chq-taskview-bulk-selectall\s*\{([^}]*)\}/g)];
    const withFloor = allMatches.filter((mm) => /min-height:\s*44px/.test(mm[1] as string));
    expect(withFloor).toHaveLength(1);
  });
});
