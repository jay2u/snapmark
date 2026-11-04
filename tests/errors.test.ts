import { describe, expect, it } from 'vitest';
import { describeError, isAccessError } from '../src/shared/errors';

describe('describeError', () => {
  it('explains blocked pages', () => {
    const e = describeError(new Error('Cannot access contents of the page. Extension manifest must request permission to access the respective host.'));
    expect(e.message).toMatch(/isn't allowed to read this page/);
    expect(e.detail).toMatch(/Cannot access contents/);
  });
  it('explains the capture rate limit', () => {
    expect(describeError('This request exceeds the MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND quota.').message).toMatch(/wait a few seconds/i);
  });
  it('explains timeouts', () => {
    expect(describeError(new Error('Scrolling timed out')).message).toMatch(/stopped responding/);
  });
  it('passes unknown errors through unchanged', () => {
    expect(describeError(new Error('boom'))).toEqual({ message: 'boom', detail: 'boom' });
  });
});

describe('isAccessError', () => {
  it('recognises blocked-page errors', () => {
    expect(isAccessError(new Error('Cannot access a chrome:// URL'))).toBe(true);
    expect(isAccessError(new Error('The extensions gallery cannot be scripted.'))).toBe(true);
  });
  it('ignores unrelated errors', () => {
    expect(isAccessError(new Error('Scrolling timed out'))).toBe(false);
  });
});
