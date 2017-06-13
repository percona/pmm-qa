# pmm-qa
Automated tests for Percona Monitoring and Management
GUI tests are created for testing frontend of PMM. They include tests for Query Analytics and for Grafana dashboards

## Installation
1. Install Nodejs and Java
2. Install [Protractor](http://www.protractortest.org/#/).  
3. Install protractor-jasmine2-screenshot-reporter and jasmine-reporters
4. To run tests locally install Selenium:
```
webdriver-manager update
webdriver-manager start
```

## How to use
Run tests:
```
./start.sh config_file URL_TO_PMM
```


