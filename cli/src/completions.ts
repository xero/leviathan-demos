/**
 * completions.ts — Pure completion logic + shell script templates.
 * No imports from the rest of the app. No shell-specific runtime code.
 */

const COMMANDS = ['encrypt', 'decrypt', 'keygen', 'help'];

const FLAGS: Record<string, string[]> = {
	encrypt: [
		'--passphrase',
		'--keyfile',
		'--cipher',
		'--armor',
		'--output',
		'--force',
		'--help',
	],
	decrypt: [
		'--passphrase',
		'--keyfile',
		'--output',
		'--force',
		'--help',
	],
	keygen: [
		'--output',
		'--armor',
		'--force',
		'--help',
	],
};

const MUTEX: Record<string, string[][]> = {
	encrypt: [['-p', '--passphrase', '-k', '--keyfile']],
	decrypt: [['-p', '--passphrase', '-k', '--keyfile']],
	keygen: [],
};

const VALUE_FLAGS: Record<string, string[]> = {
	'-c': ['serpent', 'chacha'],
	'--cipher': ['serpent', 'chacha'],
	'-k': ['__files__'],
	'--keyfile': ['__files__'],
	'-o': ['__files__'],
	'--output': ['__files__'],
	'-p': [],
	'--passphrase': [],
};

// Short/long alias pairs — used to suppress both forms when either is seen
const ALIASES: Record<string, string[]> = {
	'-p': ['--passphrase'],  '--passphrase': ['-p'],
	'-k': ['--keyfile'],     '--keyfile': ['-k'],
	'-c': ['--cipher'],      '--cipher': ['-c'],
	'-o': ['--output'],      '--output': ['-o'],
	'-h': ['--help'],        '--help': ['-h'],
};

const FILE_POSITIONAL_CMDS = new Set(['encrypt', 'decrypt']);

export function getCompletions(words: string[]): string[] {
	// words[0] = 'lvthn', strip it
	const toks = words.slice(1);

	// top-level: no subcommand yet
	if (toks.length === 0) return COMMANDS;
	if (toks.length === 1 && !toks[0].startsWith('-')) {
		return COMMANDS.filter(c => c.startsWith(toks[0]));
	}

	const cmd = toks[0];
	if (!FLAGS[cmd]) return [];  // unknown command

	// tokens before the current (incomplete) one
	const before = toks.slice(1, -1);
	const _cur   = toks[toks.length - 1];  // intentionally unused — filtering is the shell's job
	const prev   = before[before.length - 1] ?? cmd;

	// if prev is a value-consuming flag, return its values
	if (prev in VALUE_FLAGS) return VALUE_FLAGS[prev];

	// scan seen flags from before[]
	const seen = new Set<string>();
	for (let i = 0; i < before.length; i++) {
		const tok = before[i];
		if (tok.startsWith('-')) {
			seen.add(tok);
			// skip next token if this flag consumes a value
			if (tok in VALUE_FLAGS) i++;
		}
	}

	// collect suppressed flags from triggered mutex groups
	const suppressed = new Set<string>();
	for (const group of (MUTEX[cmd] ?? [])) {
		if (group.some(f => seen.has(f))) {
			group.forEach(f => suppressed.add(f));
		}
	}
	// also suppress flags already seen (deduplicate booleans + suppress aliases)
	seen.forEach(f => {
		suppressed.add(f);
		for (const alias of (ALIASES[f] ?? [])) suppressed.add(alias);
	});

	// remaining flags
	const remaining = (FLAGS[cmd] ?? []).filter(f => !suppressed.has(f));

	// file positionals
	const result = [...remaining];
	if (FILE_POSITIONAL_CMDS.has(cmd)) result.push('__files__');

	return result;
}

export function bashScript(): string {
	return `\
_lvthn_complete() {
  local cur prev words cword
  _init_completion 2>/dev/null || {
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    words=("\${COMP_WORDS[@]}")
    cword=$COMP_CWORD
  }
  COMPREPLY=()
  local candidates
  candidates=$(lvthn __complete -- "\${words[@]}" 2>/dev/null) || return
  local files=0
  local flags=()
  while IFS= read -r line; do
    [[ "$line" == "__files__" ]] && files=1 && continue
    flags+=("$line")
  done <<< "$candidates"
  // eslint-disable-next-line no-useless-escape
  if [[ \${#flags[@]} -gt 0 ]]; then
    COMPREPLY+=($(compgen -W "\${flags[*]}" -- "$cur"))
  fi
  if [[ $files -eq 1 ]]; then
    COMPREPLY+=($(compgen -f -- "$cur"))
  fi
}
complete -F _lvthn_complete lvthn
`;
}

export function zshScript(): string {
	return `\
#compdef lvthn
_lvthn() {
  local candidates
  candidates=$(lvthn __complete -- "\${words[@]}" 2>/dev/null) || return
  local -a flags
  local files=0
  while IFS= read -r line; do
    [[ "$line" == "__files__" ]] && files=1 && continue
    flags+=("$line")
  done <<< "$candidates"
  if (( \${#flags[@]} )); then
    _describe 'option' flags
  fi
  if (( files )); then
    _files
  fi
}
_lvthn
`;
}

export function fishScript(): string {
	return `\
function __lvthn_complete
  set -l tokens (commandline -opc)
  set -l cur (commandline -ct)
  set -l candidates (lvthn __complete -- $tokens $cur 2>/dev/null)
  for c in $candidates
    if test "$c" = "__files__"
      __fish_complete_path $cur
    else
      echo $c
    end
  end
end
complete -c lvthn -f -a '(__lvthn_complete)'
`;
}

export function pwshScript(): string {
	return `\
Register-ArgumentCompleter -Native -CommandName lvthn -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $words = $commandAst.CommandElements | ForEach-Object { $_.Value }
  $candidates = & lvthn __complete -- @words 2>$null
  foreach ($c in $candidates) {
    if ($c -eq '__files__') {
      Get-ChildItem -Path "$wordToComplete*" -ErrorAction SilentlyContinue |
        ForEach-Object {
          [System.Management.Automation.CompletionResult]::new(
            $_.Name, $_.Name, 'ParameterValue', $_.Name)
        }
    } else {
      [System.Management.Automation.CompletionResult]::new(
        $c, $c, 'ParameterValue', $c)
    }
  }
}
`;
}
