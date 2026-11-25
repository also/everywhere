import fs from 'fs';
import path from 'path';

export interface Config {
  // relative paths are resolved against the repo root
  dataDir: string;
  // where strava credentials are stored
  credsDir: string;
}

const rootPath = path.join(__dirname, '..');
// the directory containing config.json
const configDir =
  process.env.EVERYWHERE_CONFIG_DIR ?? path.join(rootPath, 'config');
const configFile = path.join(configDir, 'config.json');

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
    const merged = { ...defaults, ...overrides };
    config = {
      ...merged,
      dataDir: path.resolve(rootPath, merged.dataDir),
      credsDir: path.resolve(rootPath, merged.credsDir),
    };
  }
  return config;
}
