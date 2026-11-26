import axios from 'axios';
import { baseUrl, getAccessToken } from './garmin-creds';

// Endpoints are from Garmin's official client,
// https://github.com/garmin/connect-personal-api-python

// Only the fields we use; the API returns many more.
export type GarminActivitySummary = {
  activityId: number;
  activityName: string;
  startTimeLocal: string;
  startTimeGMT: string;
  activityType: { typeKey: string; parentTypeId?: number };
  manualActivity?: boolean;
  [key: string]: unknown;
};

export type GarminActivity = {
  summary: GarminActivitySummary;
  // response of /activity-service/activity/{id}
  activity: any;
};

const maxRateLimitRetries = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path: string, options: any = {}) {
  for (let attempt = 0; ; attempt++) {
    const accessToken = await getAccessToken();
    try {
      const response = await axios.get(`${baseUrl}${path}`, {
        ...options,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...options.headers,
        },
      });
      return response.data;
    } catch (e) {
      // the limits aren't published; in practice, ~200 requests in a burst
      // gets a 429 with a retry-after of under a minute
      if (
        axios.isAxiosError(e) &&
        e.response?.status === 429 &&
        attempt < maxRateLimitRetries
      ) {
        const seconds = Number(e.response.headers['retry-after']) || 60;
        console.error(`rate limited, waiting ${seconds}s`);
        await sleep((seconds + 1) * 1000);
        continue;
      }
      throw e;
    }
  }
}

export async function* searchActivities({
  startDate,
  endDate,
  pageSize = 100,
}: {
  startDate?: string;
  endDate?: string;
  pageSize?: number;
} = {}): AsyncGenerator<GarminActivitySummary> {
  let start = 0;
  while (true) {
    console.error(`listing garmin activities from ${start}`);
    const page: GarminActivitySummary[] = await request(
      '/activitylist-service/activities/search/activities',
      { params: { start, limit: pageSize, startDate, endDate } }
    );
    if (!page || page.length === 0) {
      break;
    }
    yield* page;
    start += page.length;
  }
}

export function getActivity(id: number | string) {
  return request(`/activity-service/activity/${id}`);
}

// The original uploaded file (usually a FIT), inside a zip.
export async function downloadActivity(
  id: number | string
): Promise<Buffer | undefined> {
  try {
    const data = await request(`/download-service/files/activity/${id}`, {
      headers: {
        Accept:
          'application/zip, application/x-zip-compressed, application/octet-stream',
      },
      responseType: 'arraybuffer',
    });
    return Buffer.from(data);
  } catch (e) {
    // manual activities have no file
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      return;
    }
    throw e;
  }
}
