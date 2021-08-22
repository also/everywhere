import { getAppConfig, login } from './strava-creds';

export default async function loginInteractive({ _: code }: { _: string }) {
  login(await getAppConfig(), code).catch((result) => {
    console.error('error', result.stack || JSON.stringify(result));
  });
}
