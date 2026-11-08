import { uid } from './util.js'

const KEY = 'huanhuan.v1'
const CACHE_KEY = 'huanhuan.posts.v1'
const PENDING_KEY = 'huanhuan.pending.v1'
const FONT_KEY = 'huanhuan.font'
const ANON_KEY = 'huanhuan.anon.v1'

const NAMES = ['夜里的猫', '慢半拍', '一颗橘子', '傍晚的风', '小满', '安静的海', '半糖', '青苔', '迟到的春天', '不着急']

function randomName() {
	return NAMES[Math.floor(Math.random() * NAMES.length)]
}

function now() {
	return Date.now()
}

function readKey(key, fallback) {
	try {
		const value = uni.getStorageSync(key)
		return value === '' || value === null || value === undefined ? fallback : value
	} catch (e) {
		return fallback
	}
}

function writeKey(key, value) {
	try {
		uni.setStorageSync(key, value)
	} catch (e) {
		// 本地存储失败时保持内存可用
	}
}

function emptyState() {
	return {
		profile: { name: randomName(), since: now() },
		bookmarks: [],
		readIds: [],
		settings: { sample: false },
		seeded: false,
		legacyMigrated: false
	}
}

function normalize(raw) {
	if (!raw || typeof raw !== 'object') return null
	const profile = raw.profile && raw.profile.name
		? { name: raw.profile.name, since: raw.profile.since || now() }
		: { name: randomName(), since: now() }
	return {
		profile,
		bookmarks: Array.isArray(raw.bookmarks) ? raw.bookmarks : [],
		readIds: Array.isArray(raw.readIds) ? raw.readIds : [],
		settings: Object.assign({ sample: false }, raw.settings || {}),
		seeded: !!raw.seeded,
		legacyMigrated: !!raw.legacyMigrated
	}
}

let state = null

function readPending() {
	const value = readKey(PENDING_KEY, null)
	if (!value || typeof value !== 'object') {
		return { posts: [], hugs: [], echoes: [] }
	}
	return {
		posts: Array.isArray(value.posts) ? value.posts : [],
		hugs: Array.isArray(value.hugs) ? value.hugs : [],
		echoes: Array.isArray(value.echoes) ? value.echoes : []
	}
}

function writePending(pending) {
	writeKey(PENDING_KEY, pending)
}

function migrateLegacy(raw, next) {
	const pending = readPending()
	const legacy = Array.isArray(raw.posts) ? raw.posts : []
	legacy.filter(post => post && post.mine && !post.sample).forEach(post => {
		const exists = pending.posts.some(item => item.legacyId === post.id)
		if (!exists) {
			pending.posts.push({
				localId: uid('local'),
				legacyId: post.id,
				mood: post.mood || 'tired',
				text: String(post.text || '').slice(0, 500),
				at: post.at || now()
			})
		}
	})
	writePending(pending)
	next.posts = []
}

export function ensure() {
	let raw = null
	try {
		raw = uni.getStorageSync(KEY)
	} catch (e) {
		raw = null
	}

	let next = normalize(raw)
	if (!next) {
		next = emptyState()
		next.seeded = true
		writeKey(KEY, next)
	} else if (!next.legacyMigrated) {
		migrateLegacy(raw, next)
		next.legacyMigrated = true
		writeKey(KEY, next)
	} else if (!next.seeded) {
		next.seeded = true
		writeKey(KEY, next)
	}

	state = next
	return next
}

export function getAnonId() {
	let value = readKey(ANON_KEY, '')
	if (!value) {
		value = uid('a')
		writeKey(ANON_KEY, value)
	}
	return value
}

export function getProfile() {
	return ensure().profile
}

export function renameProfile(name) {
	const next = ensure()
	const value = String(name || '').trim()
	if (!value) return next.profile
	next.profile = Object.assign({}, next.profile, { name: value.slice(0, 12) })
	writeKey(KEY, next)
	return next.profile
}

/* ------------------------- 本地文章状态 ------------------------- */

export function isBookmarked(id) {
	return ensure().bookmarks.includes(id)
}

export function toggleBookmark(id) {
	const next = ensure()
	const index = next.bookmarks.indexOf(id)
	if (index >= 0) {
		next.bookmarks.splice(index, 1)
	} else {
		next.bookmarks.push(id)
	}
	writeKey(KEY, next)
	return index < 0
}

export function markRead(id) {
	const next = ensure()
	if (!next.readIds.includes(id)) {
		next.readIds.push(id)
		writeKey(KEY, next)
	}
}

export function isRead(id) {
	return ensure().readIds.includes(id)
}

export function getLocalStats() {
	const next = ensure()
	return {
		bookmarks: next.bookmarks.length,
		read: next.readIds.length
	}
}

export function clearSamples() {
	const next = ensure()
	next.settings.sample = false
	writeKey(KEY, next)
}

export function clearAll() {
	const next = emptyState()
	next.seeded = true
	next.legacyMigrated = true
	next.settings.sample = false
	writeKey(KEY, next)
	writeKey(CACHE_KEY, [])
	writePending({ posts: [], hugs: [], echoes: [] })
	state = next
	return next
}

export function exportJSON() {
	return JSON.stringify({
		version: 2,
		local: ensure(),
		postsCache: getCachedPosts(),
		pending: readPending()
	}, null, 2)
}

export function getFontSize() {
	return readKey(FONT_KEY, 'normal')
}

export function setFontSize(value) {
	writeKey(FONT_KEY, value)
}

/* ------------------------- 云端帖子缓存 ------------------------- */

export function getCachedPosts(mood) {
	const list = readKey(CACHE_KEY, [])
	const posts = Array.isArray(list) ? list.slice().sort((a, b) => b.at - a.at) : []
	if (!mood || mood === 'all') return posts
	return posts.filter(post => post.mood === mood)
}

export function mergeCachedPosts(list) {
	if (!Array.isArray(list) || !list.length) return getCachedPosts()
	const current = readKey(CACHE_KEY, [])
	const map = new Map()
	;(Array.isArray(current) ? current : []).forEach(post => map.set(post.id, post))
	list.forEach(post => {
		if (post && post.id) map.set(post.id, post)
	})
	const merged = Array.from(map.values()).sort((a, b) => b.at - a.at).slice(0, 100)
	writeKey(CACHE_KEY, merged)
	return merged
}

export function replaceCachedPosts(list) {
	const current = readKey(CACHE_KEY, [])
	const pending = (Array.isArray(current) ? current : []).filter(post => post && post.pending)
	const map = new Map()
	pending.forEach(post => map.set(post.id, post))
	;(Array.isArray(list) ? list : []).forEach(post => {
		if (post && post.id) map.set(post.id, post)
	})
	const merged = Array.from(map.values()).sort((a, b) => b.at - a.at).slice(0, 100)
	writeKey(CACHE_KEY, merged)
	return merged
}

export function setCachedPosts(list) {
	const posts = (Array.isArray(list) ? list : []).slice(0, 100)
	writeKey(CACHE_KEY, posts)
	return posts
}

export function upsertCachedPost(post) {
	if (!post || !post.id) return
	const current = readKey(CACHE_KEY, [])
	const list = Array.isArray(current) ? current : []
	const index = list.findIndex(item => item.id === post.id)
	if (index >= 0) {
		list[index] = Object.assign({}, list[index], post)
	} else {
		list.unshift(post)
	}
	writeKey(CACHE_KEY, list.sort((a, b) => b.at - a.at).slice(0, 100))
}

export function removeCachedPost(id) {
	const current = readKey(CACHE_KEY, [])
	const list = (Array.isArray(current) ? current : []).filter(post => post.id !== id)
	writeKey(CACHE_KEY, list)
}

/* ------------------------- 文章缓存 ------------------------- */

const ARTICLE_LIST_KEY = 'huanhuan.articles.list.v1'
const ARTICLE_DETAIL_KEY = 'huanhuan.articles.detail.v1'

export function getCachedArticleList() {
	const list = readKey(ARTICLE_LIST_KEY, [])
	return Array.isArray(list) ? list : []
}

export function setCachedArticleList(list) {
	const value = (Array.isArray(list) ? list : []).slice(0, 300)
	writeKey(ARTICLE_LIST_KEY, value)
	return value
}

export function getCachedArticleDetail(id) {
	const map = readKey(ARTICLE_DETAIL_KEY, {})
	if (!map || typeof map !== 'object') return null
	return map[id] || null
}

export function setCachedArticleDetail(article) {
	if (!article || !article.id) return
	const map = readKey(ARTICLE_DETAIL_KEY, {})
	const next = map && typeof map === 'object' ? map : {}
	next[article.id] = article
	const keys = Object.keys(next)
	if (keys.length > 200) {
		// 简单的 LRU：丢掉最早写入的一批
		keys.slice(0, keys.length - 200).forEach(key => delete next[key])
	}
	writeKey(ARTICLE_DETAIL_KEY, next)
}

/* ------------------------- 待同步队列 ------------------------- */

export function getPending() {
	return readPending()
}

export function pendingCount() {
	const pending = readPending()
	return pending.posts.length + pending.hugs.length + pending.echoes.length
}

export function addPendingPost({ mood, text, moodLabel }) {
	const pending = readPending()
	const label = String(moodLabel || '').replace(/\s+/g, '').slice(0, 6)
	const item = {
		localId: uid('local'),
		mood: mood || 'tired',
		moodLabel: label,
		text: String(text || '').trim().slice(0, 500),
		at: now()
	}
	pending.posts.push(item)
	writePending(pending)
	upsertCachedPost({
		id: item.localId,
		mood: item.mood,
		moodLabel: item.moodLabel,
		text: item.text,
		at: item.at,
		hugCount: 0,
		echoCount: 0,
		isMine: true,
		hugged: false,
		pending: true
	})
	return item
}

export function addPendingHug(postId) {
	const pending = readPending()
	if (!pending.hugs.some(item => item.postId === postId)) {
		pending.hugs.push({ postId, at: now() })
		writePending(pending)
	}
}

export function addPendingEcho(postId, text) {
	const pending = readPending()
	pending.echoes.push({
		postId,
		text: String(text || '').trim().slice(0, 40),
		at: now()
	})
	writePending(pending)
}

export async function flushPending(api) {
	const pending = readPending()
	if (!pending.posts.length && !pending.hugs.length && !pending.echoes.length) {
		return { posts: 0, hugs: 0, echoes: 0, remain: 0 }
	}

	const result = { posts: 0, hugs: 0, echoes: 0, remain: 0 }
	const remainPosts = []
	const remainHugs = []
	const remainEchoes = []
	let needLogin = false

	for (const item of pending.posts) {
		try {
			const res = await api.createPost({ mood: item.mood, text: item.text, moodLabel: item.moodLabel || '' })
			removeCachedPost(item.localId)
			if (res && res.post) upsertCachedPost(res.post)
			result.posts++
		} catch (error) {
			if (error && error.code === 'NEED_LOGIN') {
				needLogin = true
				remainPosts.push(item)
			} else {
				remainPosts.push(item)
			}
		}
	}

	if (!needLogin) {
		for (const item of pending.hugs) {
			try {
				const res = await api.hug({ postId: item.postId })
				if (res && res.ok) {
					const post = getCachedPosts().find(p => p.id === item.postId)
					if (post) upsertCachedPost({ ...post, hugged: true, hugCount: res.hugCount })
					result.hugs++
				}
			} catch (error) {
				if (error && error.code === 'NEED_LOGIN') needLogin = true
				remainHugs.push(item)
			}
		}

		for (const item of pending.echoes) {
			try {
				await api.echo({ postId: item.postId, text: item.text })
				result.echoes++
			} catch (error) {
				if (error && error.code === 'NEED_LOGIN') needLogin = true
				remainEchoes.push(item)
			}
		}
	} else {
		remainHugs.push(...pending.hugs)
		remainEchoes.push(...pending.echoes)
	}

	const nextPending = {
		posts: remainPosts,
		hugs: remainHugs,
		echoes: remainEchoes
	}
	writePending(nextPending)
	result.remain = nextPending.posts.length + nextPending.hugs.length + nextPending.echoes.length
	return result
}

/* ------------------------- 兼容帖子展示 ------------------------- */

export function isHugged(post) {
	if (!post) return false
	if (typeof post.hugged === 'boolean') return post.hugged
	return (post.echoes || []).some(echo => echo.kind === 'hug' && echo.mine)
}

export function hugCount(post) {
	if (!post) return 0
	if (typeof post.hugCount === 'number') return post.hugCount
	return (post.echoes || []).filter(echo => echo.kind === 'hug').length
}

export function wordEchoes(post) {
	if (!post) return []
	if (Array.isArray(post.echoes)) {
		return post.echoes
			.filter(echo => echo.kind === 'word')
			.sort((a, b) => a.at - b.at)
	}
	return []
}
