# pytest example

This example runs pytest with `pytest-tesults` and publishes the results in the
GitHub Actions job summary. It requires no Tesults account or target token.

## Run locally

```sh
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m pytest
```

On Windows, activate the environment with `.venv\\Scripts\\activate`.

## Use it in GitHub Actions

Copy [`.github/workflows/test.yml`](.github/workflows/test.yml) into the same
path in your project. The installed pytest plugin is discovered automatically;
the action supplies its output file in CI.
