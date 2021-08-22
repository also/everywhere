import axios from 'axios';

import stravaAuth from '../creds/strava.json';
import { getAppConfig, writeCreds } from './strava-creds';

export default async function login() {
  const { clientId, clientSecret } = await getAppConfig();
  axios
    .post(
      `https://www.strava.com/api/v3/oauth/token?client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${stravaAuth.refresh_token}&grant_type=refresh_token`
    )
    .then(({ data: body }) => {
      writeCreds(body);
    })
    .catch((result) => {
      console.error('error', result.stack || JSON.stringify(result));
    });
}
