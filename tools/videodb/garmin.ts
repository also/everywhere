// Garmin camera metadata (Varia RCT715). Not documented by Garmin; the layout
// comes from ExifTool's QuickTime.pm / QuickTimeStream.pl and from these files.
import { Scan } from './mp4-scan';

// udta uuid: ExifTool's GarminModel. Data (after the usertype) is 4 unknown
// bytes, the unit ID (u32), then a length-prefixed model name.
const MODEL = 'f76cd76a075b4a1eb31c0e7fab7e09d4';
// moov uuid: ExifTool's GarminGPS. 33 bytes from the box start (8 header + 16
// usertype + 9), then 20-byte records: time (s since 1904), speed (mph), 6
// unknown bytes, latitude and longitude (semicircles).
const GPS = '9b630f8d637440ec8204bc5ff5091728';
const GPS_HEADER = 33;
const GPS_RECORD = 20;
// top-level uuid whose usertype starts "GRMN": a 128-byte header. The model
// name is at byte 9; a local-time Unix timestamp is at byte 45.
const HEADER_PREFIX = Buffer.from('GRMN').toString('hex');

export type GarminInfo = {
  model: string | null;
  unitId: number | null;
  // local wall time, no zone (the clip's start + ~27s on the RCT715)
  headerLocal: string | null;
  // null when the file has no GarminGPS box
  gpsRecords: number | null;
};

// A clip the camera cut off and recovered: no GarminGPS box, an empty text
// track in its place, and a duration that differs between the MP4 and GLV.
export function isRecoveredClip(scan: Scan) {
  const g = garminInfo(scan);
  return (
    !!g &&
    g.gpsRecords === null &&
    scan.tracks.some((t) => t.handler === 'text' && t.samples === 0)
  );
}

export function garminInfo(scan: Scan): GarminInfo | null {
  const model = scan.uuids.find((u) => u.at === 'udta' && u.usertype === MODEL);
  const header = scan.uuids.find(
    (u) => u.at === 'top' && u.usertype.startsWith(HEADER_PREFIX)
  );
  if (!model && !header) return null;
  const gps = scan.uuids.find((u) => u.at === 'moov' && u.usertype === GPS);

  let name: string | null = null;
  let unitId: number | null = null;
  if (model) {
    const d = Buffer.from(model.data, 'hex');
    if (d.length >= 9) {
      unitId = d.readUInt32BE(4);
      name = d.toString('latin1', 9, 9 + d[8]);
    }
  }
  let headerLocal: string | null = null;
  if (header) {
    // usertype (16) + data: byte 45 of the body is byte 29 of the data
    const d = Buffer.from(header.usertype + header.data, 'hex');
    if (d.length >= 49) {
      headerLocal = new Date(d.readUInt32BE(45) * 1000)
        .toISOString()
        .replace(/\.000Z$/, '');
      if (!name) name = d.toString('latin1', 9, 16).replace(/\0+$/, '');
    }
  }
  return {
    model: name,
    unitId,
    headerLocal,
    gpsRecords: gps
      ? Math.max(0, Math.floor((gps.size - GPS_HEADER) / GPS_RECORD))
      : null,
  };
}
