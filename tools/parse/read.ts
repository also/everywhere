import { BufferWrapper } from './buffers';

export const utf8decoder = new TextDecoder();
export const latin18decoder = new TextDecoder('latin1');

export function utf8(v: DataView): string {
  return utf8decoder.decode(v);
}

export function readUtf8(b: BufferWrapper, len: number): string {
  return utf8(slice(b, len));
}

export function readAscii(b: BufferWrapper, len: number): string {
  return utf8(slice(b, len));
}

export function readUInt32BE(b: BufferWrapper): number {
  const result = b.buf.getUint32(b.offset);
  b.offset += 4;
  return result;
}

export function readUInt16BE(b: BufferWrapper): number {
  const result = b.buf.getUint16(b.offset);
  b.offset += 2;
  return result;
}

export function readBigUInt64BE(b: BufferWrapper): bigint {
  const result = b.buf.getBigUint64(b.offset);
  b.offset += 8;
  return result;
}

export function readFloatBE(b: BufferWrapper): number {
  const result = b.buf.getFloat32(b.offset);
  b.offset += 4;
  return result;
}

export function readUInt8(b: BufferWrapper) {
  return b.buf.getUint8(b.offset++);
}

export function readInt8(b: BufferWrapper) {
  return b.buf.getInt8(b.offset++);
}

export function skip(b: BufferWrapper, n: number): void {
  b.offset += n;
}

export function slice(b: BufferWrapper, n: number): DataView {
  const result = new DataView(b.buf.buffer, b.offset, n);
  b.offset += n;
  return result;
}
