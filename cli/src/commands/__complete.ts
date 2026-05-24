/**
 * __complete.ts: hidden completion oracle invoked by shell scripts.
 *
 * Called as: lvthn __complete -- <word0> <word1> ... <wordN>
 * Outputs one completion candidate per line to stdout.
 */

import { getCompletions } from '../completions.ts';

export function runComplete(): void {
	// argv: ['bun'|binary, '__complete', '--', 'lvthn', ...words]
	const sep = Bun.argv.indexOf('--');
	const words = sep >= 0 ? Bun.argv.slice(sep + 1) : [];
	// words[0] should be 'lvthn'; if the shell omitted it, prepend it
	const normalized = words[0] === 'lvthn' ? words : ['lvthn', ...words];
	const candidates = getCompletions(normalized);
	process.stdout.write(candidates.join('\n') + (candidates.length ? '\n' : ''));
}
