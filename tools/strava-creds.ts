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

export async function getAppConfig(): Promise<AppConfig> {
  const appConfigFile = path.join(__dirname, '..', 'creds', 'strava-app.json');
  let appConfig: AppConfig;
  try {
    appConfig = JSON.parse(fs.readFileSync(appConfigFile, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') {
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
