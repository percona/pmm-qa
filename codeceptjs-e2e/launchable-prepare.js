const path = require('path');
const fs = require('fs');
const glob = require('glob');
const { config } = require('./pr.codecept.js');

// Get command line arguments
const args = process.argv.slice(2);
const targetTag = args[0];

if (!targetTag) {
  console.error('Usage: node launchable-prepare.js <tag-or-regex>');
  console.error('Examples:');
  console.error('  node launchable-prepare.js @bm-mongo');
  console.error('  node launchable-prepare.js "@bm-mongo|@bm-locations"');
  process.exit(1);
}

const testPattern = config.tests || 'tests/**/*_test.js';

function findTestsWithTag(tagExpression) {
  // Find all test files using glob pattern
  const allTestFiles = glob.sync(testPattern, {
    cwd: process.cwd(),
    absolute: true,
  });

  console.log(`Scanning ${allTestFiles.length} test files for expression: ${tagExpression}`);

  // Check if the expression is a regex (contains | or starts with ^ or has other regex chars)
  const isRegex = tagExpression.includes('|') || tagExpression.startsWith('^') || /[()*+?.[\\\]]/.test(tagExpression);

  let regex;

  if (isRegex) {
    try {
      // Treat as regex pattern
      regex = new RegExp(tagExpression);
    } catch (err) {
      console.warn(`Invalid regex pattern "${tagExpression}": ${err.message}`);
      console.warn('Falling back to simple string match');
      regex = null;
    }
  }

  // Filter files that match the expression
  const matchingFiles = allTestFiles.filter((testFile) => {
    try {
      const content = fs.readFileSync(testFile, 'utf8');

      if (regex) {
        return regex.test(content);
      }

      return content.includes(tagExpression);
    } catch (err) {
      console.warn(`Could not read test file: ${testFile}`);

      return false;
    }
  });

  return matchingFiles;
}

function writeToSubsetFile(files) {
  const relativeFiles = files.map((file) => path.relative(process.cwd(), file));
  const content = relativeFiles.join('\n');

  try {
    fs.writeFileSync('test_list.txt', content, 'utf8');
    console.log(`\nResults written to test_list.txt (${files.length} files)`);
  } catch (err) {
    console.error('Error writing to test_list.txt:', err.message);
  }
}

function main() {
  console.log(`Searching for tests with tag: ${targetTag}`);

  const matchingFiles = findTestsWithTag(targetTag);

  if (matchingFiles.length === 0) {
    console.log(`No test files found containing tag: ${targetTag}`);
    // Write empty file
    writeToSubsetFile([]);
  } else {
    console.log(`Found ${matchingFiles.length} test file(s) with tag "${targetTag}":`);
    matchingFiles.forEach((file) => {
      console.log(`  ${path.relative(process.cwd(), file)}`);
    });

    // Write results to subset.txt
    writeToSubsetFile(matchingFiles);
  }
}

main();
