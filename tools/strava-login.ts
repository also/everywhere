/*
https://www.strava.com/oauth/authorize?client_id=6464&redirect_uri=http://localhost/&response_type=code&scope=activity:read_all
*/

import axios from 'axios';
import { getAppConfig, writeCreds } from './strava-creds';

export default async function login({ _: code }: { _: string }) {
  const { clientId, clientSecret } = await getAppConfig();
  axios
    .post(
      `https://www.strava.com/api/v3/oauth/token?client_id=${clientId}&client_secret=${clientSecret}&code=${code}&grant_type=authorization_code`
    )
    .then(({ data: body }) => {
      writeCreds(body);
    })
    .catch((result) => {
      console.error('error', result.stack || JSON.stringify(result));
    });
}
