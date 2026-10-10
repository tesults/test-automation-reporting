# Vitest example

This example runs Vitest with `vitest-tesults-reporter` and publishes the
results in the GitHub Actions job summary. It requires no Tesults account or
target token. The example uses Vitest 3 because the published reporter's
legacy lifecycle hook is not compatible with Vitest 4 or later.

## Run locally

```sh
npm ci
npm test
```

## Use it in GitHub Actions

Copy [`.github/workflows/test.yml`](.github/workflows/test.yml) into the same
path in your project. `includeTaskLocation` enables source links in the report,
while the `default` reporter retains Vitest's console output.
