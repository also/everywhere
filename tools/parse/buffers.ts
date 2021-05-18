export interface BufferWrapper {
  buf: DataView;
  offset: number;
}

export interface SeekableBuffer extends BufferWrapper {
  move(to: number, ensureReadable: number): Promise<void>;
  view(): SeekableBuffer;
  size: number;
}

const empty = new DataView(new ArrayBuffer(0));

export abstract class AbstractSeekableBuffer implements SeekableBuffer {
  protected abstract arrayBuffer: ArrayBuffer;
  abstract size: number;
  protected abstract _seek(to: number): Promise<void>;
  abstract view(): SeekableBuffer;

  buf: DataView;
  offset = 0;
  protected bufFileOffset = 0;
  protected bufLength = 0;

  constructor() {
    this.buf = empty;
  }

  async move(to: number, ensureReadable: number) {
    if (to + ensureReadable > this.size) {
      throw new Error(`moving beyond file end`);
    }
    let buf;
    if (to < this.bufFileOffset) {
      await this._seek(to);
      buf = new DataView(this.arrayBuffer, 0, ensureReadable);
    } else {
      const end = to + ensureReadable;
      if (end > this.bufFileOffset + this.bufLength) {
        await this._seek(to);
        buf = new DataView(this.arrayBuffer, 0, ensureReadable);
      } else {
        buf = new DataView(
          this.arrayBuffer,
          to - this.bufFileOffset,
          ensureReadable
        );
      }
    }
    this.buf = buf;
    this.offset = 0;
  }
}

export class SeekableBlobBuffer
  extends AbstractSeekableBuffer
  implements SeekableBuffer
{
  protected arrayBuffer: ArrayBuffer;
  size: number;

  constructor(private blob: Blob, private bufferSize: number) {
    super();
    this.size = blob.size;

    this.arrayBuffer = new ArrayBuffer(0);
  }

  protected async _seek(to: number) {
    this.bufFileOffset = to;
    const s = this.blob.slice(to, to + this.bufferSize);
    this.arrayBuffer = await s.arrayBuffer();
    this.bufLength = this.arrayBuffer.byteLength;
  }

  view() {
    const result = new SeekableBlobBuffer(this.blob, this.bufferSize);
    result.arrayBuffer = this.arrayBuffer.slice(0);
    result.buf = new DataView(
      result.arrayBuffer,
      this.buf.byteOffset,
      this.buf.byteLength
    );
    result.offset = this.offset;
    result.bufFileOffset = this.bufFileOffset;
    result.bufLength = this.bufLength;

    return result;
  }
}
