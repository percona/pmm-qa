// CodeceptJS 4 is ESM, so mocha-multi's bare require() of the CLI reporter yields a
// module namespace rather than the constructor it calls.
const cliReporter = require('codeceptjs/lib/mocha/cli');

module.exports = cliReporter && cliReporter.__esModule ? cliReporter.default : cliReporter;
