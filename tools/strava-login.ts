import { getAppConfig, login, prompt } from './strava-creds';

function parseCode(input: string): string {
  input = input.trim();
  if (!input.includes('://')) {
    return input;
  }
  const url = new URL(input);
  const code = url.searchParams.get('code');
  if (!code) {
    throw new Error(
      `no code in URL (error: ${url.searchParams.get('error') || 'none'})`
    );
  }
  return code;
}

export default async function loginInteractive({ _: [code] }: { _: string[] }) {
  try {
    const appConfig = await getAppConfig();
    if (!code) {
      const authUrl = `https://www.strava.com/oauth/authorize?client_id=${appConfig.clientId}&redirect_uri=http://localhost&response_type=code&scope=activity:read_all`;
      console.log(
        `Open this URL in any browser and click Authorize:\n\n  ${authUrl}\n\n` +
          "The redirect page won't load; that's expected. Copy its full URL from the address bar."
      );
      code = parseCode(await prompt('\nPaste the redirect URL (or just the code): '));
    }
    await login(appConfig, code);
    console.log('Saved creds/strava.json');
  } catch (result: any) {
    console.error('error', result.stack || JSON.stringify(result));
  }
}
