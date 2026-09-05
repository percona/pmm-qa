// mocha-multi resolves each reporterOptions key with a bare require() and calls it as a
// constructor. CodeceptJS 4 is ESM ("type": "module"), so requiring its CLI reporter yields a
// module namespace rather than the class. Unwrap it here; the check keeps this working against
// CodeceptJS 3 as well.
const cliReporter = require('codeceptjs/lib/mocha/cli');

module.exports = cliReporter && cliReporter.__esModule ? cliReporter.default : cliReporter;
