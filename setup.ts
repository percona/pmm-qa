import { main } from './provisioning/setup.ts';

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
