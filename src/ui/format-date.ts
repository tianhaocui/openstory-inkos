/**
 * Format a date as a locale-aware calendar date (e.g. `2026/11/25` for zh-CN).
 *
 * `timeZone` is intentionally omitted: `Intl.DateTimeFormat` then uses the
 * device/runtime local zone, matching the previous
 * `date.toLocaleDateString('zh-CN')` behaviour. Keep the default options so
 * the rendered string does not change when a locale is swapped in later.
 */
export function formatDate(date: Date, locale = 'zh-CN'): string {
  return new Intl.DateTimeFormat(locale).format(date);
}

/**
 * Format a date as a relative time string (e.g., "2 hours ago")
 */
export function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays}d ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears}y ago`;
}
