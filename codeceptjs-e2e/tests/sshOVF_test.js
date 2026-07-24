Feature('OVF SSH connection');

if (process.env.SERVER_TYPE === 'ovf') {
  Scenario(
    'PMM-T1976 verify user is not able to connect to ovf over SSH using vagrant creds @nightly',
    async ({
      I,
    }) => {
      const ip = new URL(process.env.PMM_UI_URL).hostname;

      await I.verifyCommand(`./utils/ssh-connect.exp ${ip} vagrant vagrant 3022`, 'Permission denied error.', 'fail');
    },
  );
}
