import refreshToken from './strava-creds';

export default async function login() {
  refreshToken().catch((result) => {
    console.error('error', result.stack || JSON.stringify(result));
  });
}
