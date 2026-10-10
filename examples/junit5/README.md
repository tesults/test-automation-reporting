# JUnit 5 example

This Maven example runs JUnit 5 with the Tesults listener and publishes the
result in the GitHub Actions job summary. It requires no Tesults account or
target token.

## Run locally

```sh
mvn test
```

## Use it in GitHub Actions

Copy [`.github/workflows/test.yml`](.github/workflows/test.yml) into the same
path in your project. The listener is loaded from the test dependency and the
action supplies its output file in CI.
