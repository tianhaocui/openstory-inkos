import { getJestConfig } from '@storybook/test-runner';

const config = getJestConfig();

export default {
  ...config,
  // A TestRunnerConfig file (.storybook/test-runner.ts) cannot be used here:
  // Storybook's serverRequire() calls module.register(), which Jest 30 rejects
  // under Node 24. A setup file lets us register the same postVisit hook.
  setupFilesAfterEnv: [
    ...config.setupFilesAfterEnv,
    '<rootDir>/.storybook/a11y-setup.ts',
  ],
};
