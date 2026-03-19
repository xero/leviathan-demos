/**
 * cli.ts — Argument parsing, help text, and error formatting.
 *
 * Uses Node.js util.parseArgs (built into Bun) for argument parsing.
 * See: docs/bun/guides/process/argv.mdx
 */

import { parseArgs } from 'util';
import { stopSpinner } from './spinner.ts';

export interface ParsedArgs {
  command: string | null;
  passphrase: string | undefined;
  keyfile: string | undefined;
  output: string | undefined;
  armor: boolean;
  force: boolean;
  help: boolean;
  positionals: string[];  // [input?, output?] after the command
}

const HELP_TEXT = `
lvthn — Serpent-256 file encryption (leviathan demo)

Usage:
  lvthn <command> [options] [input] [output]

Commands:
  encrypt   Encrypt a file or stdin
  decrypt   Decrypt a file or stdin
  keygen    Generate a cryptographically secure random keyfile
  help      Show this help message

Encrypt options:
  -p, --passphrase <phrase>   Encrypt using passphrase (scrypt key derivation)
  -k, --keyfile <path>        Encrypt using a keyfile
      --armor                 Output base64 armored text instead of binary
  -o, --output <path>         Output file path
      --force                 Overwrite output file if it exists

Decrypt options:
  -p, --passphrase <phrase>   Passphrase for decryption
  -k, --keyfile <path>        Keyfile for decryption
  -o, --output <path>         Output file path (default: stdout)

  Auto-detects armored vs binary input — no --armor flag needed on decrypt.

Keygen options:
  -o, --output <path>         Output path (default: leviathan.key)
      --armor                 Output base64 armored keyfile

Examples:
  lvthn encrypt -p "correct horse battery" secret.txt
  lvthn encrypt -k my.key secret.txt secret.enc
  lvthn encrypt -p "passphrase" --armor < message.txt > message.enc
  cat secret.txt | lvthn encrypt -k my.key --armor
  lvthn decrypt -p "correct horse battery" secret.enc
  lvthn decrypt -k my.key secret.enc decrypted.txt
  lvthn keygen
  lvthn keygen -o my.key
  lvthn keygen --armor -o my.key

Exit codes:
  0   Success
  1   Authentication failure (wrong key/passphrase or tampered data)
  2   Bad arguments or missing required flags
  3   File not found or not readable
  4   Output file already exists (use --force to overwrite)
  5   Invalid or unrecognized file format
`.trim();

/**
 * Parse Bun.argv into a structured ParsedArgs object.
 * Bun.argv = [bunPath, scriptPath, ...actual args]
 * We strip the first two elements before parsing.
 */
export function parseCliArgs(): ParsedArgs {
	// Bun.argv[0] = bun executable, Bun.argv[1] = script path
	const raw = Bun.argv.slice(2);

	// Extract the command (first non-flag argument)
	const command = raw.length > 0 && !raw[0].startsWith('-') ? raw[0] : null;
	const argsAfterCommand = command !== null ? raw.slice(1) : raw;

	let parsed: ReturnType<typeof parseArgs>;
	try {
		parsed = parseArgs({
			args: argsAfterCommand,
			options: {
				passphrase: { type: 'string',  short: 'p' },
				keyfile: { type: 'string',  short: 'k' },
				output: { type: 'string',  short: 'o' },
				armor: { type: 'boolean'             },
				force: { type: 'boolean'             },
				help: { type: 'boolean', short: 'h' },
			},
			strict: false,
			allowPositionals: true,
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		die(`Argument error: ${msg}`, 2);
	}

	return {
		command,
		passphrase: parsed.values.passphrase as string | undefined,
		keyfile: parsed.values.keyfile    as string | undefined,
		output: parsed.values.output     as string | undefined,
		armor: (parsed.values.armor     as boolean | undefined) ?? false,
		force: (parsed.values.force     as boolean | undefined) ?? false,
		help: (parsed.values.help      as boolean | undefined) ?? false,
		positionals: parsed.positionals as string[],
	};
}

/** Print help to stdout and exit 0. */
export function printHelp(): never {
	process.stdout.write(HELP_TEXT + '\n');
	process.exit(0);
}

/**
 * Print an error message to stderr and exit with the given code.
 * Never prints stack traces — only human-readable messages.
 */
export function die(message: string, code = 2): never {
	stopSpinner();
	process.stderr.write(`Error: ${message}\n`);
	process.exit(code);
}

/** Print a status message to stderr (not stdout — stdout is for data). */
export function info(message: string): void {
	process.stderr.write(`${message}\n`);
}
