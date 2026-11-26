import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getConfig } from './config';
import { prompt } from './strava-creds';
import { isErrno } from './utils/fs';

// Garmin Connect Personal API. Unlike Strava, this isn't OAuth: you create a
// long-lived API key at https://connect.garmin.com/app/settings/personalApiToken
// and exchange it for a 24 hour bearer token. There are no refresh tokens; once
// the bearer token expires, exchange the key again.
// https://developer.garmin.com/gc-developer-program/personal/personal-api/

export const baseUrl = 'https://personal.connectapi.garmin.com';
const tokenPath =
  '/personalapitoken-service/personal-api/personal-api-key/token';
// get a new token when the cached one has less than this left
const refreshWindowSeconds = 60 * 60;

function credsPath(name: string) {
  return path.join(getConfig().credsDir, name);
}

function writePrivate(file: string, contents: string) {
  fs.writeFileSync(file, contents, { mode: 0o600 });
}

export async function getApiKey(allowPrompt = true): Promise<string> {
  const fromEnv = process.env.GARMIN_PERSONAL_API_KEY?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const keyFile = credsPath('garmin-api-key');
  try {
    const key = fs.readFileSync(keyFile, 'utf8').trim();
    if (!key) {
      throw new Error(`${keyFile} is empty`);
    }
    return key;
  } catch (e) {
    if (!allowPrompt || !isErrno(e) || e.code !== 'ENOENT') {
      throw e;
    }
    console.log(
      'Create a Garmin Personal API key at https://connect.garmin.com/app/settings/personalApiToken'
    );
    const key = (await prompt('Paste your Garmin API key: ')).trim();
    writePrivate(keyFile, key + '\n');
    console.log(`Saved ${keyFile}`);
    return key;
  }
}

type CachedToken = {
  // which key the token came from, so replacing the key invalidates the cache
  fingerprint: string;
  access_token: string;
  expires_at: number;
};

function fingerprint(apiKey: string) {
  return crypto
    .createHash('sha256')
    .update(`${baseUrl}\0${apiKey}`)
    .digest('hex');
}

function readCachedToken(): CachedToken | undefined {
  try {
    return JSON.parse(fs.readFileSync(credsPath('garmin.json'), 'utf8'));
  } catch (e) {
    if (isErrno(e) && e.code === 'ENOENT') {
      return;
    }
    throw e;
  }
}

function jwtExpiration(token: string): number {
  const payload = token.split('.')[1];
  if (!payload) {
    throw new Error('token endpoint did not return a JWT');
  }
  const { exp } = JSON.parse(
    Buffer.from(
      payload.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString()
  );
  if (typeof exp !== 'number') {
    throw new Error('token has no exp claim');
  }
  return exp;
}

export async function exchangeApiKey(apiKey: string): Promise<CachedToken> {
  const { data } = await axios.post(`${baseUrl}${tokenPath}`, undefined, {
    headers: { Accept: '*/*', Authorization: `ApiKey ${apiKey}` },
    responseType: 'text',
    // the response is the bare token, don't let axios try to parse it
    transformResponse: (d: string) => d,
  });
  const accessToken = String(data).trim();
  const token = {
    fingerprint: fingerprint(apiKey),
    access_token: accessToken,
    expires_at: jwtExpiration(accessToken),
  };
  writePrivate(credsPath('garmin.json'), JSON.stringify(token));
  return token;
}

export async function getAccessToken({ force = false } = {}): Promise<string> {
  const apiKey = await getApiKey();
  const cached = readCachedToken();
  if (
    !force &&
    cached &&
    cached.fingerprint === fingerprint(apiKey) &&
    cached.expires_at - Date.now() / 1000 > refreshWindowSeconds
  ) {
    return cached.access_token;
  }
  console.error('getting a new garmin access token');
  return (await exchangeApiKey(apiKey)).access_token;
}
