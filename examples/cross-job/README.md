# Cross-job reporting example

Use this workflow when tests run in a matrix or untrusted pull-request job and
one trusted job should publish the combined report. It works with every
reporter-based framework example in this repository.

Copy [`.github/workflows/test.yml`](.github/workflows/test.yml) into a project
that already has its Tesults framework reporter configured. The test jobs use
`mode: collect`, upload only the generated JSON, and do not publish separate
reports. The final job downloads and merges every matrix result.

For workflows triggered from public forks, use the trusted `workflow_run`
variation documented in the [main README](../../README.md#reports-from-another-job-or-workflow).
