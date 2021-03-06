/*
https://www.strava.com/oauth/authorize?client_id=6464&redirect_uri=http://localhost/&response_type=code&scope=activity:read_all
*/

import axios from 'axios';

import fs from 'fs';
import path from 'path';

export const client_secret = 'SECRET';
export const client_id = 6464;

export function writeCreds(body) {
  fs.writeFileSync(
    path.join(__dirname, '..', 'creds', 'strava.json'),
    JSON.stringify(body)
  );
  console.log(body);
}

export default function login({ _: code }) {
  axios
    .post(
      `https://www.strava.com/api/v3/oauth/token?client_id=${client_id}&client_secret=${client_secret}&code=${code}&grant_type=authorization_code`
    )
    .then(({ data: body }) => {
      writeCreds(body);
    })
    .catch((result) => {
      console.error('error', result.stack || JSON.stringify(result));
    });
}
