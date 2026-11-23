export const mongoConnection = {
  username: 'pmm',
  password: 'pmmpass',
};

export const psConnection = {
  username: 'root',
  password: 'GRgrO9301RuF',
  address: '127.0.0.1:3306',
};

export const gssapi = {
  enabled: process.env.GSSAPI_ENABLED === 'true' ? 'true' : 'false',
  credentials_flags: '--username="pmm@PERCONATEST.COM" --password=password1 --authentication-mechanism=GSSAPI --authentication-database="$external"',
};

export const clientCredentialsFlags = gssapi.enabled === 'true'
  ? gssapi.credentials_flags
  : `--username=${mongoConnection.username} --password=${mongoConnection.password}`;

export const dockerImage = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
export const clientDockerImage = process.env.CLIENT_DOCKER_VERSION || 'perconalab/pmm-client:3-dev-latest';
