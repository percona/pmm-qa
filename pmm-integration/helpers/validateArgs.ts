import { exit } from "process";
import availableCommandsLineArgs, { availableArgsMap } from "../availableArgs";

const validateArgs = async (args: string[]) => {
    args.forEach((arg) => {
        if(availableCommandsLineArgs.findIndex(option => arg.includes(option)) < 0) {
            console.log(`Arg "${arg}" in not a valid parameter.\nPlease select one from list below:`);
            availableArgsMap.forEach((value, key) => {
                console.log(`   ${key}:    ${value}`);
            })
            exit();
        }
    })

}

export default validateArgs;
