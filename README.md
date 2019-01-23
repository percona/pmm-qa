# PMM-QA
Automated tests for Percona Monitoring and Management
GUI tests are created for testing frontend of PMM. They include tests for Query Analytics and for Grafana dashboards

## Installation (UI tests version 2.0)
1. Install Nodejs and atleast npm 8.x on your system
2. Checkout `master` branch for pmm-qa Repo
3. To run tests on your local systems, delete `codecept.json` and rename `local.codecept.json` to `codecept.json`
4. Make sure to update URL of the application in the `webdriver` helper in the configuration file (codecept.json)
5. Install latest version of JDK on your system
6. Install Selenium Standalone server via npm globally using `npm install selenium-standalone -g`
7. Run the following `selenium-standalone start`
8. Inside the root folder for `pmm-qa` run `npm install` this will install all required packages

## How to use
Run all Tests:
```
./node_modules/.bin/codeceptjs run --steps
```
Run individual Tests:
```
./node_modules/.bin/codeceptjs run --steps tests/verifyCompareSystemParametersDashboard_test.js
```

We have implemented the tests to run in parallel chunks of 3, which will basically launch 3 browsers and execute different tests,
to make any change to that, modify the configuration file `codecept.json`
