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

/** 同步读取：缓存优先，其次内置 */
export function getArticleList() {
	const cached = getCachedArticleList()
	return cached.length ? withBodyFallback(cached) : ARTICLES
}

/** 异步刷新：云端失败时返回当前可用列表 */
export async function refreshArticleList(force) {
	void force
	try {
		const res = await api.listArticles({ limit: 100 })
		const list = (res && res.list) || []
		if (list.length) {
			setCachedArticleList(list)
			return withBodyFallback(list)
		}
	} catch (error) {
		// 离线或后端未部署：保持现有内容
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
