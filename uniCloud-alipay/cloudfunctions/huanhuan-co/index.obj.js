const uniIdCommon = require('uni-id-common')

const MOODS = ['anxious', 'low', 'sleep', 'friction', 'social', 'tired']

const BLOCKED_WORDS = [
	'加微信', '加qq', '加v', '代开发票', '色情', '赌博', '博彩',
	'贷款', '办证', '刷单', '返利', '约炮', '裸聊', '招嫖',
	'出售账号', '出售资料', '私聊我买'
]

const CRISIS_PATTERNS = [
	/自杀/, /自残/, /自伤/, /轻生/, /不想活/, /活不下去/,
	/结束(自己|生命)/, /跳(楼|桥|河)/, /想死(?!你)/, /死了算了/, /活着没(有)?意思/
]

const REPORT_REASONS = {
	spam: '广告或引流',
	harm: '伤害性内容',
	abuse: '辱骂或攻击',
	other: '其他'
}

function detectCrisis(text) {
	return CRISIS_PATTERNS.some(pattern => pattern.test(String(text || '')))
}

function containsBlocked(text) {
	const value = String(text || '')
	return BLOCKED_WORDS.some(word => value.includes(word))
}

function toMillis(value) {
	if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0
	if (value instanceof Date) {
		const ts = value.getTime()
		return Number.isFinite(ts) ? ts : 0
	}
	if (typeof value === 'string') {
		const num = Number(value)
		if (Number.isFinite(num) && num > 0) return num
		const parsed = Date.parse(value)
		return Number.isFinite(parsed) ? parsed : 0
	}
	if (value && typeof value === 'object') {
		if (typeof value.getTime === 'function') {
			const ts = value.getTime()
			if (Number.isFinite(ts)) return ts
		}
		if (value.$date !== undefined) return toMillis(value.$date)
		if (value.value !== undefined) return toMillis(value.value)
	}
	return 0
}

function createError(errCode, errMsg) {
	const error = new Error(errMsg)
	error.errCode = errCode
	error.errMsg = errMsg
	return error
}

function isDuplicate(error) {
	const message = String((error && (error.message || error.errMsg)) || '')
	return /duplicate|E11000/i.test(message)
}

async function resolveUid(ctx, required = true) {
	const token = ctx.getUniIdToken()
	if (!token) {
		if (!required) return ''
		throw createError('HUAN_LOGIN_REQUIRED', '请先登录')
	}
	try {
		const payload = await ctx.uniId.checkToken(token)
		if (payload.errCode) {
			if (!required) return ''
			throw createError(payload.errCode, payload.errMsg || '请先登录')
		}
		return payload.uid
	} catch (error) {
		if (!required) return ''
		throw createError(error && error.errCode, (error && (error.errMsg || error.message)) || '请先登录')
	}
}

/**
 * 管理员校验：必须是已登录、且 uni-id 角色里带 admin 的账号
 * 角色在 uni-id-users.role 里配置（HBuilderX → uniCloud → 用户管理）
 */
async function resolveAdmin(ctx) {
	const token = ctx.getUniIdToken()
	if (!token) throw createError('HUAN_LOGIN_REQUIRED', '请先登录')

	const payload = await ctx.uniId.checkToken(token)
	if (payload.errCode) {
		throw createError(payload.errCode, payload.errMsg || '请先登录')
	}

	const roles = Array.isArray(payload.role) ? payload.role : []
	if (!roles.includes('admin')) {
		throw createError('HUAN_FORBIDDEN', '没有管理权限')
	}
	return payload.uid
}

function normalizeAnonId(value) {
	const anonId = String(value || '').trim()
	return /^[A-Za-z0-9_-]{8,64}$/.test(anonId) ? anonId : ''
}

/** 自定义情绪标签：去掉空白与控制字符，最多 6 个字 */
function normalizeMoodLabel(value) {
	const text = String(value || '')
		.replace(/[\u0000-\u001F\u007F]/g, '')
		.replace(/\s+/g, '')
		.trim()
	return text.slice(0, 6)
}

function pick(post, uid, anonId) {
	const mineByAccount = !!uid && post.user_id === uid
	const mineByDevice = !!anonId && post.anon_id === anonId
	return {
		id: post._id,
		mood: post.mood,
		moodLabel: post.mood_label || '',
		text: post.text,
		at: toMillis(post.at),
		hugCount: post.hug_count || 0,
		echoCount: post.echo_count || 0,
		isMine: mineByAccount || mineByDevice,
		hugged: false,
		reviewing: post.status === 'reviewing'
	}
}

function pickArticle(row) {
	return {
		id: row._id,
		title: row.title,
		category: row.category,
		source: row.source || '',
		summary: row.summary || '',
		body: Array.isArray(row.body) ? row.body : [],
		url: row.url || '',
		minutes: row.minutes || 3,
		status: row.status,
		sort: row.sort || 0,
		at: toMillis(row.at),
		createdAt: row.created_at ? toMillis(row.created_at) : 0,
		updatedAt: row.updated_at ? toMillis(row.updated_at) : 0
	}
}

async function isAdmin(ctx) {
	try {
		await resolveAdmin(ctx)
		return true
	} catch (error) {
		return false
	}
}

function normalizeArticle(input) {
	const title = String((input && input.title) || '').trim()
	if (!title) throw createError('HUAN_EMPTY', '标题不能为空')
	if (title.length > 100) throw createError('HUAN_TOO_LONG', '标题最多 100 字')

	const category = String((input && input.category) || '').trim().slice(0, 20) || '未分类'
	const source = String((input && input.source) || '').trim().slice(0, 40) || '编辑部'
	const summary = String((input && input.summary) || '').trim().slice(0, 200)

	const bodyInput = Array.isArray(input && input.body) ? input.body : []
	const body = bodyInput
		.map(item => String(item || '').trim())
		.filter(Boolean)
		.slice(0, 50)
		.map(item => item.slice(0, 2000))
	if (!body.length) throw createError('HUAN_EMPTY', '正文至少写一段')

	const url = String((input && input.url) || '').trim().slice(0, 500)
	const status = ['published', 'draft', 'hidden'].includes(input && input.status)
		? input.status
		: 'draft'
	const minutes = Math.min(Math.max(Number(input && input.minutes) || 3, 1), 120)
	const sort = Math.min(Math.max(Number(input && input.sort) || 0, 0), 99999)
	const at = Number(input && input.at) || Date.now()

	return { title, category, source, summary, body, url, status, minutes, sort, at }
}

async function decorate(ctx, rows, uid, anonId) {
	if (!rows.length) return []
	let hugged = []
	if (uid) {
		const res = await ctx.echoes
			.where({
				post_id: ctx.db.command.in(rows.map(item => item._id)),
				user_id: uid,
				kind: 'hug'
			})
			.field({ post_id: true })
			.limit(1000)
			.get()
		hugged = res.data.map(item => item.post_id)
	}
	return rows.map(post => {
		const item = pick(post, uid, anonId)
		item.hugged = hugged.includes(post._id)
		return item
	})
}

async function findPost(ctx, id) {
	if (!id || typeof id !== 'string') return null
	try {
		const res = await ctx.posts.doc(id).get()
		return (res.data && res.data[0]) || null
	} catch (e) {
		return null
	}
}

module.exports = {
	_before() {
		this.db = uniCloud.database()
		this.posts = this.db.collection('huanhuan-posts')
		this.echoes = this.db.collection('huanhuan-echoes')
		this.reports = this.db.collection('huanhuan-reports')
		this.articles = this.db.collection('huanhuan-articles')
		this.uniId = uniIdCommon.createInstance({
			clientInfo: this.getClientInfo()
		})
	},

	async listPosts({ mood, cursor, limit = 20, anonId } = {}) {
		const uid = await resolveUid(this, false)
		const anon = normalizeAnonId(anonId)
		const size = Math.min(Math.max(Number(limit) || 20, 1), 30)
		const query = { status: 'published' }
		if (mood && mood !== 'all' && MOODS.includes(mood)) query.mood = mood
		if (cursor) query.at = this.db.command.lt(Number(cursor))

		const res = await this.posts
			.where(query)
			.orderBy('at', 'desc')
			.limit(size + 1)
			.get()

		const rows = res.data.slice(0, size)
		const list = await decorate(this, rows, uid, anon)
		return {
			list,
			hasMore: res.data.length > size,
			cursor: list.length ? list[list.length - 1].at : 0
		}
	},

	async getPost({ id, anonId } = {}) {
		const uid = await resolveUid(this, false)
		const anon = normalizeAnonId(anonId)
		const post = await findPost(this, id)
		if (!post || post.status === 'hidden') {
			throw createError('HUAN_NOT_FOUND', '这条已经不在了')
		}

		const mineByAccount = !!uid && post.user_id === uid
		const mineByDevice = !!anon && post.anon_id === anon
		const isMine = mineByAccount || mineByDevice
		if (post.status === 'reviewing' && !isMine) {
			throw createError('HUAN_NOT_FOUND', '这条已经不在了')
		}

		const item = pick(post, uid, anon)
		if (uid) {
			const count = await this.echoes.where({
				post_id: id,
				user_id: uid,
				kind: 'hug'
			}).count()
			item.hugged = count.total > 0
		}

		const echoRes = await this.echoes
			.where({ post_id: id, kind: 'word' })
			.orderBy('at', 'asc')
			.limit(100)
			.get()

		const echoes = echoRes.data.map(echo => ({
			text: echo.text,
			at: toMillis(echo.at),
			mine: !!uid && echo.user_id === uid
		}))

		return { post: item, echoes }
	},

	async listArticles({ category = '', limit = 50, skip = 0 } = {}) {
		const size = Math.min(Math.max(Number(limit) || 50, 1), 100)
		const offset = Math.max(Number(skip) || 0, 0)

		const query = { status: 'published' }
		if (category) query.category = String(category).slice(0, 20)

		const totalRes = await this.articles.where(query).count()
		const res = await this.articles
			.where(query)
			.orderBy('updated_at', 'desc')
			.orderBy('at', 'desc')
			.skip(offset)
			.limit(size)
			.get()

		const rows = res.data || []
		return {
			list: rows.map(row => {
				const article = pickArticle(row)
				// 列表不返回正文，减少传输
				delete article.body
				return article
			}),
			total: totalRes.total || 0,
			hasMore: offset + rows.length < (totalRes.total || 0)
		}
	},

	async getArticle({ id } = {}) {
		if (!id || typeof id !== 'string') throw createError('HUAN_NOT_FOUND', '文章不存在')
		let row = null
		try {
			const res = await this.articles.doc(id).get()
			row = (res.data && res.data[0]) || null
		} catch (e) {
			row = null
		}
		if (!row) throw createError('HUAN_NOT_FOUND', '文章不存在')

		if (row.status !== 'published') {
			const admin = await isAdmin(this)
			if (!admin) throw createError('HUAN_NOT_FOUND', '文章不存在')
		}
		return { article: pickArticle(row) }
	},

	async createPost({ mood, text, anonId, moodLabel } = {}) {
		const uid = await resolveUid(this, false)
		const anon = normalizeAnonId(anonId)
		if (!uid && !anon) {
			throw createError('HUAN_LOGIN_REQUIRED', '请先登录')
		}
		if (!MOODS.includes(mood)) {
			throw createError('HUAN_INVALID_MOOD', '选一个情绪再发吧')
		}
		const label = normalizeMoodLabel(moodLabel)
		const value = String(text || '').trim()
		if (!value) throw createError('HUAN_EMPTY', '先写一句吧')
		if (value.length > 500) throw createError('HUAN_TOO_LONG', '最多 500 字')

		// 频率限制：登录用户和本机匿名牌一视同仁
		const since = Date.now() - 60 * 1000
		const recentWhere = {
			status: this.db.command.in(['published', 'reviewing']),
			at: this.db.command.gt(since)
		}
		if (uid) recentWhere.user_id = uid
		else recentWhere.anon_id = anon

		const recent = await this.posts.where(recentWhere).count()
		if (recent.total > 0) {
			throw createError('HUAN_TOO_FREQUENT', '慢一点，一分钟后再试')
		}

		const status = containsBlocked(value) ? 'reviewing' : 'published'
		const at = Date.now()
		const data = {
			mood,
			mood_label: label,
			text: value,
			user_id: uid || '',
			anon_id: anon,
			at,
			status,
			hug_count: 0,
			echo_count: 0,
			report_count: 0,
			risk: detectCrisis(value)
		}

		const res = await this.posts.add(data)
		return {
			post: {
				id: res.id,
				mood,
				moodLabel: label,
				text: value,
				at,
				hugCount: 0,
				echoCount: 0,
				isMine: true,
				hugged: false,
				reviewing: status === 'reviewing'
			}
		}
	},

	async hug({ postId } = {}) {
		const uid = await resolveUid(this)
		const post = await findPost(this, postId)
		if (!post || post.status !== 'published') {
			throw createError('HUAN_NOT_FOUND', '这条已经不在了')
		}

		// 先查一次：已经抱过就直接返回，不依赖数据库重复键的报错文案
		const existed = await this.echoes.where({
			post_id: postId,
			user_id: uid,
			kind: 'hug'
		}).limit(1).get()
		if (existed && existed.data && existed.data.length) {
			return { ok: false, message: '已经抱过啦', hugCount: post.hug_count || 0 }
		}

		// 固定 _id = 帖子 + 用户：并发下由主键兜底，天然幂等
		try {
			await this.echoes.add({
				_id: postId + '_' + uid,
				post_id: postId,
				user_id: uid,
				kind: 'hug',
				at: Date.now()
			})
		} catch (error) {
			if (isDuplicate(error)) {
				return { ok: false, message: '已经抱过啦', hugCount: post.hug_count || 0 }
			}
			// 并发下重复写入也可能报别的错，再查一次确认
			const again = await this.echoes.where({
				post_id: postId,
				user_id: uid,
				kind: 'hug'
			}).limit(1).get()
			if (again && again.data && again.data.length) {
				return { ok: false, message: '已经抱过啦', hugCount: post.hug_count || 0 }
			}
			throw error
		}

		await this.posts.doc(postId).update({
			hug_count: this.db.command.inc(1)
		})

		return { ok: true, hugCount: (post.hug_count || 0) + 1 }
	},

	async echo({ postId, text } = {}) {
		const uid = await resolveUid(this)
		const value = String(text || '').trim()
		if (!value) throw createError('HUAN_EMPTY', '写一句再送出吧')
		if (value.length > 40) throw createError('HUAN_TOO_LONG', '最多 40 字')
		if (containsBlocked(value)) {
			throw createError('HUAN_BLOCKED', '换一种说法试试')
		}

		const post = await findPost(this, postId)
		if (!post || post.status !== 'published') {
			throw createError('HUAN_NOT_FOUND', '这条已经不在了')
		}

		// 同一个人对同一条 20 秒内只留一句，避免刷屏
		const since = Date.now() - 20 * 1000
		const recent = await this.echoes.where({
			post_id: postId,
			user_id: uid,
			kind: 'word',
			at: this.db.command.gt(since)
		}).count()
		if (recent.total > 0) {
			throw createError('HUAN_TOO_FREQUENT', '同一句慢慢说，等一下再发')
		}

		const at = Date.now()
		await this.echoes.add({
			post_id: postId,
			user_id: uid,
			kind: 'word',
			text: value,
			at
		})
		await this.posts.doc(postId).update({
			echo_count: this.db.command.inc(1)
		})

		return {
			ok: true,
			echo: { text: value, at, mine: true },
			echoCount: (post.echo_count || 0) + 1
		}
	},

	async deletePost({ postId, anonId } = {}) {
		const uid = await resolveUid(this, false)
		const anon = normalizeAnonId(anonId)
		if (!uid && !anon) throw createError('HUAN_LOGIN_REQUIRED', '请先登录')
		const post = await findPost(this, postId)
		if (!post) throw createError('HUAN_NOT_FOUND', '这条已经不在了')
		const mineByAccount = !!uid && post.user_id === uid
		const mineByDevice = !!anon && post.anon_id === anon
		if (!mineByAccount && !mineByDevice) {
			throw createError('HUAN_FORBIDDEN', '只能删除自己写的')
		}
		await this.posts.doc(postId).update({ status: 'hidden' })
		return { ok: true }
	},

	async reportPost({ postId, reason } = {}) {
		const uid = await resolveUid(this)
		const post = await findPost(this, postId)
		if (!post || post.status === 'hidden') {
			throw createError('HUAN_NOT_FOUND', '这条已经不在了')
		}

		const exist = await this.reports.where({
			post_id: postId,
			user_id: uid
		}).count()
		if (exist.total > 0) {
			return { ok: false, message: '已经举报过了' }
		}

		try {
			await this.reports.add({
				post_id: postId,
				user_id: uid,
				reason: REPORT_REASONS[reason] || REPORT_REASONS.other,
				at: Date.now()
			})
		} catch (error) {
			// 并发下由 post_user 唯一索引兜底
			if (isDuplicate(error)) return { ok: false, message: '已经举报过了' }
			throw error
		}

		// 计数用 inc，避免并发举报互相覆盖
		await this.posts.doc(postId).update({
			report_count: this.db.command.inc(1)
		})

		const fresh = await findPost(this, postId)
		if (fresh && (fresh.report_count || 0) >= 3 && fresh.status === 'published') {
			await this.posts.doc(postId).update({ status: 'reviewing' })
		}

		return { ok: true, message: '已收到，谢谢你' }
	},

	async myPosts({ cursor, limit = 20, anonId } = {}) {
		const uid = await resolveUid(this, false)
		const anon = normalizeAnonId(anonId)
		const conditions = []
		if (uid) conditions.push({ user_id: uid })
		if (anon) conditions.push({ anon_id: anon })
		if (!conditions.length) return { list: [], hasMore: false, cursor: 0 }

		const size = Math.min(Math.max(Number(limit) || 20, 1), 30)
		const filters = [
			this.db.command.or(conditions),
			{ status: this.db.command.in(['published', 'reviewing']) }
		]
		if (cursor) filters.push({ at: this.db.command.lt(Number(cursor)) })

		const res = await this.posts
			.where(this.db.command.and(filters))
			.orderBy('at', 'desc')
			.limit(size + 1)
			.get()

		const rows = res.data.slice(0, size)
		const list = await decorate(this, rows, uid, anon)
		return {
			list,
			hasMore: res.data.length > size,
			cursor: list.length ? list[list.length - 1].at : 0
		}
	},

	async myStats({ anonId } = {}) {
		const uid = await resolveUid(this, false)
		const anon = normalizeAnonId(anonId)
		const conditions = []
		if (uid) conditions.push({ user_id: uid })
		if (anon) conditions.push({ anon_id: anon })
		if (!conditions.length) return { posts: 0, hugs: 0 }

		const postsRes = await this.posts
			.where(this.db.command.and([
				this.db.command.or(conditions),
				{ status: this.db.command.in(['published', 'reviewing']) }
			]))
			.field({ hug_count: true })
			.limit(1000)
			.get()

		const hugs = postsRes.data.reduce((total, item) => total + (item.hug_count || 0), 0)
		return {
			posts: postsRes.data.length,
			hugs
		}
	},

	/* ------------------------- 管理端（需 admin 角色） ------------------------- */

	/**
	 * 审核队列
	 * @param {string} status all | reviewing | published | hidden
	 * @param {string} mood   情绪筛选，空为全部
	 * @param {number} skip   偏移量（后台分页）
	 * @param {number} limit  每页条数 1-50
	 */
	async adminListQueue({ status = 'reviewing', mood = '', skip = 0, limit = 20 } = {}) {
		await resolveAdmin(this)
		const size = Math.min(Math.max(Number(limit) || 20, 1), 50)
		const offset = Math.max(Number(skip) || 0, 0)

		const query = {}
		if (status && status !== 'all') {
			query.status = ['reviewing', 'published', 'hidden'].includes(status) ? status : 'reviewing'
		}
		if (mood && MOODS.includes(mood)) query.mood = mood

		const totalRes = await this.posts.where(query).count()
		const res = await this.posts
			.where(query)
			.orderBy('at', 'desc')
			.skip(offset)
			.limit(size)
			.get()

		const rows = res.data || []
		return {
			list: rows.map(post => ({
				id: post._id,
				mood: post.mood,
				text: post.text,
				at: toMillis(post.at),
				status: post.status,
				reportCount: post.report_count || 0,
				hugCount: post.hug_count || 0,
				echoCount: post.echo_count || 0,
				risk: !!post.risk,
				moderatedAt: post.moderated_at ? toMillis(post.moderated_at) : 0
			})),
			total: totalRes.total || 0,
			hasMore: offset + rows.length < (totalRes.total || 0)
		}
	},

	/**
	 * 后台查看单条（可见 hidden，带回应与举报）
	 */
	async adminGetPost({ postId } = {}) {
		await resolveAdmin(this)
		const post = await findPost(this, postId)
		if (!post) throw createError('HUAN_NOT_FOUND', '这条已经不在了')

		const echoRes = await this.echoes
			.where({ post_id: postId, kind: 'word' })
			.orderBy('at', 'asc')
			.limit(200)
			.get()
		const reportRes = await this.reports
			.where({ post_id: postId })
			.orderBy('at', 'desc')
			.limit(100)
			.get()

		return {
			post: {
				id: post._id,
				mood: post.mood,
				text: post.text,
				at: toMillis(post.at),
				status: post.status,
				hugCount: post.hug_count || 0,
				echoCount: post.echo_count || 0,
				reportCount: post.report_count || 0,
				risk: !!post.risk,
				moderatedAt: post.moderated_at ? toMillis(post.moderated_at) : 0,
				author: post.user_id || post.anon_id || ''
			},
			echoes: (echoRes.data || []).map(echo => ({
				text: echo.text,
				at: toMillis(echo.at),
				author: echo.user_id || ''
			})),
			reports: (reportRes.data || []).map(item => ({
				reason: item.reason,
				at: toMillis(item.at),
				reporter: item.user_id || ''
			}))
		}
	},

	/**
	 * 审核动作
	 * @param {string} action publish（放行）| hide（下架）| review（转人工）
	 */
	async adminModerate({ postId, action } = {}) {
		const adminId = await resolveAdmin(this)
		const statusMap = { publish: 'published', hide: 'hidden', review: 'reviewing' }
		const status = statusMap[action]
		if (!status) throw createError('HUAN_INVALID_ACTION', '动作不对')

		const post = await findPost(this, postId)
		if (!post) throw createError('HUAN_NOT_FOUND', '这条已经不在了')

		const update = {
			status,
			moderated_by: adminId,
			moderated_at: Date.now()
		}
		// 放行时清空举报计数，之后需要重新攒够 3 次才会再进审核
		if (status === 'published') update.report_count = 0

		await this.posts.doc(postId).update(update)
		return { ok: true, status }
	},

	/**
	 * 举报记录（可按帖子过滤）
	 */
	async adminListReports({ postId, skip = 0, limit = 50 } = {}) {
		await resolveAdmin(this)
		const size = Math.min(Math.max(Number(limit) || 50, 1), 100)
		const offset = Math.max(Number(skip) || 0, 0)

		const query = {}
		if (postId) query.post_id = postId

		const totalRes = await this.reports.where(query).count()
		const res = await this.reports
			.where(query)
			.orderBy('at', 'desc')
			.skip(offset)
			.limit(size)
			.get()

		const rows = res.data || []
		return {
			list: rows.map(item => ({
				id: item._id,
				postId: item.post_id,
				reason: item.reason,
				at: toMillis(item.at),
				reporter: item.user_id
			})),
			total: totalRes.total || 0,
			hasMore: offset + rows.length < (totalRes.total || 0)
		}
	},

	/* ------------------------- 文章管理（需 admin 角色） ------------------------- */

	async adminListArticles({ status = '', skip = 0, limit = 20 } = {}) {
		await resolveAdmin(this)
		const size = Math.min(Math.max(Number(limit) || 20, 1), 100)
		const offset = Math.max(Number(skip) || 0, 0)

		const query = {}
		if (status && status !== 'all') {
			query.status = ['published', 'draft', 'hidden'].includes(status) ? status : 'draft'
		}

		const totalRes = await this.articles.where(query).count()
		const res = await this.articles
			.where(query)
			.orderBy('updated_at', 'desc')
			.orderBy('created_at', 'desc')
			.skip(offset)
			.limit(size)
			.get()

		const rows = res.data || []
		return {
			list: rows.map(row => {
				const article = pickArticle(row)
				article.bodyCount = article.body.length
				delete article.body
				return article
			}),
			total: totalRes.total || 0,
			hasMore: offset + rows.length < (totalRes.total || 0)
		}
	},

	async adminGetArticle({ id } = {}) {
		await resolveAdmin(this)
		if (!id) throw createError('HUAN_NOT_FOUND', '文章不存在')
		const res = await this.articles.doc(id).get()
		const row = (res.data && res.data[0]) || null
		if (!row) throw createError('HUAN_NOT_FOUND', '文章不存在')
		return { article: pickArticle(row) }
	},

	async adminSaveArticle(input = {}) {
		const adminId = await resolveAdmin(this)
		const data = normalizeArticle(input)
		const now = Date.now()

		if (input.id) {
			const res = await this.articles.doc(input.id).get()
			const exist = (res.data && res.data[0]) || null
			if (!exist) throw createError('HUAN_NOT_FOUND', '文章不存在')
			const patch = Object.assign({}, data, {
				updated_at: now,
				updated_by: adminId
			})
			// 编辑时没传 at 就保留原来的发布时间
			if (!input.at) delete patch.at
			await this.articles.doc(input.id).update(patch)
			return { ok: true, id: input.id, created: false }
		}

		const res = await this.articles.add(Object.assign({}, data, {
			created_at: now,
			updated_at: now,
			created_by: adminId
		}))
		return { ok: true, id: res.id, created: true }
	},

	async adminDeleteArticle({ id } = {}) {
		await resolveAdmin(this)
		if (!id) throw createError('HUAN_NOT_FOUND', '文章不存在')
		await this.articles.doc(id).remove()
		return { ok: true }
	},

	async adminSetArticleStatus({ id, status } = {}) {
		await resolveAdmin(this)
		if (!id) throw createError('HUAN_NOT_FOUND', '文章不存在')
		if (!['published', 'draft', 'hidden'].includes(status)) {
			throw createError('HUAN_INVALID_ACTION', '状态不对')
		}
		const res = await this.articles.doc(id).get()
		if (!res.data || !res.data.length) throw createError('HUAN_NOT_FOUND', '文章不存在')
		await this.articles.doc(id).update({ status, updated_at: Date.now() })
		return { ok: true, status }
	},

	/**
	 * 一次性导入内置文章（已存在同 id 的跳过）
	 */
	async adminSeedArticles({ articles } = {}) {
		const adminId = await resolveAdmin(this)
		const list = Array.isArray(articles) ? articles.slice(0, 200) : []
		if (!list.length) return { inserted: 0, skipped: 0 }

		let inserted = 0
		let skipped = 0

		for (let i = 0; i < list.length; i++) {
			const item = list[i]
			const data = normalizeArticle(item)
			const id = item && item.id ? String(item.id).slice(0, 64) : ''
			const now = Date.now()

			if (!id) {
				await this.articles.add(Object.assign({}, data, {
					created_at: now,
					updated_at: now,
					created_by: adminId
				}))
				inserted++
				continue
			}

			const existRes = await this.articles.doc(id).get()
			if (existRes.data && existRes.data.length) {
				skipped++
				continue
			}

			try {
				await this.articles.add(Object.assign({}, data, {
					_id: id,
					created_at: now,
					updated_at: now,
					created_by: adminId
				}))
				inserted++
			} catch (error) {
				if (isDuplicate(error)) {
					skipped++
					continue
				}
				throw error
			}
		}

		return { inserted, skipped }
	}
}
