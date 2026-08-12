import { describe, expect, it } from 'vitest';
import { describeSendResult, type SendResult } from './sendResult';

const noun = { one: 'reviewer', many: 'reviewers' };

describe('describeSendResult', () => {
  it('always states how many were actually sent', () => {
    const result: SendResult = { sent: 3 };
    expect(describeSendResult(result, noun)).toContain('Sent to 3 reviewers.');
  });

  it('uses the singular noun for one sent', () => {
    const result: SendResult = { sent: 1 };
    expect(describeSendResult(result, noun)).toContain('Sent to 1 reviewer.');
  });

  it('states failures whenever failed.length > 0, naming the count not the addresses', () => {
    const result: SendResult = {
      sent: 0,
      failed: [
        { email: 'a@x.com', message: 'bounced' },
        { email: 'b@x.com', message: 'bounced' },
      ],
    };
    const msg = describeSendResult(result, noun);
    expect(msg).toContain('2 failures.');
    expect(msg).not.toContain('a@x.com');
    expect(msg).not.toContain('b@x.com');
  });

  it('states skipped whenever skipped > 0', () => {
    const result: SendResult = { sent: 5, skipped: 2 };
    expect(describeSendResult(result, noun)).toContain('2 skipped.');
  });

  it('states remaining whenever remaining > 0, with the run-it-again clause', () => {
    const result: SendResult = { sent: 5, remaining: 4 };
    expect(describeSendResult(result, noun)).toContain('4 still outstanding — run it again to continue.');
  });

  it('when sent === 0 with failures present, says nothing was sent and names the cause', () => {
    const result: SendResult = { sent: 0, failed: [{ email: 'a@x.com', message: 'bounced' }] };
    const msg = describeSendResult(result, noun);
    expect(msg).toContain('Nothing was sent.');
    expect(msg).toContain('1 failure.');
  });

  it('when sent === 0 with only skipped present, names skipped as the cause', () => {
    const result: SendResult = { sent: 0, skipped: 3 };
    const msg = describeSendResult(result, noun);
    expect(msg).toContain('Nothing was sent.');
    expect(msg).toContain('3 skipped.');
  });

  it('when sent === 0 with only remaining present, names remaining as the cause', () => {
    const result: SendResult = { sent: 0, remaining: 7 };
    const msg = describeSendResult(result, noun);
    expect(msg).toContain('Nothing was sent.');
    expect(msg).toContain('7 still outstanding — run it again to continue.');
  });

  it('says nothing was outstanding when sent, failed, skipped, and remaining are all zero', () => {
    const result: SendResult = { sent: 0 };
    expect(describeSendResult(result, noun)).toBe('Nothing was outstanding.');
  });

  it('combines sent, failed, skipped, and remaining in one sentence', () => {
    const result: SendResult = {
      sent: 2,
      failed: [{ email: 'a@x.com', message: 'x' }],
      skipped: 1,
      remaining: 3,
    };
    const msg = describeSendResult(result, noun);
    expect(msg).toContain('Sent to 2 reviewers.');
    expect(msg).toContain('1 failure.');
    expect(msg).toContain('1 skipped.');
    expect(msg).toContain('3 still outstanding — run it again to continue.');
  });

  it('never restates a pre-send intent count', () => {
    // An intent count (e.g. "5 selected") is a caller-side concept; the
    // helper only ever sees the post-send SendResult fields.
    const result: SendResult = { sent: 5 };
    const msg = describeSendResult(result, noun);
    expect(msg).toBe('Sent to 5 reviewers.');
  });
});
