import { createHighlighter } from 'shiki'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const r = f => readFileSync(join(__dir, f), 'utf8')

const theme = JSON.parse(r('leviathan-theme.json'))
const hl = await createHighlighter({ themes: [theme], langs: ['typescript', 'bash', 'sh'] })

const src = r('index.src.html')

const out = src.replace(
	/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g,
	(_, lang, code) => hl.codeToHtml(
		code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim(),
		{ lang, theme: 'leviathan' }
	)
)

writeFileSync(join(__dir, 'index.html'), out)
console.log('built → index.html')
