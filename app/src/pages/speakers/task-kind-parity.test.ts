import { describe, expect, it } from 'vitest';
import { TASK_KINDS as DOMAIN_TASK_KINDS } from '../../../../src/domain/task-kinds';
import { TASK_KINDS } from './types';

describe('task-kind vocabulary parity (DEC-613 wave-70 amendment)', () => {
  it('the app types re-export equals the domain set member-for-member', () => {
    expect([...TASK_KINDS]).toEqual([...DOMAIN_TASK_KINDS]);
  });
});
