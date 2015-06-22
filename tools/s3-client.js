import s3 from 's3';

import creds from '../creds/aws.json';

export const client = s3.createClient({s3Options: creds});
export const Bucket = creds.bucket;
