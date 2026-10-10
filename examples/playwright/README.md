# Playwright example

This example runs browser tests with `playwright-tesults-reporter` and adds the
result report to the GitHub Actions job summary. No Tesults account or target
token is required.

## Run locally

```sh
npm ci
npx playwright install chromium
npm test
```

## Use it in GitHub Actions

Copy [`.github/workflows/test.yml`](.github/workflows/test.yml) into the same
path in your project. Keep Playwright's normal reporter alongside the Tesults
reporter if you want both console and GitHub output.
