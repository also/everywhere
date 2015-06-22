import requestNode from 'request';
import Promise from 'bluebird';
import * as fs from 'fs';

import {simpleName} from './list-s3-videos';

import {key} from '../creds/zencoder.json';

const request = Promise.promisify(requestNode);

const template = fs.readFileSync(require.resolve('./zencoder.json'), {encoding: 'utf8'});

export function encode(file) {
  const requestBody = template.replace(/VIDEO_NAME/g, simpleName(file));
  // console.log(requestBody);
  // return Promise.resolve([]);
  return request({
    method: 'POST',
    url: 'https://app.zencoder.com/api/v2/jobs',
    json: JSON.parse(requestBody),
    headers: {
      'Zencoder-Api-Key': key
    }
  });
}

export default function({_: [file]}) {
  encode(file)
  .then(
    ([res, body]) => console.log(body),
    (err) => console.log(err)
  );
}
