export const argsMap = new Map<string, string>([
    ["--setup-pmm-pgsm-integration", "Use this option to setup PMM-Client with PGSM for integration testing"], 
    ["--setup-pmm-pgss-integration", "Use this option to setup PMM-Client with PG Stat Statements for Integration Testing"], 
    ["--setup-pgsql-vacuum", "Use this do setup postgres for vacuum monitoring tests"],
    ["--pgsql-version", "Pass Postgre SQL server version Info"]
])

const availableCommandsLineArgs: string[] =  Array.from( argsMap.keys() );

export default availableCommandsLineArgs;