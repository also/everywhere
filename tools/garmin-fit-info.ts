import fs from 'fs';
import { unzipSync } from 'fflate';

import { dataPath } from './data';

// Summarizes what's in a Garmin original activity file: which sensors were
// connected, Varia radar events, Connect IQ developer fields and any messages
// that aren't in the public FIT profile.
//
//   node tools garmin-fit-info <activity id | .zip | .fit> ...
//   node tools garmin-fit-info --json <activity id>   # dump all decoded messages

// @garmin/fitsdk is ESM-only, and ts-node compiles `import()` to `require()`
// for commonjs, so hide the import from TypeScript.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const importEsm = new Function('s', 'return import(s)') as (
  s: string
) => Promise<any>;

export async function decodeFit(bytes: Uint8Array) {
  const { Decoder, Stream } = await importEsm('@garmin/fitsdk');
  const decoder = new Decoder(Stream.fromByteArray(bytes));
  if (!decoder.isFIT()) {
    throw new Error('not a FIT file');
  }
  const { messages, errors } = decoder.read({ includeUnknownData: true });
  if (errors.length > 0) {
    console.error('decode errors:', errors);
  }
  return messages as Record<string, any[]>;
}

function readFitFiles(arg: string): { name: string; bytes: Uint8Array }[] {
  const file = /^\d+$/.test(arg)
    ? dataPath('garmin-activities', `${arg}.zip`)
    : arg;
  const bytes = new Uint8Array(fs.readFileSync(file));
  if (!file.endsWith('.zip')) {
    return [{ name: file, bytes }];
  }
  return Object.entries(unzipSync(bytes)).map(([name, contents]) => ({
    name: `${file}:${name}`,
    bytes: contents,
  }));
}

function hex(bytes: number[] | undefined) {
  return bytes?.map((b) => b.toString(16).padStart(2, '0')).join('') ?? '?';
}

function describeDevices(messages: Record<string, any[]>) {
  const seen = new Set<string>();
  for (const d of messages.deviceInfoMesgs ?? []) {
    const desc = [
      d.manufacturer,
      d.garminProduct ?? d.product,
      d.productName,
      d.antplusDeviceType ?? d.deviceType,
      d.sourceType,
      d.serialNumber && `serial ${d.serialNumber}`,
    ]
      .filter((x) => x != null)
      .join(' / ');
    if (!seen.has(desc)) {
      seen.add(desc);
      console.log(`  ${desc}`);
    }
  }
}

function describeRadar(messages: Record<string, any[]>) {
  const alerts = (messages.eventMesgs ?? []).filter(
    (e) => e.event === 'radarThreatAlert'
  );
  if (alerts.length === 0) {
    console.log('  no radarThreatAlert events');
    return;
  }
  const maxOf = (k: string) => Math.max(...alerts.map((a) => a[k] ?? 0));
  console.log(`  ${alerts.length} radarThreatAlert events`);
  console.log(`  max threats at once: ${maxOf('radarThreatCount')}`);
  console.log(
    `  max approach speed: ${maxOf('radarThreatMaxApproachSpeed')} m/s`
  );
  console.log('  first few:');
  for (const a of alerts.slice(0, 5)) {
    console.log(
      `    ${a.timestamp?.toISOString?.() ?? a.timestamp} level=${a.radarThreatLevelMax} count=${a.radarThreatCount} avg=${a.radarThreatAvgApproachSpeed} max=${a.radarThreatMaxApproachSpeed}`
    );
  }
}

function describeDeveloperFields(messages: Record<string, any[]>) {
  const apps = messages.developerDataIdMesgs ?? [];
  const fields = messages.fieldDescriptionMesgs ?? [];
  if (apps.length === 0 && fields.length === 0) {
    console.log('  none');
    return;
  }
  for (const app of apps) {
    console.log(
      `  app ${hex(app.applicationId)} (index ${app.developerDataIndex}, version ${app.applicationVersion})`
    );
  }

  // the decoder keys developer field values by the `key` it assigns to each
  // field description
  const valuesByKey = new Map<number, { mesg: string; values: any[] }[]>();
  for (const [mesgKey, list] of Object.entries(messages)) {
    for (const m of list) {
      for (const [k, v] of Object.entries(m.developerFields ?? {})) {
        const entries = valuesByKey.get(Number(k)) ?? [];
        let entry = entries.find((e) => e.mesg === mesgKey);
        if (!entry) {
          entry = { mesg: mesgKey, values: [] };
          entries.push(entry);
        }
        entry.values.push(v);
        valuesByKey.set(Number(k), entries);
      }
    }
  }

  for (const f of fields) {
    console.log(
      `  field "${f.fieldName}" [${f.units ?? ''}] app index ${f.developerDataIndex} #${f.fieldDefinitionNumber}`
    );
    for (const { mesg, values } of valuesByKey.get(f.key) ?? []) {
      const numbers = values.filter((v) => typeof v === 'number');
      const summary =
        values.length === 1
          ? JSON.stringify(values[0])
          : numbers.length === values.length
            ? `n=${values.length} min=${Math.min(...numbers)} max=${Math.max(...numbers)} last=${numbers[numbers.length - 1]}`
            : `n=${values.length} last=${JSON.stringify(values[values.length - 1])}`;
      console.log(`    ${mesg}: ${summary}`);
    }
  }
}

function describe(name: string, messages: Record<string, any[]>) {
  console.log(`\n${name}`);
  const session = messages.sessionMesgs?.[0];
  if (session) {
    console.log(
      `  ${session.sport}/${session.subSport} ${session.startTime?.toISOString?.()} ${((session.totalDistance ?? 0) / 1000).toFixed(1)} km`
    );
  }
  console.log('devices:');
  describeDevices(messages);
  console.log('radar:');
  describeRadar(messages);
  console.log('developer fields:');
  describeDeveloperFields(messages);

  const known: string[] = [];
  const unknown: string[] = [];
  for (const [k, list] of Object.entries(messages)) {
    (/^\d+$/.test(k) ? unknown : known).push(`${k}=${list.length}`);
  }
  console.log(`messages: ${known.join(' ')}`);
  console.log(
    `unknown messages (not in public profile): ${unknown.join(' ') || 'none'}`
  );
}

export default async function ({
  _: args,
  json,
}: {
  _: string[];
  json?: boolean | string;
}) {
  // minimist parses `--json 123` as json=123
  if (json !== undefined && typeof json !== 'boolean') {
    args = [String(json), ...args];
  }
  if (args.length === 0) {
    throw new Error('usage: garmin-fit-info [--json] <activity id | file> ...');
  }
  for (const arg of args) {
    for (const { name, bytes } of readFitFiles(String(arg))) {
      if (!name.toLowerCase().endsWith('.fit')) {
        console.log(`\n${name}: not a FIT file, skipping`);
        continue;
      }
      const messages = await decodeFit(bytes);
      if (json) {
        console.log(JSON.stringify(messages, null, 2));
      } else {
        describe(name, messages);
      }
    }
  }
}
