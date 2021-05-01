import axios from 'axios';
import path from 'path';

import { sign } from './s3-client';

import { accountId, token } from '../creds/cloudflare';

/*
curl \
-X POST \
-d '{"url":"https://storage.googleapis.com/zaid-test/Watermarks%20Demo/cf-ad-original.mp4","meta":{"name":"My First Stream Video"}}' \
-H "Authorization: Bearer $TOKEN" \
https://api.cloudflare.com/client/v4/accounts/$ACCOUND_ID/stream/copy
*/

export async function encode(file) {
  const signedUrl = await sign(`everywhere/video/raw/${file}`);

  const body = { url: signedUrl, meta: { name: path.basename(file) } };
  console.log(body);

  const { data } = await axios.post(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`,
    body,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return data;
}

export default async function({ _: [file] }) {
  try {
    console.log(await encode(file));
  } catch (e) {
    console.log(e.response.data);
  }
}
