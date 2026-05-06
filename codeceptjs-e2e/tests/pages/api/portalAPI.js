const assert = require('assert');
const faker = require('faker');
const { generate } = require('generate-password');

const { I } = inject();

module.exports = {
  snUsername: process.env.SERVICENOW_LOGIN,
  snPassword: process.env.SERVICENOW_PASSWORD,
  devUrl: process.env.SERVICENOW_DEV_URL,
  oktaToken: `SSWS ${process.env.OKTA_TOKEN}`,
  oktaUrl: 'https://id-dev.percona.com/',
  oktaClientId: process.env.OAUTH_DEV_CLIENT_ID,
  portalBaseUrl: process.env.PORTAL_BASE_URL,

  async createServiceNowUsers() {
    const headers = { Authorization: `Basic ${await I.getAuth(this.snUsername, this.snPassword)}` };
    const resp = await I.sendPostRequest(this.devUrl, {}, headers);

    assert.equal(resp.status, 200);

    return {
      name: resp.data.result.account.name,
      id: resp.data.result.account.sys_id,
      admin1: await this.getUser(resp.data.result.contacts.find(({ email }) => email.startsWith('ui_tests_admin-')).email),
      admin2: await this.getUser(resp.data.result.contacts.find(({ email }) => email.startsWith('ui_tests_admin2-')).email),
      technical: await this.getUser(resp.data.result.contacts.find(({ email }) => email.startsWith('ui_tests_technical-')).email),
    };
  },

  // eslint-disable-next-line object-curly-newline
  async oktaCreateUser({ email, password, firstName, lastName }) {
    const oktaUrl = `${this.oktaUrl}api/v1/users?activate=true`;
    const headers = { Authorization: this.oktaToken };
    const data = {
      profile: {
        firstName,
        lastName,
        email,
        login: email,
      },
      credentials: {
        password: { value: password },
      },
    };
    const response = await I.sendPostRequest(oktaUrl, data, headers);

    assert.equal(response.status, 200);

    return response.data;
  },

  async getUserAccessToken(username, password) {
    const apiUrl = `${this.portalBaseUrl}/v1/auth/SignIn`;
    const data = {
      email: username,
      password,
    };
    const response = await I.sendPostRequest(apiUrl, data, {});

    return response.data.access_token;
  },

  async getUser(email = '') {
    const firstName = faker.name.firstName();
    const lastName = faker.name.lastName();

    return {
      email: email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${Date.now()}.${faker.datatype.number()}@test.com`,
      password: generate({
        length: 16,
        numbers: true,
        lowercase: true,
        uppercase: true,
        strict: true,
        symbols: true,
      }),
      firstName,
      lastName,
    };
  },

  async oktaGetUser(userEmail) {
    const oktaUrl = `${this.oktaUrl}api/v1/users?q=${userEmail}`;
    const headers = { Authorization: this.oktaToken };
    const response = await I.sendGetRequest(oktaUrl, headers);

    assert.equal(response.status, 200);

    return response.data;
  },

  async oktaDeleteUserByEmail(userEmail) {
    const userDetails = await this.oktaGetUser(userEmail);

    await this.oktaDeleteUserById(userDetails[0].id);
  },

  async oktaDeleteUserById(userId) {
    this.oktaDeactivateUserById(userId);
    this.oktaDeactivateUserById(userId);
  },

  async oktaDeactivateUserById(userId) {
    const oktaUrl = `${this.oktaUrl}api/v1/users/${userId}`;
    const headers = { Authorization: this.oktaToken };
    const response = await I.sendDeleteRequest(oktaUrl, headers);

    assert.equal(response.status, 204);

    return response.data;
  },

  async apiCreateOrg(accessToken, orgName = 'Test Organization') {
    const apiUrl = `${this.portalBaseUrl}/v1/orgs`;
    const headers = { Authorization: `Bearer ${accessToken}` };
    const response = await I.sendPostRequest(apiUrl, { name: orgName }, headers);

    return response.data.org;
  },

  async apiDeleteOrg(orgId, accessToken) {
    const apiUrl = `${this.portalBaseUrl}/v1/orgs/${orgId}`;
    const headers = { Authorization: `Bearer ${accessToken}` };
    const response = await I.sendDeleteRequest(apiUrl, headers);

    assert.equal(response.status, 200);
  },

  async apiGetOrg(accessToken) {
    const apiUrl = `${this.portalBaseUrl}/v1/orgs:search`;
    const headers = { Authorization: `Bearer ${accessToken}` };
    const response = await I.sendPostRequest(apiUrl, {}, headers);

    assert.equal(response.status, 200);

    return response.data.orgs;
  },

  async apiGetOrgDetails(orgId, accessToken) {
    const apiUrl = `${this.portalBaseUrl}/v1/orgs/${orgId}`;
    const headers = { Authorization: `Bearer ${accessToken}` };
    const response = await I.sendGetRequest(apiUrl, headers);

    assert.equal(response.status, 200);

    return response.data;
  },

  async apiInviteOrgMember(
    accessToken,
    orgId,
    member = {
      username: '',
      role: '',
    },
  ) {
    const apiUrl = `${this.portalBaseUrl}/v1/orgs/${orgId}/members`;
    const headers = { Authorization: `Bearer ${accessToken}` };
    const response = await I.sendPostRequest(apiUrl, member, headers);

    assert.equal(response.status, 200);

    return response.data;
  },

  async searchCompany(accessToken) {
    const endpointUrl = `${this.portalBaseUrl}/v1/orgs/company:search`;
    const headers = { Authorization: `Bearer ${accessToken}` };
    const response = await I.sendPostRequest(endpointUrl, {}, headers);

    return response.data;
  },

  async connectPMMToPortal(token, serverName = 'Test Server') {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const body = { personal_access_token: token, server_name: serverName };
    const resp = await I.sendPostRequest('v1/Platform/Connect', body, headers);

    assert.ok(resp.status === 200, `Failed to connect PMM to the Portal. Response message is "${resp.data.message}"`);

    return resp.data;
  },

  async disconnectPMMFromPortal(grafana_session_cookie) {
    const headers = { Cookie: `${grafana_session_cookie.name}=${grafana_session_cookie.value}` };

    const resp = await I.sendPostRequest('v1/platform:disconnect', {}, headers);

    assert.ok(resp.status === 200, `Failed to disconnect PMM from the Portal. Response message is "${resp.data.message}"`);

    return resp.data;
  },
};
