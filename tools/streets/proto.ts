// Minimal protobuf wire-format reader: just enough for OSM PBF.
// Values are JS numbers; OSM ids and coordinates fit well within 2^53.

export class Proto {
  pos: number;
  constructor(
    public buf: Uint8Array,
    start = 0,
    public end = buf.length
  ) {
    this.pos = start;
  }

  more(): boolean {
    return this.pos < this.end;
  }

  /** Reads a field key; returns field number, sets this.wire. */
  wire = 0;
  key(): number {
    const k = this.varint();
    this.wire = k & 7;
    return k >>> 3;
  }

  varint(): number {
    const b = this.buf;
    let byte = b[this.pos++];
    let v = byte & 0x7f;
    if (byte < 0x80) return v;
    byte = b[this.pos++];
    v |= (byte & 0x7f) << 7;
    if (byte < 0x80) return v;
    byte = b[this.pos++];
    v |= (byte & 0x7f) << 14;
    if (byte < 0x80) return v;
    byte = b[this.pos++];
    v = (v | ((byte & 0x7f) << 21)) >>> 0;
    if (byte < 0x80) return v;
    // beyond 28 bits: switch to float arithmetic
    let mul = 2 ** 28;
    do {
      byte = b[this.pos++];
      v += (byte & 0x7f) * mul;
      mul *= 128;
    } while (byte >= 0x80);
    return v;
  }

  svarint(): number {
    const v = this.varint();
    // zigzag without 32-bit bitwise ops
    return v % 2 === 0 ? v / 2 : -(v + 1) / 2;
  }

  /** Length-delimited field: returns [start, end) and skips past it. */
  bytes(): [number, number] {
    const len = this.varint();
    const s = this.pos;
    this.pos += len;
    return [s, s + len];
  }

  string(): string {
    const [s, e] = this.bytes();
    return decoder.decode(this.buf.subarray(s, e));
  }

  skip(): void {
    switch (this.wire) {
      case 0:
        this.varint();
        break;
      case 1:
        this.pos += 8;
        break;
      case 2: {
        // not `this.pos += this.varint()`: that reads pos before varint() advances it
        const len = this.varint();
        this.pos += len;
        break;
      }
      case 5:
        this.pos += 4;
        break;
      default:
        throw new Error(`unsupported wire type ${this.wire}`);
    }
  }

  /** Sub-reader over a length-delimited field. */
  sub(): Proto {
    const [s, e] = this.bytes();
    return new Proto(this.buf, s, e);
  }
}

const decoder = new TextDecoder();
