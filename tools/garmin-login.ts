import { exchangeApiKey, getApiKey } from './garmin-creds';

// Saves the Garmin API key (prompting if needed) and checks that it works by
// exchanging it for an access token.
export default async function login() {
  const { expires_at } = await exchangeApiKey(await getApiKey());
  console.log(
    `Saved creds/garmin.json, token expires ${new Date(expires_at * 1000).toISOString()}`
  );
}
