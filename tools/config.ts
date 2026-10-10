import fs from 'fs';
import path from 'path';

export interface Config {
  // relative paths are resolved against the repo root
  dataDir: string;
}

const rootPath = path.join(__dirname, '..');
const configFile = path.join(rootPath, 'config', 'config.json');

const defaults: Config = {
  dataDir: 'data',
};

let config: Config | undefined;

export function getConfig(): Config {
  if (!config) {
    const overrides: Partial<Config> = fs.existsSync(configFile)
      ? JSON.parse(fs.readFileSync(configFile, 'utf8'))
      : {};
    const merged = { ...defaults, ...overrides };
    config = { ...merged, dataDir: path.resolve(rootPath, merged.dataDir) };
  }
  return config;
}
