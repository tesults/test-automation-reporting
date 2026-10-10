# Cypress example

This example uses the Cypress module API with `cypress-tesults-reporter`, as
required for Cypress-specific results and captured files. The action publishes
the result in the GitHub Actions job summary without a Tesults account or
target token.

## Run locally

```sh
npm ci
npm test
```

## Use it in GitHub Actions

Copy [`.github/workflows/test.yml`](.github/workflows/test.yml) into the same
path in your project. Keep `cypress-run.js` as the test entry point so the
module receives Cypress's completed run object.
