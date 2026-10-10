# Jest example

This example runs Jest with `jest-tesults-reporter` and publishes the results
in the GitHub Actions job summary. It does not require a Tesults account or
target token.

## Run locally

```sh
npm ci
npm test
```

The Tesults reporter keeps normal local test runs unchanged. The GitHub Action
sets `TESULTS_OUTPUT_FILE` automatically in CI, which tells the reporter where
to write the result data used for the job summary.

## Use it in GitHub Actions

Copy [`.github/workflows/test.yml`](.github/workflows/test.yml) into the same
path in your repository. The important ordering is that the reporting action
runs before Jest:

```yaml
- name: Set up test automation reporting
  uses: tesults/test-automation-reporting@v1

- name: Run tests
  run: npm test
```

Keep `default` alongside the Tesults reporter in `jest.config.js` if you want
Jest's normal console output as well as the GitHub report.
