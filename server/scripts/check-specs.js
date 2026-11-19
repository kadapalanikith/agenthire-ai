'use strict';

/* Validates every file under /specs. Exit code 1 on any problem. */
const { loadSpecs } = require('../src/utils/specLoader');

try {
  const { versions } = loadSpecs();
  for (const [key, version] of Object.entries(versions)) {
    process.stdout.write(`  ok  ${key}@${version}\n`);
  }
  process.stdout.write(`All ${Object.keys(versions).length} spec files are valid.\n`);
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}
