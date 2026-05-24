/**
 * completion.ts: print the shell completion script for the given shell.
 *
 * Usage: lvthn completion <bash|zsh|fish|pwsh>
 */

import { bashScript, zshScript, fishScript, pwshScript } from '../completions.ts';
import { die } from '../cli.ts';

const SHELLS = ['bash', 'zsh', 'fish', 'pwsh'];

export function runCompletion(): void {
	const shell = Bun.argv[3]?.toLowerCase();
	if (!shell || !SHELLS.includes(shell)) {
		die(`Usage: lvthn completion <${SHELLS.join('|')}>`, 2);
	}
	const scripts: Record<string, () => string> = {
		bash: bashScript,
		zsh: zshScript,
		fish: fishScript,
		pwsh: pwshScript,
	};
	process.stdout.write(scripts[shell]());
}
