function getTargetImage() {
  const dockerVersion = process.env.DOCKER_VERSION;

  if (dockerVersion && dockerVersion.includes('pmm-server')) {
    return dockerVersion;
  }

  if (process.env.PMM_SERVER_LATEST) {
    return `percona/pmm-server:${process.env.PMM_SERVER_LATEST}`;
  }

  return 'percona/pmm-server:3';
}

function isGuiUpgradeRemoved() {
  const version = process.env.PMM_SERVER_LATEST || process.env.DOCKER_VERSION || '';
  const match = version.match(/3\.(\d+)/);

  return Boolean(match && Number(match[1]) >= 9);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function buildDockerRunCommand(containerName, targetImage, inspect) {
  const hostConfig = inspect.HostConfig;
  const config = inspect.Config;
  const args = ['docker run -d'];

  args.push(`--restart ${hostConfig.RestartPolicy?.Name || 'always'}`);
  args.push(`--name ${containerName}`);

  if (config.Hostname) {
    args.push(`--hostname ${config.Hostname}`);
  }

  for (const [containerPort, bindings] of Object.entries(hostConfig.PortBindings || {})) {
    const port = containerPort.split('/')[0];

    for (const binding of bindings) {
      args.push(`-p ${binding.HostPort}:${port}`);
    }
  }

  for (const bind of hostConfig.Binds || []) {
    args.push(`-v ${bind}`);
  }

  for (const env of config.Env || []) {
    args.push(`-e ${shellQuote(env)}`);
  }

  const networkMode = hostConfig.NetworkMode;

  if (networkMode && networkMode !== 'default' && networkMode !== 'bridge' && !networkMode.startsWith('container:')) {
    args.push(`--network ${networkMode}`);
  }

  args.push(targetImage);

  return args.join(' ');
}

async function upgradeContainer(I, containerName, recreateFn) {
  const targetImage = getTargetImage();
  let inspect = null;

  try {
    const raw = await I.verifyCommand(`docker inspect ${containerName}`);

    inspect = JSON.parse(raw)[0];
  } catch (error) {
    inspect = null;
  }

  await I.verifyCommand(`docker pull ${targetImage}`);
  await I.verifyCommand(`docker stop ${containerName} || true`);
  await I.verifyCommand(`docker rm ${containerName} || true`);

  if (recreateFn) {
    await recreateFn(I, targetImage);
  } else if (inspect) {
    await I.verifyCommand(buildDockerRunCommand(containerName, targetImage, inspect));
  } else {
    throw new Error(`docker upgrade: cannot recreate ${containerName}`);
  }

  I.wait(90);
}

module.exports = {
  buildDockerRunCommand,
  getTargetImage,
  isGuiUpgradeRemoved,
  upgradeContainer,
};
