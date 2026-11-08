import { store as userStore } from '@/uni_modules/uni-id-pages/common/store.js'
import { getAnonId } from '@/common/store.js'

const co = uniCloud.importObject('huanhuan-co', { customUI: true })

const LOGIN_CODES = [
	'HUAN_LOGIN_REQUIRED',
	'uni-id-token-expired',
	'uni-id-check-token-failed',
	'uni-id-permission-error'
]

function wrapError(error) {
	const raw = error || {}
	const errCode = raw.errCode || (raw.error && raw.error.errCode) || raw.code
	const errMsg = raw.errMsg || (raw.error && raw.error.errMsg) || raw.message || '网络开小差了，稍后再试'

	if (LOGIN_CODES.includes(errCode)) {
		return { code: 'NEED_LOGIN', message: '登录之后才能继续', raw }
	}

	const network = !errCode && /fail|timeout|network|断网|超时|Network/i.test(errMsg)
	return {
		code: network ? 'NETWORK' : (errCode || 'UNKNOWN'),
		message: errMsg,
		raw
	}
}

async function call(method, params) {
	try {
		const payload = Object.assign({ anonId: getAnonId() }, params || {})
		return await co[method](payload)
	} catch (error) {
		throw wrapError(error)
	}
}

export function isLoggedIn() {
	if (userStore.hasLogin) return true
	return !!uni.getStorageSync('uni_id_token')
}

export function goLogin(redirect) {
	const suffix = redirect ? '?uniIdRedirectUrl=' + encodeURIComponent(redirect) : ''
	uni.navigateTo({
		url: '/uni_modules/uni-id-pages/pages/login/login-withoutpwd' + suffix
	})
}

export function requireLogin() {
	if (isLoggedIn()) return true
	uni.showToast({ title: '登录之后才能继续', icon: 'none' })
	setTimeout(() => goLogin(), 400)
	return false
}

export function isNetworkError(error) {
	return !!error && error.code === 'NETWORK'
}

export const api = {
	listPosts(params) {
		return call('listPosts', params)
	},
	getPost(params) {
		return call('getPost', params)
	},
	listArticles(params) {
		return call('listArticles', params)
	},
	getArticle(params) {
		return call('getArticle', params)
	},
	createPost(params) {
		return call('createPost', params)
	},
	hug(params) {
		return call('hug', params)
	},
	echo(params) {
		return call('echo', params)
	},
	deletePost(params) {
		return call('deletePost', params)
	},
	reportPost(params) {
		return call('reportPost', params)
	},
	myPosts(params) {
		return call('myPosts', params)
	},
	myStats() {
		return call('myStats', {})
	}
}
