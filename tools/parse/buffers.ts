import fs from 'fs';

export interface SeekableBuffer extends BufferWrapper {
  move(to: number, ensureReadable: number): Promise<void>;
  size: number;
}

abstract class NotReallyAsync {
  protected abstract _move(to: number, ensureReadable: number): void;

  async move(to: number, ensureReadable: number): Promise<void> {
    return this._move(to, ensureReadable);
  }
}

export class SeekableFileBuffer
  extends NotReallyAsync
  implements SeekableBuffer
{
  private bufFileOffset = 0;
  private bufLength = 0;
  offset = 0;
  size: number;
  buf: Buffer;

  private fd: number;

  constructor(fd: number, private backingBuffer: Buffer) {
    super();
    this.fd = fd;
    this.size = fs.fstatSync(this.fd).size;
    this.buf = backingBuffer.slice(0, 0);
  }

  private _seek(to: number) {
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

  protected _move(to: number, ensureReadable: number) {
    if (to + ensureReadable > this.size) {
      throw new Error(`moving beyond file end`);
    }
    let buf;
    if (to < this.bufFileOffset) {
      this._seek(to);
      buf = this.backingBuffer.slice(0, ensureReadable);
    } else {
      const end = to + ensureReadable;
      if (end > this.bufFileOffset + this.bufLength) {
        this._seek(to);
        buf = this.backingBuffer.slice(0, ensureReadable);
      } else {
        buf = this.backingBuffer.slice(to - this.bufFileOffset, end);
      }
    }
    this.buf = buf;
    this.offset = 0;
  }
}

export class SeekableInMemoryBuffer
  extends NotReallyAsync
  implements SeekableBuffer
{
  size: number;
  constructor(public buf: Buffer, public offset: number) {
    super();
    this.size = buf.length;
  }

  _move(to: number) {
    return (this.offset = to);
  }
}

export interface BufferWrapper {
  buf: Buffer;
  offset: number;
}
