import { processCheckin, VenueFeature } from '../../tools/swarm';

import { Tool } from '.';

const swarmTool: Tool<Map<string, VenueFeature>> = {
  createState() {
    return new Map();
  },
  async processFile(file, state) {
    const checkin = JSON.parse(await file.file.file.text());
    return processCheckin(checkin, state);
  },
};

export default swarmTool;
