import fs from 'fs';
import path from 'path';

export interface Config {
  // relative paths are resolved against the repo root
  dataDir: string;
  // where strava credentials are stored
  credsDir: string;
}

const rootPath = path.join(__dirname, '..');
const configFile = path.join(rootPath, 'config', 'config.json');

const defaults: Config = {
  dataDir: 'data',
  credsDir: 'creds',
};

let config: Config | undefined;

export function getConfig(): Config {
  if (!config) {
    const overrides: Partial<Config> = fs.existsSync(configFile)
      ? JSON.parse(fs.readFileSync(configFile, 'utf8'))
      : {};
    // environment variables take precedence over config.json
    const env: Partial<Config> = {};
    if (process.env.EVERYWHERE_DATA_DIR) {
      env.dataDir = process.env.EVERYWHERE_DATA_DIR;
    }
    if (process.env.EVERYWHERE_CREDS_DIR) {
      env.credsDir = process.env.EVERYWHERE_CREDS_DIR;
    }
    const merged = { ...defaults, ...overrides, ...env };
    config = {
      ...merged,
      dataDir: path.resolve(rootPath, merged.dataDir),
      credsDir: path.resolve(rootPath, merged.credsDir),
    };
  }
  return config;
}
