const { test, expect } = require('@playwright/test');

test('adds two numbers in the browser', async ({ page }) => {
  await page.setContent('<output id="result"></output>');
  await page.evaluate(() => {
    document.querySelector('#result').textContent = String(2 + 3);
  });

  await expect(page.locator('#result')).toHaveText('5');
});

test('subtracts two numbers in the browser', async ({ page }) => {
  await page.setContent('<output id="result"></output>');
  await page.evaluate(() => {
    document.querySelector('#result').textContent = String(7 - 4);
  });

  await expect(page.locator('#result')).toHaveText('3');
});
