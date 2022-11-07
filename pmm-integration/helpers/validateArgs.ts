import { exit } from "process";
import availableCommandsLineArgs, { argsMap } from "../availableArgs";

const validateArgs = async (args: string[]) => {
    args.forEach((arg) => {
        if(availableCommandsLineArgs.findIndex(option => arg.includes(option)) < 0) {
            argsMap.forEach((value, key) => {
                console.log(`   ${key}:    ${value}`);
            })
            exit();
        }
    })

}

export default validateArgs;