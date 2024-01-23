import { writeFileSync, readdirSync, readFileSync } from 'fs';
import axios from 'axios';
import { Checkin, Root } from './swarm';

function readCreds() {
  return JSON.parse(readFileSync('creds/swarm.json', 'utf8'));
}

function findEarliestCheckin() {
  const files = readdirSync('data/swarm');
  const timestamps = files.map((filename) => {
    const checkin: Checkin = JSON.parse(
      readFileSync(`data/swarm/${filename}`, 'utf8')
    );
    return checkin.createdAt;
  });

  if (timestamps.length === 0) {
    return undefined;
  }

  return Math.min(...timestamps);
}

export default async function () {
  // assuming running the script repeatedly after the API returns a few 500s
  let lastTs: undefined | number = findEarliestCheckin();

  do {
    const params = new URLSearchParams({
      // I just made this up
      v: '20200101',
      limit: '100',
    });
    if (lastTs !== undefined) {
      params.append('beforeTimestamp', lastTs.toString());
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
      writeFileSync(filename, JSON.stringify(checkin, null, 2));
      lastTs = checkin.createdAt;
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  } while (lastTs !== undefined);
}
