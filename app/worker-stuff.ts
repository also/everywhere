import { WorkerChannel, workerHandshake } from './WorkerChannel';
export * from './worker-messages';

export async function create() {
  const worker = new Worker(new URL('./tile-worker.ts', import.meta.url));

  const error = new Promise<Error>((__, reject) => {
    worker.addEventListener(
      'error',
      (e) => {
        reject(new Error(`Failed to start worker`));
      },
      { once: true }
    );
  });

  const channel = WorkerChannel.forWorker(worker);
  return Promise.race([
    channel.sendRequest(workerHandshake, 'ping'),
    error,
  ]).then(() => ({ worker, channel }));
}
