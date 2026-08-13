// DEC-812: the two scheduled jobs (reminders, Airtable sync) must not be
// able to cancel each other — a throw in one must still let the other run,
// and the tick must still fail loudly overall by rethrowing an aggregate
// error naming every job that failed.
import { afterEach, describe, expect, it, vi } from 'vitest';

const runDueReminders = vi.fn();
const runAirtableSync = vi.fn();
const makeDb = vi.fn((_arg: unknown) => ({}) as unknown);

vi.mock('../src/routes/tasks', () => ({
  runDueReminders: (arg: unknown) => runDueReminders(arg),
}));
vi.mock('../src/sync/airtable', () => ({
  runAirtableSync: (arg1: unknown, arg2: unknown) => runAirtableSync(arg1, arg2),
}));
vi.mock('../src/server/context', () => ({
  makeDb: (arg: unknown) => makeDb(arg),
}));

import { handleScheduled } from '../src/server/scheduled';

const fakeController = { cron: '*/15 * * * *' } as unknown as ScheduledController;
const fakeEnv = {} as unknown as Parameters<typeof handleScheduled>[1];
const fakeCtx = {} as unknown as ExecutionContext;

describe('handleScheduled job isolation (DEC-812)', () => {
  afterEach(() => {
    runDueReminders.mockReset();
    runAirtableSync.mockReset();
    makeDb.mockReset();
    makeDb.mockImplementation(() => ({}) as unknown);
  });

  it('still runs the sync when reminders throws, then rethrows', async () => {
    runDueReminders.mockRejectedValueOnce(new Error('reminders boom'));
    runAirtableSync.mockResolvedValueOnce(undefined);

    await expect(handleScheduled(fakeController, fakeEnv, fakeCtx)).rejects.toThrow(
      /runDueReminders/,
    );

    expect(runDueReminders).toHaveBeenCalledTimes(1);
    expect(runAirtableSync).toHaveBeenCalledTimes(1);
  });

  it('still runs reminders when sync throws, then rethrows', async () => {
    runDueReminders.mockResolvedValueOnce(undefined);
    runAirtableSync.mockRejectedValueOnce(new Error('sync boom'));

    await expect(handleScheduled(fakeController, fakeEnv, fakeCtx)).rejects.toThrow(
      /runAirtableSync/,
    );

    expect(runDueReminders).toHaveBeenCalledTimes(1);
    expect(runAirtableSync).toHaveBeenCalledTimes(1);
  });

  it('names both jobs when both fail', async () => {
    runDueReminders.mockRejectedValueOnce(new Error('reminders boom'));
    runAirtableSync.mockRejectedValueOnce(new Error('sync boom'));

    await expect(handleScheduled(fakeController, fakeEnv, fakeCtx)).rejects.toThrow(
      /runDueReminders.*runAirtableSync/,
    );
  });

  it('resolves cleanly when both jobs succeed', async () => {
    runDueReminders.mockResolvedValueOnce(undefined);
    runAirtableSync.mockResolvedValueOnce(undefined);

    await expect(handleScheduled(fakeController, fakeEnv, fakeCtx)).resolves.toBeUndefined();
  });
});
