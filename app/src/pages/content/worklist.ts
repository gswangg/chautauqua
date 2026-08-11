import type { ContentStatus } from './types';

export type WorklistTab = 'all' | ContentStatus;

export const WORKLIST_TABS: readonly WorklistTab[] = ['all', 'changes_requested', 'pending', 'approved'];
