/**
 * spinner.ts — Ouroboros terminal animation.
 *
 * Plays a looping snake animation on stderr while work is in progress.
 * Only animates when stderr is a TTY; silently no-ops otherwise.
 */

const GREEN  = '\x1b[38;5;22m';
const RED    = '\x1b[38;5;160m';
const LEADER = '\x1b[38;5;23m';
const RESET  = '\x1b[0m';

const LEADER_LINES = [
	' \u2592  \u2584\u2580\u2580 \u2592 \u2592 \u2588 \u2584\u2580\u2584 \u2580\u2588\u2580 \u2588 \u2592 \u2584\u2580\u2584 \u2588\u2580\u2584  ',
	' \u2593  \u2593\u2580  \u2593 \u2593 \u2593 \u2593\u2584\u2593  \u2593  \u2593\u2580\u2593 \u2593\u2584\u2593 \u2593 \u2593  ',
	' \u2580\u2584 \u2580\u2584\u2584 \u2580\u2584\u2580 \u2592 \u2592 \u2592  \u2592  \u2592 \u2588 \u2592 \u2592 \u2592 \u2588  ',
].map(l => LEADER + l + RESET);

const FRAMES = [
	[' \u2584\u2580\u2580\u2580\u2584 ', '\u2588     \u2588', '` \u2584\u2584\u2584\u2580 '],
	[' \u2584\u2580\u2580\u2580\u2584 ', '\u2588     \u2588', ' \u2580\u2584, \u2580 '],
	[' \u2584\u2580\u2580\u2580\u2584 ', '\u2588     \u2588', ' \u2580\u2584\u2584\u2584, '],
	[' \u2584\u2580\u2580\u2580 ,', '\u2588     \u2588', ' \u2580\u2584\u2584\u2584\u2580 '],
	[' \u2584 `\u2580\u2584 ', '\u2588     \u2588', ' \u2580\u2584\u2584\u2584\u2580 '],
	['  \'\u2580\u2580\u2584 ', '\u2588     \u2588', ' \u2580\u2584\u2584\u2584\u2580 '],
];

const RED_CHARS = new Set(['\'', ',', '`']);

function colorizeSnake(lines: string[]): string[] {
	return lines.map(line => {
		let out = '';
		for (const ch of line) {
			if (RED_CHARS.has(ch))  out += RED   + ch + RESET;
			else if (ch !== ' ')    out += GREEN + ch + RESET;
			else                    out += ch;
		}
		return out;
	});
}

const FRAMES_COLORED = FRAMES.map(colorizeSnake);
const FRAME_HEIGHT   = 3;
const DELAY_MS       = 220;

function clearFrameLines(): void {
	let seq = '';
	for (let i = 0; i < FRAME_HEIGHT; i++) {
		seq += '\x1b[2K\x1b[1A';
	}
	seq += '\x1b[2K';
	process.stderr.write(seq);
}

function drawFrame(snakeLines: string[]): void {
	const rows = snakeLines.map((sl, i) => LEADER_LINES[i] + sl);
	process.stderr.write('\r' + rows.join('\n\r') + '\n');
}

let timer: ReturnType<typeof setInterval> | null = null;
let frameIdx = 0;

/**
 * Start the ouroboros animation on stderr.
 * No-ops if stderr is not a TTY.
 */
export function startSpinner(): void {
	if (!process.stderr.isTTY) return;

	// Hide cursor
	process.stderr.write('\x1b[?25l\n');

	frameIdx = 0;
	drawFrame(FRAMES_COLORED[0]);

	timer = setInterval(() => {
		clearFrameLines();
		frameIdx = (frameIdx + 1) % FRAMES_COLORED.length;
		drawFrame(FRAMES_COLORED[frameIdx]);
	}, DELAY_MS);
}

/**
 * Stop the animation and restore the terminal.
 */
export function stopSpinner(): void {
	if (timer === null) return;

	clearInterval(timer);
	timer = null;

	// Clear the animation and show cursor
	clearFrameLines();
	process.stderr.write('\x1b[2K\x1b[?25h');
}

/** Duration of one complete animation cycle in milliseconds. */
export const FULL_CYCLE_MS = FRAMES.length * DELAY_MS; // 6 × 220 = 1320ms

/**
 * Returns a promise that resolves after `ms` milliseconds.
 * Use with the spinner to enforce a minimum display time:
 *
 *   startSpinner();
 *   const minDisplay = waitMs(FULL_CYCLE_MS);
 *   await doWork();
 *   await minDisplay;  // waits for remainder if work was fast; no-op if slow
 *   stopSpinner();
 */
export function waitMs(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}
