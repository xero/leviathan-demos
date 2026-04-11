import { spawnSync } from 'child_process';
import { randomBytes as nodeRandomBytes } from 'crypto';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Absolute path to the CLI entrypoint — import.meta.url is portable across
// Bun and Node; import.meta.dir is Bun-only and undefined under Vitest/Node.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.resolve(__dirname, '../../src/main.ts');

const LVTHN_BIN = process.env.LVTHN_BIN;

// When LVTHN_BIN is set (test:dist), spawn the compiled binary directly.
// Otherwise spawn via `bun src/main.ts` (source target, no build required).
const SPAWN_CMD  = LVTHN_BIN ? LVTHN_BIN : 'bun';
const SPAWN_ARGS = LVTHN_BIN ? []        : [ENTRY];

export interface RunResult {
  stdout: string;
  stderr: string;
  status:  number;
}

/**
 * Spawn `bun src/main.ts <args>` synchronously (or compiled binary if LVTHN_BIN is set).
 * stdin is ignored unless stdinData is provided.
 *
 * stdout is returned as a binary string so that Buffer.from(r.stdout, 'binary')
 * always recovers the exact bytes — required for binary round-trip tests.
 */
export function run(args: string[], opts: {
  cwd?:      string;
  stdinData?: Buffer | Uint8Array;
} = {}): RunResult {
  const result = spawnSync(SPAWN_CMD, [...SPAWN_ARGS, ...args], {
    cwd:   opts.cwd,
    input: opts.stdinData,
    env:   { ...process.env },
  });
  return {
    stdout: result.stdout?.toString('binary') ?? '',
    stderr: result.stderr?.toString() ?? '',
    status: result.status ?? 1,
  };
}

/**
 * Return a Buffer of `size` random bytes.
 * Uses Node's crypto.randomBytes — no 65536-byte cap (unlike getRandomValues).
 */
export function randomBytes(size: number): Buffer {
  return nodeRandomBytes(size);
}
