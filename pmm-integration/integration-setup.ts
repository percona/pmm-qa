import pgsqlVacuumSetup from "./postgres/pgsql-vacuum-setup";
import validateArgs from "./helpers/validateArgs";

const run = async () => {

  let pgsqlVersion: string | undefined;

  const myArgs: string[] = process.argv.slice(2);
  validateArgs(myArgs);
  console.log(myArgs);
  
  myArgs.forEach((arg) => {
    switch (true) {
      case arg.includes('--pgsql-version'):
        pgsqlVersion = arg.split("=")[1];
        break
      default:
        break
    }
  })

  for await (const [_index, value] of myArgs.entries()) {
    console.log(value)
    switch (value) {
      case '--setup-pgsql-vacuum':
        await pgsqlVacuumSetup({pgsqlVersion})
        break
      default:
        break
    }
  } 
}

run();

export default run;