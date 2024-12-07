type MessageChannelKey<I, O> = { key: string; __in: I; __out: O };

export function key<I, O = undefined>(key: string): MessageChannelKey<I, O> {
  return { key } as any;
}

export const workerHandshake = key<'ping', 'pong'>('handshake');

export interface WorkerRemote {
  sendRequest<I, O>(
    { key }: MessageChannelKey<I, O>,
    input: I,
    transferrable?: Transferable[]
  ): Promise<O>;
}

export interface WorkerLocal {
  handle<I, O>(
    { key }: MessageChannelKey<I, O>,
    handler: (input: I) => O | Promise<O>
  ): void;
}

class HandlerRegistry implements WorkerLocal {
  private handlers: Map<string, (input: any) => any> = new Map();

  handle<I, O>(
    { key }: MessageChannelKey<I, O>,
    handler: (input: I) => O | Promise<O>
  ): void {
    this.handlers.set(key, handler);
  }

  protected async invokeHandler(key: string, input: any) {
    const handler = this.handlers.get(key);
    if (!handler) {
      throw new Error(`missing handler ${key}`);
    }
    return await handler(input);
  }
}

export class LocalWorkerChannel
  extends HandlerRegistry
  implements WorkerRemote
{
  async sendRequest<I, O>(
    { key }: MessageChannelKey<I, O>,
    input: I
  ): Promise<O> {
    return this.invokeHandler(key, input);
  }
}

export class WorkerChannel extends HandlerRegistry implements WorkerRemote {
  private id = 0;
  private requests: Map<
    number,
    { resolve: (value: any) => any; reject: (value: any) => any }
  > = new Map();

  constructor(
    private postMessage: Worker['postMessage'],
    onmessageable: Pick<Worker, 'onmessage'>
  ) {
    super();
    onmessageable.onmessage = (message) => this.onmessage(message);
  }

  static forWorker(worker: Worker): WorkerChannel {
    return new WorkerChannel(worker.postMessage.bind(worker), worker);
  }

  private async onmessage(e: MessageEvent) {
    const { data } = e;
    if (data.from === 'MessageChannel') {
      const {
        value,
        value: { type, id },
      } = data;
      if (type === 'request') {
        const { key, input } = value;
        let result;
        let status: 'success' | 'failure' = 'success';
        try {
          result = await this.invokeHandler(key, input);
        } catch (e) {
          status = 'failure';
          // FIXME only chrome can send errors
          result = e;
        }
        this.postMessage({
          from: 'MessageChannel',
          value: { type: 'response', id, status, result },
        });
      } else {
        const { id, status, result } = value;
        const request = this.requests.get(id);
        if (!request) {
          console.error(`unexpected response`, value);
          return;
        }
        this.requests.delete(id);
        if (status === 'success') {
          request.resolve(result);
        } else {
          request.reject(result);
        }
      }
    }
  }

  // FIXME doesn't actually restrict I or O to match key types
  sendRequest<I, O>(
    { key }: MessageChannelKey<I, O>,
    input: I,
    transferrable: Transferable[] = []
  ): Promise<O> {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.postMessage(
        {
          from: 'MessageChannel',
          value: { type: 'request', id, key, input },
        },
        transferrable
      );
      this.requests.set(id, { resolve, reject });
    });
  }
}
