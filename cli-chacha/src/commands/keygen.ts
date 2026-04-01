/**
 * keygen.ts — Generate a cryptographically secure random keyfile.
 *
 * Always produces a 64-byte (512-bit) key using Fortuna CSPRNG.
 */

import { ParsedArgs, die, info } from '../cli.ts';
import { generateKey } from '../crypto.ts';
import { armorKey } from '../format.ts';

export async function runKeygen(args: ParsedArgs): Promise<void> {
	const { output: outputArg, armor: useArmor, force, positionals } = args;

	// Output path: -o flag, then first positional, then default
	const outputPath = outputArg ?? positionals[0] ?? 'leviathan.key';

	// Refuse to overwrite unless --force
	const outFile = Bun.file(outputPath);
	if ((await outFile.exists()) && !force) {
		die(`Output file already exists: ${outputPath} (use --force to overwrite)`, 4);
	}

	// Generate 64-byte key from Fortuna CSPRNG
	let keyData: Uint8Array;
	try {
		keyData = await generateKey();
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		die(`Key generation failed: ${msg}`, 2);
	}

	// Write output
	if (useArmor) {
		const armored = armorKey(keyData);
		await Bun.write(outputPath, armored);
	} else {
		await Bun.write(outputPath, keyData);
	}

	info(`Generated 256-bit keyfile: ${outputPath}`);
}
