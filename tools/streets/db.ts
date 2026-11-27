// node:sqlite (built in since Node 22.5, unflagged since 22.13).

// Silence the one-time "SQLite is an experimental feature" warning.
const emit = process.emitWarning;
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const msg = typeof warning === 'string' ? warning : warning.message;
  if (msg.includes('SQLite')) return;
  return (emit as (...a: unknown[]) => void).call(process, warning, ...rest);
}) as typeof process.emitWarning;

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Param = string | number | bigint | null | Uint8Array;
export interface Statement {
  run(...params: Param[]): unknown;
  get(...params: Param[]): Row | undefined;
  all(...params: Param[]): Row[];
}
export interface Db {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync } = require('node:sqlite');

export function openDb(path: string, readOnly = false): Db {
  return new DatabaseSync(path, { readOnly }) as Db;
}
