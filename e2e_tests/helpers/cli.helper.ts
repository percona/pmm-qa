import shell from 'shelljs';

export default class CliHelper {
  constructor() {}

  sendCommand = async (command: string) => {
    const { stdout, code } = shell.exec(command.replace(/(\r\n|\n|\r)/gm, ''), {
      silent: true,
    });

    if (code !== 0) {
      throw new Error('');
    }

    return stdout.trim();
  };
}
