import React from 'react';
import { WorkerChannel } from '../WorkerChannel';

export default React.createContext<{
  worker: Worker;
  channel: WorkerChannel;
}>(undefined as any);
