# **How to test Integrated Alerting**
### Requirements :
* PMM Server 2.19.0 or higher
### Environment variables:
* MAILOSAUR_API_KEY
* MAILOSAUR_SERVER_ID
* MAILOSAUR_SMTP_PASSWORD
* PAGER_DUTY_SERVICE_KEY
* PAGER_DUTY_API_KEY
### Webhook setup with Auth enabled and SSL (self-signed)
Generate self-signed cert: `bash -x ${PWD}/testdata/ia/gencerts.sh`

Start Webhook container: `docker-compose -f docker-compose-webhook.yml up -d`

Webhook URL `https://webhookd:8080/alert`

CA file location `./testdata/ia/certs/self.crt`

Credentials: `alert|alert`

Once the webhook will be triggered the alert details will appear in `./testdata/ia/scripts/alert.txt` file

Shut down webhook server command: `docker-compose -f docker-compose-webhook.yml stop`

### Command to execute Integrated Alerting Alerts tests command
`Note: webhook setup is done automatically from the tests code, so no need to start webhook server manually`

`npx codeceptjs run -c pr.codecept.js tests/ia/alerts_test.js --steps`

### Command to execute all Integrated Alerting tests:

`npx codeceptjs run -c pr.codecept.js --grep '@fb-alerting'`

### Execute Integrated Alerting tests in Jenkins
* Job name - `pmm2-ui-tests`
* tag - `@fb-alerting`
* run tagged day - `yes`
* clients not needed
