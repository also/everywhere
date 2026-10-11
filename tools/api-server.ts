import Fastify from 'fastify';
import axios from 'axios';

import { fetchAndSaveTrip } from './fetch-strava-trips';

export default async function ({
  port = 3001,
  host = process.env.HOST ?? '127.0.0.1',
}: {
  port?: number;
  host?: string;
}) {
  const app = Fastify({ logger: true });

  app.post<{ Params: { id: string } }>(
    '/strava/activities/:id/fetch',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
          required: ['id'],
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      try {
        const { activity, streams } = await fetchAndSaveTrip(id);
        return { id, name: activity.name, hasStreams: streams !== undefined };
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          return reply.code(404).send({ error: `activity ${id} not found` });
        }
        throw e;
      }
    }
  );

  // these actions use local credentials and write to the data directory, so
  // default to localhost. in docker, pass --host 0.0.0.0 (or set HOST) and
  // publish the port to the host's loopback: -p 127.0.0.1:3001:3001
  await app.listen({ port, host });
}
