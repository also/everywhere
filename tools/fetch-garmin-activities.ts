import fs from 'fs';

import { dataPath } from './data';
import {
  downloadActivity,
  GarminActivity,
  GarminActivitySummary,
  getActivity,
  searchActivities,
} from './garmin-api';

// Each activity is saved as data/garmin-activities/<id>.json (summary and
// details) and <id>.zip (the original file from the device).

function activityPath(id: number | string, ext: string) {
  return dataPath('garmin-activities', `${id}.${ext}`);
}

async function fetchAndSave(
  summary: GarminActivitySummary | undefined,
  id: number | string
) {
  const activity = await getActivity(id);
  const result: GarminActivity = { summary: summary ?? activity, activity };
  const original = await downloadActivity(id);
  if (original) {
    fs.writeFileSync(activityPath(id, 'zip'), original);
  } else {
    console.error(`no original file for ${id}`);
  }
  // written last, so its existence means the fetch completed
  fs.writeFileSync(activityPath(id, 'json'), JSON.stringify(result));
}

async function fetchAll(breakOnExisting: boolean) {
  for await (const summary of searchActivities()) {
    const { activityId: id, activityName: name } = summary;
    const type = summary.activityType?.typeKey;
    if (summary.manualActivity) {
      console.error(`skipping manual activity "${name}" ${id}`);
      continue;
    }
    if (fs.existsSync(activityPath(id, 'json'))) {
      console.log(`already fetched ${id}`);
      if (breakOnExisting) {
        break;
      }
      continue;
    }
    console.log(`fetching ${type} "${name}" ${id} (${summary.startTimeLocal})`);
    await fetchAndSave(summary, id);
  }
}

export default async function ({ _: [id] }: { _: string[] }) {
  fs.mkdirSync(dataPath('garmin-activities'), { recursive: true });
  if (id === 'new') {
    await fetchAll(true);
  } else if (id) {
    await fetchAndSave(undefined, id);
  } else {
    await fetchAll(false);
  }
}
