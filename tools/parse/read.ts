import { BufferWrapper } from './buffers';

export const utf8decoder = new TextDecoder();
export const latin18decoder = new TextDecoder('latin1');

export function utf8(v: DataView): string {
  return utf8decoder.decode(v);
}

export function hex(v: DataView): string {
  return Array.from(new Uint8Array(v.buffer, v.byteOffset, v.byteLength), (v) =>
    v.toString(16).padStart(2, '0')
  ).join('');
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
  const result = new DataView(b.buf.buffer, b.buf.byteOffset + b.offset, n);
  b.offset += n;
  return result;
}

export type TypeReader = {
  f: keyof DataView | ((d: BufferWrapper) => any);
  size: number;
};

export function readFixedSize(d: BufferWrapper, t: TypeReader): any {
  const result =
    typeof t.f === 'function' ? t.f(d) : (d.buf[t.f] as any)(d.offset);
  d.offset += t.size;
  return result;
}

export const t = {
  int8: { f: 'getInt8', size: 1 },
  uint8: { f: 'getUint8', size: 1 },
  float32: { f: 'getFloat32', size: 4 },
  F: {
    f: (d: BufferWrapper) => readAscii(d, 4),
    size: 4,
  },
  uint64: { f: 'getBigUint64', size: 8 },
  int32: { f: 'getInt32', size: 4 },
  uint32: { f: 'getUint32', size: 4 },
  int16: { f: 'getInt16', size: 2 },
  uint16: { f: 'getUint16', size: 2 },
  U: {
    f: (d: BufferWrapper) => readAscii(d, 16),
    size: 16,
  },
} as const;

export function nullTerminated(v: DataView): string {
  if (v.byteLength === 0) {
    return '';
  }
  for (let i = 0; i < v.byteLength; i++) {
    if (v.getUint8(i) === 0) {
      if (i === 0) {
        return '';
      }
      v = new DataView(v.buffer, v.byteOffset, i);
      break;
    }
  }
  return utf8decoder.decode(v);
}
