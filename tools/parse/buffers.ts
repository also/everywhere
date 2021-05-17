import fs from 'fs';

export interface SeekableBuffer extends BufferWrapper {
  move(to: number, ensureReadable: number): Promise<void>;
  size: number;
}

abstract class NotReallyAsync {
  protected abstract _move(to: number, ensureReadable: number): void;

  async move(to: number, ensureReadable: number): Promise<void> {
    this._move(to, ensureReadable);
  }
}

export class SeekableFileBuffer
  extends NotReallyAsync
  implements SeekableBuffer
{
  private bufFileOffset = 0;
  filePos = -1;
  private bufLength = 0;
  offset = 0;
  size: number;
  buf: Buffer;
  private fd: number;

  constructor(fd: number, buf: Buffer) {
    super();
    this.fd = fd;
    this.size = fs.fstatSync(this.fd).size;

    this.buf = buf;
  }

  protected _seek(to: number) {
    if (this.filePos === to) {
      return;
    }
    this.bufFileOffset = to;
    const read = fs.readSync(this.fd, this.buf, 0, this.buf.length, to);
    this.bufLength = read;
    this.offset = 0;
    this.filePos = to;
  }

  protected _move(to: number, ensureReadable: number) {
    if (to < this.bufFileOffset) {
      this._seek(to);
    } else {
      const end = to + ensureReadable;
      if (end > this.bufFileOffset + this.bufLength) {
        this._seek(to);
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

  _seek(to: number) {
    this.offset = this.filePos = to;
  }

  _move(to: number) {
    this._seek(to);
  }
}

export interface BufferWrapper {
  buf: Buffer;
  offset: number;
  filePos: number;
}
