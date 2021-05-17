import fs from 'fs';

export interface SeekableBuffer extends BufferWrapper {
  seek(to: number): void;
  move(to: number, ensureReadable: number): void;
  asyncSeek(to: number): Promise<void>;
  asyncMove(to: number, ensureReadable: number): Promise<void>;
  size: number;
}

abstract class NotReallyAsync {
  abstract seek(to: number): void;
  abstract move(to: number, ensureReadable: number): void;

  async asyncSeek(to: number): Promise<void> {
    this.seek(to);
  }

  async asyncMove(to: number, ensureReadable: number): Promise<void> {
    this.move(to, ensureReadable);
  }
}

export class SeekableFileBuffer
  extends NotReallyAsync
  implements SeekableBuffer
{
  bufFileOffset = 0;
  filePos = -1;
  bufLength = 0;
  offset = 0;
  size: number;
  buf: Buffer;
  fd: number;

  constructor(fd: number, buf: Buffer) {
    super();
    this.fd = fd;
    this.size = fs.fstatSync(this.fd).size;

    this.buf = buf;
  }

  seek(to: number) {
    if (this.filePos === to) {
      return;
    }
    this.bufFileOffset = to;
    const read = fs.readSync(this.fd, this.buf, 0, this.buf.length, to);
    this.bufLength = read;
    this.offset = 0;
    this.filePos = to;
  }

  move(to: number, ensureReadable: number) {
    if (to < this.bufFileOffset) {
      this.seek(to);
    } else {
      const end = to + ensureReadable;
      if (end > this.bufFileOffset + this.bufLength) {
        this.seek(to);
      } else {
        this.filePos = to;
        this.offset = to - this.bufFileOffset;
      }
    }
  }
}

export class SeekableInMemoryBuffer
  extends NotReallyAsync
  implements SeekableBuffer
{
  size: number;
  constructor(
    public buf: Buffer,
    public offset: number,
    public filePos = offset
  ) {
    super();
    this.size = buf.length;
  }

  seek(to: number) {
    this.offset = this.filePos = to;
  }

  move(to: number) {
    this.seek(to);
  }
}

export interface BufferWrapper {
  buf: Buffer;
  offset: number;
  filePos: number;
}
