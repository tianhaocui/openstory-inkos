/**
 * P5 a11y CI gate — critical/serious axe findings fail a story.
 *
 * The addon's own report (`.storybook/preview.tsx` → `a11y.test: 'error'`)
 * fails on ANY violation; stories carrying historical findings opt out with
 * `parameters.a11y.test = 'todo'`. That todo list may only shrink.
 */

import AxeBuilder from '@axe-core/playwright';
import { getStoryContext, setPostVisit } from '@storybook/test-runner';

const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

function isTodoOrDisabled(parameters: Record<string, unknown>): boolean {
  const a11y: unknown = parameters['a11y'];
  if (typeof a11y !== 'object' || a11y === null) return false;
  if ('disable' in a11y && a11y.disable === true) return true;
  return 'test' in a11y && (a11y.test === 'todo' || a11y.test === 'off');
}

setPostVisit(async (page, context) => {
  const storyContext = await getStoryContext(page, context);
  const parameters: Record<string, unknown> = storyContext.parameters;
  if (isTodoOrDisabled(parameters)) return;

  const results = await new AxeBuilder({ page })
    .include('#storybook-root')
    .analyze();
  const blocking = results.violations.filter((violation) =>
    BLOCKING_IMPACTS.has(violation.impact ?? '')
  );

  if (blocking.length > 0) {
    throw new Error(
      [
        `a11y gate: ${blocking.length} critical/serious violation(s)`,
        ...blocking.map(
          (violation) =>
            `  - ${violation.id} [${violation.impact}]: ${violation.help}`
        ),
      ].join('\n')
    );
  }
});
