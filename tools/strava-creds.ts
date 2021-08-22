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
  console.log(body);
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

export async function loginHandler({ code }: { code: string }) {
  const appConfig = await getAppConfig(false);
  if (code) {
    await login(appConfig, code);
  } else {
    return `https://www.strava.com/oauth/authorize?client_id=${appConfig.clientId}&redirect_uri=https://localhost:8080/strava-auth&response_type=code&scope=activity:read_all`;
  }
}
