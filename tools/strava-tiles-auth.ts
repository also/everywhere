import axios from 'axios';
import { getAccessToken } from './strava-creds';

export default async function getTilesAuth() {
  const token = await getAccessToken();

  const { data: body, headers } = await axios.get(
    `https://heatmap-external-a.strava.com/auth?access_token=${token}`
  );

  if (typeof body !== 'string' || !body.includes('cloudfront cookies set')) {
    throw new Error('Unexpected response from Strava auth');
  }

  const rawCookies = headers['set-cookie'] as string[];
  const cookies = Object.fromEntries(
    rawCookies.map((cookie) => {
      const [name, value] = cookie.split(';')[0].split('=');
      return [name, value];
    })
  );

  console.log(
    JSON.stringify(
      {
        policy: cookies['CloudFront-Policy'],
        signature: cookies['CloudFront-Signature'],
        keyPairId: cookies['CloudFront-Key-Pair-Id'],
      },
      null,
      2
    )
  );
}
