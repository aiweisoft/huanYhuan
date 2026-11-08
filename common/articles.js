// 「读一点」数据服务
// 优先云端（后台可管理），失败或为空时回落到内置文章，保证离线也有内容

import { api } from './api.js'
import { ARTICLES } from './data/articles.js'
import {
	getCachedArticleList,
	setCachedArticleList,
	getCachedArticleDetail,
	setCachedArticleDetail
} from './store.js'

export const BUILTIN_ARTICLES = ARTICLES

function withBodyFallback(list) {
	return list.map(item => {
		if (item && item.body && item.body.length) return item
		const builtin = ARTICLES.find(a => a.id === item.id)
		const merged = builtin ? Object.assign({}, builtin, item) : item
		return Object.assign({}, merged, { body: merged.body || [] })
	})
}

/** 默认排序：按更新时间倒序，没有更新时间时用发布时间 */
function sortByUpdated(list) {
	return (Array.isArray(list) ? list.slice() : []).sort((a, b) => {
		const left = (a && (a.updatedAt || a.at)) || 0
		const right = (b && (b.updatedAt || b.at)) || 0
		return right - left
	})
}

/** 同步读取：缓存优先，其次内置 */
export function getArticleList() {
	const cached = getCachedArticleList()
	return withBodyFallback(sortByUpdated(cached.length ? cached : ARTICLES))
}

/** 异步刷新：云端失败时返回当前可用列表 */
export async function refreshArticleList(force) {
	void force
	try {
		// 云端单次最多 100 条，这里按 hasMore 翻页，避免文章多了以后新的被挤掉
		const all = []
		let skip = 0
		for (let page = 0; page < 5; page++) {
			const res = await api.listArticles({ limit: 100, skip })
			const list = (res && res.list) || []
			all.push(...list)
			if (!res || !res.hasMore || !list.length) break
			skip += list.length
		}
		if (all.length) {
			const sorted = sortByUpdated(all)
			setCachedArticleList(sorted)
			return withBodyFallback(sorted)
		}
	} catch (error) {
		// 离线或后端未部署：保持现有内容
		console.warn('[articles] 云端同步失败，使用本地缓存', error)
	}
	return getArticleList()
}

/** 分类从当前文章集合里算，避免写死 */
export function articleCategories(list) {
	const source = Array.isArray(list) && list.length ? list : getArticleList()
	return ['全部'].concat(Array.from(new Set(source.map(item => item.category).filter(Boolean))))
}

/** 详情：先给本地能拿到的，再拉云端 */
export function getArticleSync(id) {
	const detail = getCachedArticleDetail(id)
	if (detail) return detail
	const item = getArticleList().find(article => article.id === id)
	return item ? Object.assign({}, item, { body: item.body || [] }) : null
}

export async function loadArticle(id) {
	const local = getArticleSync(id)
	if (local && local.body && local.body.length) {
		// 有本地全文时后台静默更新
		try {
			const res = await api.getArticle({ id })
			if (res && res.article) {
				setCachedArticleDetail(res.article)
				return res.article
			}
		} catch (error) {
			return local
		}
	}

	try {
		const res = await api.getArticle({ id })
		if (res && res.article) {
			setCachedArticleDetail(res.article)
			return res.article
		}
	} catch (error) {
		// 离线或文章已下架
	}
	return local
}
