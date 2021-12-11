# PMM-QA
Automated tests for Percona Monitoring and Management
GUI tests are created for testing frontend of PMM. They include tests for Query Analytics and for Grafana dashboards

## Using Selenoid for running tests in Local
1. Install Node.js and atleast npm 8.x on your system
2. Selenoid and Selenoid UI use port 4444 and 8080 respectively,
make sure they are not being used, otherwise update docker-compose.yml file
3. run npm install in project root.
4. run prepare_ui_test.sh script in the root directory.
`bash -x ./prepare_ui_test.sh`
5. This should start running UI tests in 4 parallel browser sessions inside chrome containers with help of selenoid
6. Check live execution by launching http://localhost:8080 in your browser.

## If you'd like to have more control over the UI test framework parameters, please check out next sections

### Installation (UI tests version 2.0)
1. Install Node.js and atleast npm 8.x on your system
2. Checkout `main` branch for pmm-qa Repo
3. To run tests on your local systems, delete `codecept.json` and rename `local.codecept.json` to `codecept.json`
4. Make sure to update URL of the application in the `webdriver` helper in the configuration file (codecept.json)
5. Install latest version of JDK on your system

> Follow any one of these:

6. Install Selenium Standalone server via npm globally using `npm install selenium-standalone -g`
7. Run the following `selenium-standalone start`
> OR
6. Install Selenium Standalone server locally via npm `npm install selenium-standalone --save-dev`
7. Run the following `./node_modules/.bin/selenium-standalone install && ./node_modules/.bin/selenium-standalone start`

8. Inside the root folder for `pmm-qa` run `npm install` this will install all required packages

### How to use
Run all Tests:
```
./node_modules/.bin/codeceptjs run --steps
```
Run individual Tests:
```
./node_modules/.bin/codeceptjs run --steps tests/verifyMysqlDashboards_test.js
```

We have implemented the tests to run in parallel chunks of 3, which will basically launch 3 browsers and execute different tests,
to make any change to that, modify the configuration file `codecept.json`
