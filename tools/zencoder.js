import axios from 'axios';
import * as fs from 'fs';

import { simpleName } from './list-s3-videos';

import { key } from '../creds/zencoder.json';

const template = fs.readFileSync(require.resolve('./zencoder.json'), {
  encoding: 'utf8',
});

export async function encode(file) {
  const requestBody = template.replace(/VIDEO_NAME/g, simpleName(file));
  // console.log(requestBody);
  // return Promise.resolve([]);
  const { data } = await axios.post(
    'https://app.zencoder.com/api/v2/jobs',
    JSON.parse(requestBody),
    {
      headers: {
        'Zencoder-Api-Key': key,
      },
    }
  );

  return data;
}

export default async function ({ _: [file] }) {
  const result = await encode(file);
  console.log(result);
}
