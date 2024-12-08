import { completeActivityToGeoJson } from '../../tools/strava';

import { getJsonFromFile, Tool } from '.';
import { isProbablyStravaCompleteActivity } from '../file-data';

const stravaTool: Tool = {
  couldProcessFileByExtension(extension) {
    return extension === 'json' ? 'maybe' : 'no';
  },
  couldProcessFileByJson(json) {
    return isProbablyStravaCompleteActivity(json) ? 'yes' : 'no';
  },
  async processFile(file) {
    return completeActivityToGeoJson(await getJsonFromFile(file));
  },
};

export default stravaTool;
