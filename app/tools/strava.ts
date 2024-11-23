import { completeActivityToGeoJson } from '../../tools/strava';

import { ToolFunction } from '.';

const stravaTool: ToolFunction = async (file) => {
  const contents = await file.file.file.text();
  return completeActivityToGeoJson(JSON.parse(contents));
};

export default stravaTool;
