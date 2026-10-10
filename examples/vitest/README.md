# Vitest example

This example runs current Vitest with its built-in JUnit reporter. The action
reads that XML and publishes the results in the GitHub Actions job summary. It
requires no additional reporter package, Tesults account, or target token.

## Run locally

```sh
npm ci
npm test
```

## Use it in GitHub Actions

Copy [`.github/workflows/test.yml`](.github/workflows/test.yml) into the same
path in your project. The action's `junit-xml` input matches the output path in
`vitest.config.js`, while the `default` reporter retains console output.

Existing Vitest 3 projects can continue using
`vitest-tesults-reporter@^1.1.0`. Vitest removed that reporter's legacy
lifecycle hook in Vitest 4, so newer projects should use the built-in JUnit
path shown here until the dedicated reporter is updated.
