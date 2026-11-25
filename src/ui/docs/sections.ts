/**
 * Canonical ordering of documentation sections.
 * Used by the sidebar and index route to ensure consistent navigation.
 */
export const SECTION_ORDER = [
  'User Guide',
  'Developer Guide',
  'Support',
] as const;

const SECTION_LABELS: Record<string, string> = {
  'User Guide': '用户指南',
  'Developer Guide': '开发者指南',
  Support: '支持',
};

export function getSectionLabel(section: string): string {
  return SECTION_LABELS[section] ?? section;
}
