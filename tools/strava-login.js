/*
https://www.strava.com/oauth/authorize?client_id=6464&redirect_uri=http://localhost/&response_type=code&scope=activity:read_all
*/

import fs from 'fs';
import path from 'path';

import requestNode from 'request';

import Promise from 'bluebird';

const client_secret = 'SECRET';

const request = Promise.promisify(requestNode);

export default function login({ _: code }) {
  request({
    url: `https://www.strava.com/api/v3/oauth/token?client_id=6464&client_secret=${client_secret}&code=${code}&grant_type=authorization_code`,
    method: 'post',
  })
    .then(([response, body]) => {
      fs.writeFileSync(
        path.join(__dirname, '..', 'creds', 'strava.json'),
        body
      );
      console.log(body);
    })
    .catch(result => {
      console.error('error', result.stack || JSON.stringify(result));
    });
}
