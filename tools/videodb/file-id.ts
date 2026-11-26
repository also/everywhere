import crypto from 'crypto';
import { FileReader } from './mp4-scan';

// File ID v1: see "Video file and recording IDs" spec.
//   head = [0, min(S, C)), tail = [max(C, S - C), S)
//   digest = SHA-256("vid-file-id/1\0" || u64be(S) || head || tail)
//   id = "f1_" + hex(digest[0..16])
export const FILE_ID_CHUNK = 1024 * 1024;
const PREFIX = Buffer.from('vid-file-id/1\0', 'latin1');

export function fileIdV1(r: FileReader): string {
  const size = r.size;
  const head = r.read(0, Math.min(size, FILE_ID_CHUNK));
  const tailStart = Math.max(FILE_ID_CHUNK, size - FILE_ID_CHUNK);
  const tail = size > tailStart ? r.read(tailStart, size - tailStart) : null;

  const sizeBuf = Buffer.alloc(8);
  sizeBuf.writeBigUInt64BE(BigInt(size));

  const h = crypto.createHash('sha256');
  h.update(PREFIX);
  h.update(sizeBuf);
  h.update(head);
  if (tail) h.update(tail);
  return 'f1_' + h.digest().subarray(0, 16).toString('hex');
}
