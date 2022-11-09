import { exit } from "process";
import availableCommandsLineArgs, { availableArgsMap } from "../availableArgs";

const validateArgs = async (args: string[]) => {
    args.forEach((arg) => {
        if(availableCommandsLineArgs.findIndex(option => arg.includes(option)) < 0) {
            availableArgsMap.forEach((value, key) => {
                console.log(`   ${key}:    ${value}`);
            })
            exit();
        }
    })

}

export default validateArgs;
