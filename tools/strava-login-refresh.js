import axios from 'axios';

import { writeCreds, client_id, client_secret } from './strava-login';
import stravaAuth from '../creds/strava.json';

export default function login() {
  axios
    .post(
      `https://www.strava.com/api/v3/oauth/token?client_id=${client_id}&client_secret=${client_secret}&refresh_token=${stravaAuth.refresh_token}&grant_type=refresh_token`
    )
    .then(({ data: body }) => {
      writeCreds(body);
    })
    .catch((result) => {
      console.error('error', result.stack || JSON.stringify(result));
    });
}
