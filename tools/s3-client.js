import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import credentials from '../creds/aws.json';

export const client = new S3Client({ region: 'us-east-1', credentials });
export const Bucket = credentials.bucket;

export async function list(prefix) {
  const results = [];
  let ContinuationToken = undefined;
  while (true) {
    const data = await client.send(
      new ListObjectsV2Command({
        Bucket,
        Prefix: prefix,
        // MaxKeys: 10,
        ContinuationToken,
      })
    );
    ({ NextContinuationToken: ContinuationToken } = data);
    const { Contents = [] } = data;
    results.push(...Contents);
    if (!ContinuationToken) {
      break;
    }
  }

  return results;
}

export function sign(Key) {
  const command = new GetObjectCommand({ Bucket, Key });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}

export default async function({ _: [Key] }) {
  console.log(await sign(Key));
}
