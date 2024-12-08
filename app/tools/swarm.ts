import { processCheckin, VenueFeature } from '../../tools/swarm';

import { getJsonFromFile, StatefulTool } from '.';

const swarmTool: StatefulTool<Map<string, VenueFeature>> = {
  createState() {
    return new Map();
  },
  couldProcessFileByExtension(extension) {
    return extension === 'json' ? 'maybe' : 'no';
  },
  async processFile(file, state) {
    const checkin = await getJsonFromFile(file);
    return processCheckin(checkin, state);
  },
};

export default swarmTool;
