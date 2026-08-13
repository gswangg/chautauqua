// CRM sourcing pipeline card age (CRM-07/08, DEC-803). Pure and
// deterministic: every pipeline card shows how long it's sat in its current
// stage — `stageSince` IS the entry's updatedAt (only a move writes it, so
// it's the exact moment the card entered its current stage; DEC-803).
// `stale` marks a card that has sat in its stage past 30 days: weight and
// wording only, per this product's no-colour-as-identity rule (FINDINGS
// w2-4) — callers render `stale` via the bold-caps micro-label class, never
// a colour change.

import { countOf } from '../../lib/plural';
import type { PipelineStage } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// DEC-803: past 30 days is stale -- exactly 30 days is not yet stale.
const STALE_AFTER_DAYS = 30;

export interface PipelineCardAge {
  text: string;
  stale: boolean;
}

function daysSince(stageSinceMs: number, nowMs: number): number {
  const diff = nowMs - stageSinceMs;
  return Math.max(0, Math.floor(diff / MS_PER_DAY));
}

export function pipelineCardAge(stage: PipelineStage, stageSinceMs: number, nowMs: number): PipelineCardAge {
  const days = daysSince(stageSinceMs, nowMs);
  const stale = days > STALE_AFTER_DAYS;

  const daysText = countOf(days, 'day');

  let text: string;
  switch (stage) {
    case 'identified':
      text = `Added ${daysText} ago`;
      break;
    case 'contacted':
      text = `No reply · ${daysText}`;
      break;
    case 'interested':
      text = `Replied ${daysText} ago`;
      break;
    case 'confirmed':
      text = `Confirmed ${daysText} ago`;
      break;
    case 'declined':
      text = `Declined ${daysText} ago`;
      break;
    default: {
      const _exhaustive: never = stage;
      throw new Error(`pipelineCardAge: unknown stage ${_exhaustive as string}`);
    }
  }

  return { text, stale };
}
