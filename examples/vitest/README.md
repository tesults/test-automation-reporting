# Vitest example

This example runs current Vitest with `vitest-tesults-reporter@^1.2.0`. The
action supplies the reporter's local output path and publishes the results in
the GitHub Actions job summary. No Tesults account or target token is required.

## Run locally

```sh
npm ci
npm test
```

## Use it in GitHub Actions

Copy [`.github/workflows/test.yml`](.github/workflows/test.yml) into the same
path in your project. Keep the action before the test step and keep
`vitest-tesults-reporter` in `vitest.config.js`; the `default` reporter retains
console output. Reporter version 1.2.0 supports Vitest 0.34 through 5.
