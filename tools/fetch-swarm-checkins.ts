import { writeFileSync, readFileSync, existsSync } from 'fs';
import axios from 'axios';
import { Checkin, Root } from './swarm';
import { mapGen, readAllJson } from './data';

function readCreds() {
  return JSON.parse(readFileSync('creds/swarm.json', 'utf8'));
}

export default async function ({ _: [direction = 'new'] }: { _: string[] }) {
  const checkins = readAllJson<Checkin>('swarm');
  const timestamps = mapGen(checkins, (c) => c.createdAt);
  // assuming running the script repeatedly after the API returns a few 500s
  let lastTs: undefined | number =
    direction === 'new' ? Math.max(...timestamps) : Math.min(...timestamps);

  do {
    const params = new URLSearchParams({
      // I just made this up
      v: '20200101',
      limit: '100',
    });
    if (isFinite(lastTs)) {
      params.append(
        direction === 'new' ? 'afterTimestamp' : 'beforeTimestamp',
        lastTs.toString()
      );
    }

    const url = `https://api.foursquare.com/v2/users/self/checkins?${params.toString()}`;
    console.log(url);

    const creds = readCreds();

    const r = await axios.get(url, {
      headers: {
        cookie: `oauth_token=${creds.oauth_token};`,
      },
    });

    const response: Root = r.data;

    lastTs = undefined;
    for (const checkin of response.response.checkins.items) {
      const filename = `data/swarm/${checkin.id}.json`;
      if (existsSync(filename)) {
        lastTs = undefined;
        break;
      }
      console.log(filename);
      writeFileSync(filename, JSON.stringify(checkin, null, 2));
      lastTs = checkin.createdAt;
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  } while (lastTs !== undefined);
}
