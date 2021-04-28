import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

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
