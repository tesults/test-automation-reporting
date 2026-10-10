const cypress = require('cypress');
const tesults = require('cypress-tesults-reporter');

async function run() {
  const results = await cypress.run({ browser: 'electron' });

  if (results.failures) {
    throw new Error(results.message);
  }

  await tesults.results(results, {});
  process.exitCode = results.totalFailed > 0 ? 1 : 0;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
