// OpenStreetMap PBF reader. https://wiki.openstreetmap.org/wiki/PBF_Format
//
// A file is a sequence of [u32 header length][BlobHeader][Blob]. Each Blob is
// a zlib-compressed PrimitiveBlock holding a string table and groups of dense
// nodes, ways or relations. Blobs decode independently, so we inflate several
// at once on libuv's thread pool and parse them in order on the main thread.

import { promisify } from 'util';
import { inflate as inflateCb } from 'zlib';

import { Proto } from './proto';

const inflate = promisify(inflateCb);

export const NODES = 1;
export const WAYS = 2;
export const RELATIONS = 4;

interface BlobRef {
  start: number;
  end: number;
}

/** Locate every OSMData blob without decompressing anything. */
export function indexBlobs(file: Uint8Array): BlobRef[] {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const blobs: BlobRef[] = [];
  let pos = 0;
  while (pos < file.length) {
    const headerLen = view.getUint32(pos);
    pos += 4;
    const h = new Proto(file, pos, pos + headerLen);
    let type = '';
    let size = 0;
    while (h.more()) {
      const f = h.key();
      if (f === 1) type = h.string();
      else if (f === 3) size = h.varint();
      else h.skip();
    }
    pos += headerLen;
    if (type === 'OSMData') blobs.push({ start: pos, end: pos + size });
    pos += size;
  }
  return blobs;
}

async function blobData(file: Uint8Array, ref: BlobRef): Promise<Uint8Array> {
  const p = new Proto(file, ref.start, ref.end);
  while (p.more()) {
    const f = p.key();
    if (f === 1) {
      const [s, e] = p.bytes();
      return file.subarray(s, e);
    } else if (f === 3) {
      const [s, e] = p.bytes();
      return (await inflate(file.subarray(s, e))) as Uint8Array;
    } else p.skip();
  }
  throw new Error('unsupported blob compression');
}

/** Decompressed blobs in file order, `concurrency` inflating at a time. */
export async function* blocks(
  file: Uint8Array,
  refs: BlobRef[],
  concurrency = 8
): AsyncGenerator<[number, Block]> {
  const pending: Promise<Uint8Array>[] = [];
  let next = 0;
  for (let i = 0; i < refs.length; i++) {
    while (next < refs.length && pending.length < concurrency) {
      pending.push(blobData(file, refs[next++]));
    }
    yield [i, new Block(await pending.shift()!)];
  }
}

export class Tags {
  constructor(
    private strings: string[],
    public keys: number[],
    public vals: number[]
  ) {}
  get(k: string): string | undefined {
    for (let i = 0; i < this.keys.length; i++) {
      if (this.strings[this.keys[i]] === k) return this.strings[this.vals[i]];
    }
    return undefined;
  }
  toObject(only?: readonly string[]): Record<string, string> {
    const o: Record<string, string> = {};
    for (let i = 0; i < this.keys.length; i++) {
      const k = this.strings[this.keys[i]];
      if (!only || only.includes(k)) o[k] = this.strings[this.vals[i]];
    }
    return o;
  }
}

export interface Member {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role: string;
}

export interface Handlers {
  node?(id: number, lon: number, lat: number): void;
  way?(id: number, tags: Tags, refs: number[]): void;
  relation?(id: number, tags: Tags, members: Member[]): void;
}

const MEMBER_TYPES = ['node', 'way', 'relation'] as const;

function packed(p: Proto, out: number[], signed = false) {
  if (p.wire !== 2) {
    out.push(signed ? p.svarint() : p.varint());
    return;
  }
  const end = p.varint() + p.pos;
  while (p.pos < end) out.push(signed ? p.svarint() : p.varint());
}

export class Block {
  strings: string[] = [];
  granularity = 100;
  latOffset = 0;
  lonOffset = 0;
  groups: [number, number][] = [];
  /** NODES | WAYS | RELATIONS */
  contents = 0;

  constructor(public buf: Uint8Array) {
    const p = new Proto(buf);
    while (p.more()) {
      const f = p.key();
      if (f === 1) {
        const st = p.sub();
        while (st.more()) {
          if (st.key() === 1) this.strings.push(st.string());
          else st.skip();
        }
      } else if (f === 2) {
        const g = p.bytes();
        this.groups.push(g);
        const gp = new Proto(buf, g[0], g[1]);
        while (gp.more()) {
          const gf = gp.key();
          if (gf === 1 || gf === 2) this.contents |= NODES;
          else if (gf === 3) this.contents |= WAYS;
          else if (gf === 4) this.contents |= RELATIONS;
          gp.skip();
        }
      } else if (f === 17) this.granularity = p.varint();
      else if (f === 19) this.latOffset = p.varint();
      else if (f === 20) this.lonOffset = p.varint();
      else p.skip();
    }
  }

  read(h: Handlers): void {
    for (const [s, e] of this.groups) {
      const g = new Proto(this.buf, s, e);
      while (g.more()) {
        const f = g.key();
        if (f === 2 && h.node) this.dense(g.sub(), h.node);
        else if (f === 1 && h.node) this.node(g.sub(), h.node);
        else if (f === 3 && h.way) this.way(g.sub(), h.way);
        else if (f === 4 && h.relation) this.relation(g.sub(), h.relation);
        else g.skip();
      }
    }
  }

  private coord(offset: number, v: number) {
    return 1e-9 * (offset + this.granularity * v);
  }

  private dense(p: Proto, cb: NonNullable<Handlers['node']>) {
    const ids: number[] = [];
    const lats: number[] = [];
    const lons: number[] = [];
    while (p.more()) {
      const f = p.key();
      if (f === 1) packed(p, ids, true);
      else if (f === 8) packed(p, lats, true);
      else if (f === 9) packed(p, lons, true);
      else p.skip();
    }
    let id = 0;
    let lat = 0;
    let lon = 0;
    for (let i = 0; i < ids.length; i++) {
      id += ids[i];
      lat += lats[i];
      lon += lons[i];
      cb(id, this.coord(this.lonOffset, lon), this.coord(this.latOffset, lat));
    }
  }

  private node(p: Proto, cb: NonNullable<Handlers['node']>) {
    let id = 0;
    let lat = 0;
    let lon = 0;
    while (p.more()) {
      const f = p.key();
      if (f === 1) id = p.svarint();
      else if (f === 8) lat = p.svarint();
      else if (f === 9) lon = p.svarint();
      else p.skip();
    }
    cb(id, this.coord(this.lonOffset, lon), this.coord(this.latOffset, lat));
  }

  private way(p: Proto, cb: NonNullable<Handlers['way']>) {
    let id = 0;
    const keys: number[] = [];
    const vals: number[] = [];
    const deltas: number[] = [];
    while (p.more()) {
      const f = p.key();
      if (f === 1) id = p.varint();
      else if (f === 2) packed(p, keys);
      else if (f === 3) packed(p, vals);
      else if (f === 8) packed(p, deltas, true);
      else p.skip();
    }
    let ref = 0;
    for (let i = 0; i < deltas.length; i++) deltas[i] = ref += deltas[i];
    cb(id, new Tags(this.strings, keys, vals), deltas);
  }

  private relation(p: Proto, cb: NonNullable<Handlers['relation']>) {
    let id = 0;
    const keys: number[] = [];
    const vals: number[] = [];
    const roles: number[] = [];
    const memids: number[] = [];
    const types: number[] = [];
    while (p.more()) {
      const f = p.key();
      if (f === 1) id = p.varint();
      else if (f === 2) packed(p, keys);
      else if (f === 3) packed(p, vals);
      else if (f === 8) packed(p, roles);
      else if (f === 9) packed(p, memids, true);
      else if (f === 10) packed(p, types);
      else p.skip();
    }
    let ref = 0;
    const members: Member[] = memids.map((d, i) => ({
      type: MEMBER_TYPES[types[i]],
      ref: (ref += d),
      role: this.strings[roles[i]],
    }));
    cb(id, new Tags(this.strings, keys, vals), members);
  }
}
