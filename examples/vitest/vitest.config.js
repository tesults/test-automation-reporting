import { defineConfig } from 'vitest/config';
import TesultsReporter from 'vitest-tesults-reporter';

export default defineConfig({
  test: {
    includeTaskLocation: true,
    reporters: ['default', new TesultsReporter()]
  }
});
