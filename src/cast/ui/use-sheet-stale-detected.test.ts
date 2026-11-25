import { describe, expect, it } from 'vitest';
import { formatSheetStaleToastMessage } from './use-sheet-stale-detected';

describe('formatSheetStaleToastMessage', () => {
  it('uses singular copy for a single alternate', () => {
    expect(formatSheetStaleToastMessage(1)).toBe('有一个备选版本可用。');
  });

  it('uses plural copy with count for multiple alternates', () => {
    expect(formatSheetStaleToastMessage(3)).toBe('有 3 个备选版本可用。');
  });
});
