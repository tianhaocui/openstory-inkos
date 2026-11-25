/**
 * Tests for the testable pieces of `useSequenceStaleDetected`. The hook
 * itself is React-lifecycle-bound; cross-sequence attribution and timer
 * cleanup are covered by manual smoke testing in the music route.
 */

import { describe, expect, it } from 'vitest';
import { formatSequenceStaleToastMessage } from './use-sequence-stale-detected';

describe('formatSequenceStaleToastMessage', () => {
  it('uses singular music phrasing for one alternate', () => {
    expect(formatSequenceStaleToastMessage(1)).toBe('有可用的备用音乐音轨。');
  });

  it('pluralizes the music label for counts greater than one', () => {
    expect(formatSequenceStaleToastMessage(3)).toBe(
      '有 3 个备用音乐音轨可用。'
    );
  });
});
