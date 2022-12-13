import { stopAndRemoveContainer } from "../helpers/docker";

const clearAllSetups = async () => {
    await stopAndRemoveContainer('external_service_container');
    await stopAndRemoveContainer('redis_container');
};


export default clearAllSetups;