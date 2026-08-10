import { CONTENT_STATUS_PRIORITY, type ContentStatus, type ContentSubmissionListItem } from './types';

export type WorklistTab = 'all' | ContentStatus;

export const WORKLIST_TABS: readonly WorklistTab[] = ['all', 'changes_requested', 'pending', 'approved'];

/**
 * Filters the worklist by tab. 'all' keeps everything; a specific
 * contentStatus keeps only matching rows.
 */
export function filterByContentStatus<T extends { contentStatus: ContentStatus }>(items: T[], tab: WorklistTab): T[] {
  if (tab === 'all') return items;
  return items.filter((item) => item.contentStatus === tab);
}

/**
 * Orders the worklist so items needing action surface first: changes_requested,
 * then pending, then approved (SPEC §2.3 — worklist, not report). Ties break
 * by title so the list is stable and scannable.
 */
export function sortForWorklist(items: ContentSubmissionListItem[]): ContentSubmissionListItem[] {
  return [...items].sort((a, b) => {
    const pa = CONTENT_STATUS_PRIORITY.indexOf(a.contentStatus);
    const pb = CONTENT_STATUS_PRIORITY.indexOf(b.contentStatus);
    if (pa !== pb) return pa - pb;
    return a.title.localeCompare(b.title);
  });
}
