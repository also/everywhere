import { addToolHandlers } from './worker/tile';
import { WorkerChannel, workerHandshake } from './WorkerChannel';

// https://github.com/Microsoft/TypeScript/issues/20595
// self is a WorkerGlobalScope, but TypeScript doesn't know that
const ctx: Worker = self as any;

const channel = new WorkerChannel(ctx.postMessage.bind(ctx), ctx);

channel.handle(workerHandshake, () => 'pong');

addToolHandlers(channel);
