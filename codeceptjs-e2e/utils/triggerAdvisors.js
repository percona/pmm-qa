const axios = require('axios');
const https = require('https');
const assert = require('assert');

const BASE_URL = process.env.PMM_UI_URL || 'https://localhost';
const AUTH = {
  username: 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin',
};
const getAuth = () => Buffer.from(`${AUTH.username}:${AUTH.password}`).toString('base64');

(async () => {
  const agent = new https.Agent({ rejectUnauthorized: false });
  const config = { headers: { Authorization: `Basic ${getAuth()}` }, httpsAgent: agent };

  const {
    data: { checks },
  } = await axios.get(`${BASE_URL}/v1/advisors/checks`, config);
  const names = checks.map((c) => c.name);

  const advisorsCheck = await axios.post(`${BASE_URL}/v1/advisors/checks:start`, { names }, config);

  assert.strictEqual(advisorsCheck.status, 200, 'Failed to trigger advisors checks');
})();
