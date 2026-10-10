# xUnit example

This example writes standard JUnit XML with `JunitXml.TestLogger`. The action
reads that XML and publishes the result in the GitHub Actions job summary. No
Tesults package, account, or target token is required.

## Run locally

```sh
dotnet test --logger:junit
```

## Use it in GitHub Actions

Copy [`.github/workflows/test.yml`](.github/workflows/test.yml) into the same
path in your project. Unlike reporter-based integrations, this workflow tells
the action where the JUnit XML will be created.
