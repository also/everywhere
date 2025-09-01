import fs from 'fs';

import { AbstractSeekableBuffer, SeekableBuffer } from './buffers';

export default class SeekableFileBuffer
  extends AbstractSeekableBuffer
  implements SeekableBuffer
{
  protected arrayBuffer: ArrayBuffer;
  size: number;

  private fd: number;

  constructor(
    fd: number,
    private backingBuffer: Buffer
  ) {
    super();
    this.fd = fd;
    this.size = fs.fstatSync(this.fd).size;

    this.arrayBuffer = backingBuffer.buffer;
  }

  protected async _seek(to: number) {
    this.bufFileOffset = to;
    const read = fs.readSync(
      this.fd,
      this.backingBuffer,
      0,
      this.backingBuffer.length,
      to
    );
    this.bufLength = read;
  }

  view(): SeekableFileBuffer {
    throw new Error('nope');
  }
}
