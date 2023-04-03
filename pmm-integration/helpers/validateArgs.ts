import { exit } from 'process';
import availableCommandsLineArgs, { availableArgsMap } from '../availableArgs';

const validateArgs = async (args: string[]) => {
  args.forEach((arg) => {
    if (availableCommandsLineArgs.findIndex((option) => arg.includes(option)) < 0) {
      availableArgsMap.forEach((value, key) => {
        console.log(`   ${key}:    ${value}`);
      });
      if (arg.includes('-h') || arg.includes('--help')) {
        console.log('List of available arguments for integration setup.');
      } else {
        console.error(`Arg "${arg}" in not a valid parameter.\nPlease select from the list.`);
      }

      exit(1);
    }
  });
};

export default validateArgs;
