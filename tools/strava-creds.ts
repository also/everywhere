import axios from 'axios';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

function prompt(message: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(message, function (result) {
      rl.close();
      return resolve(result);
    });
  });
}

export function writeCreds(body: any) {
  fs.writeFileSync(
    path.join(__dirname, '..', 'creds', 'strava.json'),
    JSON.stringify(body)
  );
}

type AppConfig = {
  clientId: number;
  clientSecret: string;
};

export async function getAppConfig(allowPrompt = true): Promise<AppConfig> {
  const appConfigFile = path.join(__dirname, '..', 'creds', 'strava-app.json');
  let appConfig: AppConfig;
  try {
    appConfig = JSON.parse(fs.readFileSync(appConfigFile, 'utf8'));
  } catch (e) {
    if (!allowPrompt || e.code !== 'ENOENT') {
      throw e;
    }
    console.log(
      'Look up your Strava app API information at https://www.strava.com/settings/api'
    );
    const clientId = parseInt(await prompt('Enter your Strava app id: '));
    const clientSecret = await prompt('Enter client secret: ');
    appConfig = {
      clientId,
      clientSecret,
    };
    fs.writeFileSync(appConfigFile, JSON.stringify(appConfig));
  }
  return appConfig;
}

export async function login(
  { clientId, clientSecret }: AppConfig,
  code: string
) {
  const { data: body } = await axios.post(
    `https://www.strava.com/api/v3/oauth/token?client_id=${clientId}&client_secret=${clientSecret}&code=${code}&grant_type=authorization_code`
  );
  writeCreds(body);
}

function readCreds() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, '../creds/strava.json'), 'utf8')
  );
}

export async function getAccessToken() {
  let { expires_at, access_token: accessToken } = readCreds();

  if (expires_at < Date.now() / 1000) {
    console.log('token needs refresh');
    accessToken = await refreshToken();
  }

  return accessToken;
}

export default async function refreshToken(): Promise<string> {
  const { clientId, clientSecret } = await getAppConfig();
  const stravaAuth = readCreds();
  const { data: body } = await axios.post(
    `https://www.strava.com/api/v3/oauth/token?client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${stravaAuth.refresh_token}&grant_type=refresh_token`
  );
  writeCreds(body);
  return body.access_token;
}

export async function loginHandler({ code }: { code: string }) {
  const appConfig = await getAppConfig(false);
  if (code) {
    await login(appConfig, code);
  } else {
    return `https://www.strava.com/oauth/authorize?client_id=${appConfig.clientId}&redirect_uri=https://localhost:8080/strava-auth&response_type=code&scope=activity:read_all`;
  }
}
