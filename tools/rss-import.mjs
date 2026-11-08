#!/usr/bin/env node
// 零依赖 RSS / Atom 导入工具（Node 18+）
// 用法：
//   node tools/rss-import.mjs https://example.com/feed.xml
//   node tools/rss-import.mjs                       # 读取 tools/feeds.json
//   node tools/rss-import.mjs --dry                 # 只打印标题，不写文件
//   node tools/rss-import.mjs --limit 10 --out tmp.json
//   node tools/rss-import.mjs --json --out docs/import/batch.json  # 输出纯 JSON
//   node tools/rss-import.mjs --feeds tools/feeds.example.json     # 换一个源清单
//   node tools/rss-import.mjs --ua "Mozilla/5.0 ..." # 遇到 403 时换 UA
//   node tools/rss-import.mjs --dry https://example.com/feed.xml

import { readFile, writeFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const feedsFile = path.join(here, 'feeds.json')
const outputFile = path.join(root, 'common', 'data', 'articles.generated.js')

const ENTITIES = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	hellip: '…',
	mdash: '—',
	ndash: '–',
	rsquo: '’',
	lsquo: '‘',
	ldquo: '“',
	rdquo: '”'
}

function decodeEntities(value) {
	return String(value || '').replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code) => {
		if (code[0] === '#') {
			const isHex = code[1] === 'x' || code[1] === 'X'
			const num = parseInt(isHex ? code.slice(2) : code.slice(1), isHex ? 16 : 10)
			return Number.isFinite(num) ? String.fromCodePoint(num) : match
		}
		return ENTITIES[code] || match
	})
}

function stripCDATA(value) {
	return String(value || '')
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
		.trim()
}

function stripTags(value) {
	return decodeEntities(stripCDATA(value))
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<\/(p|div|br|li|h[1-6])>/gi, '\n')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, ' ')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n\s*\n+/g, '\n')
		.trim()
}

function pick(block, names) {
	for (const name of names) {
		const matched = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '>', 'i'))
		if (matched) return matched[1]
	}
	return ''
}

function pickLink(block) {
	const plain = pick(block, ['link'])
	if (plain && !plain.includes('<')) return stripCDATA(plain).trim()
	const href = block.match(/<link[^>]*href=["']([^"']+)["']/i)
	return href ? href[1] : ''
}

// 预计阅读时间：中文约 150 字/分，英文约 200 词/分，向上取整
function estimateMinutes(text) {
	const value = String(text || '')
	const cjk = (value.match(/[\u4e00-\u9fa5]/g) || []).length
	if (cjk > value.length * 0.2) {
		return Math.max(1, Math.ceil(value.length / 150))
	}
	const words = value.trim() ? value.trim().split(/\s+/).length : 0
	return Math.max(1, Math.ceil(words / 200))
}

function hash(value) {
	let h = 5381
	const text = String(value || '')
	for (let i = 0; i < text.length; i++) {
		h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
	}
	return h.toString(36)
}

function cutSummary(text, max = 120) {
	const value = String(text || '').replace(/\s+/g, ' ').trim()
	if (value.length <= max) return value
	return value.slice(0, max).replace(/[，,、；;：:\s]+$/, '') + '…'
}

function toParagraphs(text) {
	return String(text || '')
		.split(/\n+/)
		.flatMap(block => block.split(/(?<=[。！？!?])/))
		.map(item => item.trim())
		.filter(Boolean)
		.slice(0, 12)
}

function parseFeed(xml, sourceUrl, sourceName) {
	const items = []
	const itemRegex = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi
	let matched
	while ((matched = itemRegex.exec(xml)) !== null) {
		const block = matched[2]
		const title = stripTags(pick(block, ['title']))
		if (!title) continue
		const link = pickLink(block)
		const summary = stripTags(pick(block, ['description', 'summary', 'content']))
		const dateText = stripCDATA(pick(block, ['pubDate', 'published', 'updated']))
		const at = dateText ? Date.parse(dateText) : NaN
		const body = toParagraphs(summary)
		items.push({
			id: 'rss-' + hash(link || title),
			title,
			category: '外部导入',
			source: sourceName || new URL(sourceUrl).hostname,
			summary: cutSummary(summary.split('\n')[0] || title),
			body: body.length ? body : [summary || title],
			url: link || sourceUrl,
			at: Number.isFinite(at) ? at : Date.now(),
			minutes: estimateMinutes(body.join('')),
			sample: false
		})
	}
	return items
}

function toJS(items) {
	return '// 该文件由 tools/rss-import.mjs 生成，请勿手动编辑。\n' +
		'export default ' + JSON.stringify(items, null, '\t') + '\n'
}

function toJSON(items) {
	return JSON.stringify(items, null, '\t') + '\n'
}

async function loadFeeds(options) {
	if (options.urls.length) {
		return options.urls.map(url => ({ url, name: '' }))
	}
	const file = options.feeds || feedsFile
	try {
		await access(file)
		const raw = await readFile(file, 'utf8')
		const json = JSON.parse(raw)
		const list = Array.isArray(json) ? json : json.feeds
		if (!Array.isArray(list)) throw new Error('feeds 文件必须是数组，或包含 feeds 数组')
		return list
			.map(item => {
				if (typeof item === 'string') return { url: item, name: '' }
				return { url: item && item.url, name: (item && item.name) || '' }
			})
			.filter(item => item.url)
	} catch (error) {
		if (error.code === 'ENOENT') {
			throw new Error('没有传入 URL，且 ' + path.relative(root, file) + ' 不存在')
		}
		throw error
	}
}

function parseArgs(argv) {
	const options = {
		urls: [],
		out: outputFile,
		feeds: '',
		limit: 20,
		dry: false,
		json: false,
		ua: 'huanhuan-rss-import/1.0 (+https://example.com)'
	}
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (arg === '--out') {
			const value = argv[++i]
			if (!value) throw new Error('--out 需要跟一个文件路径')
			options.out = path.resolve(root, value)
		} else if (arg === '--feeds') {
			const value = argv[++i]
			if (!value) throw new Error('--feeds 需要跟一个文件路径')
			options.feeds = path.resolve(root, value)
		} else if (arg === '--limit') {
			options.limit = Math.max(1, Number(argv[++i]) || 20)
		} else if (arg === '--ua') {
			const value = argv[++i]
			if (!value) throw new Error('--ua 需要跟一个 User-Agent')
			options.ua = value
		} else if (arg === '--dry') {
			options.dry = true
		} else if (arg === '--json') {
			options.json = true
		} else if (!arg.startsWith('-')) {
			options.urls.push(arg)
		}
	}
	return options
}

async function main() {
	const options = parseArgs(process.argv.slice(2))
	const feeds = await loadFeeds(options)
	if (!feeds.length) {
		console.log('没有可导入的 feed，保持原文件不变。')
		return
	}

	const results = []
	for (const feed of feeds) {
		const url = feed.url
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), 15000)
		try {
			const response = await fetch(url, {
				headers: {
					'user-agent': options.ua,
					accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
				},
				signal: controller.signal
			})
			if (!response.ok) {
				const hint = response.status === 403 || response.status === 401
					? '（可能被反爬拦截，试试浏览器 UA 或换源）'
					: ''
				throw new Error('HTTP ' + response.status + hint)
			}
			const xml = await response.text()
			const items = parseFeed(xml, url, feed.name).slice(0, options.limit)
			results.push(...items)
			console.log('抓到 ' + items.length + ' 条：' + (feed.name || url))
		} catch (error) {
			const message = error.name === 'AbortError' ? '请求超时（15 秒）' : error.message
			console.error('跳过 ' + url + '：' + message)
		} finally {
			clearTimeout(timer)
		}
	}

	const seen = new Set()
	const unique = results.filter(item => {
		if (seen.has(item.id)) return false
		seen.add(item.id)
		return true
	})

	if (!unique.length) {
		console.log('没有抓到可用内容，原文件保持不变。')
		return
	}

	if (options.dry) {
		console.log('\n【dry-run】共 ' + unique.length + ' 条，未写入文件：')
		unique.forEach((item, index) => {
			console.log((index + 1) + '. [' + item.category + '] ' + item.title + '  ' + item.url)
		})
		return
	}

	await writeFile(options.out, options.json ? toJSON(unique) : toJS(unique), 'utf8')
	console.log('共写入 ' + unique.length + ' 条到 ' + path.relative(root, options.out))
	console.log('下一步：打开这个文件，全选复制，粘贴到后台「文章管理 → 批量导入」。')
	console.log('请人工过一遍：营销号、标题党、带诊断结论的内容一律不要上。')
}

main().catch(error => {
	console.error(error.message)
	process.exitCode = 1
})
