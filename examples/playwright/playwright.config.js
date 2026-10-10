const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  reporter: [
    ['line'],
    ['playwright-tesults-reporter']
  ],
  use: {
    browserName: 'chromium',
    headless: true
  }
});
