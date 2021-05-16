import fs from 'fs';

export interface SeekableBuffer extends BufferWrapper {
  seek(to: number): void;
  move(to: number, ensureReadable: number): void;
  size: number;
}

export class SeekableFileBuffer implements SeekableBuffer {
  bufFileOffset = 0;
  filePos = -1;
  bufLength = 0;
  offset = 0;
  size: number;
  buf: DataView;
  _buf: Buffer;
  fd: number;

  constructor(fd: number, buf: Buffer) {
    this.fd = fd;
    this.size = fs.fstatSync(this.fd).size;

    this._buf = buf;
    this.buf = new DataView(buf.buffer);
  }

  seek(to: number) {
    if (this.filePos === to) {
      return;
    }
    this.bufFileOffset = to;
    const read = fs.readSync(this.fd, this.buf, 0, this._buf.length, to);
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

export class SeekableInMemoryBuffer implements SeekableBuffer {
  size: number;
  constructor(
    public buf: DataView,
    public offset: number,
    public filePos = offset
  ) {
    this.size = buf.byteLength;
  }

  seek(to: number) {
    this.offset = this.filePos = to;
  }

  move(to: number) {
    this.seek(to);
  }
}

export interface BufferWrapper {
  buf: DataView;
  offset: number;
  filePos: number;
}
